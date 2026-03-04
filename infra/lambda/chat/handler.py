"""
FlowSync Chat Lambda Handler
Conversational AI layer on top of deterministic extraction
Uses Nova Lite (temperature=0.7) for natural multi-turn dialogue
"""

import json
import os
import boto3
import logging
from datetime import datetime, timezone
from decimal import Decimal
import uuid
from typing import Dict, List, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Clients
dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

# Environment variables
CONTEXT_TABLE = os.environ['CONTEXT_TABLE_NAME']
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE_NAME', 'flowsync-chat-sessions')
PROJECT_TABLE = os.environ['PROJECT_TABLE_NAME']

# Model Configuration - Nova Lite for cost-effective conversational AI
CHAT_MODEL_ID = "us.amazon.nova-lite-v1:0"  # 75% cheaper than Nova Pro
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"

# Session Configuration
SESSION_TTL_MINUTES = 30
MAX_HISTORY_MESSAGES = 10

# Import shared helpers (RAG pipeline, embeddings, etc.)
import sys
sys.path.insert(0, '/opt/python')
try:
    from flowsync_common.helpers import (
        call_titan_embedding,
        cosine_similarity,
        convert_decimals
    )
except ImportError:
    # Fallback: define stub functions if module not available
    def call_titan_embedding(text: str, client):
        """Stub: Generate embedding using Titan"""
        raise NotImplementedError("flowsync_common.helpers not available")
    
    def cosine_similarity(vec1: List, vec2: List) -> float:
        """Stub: Calculate cosine similarity"""
        raise NotImplementedError("flowsync_common.helpers not available")
    
    def convert_decimals(obj):
        """Stub: Convert Decimal objects"""
        return obj


def lambda_handler(event, context):
    """Main Lambda handler for chat endpoint"""
    try:
        logger.info(f"Chat request received: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        project_id = body.get('projectId') or event.get('pathParameters', {}).get('projectId')
        message = body.get('message', '').strip()
        session_id = body.get('sessionId')
        
        # Validate inputs
        if not project_id:
            return error_response(400, "projectId is required")
        if not message:
            return error_response(400, "message is required")
        
        # Get or create session
        session = get_or_create_session(project_id, session_id)
        session_id = session['sessionId']
        
        # Retrieve relevant context using RAG
        relevant_context = retrieve_relevant_context(project_id, message)
        
        # Get conversation history
        history = session.get('messages', [])[-MAX_HISTORY_MESSAGES:]
        
        # Generate conversational response
        response_data = generate_chat_response(
            project_id=project_id,
            message=message,
            context=relevant_context,
            history=history
        )
        
        # Update session with new messages
        update_session(session_id, message, response_data['reply'])
        
        # Return response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'reply': response_data['reply'],
                'sources': response_data['sources'],
                'sessionId': session_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in chat handler: {str(e)}", exc_info=True)
        return error_response(500, f"Internal server error: {str(e)}")


def get_or_create_session(project_id: str, session_id: Optional[str] = None) -> Dict:
    """Get existing session or create new one"""
    table = dynamodb.Table(SESSIONS_TABLE)
    
    if session_id:
        # Try to retrieve existing session
        try:
            response = table.get_item(Key={'sessionId': session_id})
            if 'Item' in response:
                session = response['Item']
                # Check if session belongs to this project
                if session.get('projectId') == project_id:
                    logger.info(f"Retrieved existing session: {session_id}")
                    return session
                else:
                    logger.warning(f"Session {session_id} does not belong to project {project_id}")
        except Exception as e:
            logger.warning(f"Error retrieving session: {str(e)}")
    
    # Create new session
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    session = {
        'sessionId': session_id,
        'projectId': project_id,
        'messages': [],
        'createdAt': now,
        'lastActivity': now,
        'ttl': int((datetime.now(timezone.utc).timestamp() + SESSION_TTL_MINUTES * 60))
    }
    
    try:
        table.put_item(Item=session)
        logger.info(f"Created new session: {session_id}")
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        # Continue anyway, session will be in-memory only
    
    return session


def update_session(session_id: str, user_message: str, assistant_reply: str):
    """Update session with new messages"""
    table = dynamodb.Table(SESSIONS_TABLE)
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        # Append messages to history
        table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET messages = list_append(if_not_exists(messages, :empty_list), :new_messages), lastActivity = :now, #ttl = :ttl',
            ExpressionAttributeNames={'#ttl': 'ttl'},
            ExpressionAttributeValues={
                ':new_messages': [
                    {'role': 'user', 'content': user_message, 'timestamp': now},
                    {'role': 'assistant', 'content': assistant_reply, 'timestamp': now}
                ],
                ':empty_list': [],
                ':now': now,
                ':ttl': int((datetime.now(timezone.utc).timestamp() + SESSION_TTL_MINUTES * 60))
            }
        )
        logger.info(f"Updated session {session_id} with new messages")
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        # Non-critical, continue


def retrieve_relevant_context(project_id: str, query: str) -> List[Dict]:
    """Retrieve relevant context using RAG pipeline (same as search but returns raw records)"""
    try:
        # Generate embedding for query
        query_embedding = call_titan_embedding(query, bedrock)
        
        # Fetch all context records for project
        table = dynamodb.Table(CONTEXT_TABLE)
        response = table.query(
            IndexName='ProjectContextIndex',
            KeyConditionExpression='projectId = :pk',
            ExpressionAttributeValues={':pk': project_id}
        )
        
        records = response.get('Items', [])
        if not records:
            return []
        
        # Compute similarities and attach relevance scores
        similarities = []
        for record in records:
            raw_embedding = record.get('embedding')
            if not raw_embedding:
                continue
            embedding = [float(x) for x in raw_embedding]
            if len(embedding) != 1536:
                continue
            score = cosine_similarity(query_embedding, embedding)
            record['relevance'] = score
            similarities.append((record, score))
        
        # Return top 5 results by similarity
        top_results = sorted(similarities, key=lambda x: x[1], reverse=True)[:5]
        relevant_records = [record for record, score in top_results]
        
        logger.info(f"Retrieved {len(relevant_records)} relevant context records")
        return relevant_records
        
    except Exception as e:
        logger.error(f"Error retrieving context: {str(e)}")
        return []


def generate_chat_response(project_id: str, message: str, context: List[Dict], history: List[Dict]) -> Dict:
    """Generate conversational response using Nova Lite"""
    
    # Build system prompt for conversational AI
    system_prompt = build_system_prompt(context)
    
    # Build conversation messages
    messages = []
    
    # Add conversation history
    for msg in history:
        messages.append({
            'role': msg['role'],
            'content': [{'text': msg['content']}]
        })
    
    # Add current user message
    messages.append({
        'role': 'user',
        'content': [{'text': message}]
    })
    
    # Call Nova Lite
    try:
        response = bedrock.converse(
            modelId=CHAT_MODEL_ID,
            messages=messages,
            system=[{'text': system_prompt}],
            inferenceConfig={
                'maxTokens': 2000,
                'temperature': 0.7,  # Conversational (vs 0 for deterministic extraction)
                'topP': 0.9
            }
        )
        
        # Extract reply
        reply = response['output']['message']['content'][0]['text']
        
        # Format sources for UI
        sources = format_sources(context)
        
        logger.info(f"Generated chat response: {len(reply)} chars")
        
        return {
            'reply': reply,
            'sources': sources
        }
        
    except Exception as e:
        logger.error(f"Error calling Nova Lite: {str(e)}", exc_info=True)
        return {
            'reply': "I apologize, but I encountered an error generating a response. Please try again.",
            'sources': []
        }


def build_system_prompt(context: List[Dict]) -> str:
    """Build system prompt with RAG context"""
    
    prompt = """You are an AI assistant helping developers understand their software project. You have access to the project's development history, including commits, features implemented, decisions made, and current status.

Your capabilities:
- Answer questions about project history, features, and decisions
- Provide code suggestions based on project patterns
- Break down complex features into actionable development tasks
- Explain technical decisions and their context
- Help developers understand what was done and why

Guidelines:
- Be conversational and helpful
- Base your answers on the provided context
- Cite sources when referencing specific events or decisions
- If you don't have enough context, say so clearly
- When suggesting code, follow patterns from the project
- When breaking down tasks, consider the project's current stage and patterns

"""
    
    # Add retrieved context
    if context:
        prompt += "\n## Retrieved Project Context:\n\n"
        for i, record in enumerate(context, 1):
            prompt += f"### Context {i} (Relevance: {record.get('relevance', 0):.2f})\n"
            prompt += f"- **Event**: {record.get('branch', 'unknown')} @ {record.get('timestamp', 'unknown')}\n"
            prompt += f"- **Feature**: {record.get('feature', 'N/A')}\n"
            prompt += f"- **Stage**: {record.get('stage', 'N/A')}\n"
            prompt += f"- **Decision**: {record.get('decision', 'N/A')}\n"
            if record.get('tasks'):
                prompt += f"- **Tasks**: {record.get('tasks')}\n"
            if record.get('entities'):
                prompt += f"- **Changed**: {', '.join(record.get('entities', []))}\n"
            prompt += f"- **Event ID**: {record.get('eventId', 'unknown')}\n\n"
    else:
        prompt += "\n(No specific context retrieved for this query. Provide general guidance.)\n"
    
    return prompt


def format_sources(context: List[Dict]) -> List[Dict]:
    """Format context records as source citations for UI"""
    sources = []
    for record in context:
        feature = record.get('feature') or 'N/A'
        decision = record.get('decision') or 'N/A'
        sources.append({
            'eventId': record.get('eventId'),
            'contextId': record.get('contextId'),
            'branch': record.get('branch'),
            'timestamp': record.get('timestamp'),
            'feature': feature,
            'stage': record.get('stage'),
            'relevance': float(record.get('relevance', 0)),
            'snippet': f"{feature} - {decision[:100]}..."
        })
    return sources


def error_response(status_code: int, message: str) -> Dict:
    """Format error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': message})
    }
