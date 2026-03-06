"""
FlowSync Chat Lambda Handler - MCP-Style Architecture
Hybrid AI layer combining Nova Pro RAG (factual) and Nova Lite (conversational)

Architecture:
1. Pre-filter: Skip RAG for obvious conversational queries (regex patterns)
2. Try Nova Pro RAG for remaining queries (factual grounding)
3. Post-validate: Reject mismatched RAG answers (e.g. technical dump for "Thanks!")
4. Fall back to Nova Lite for conversational responses with session history
"""

import json
import os
import boto3
import logging
from datetime import datetime, timezone
from decimal import Decimal
import uuid
import re
from typing import Dict, List, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Clients with Bedrock adaptive retry — handles ThrottlingException (429) automatically
from botocore.config import Config as BotoConfig
_bedrock_retry_config = BotoConfig(retries={'max_attempts': 3, 'mode': 'adaptive'})
dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1', config=_bedrock_retry_config)

# Environment variables
CONTEXT_TABLE = os.environ['CONTEXT_TABLE_NAME']
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE_NAME', 'flowsync-chat-sessions')
PROJECT_TABLE = os.environ['PROJECT_TABLE_NAME']
CACHE_TABLE = os.environ.get('CACHE_TABLE_NAME', '')

# Model Configuration - Nova Lite for cost-effective conversational AI
CHAT_MODEL_ID = "us.amazon.nova-lite-v1:0"  # 75% cheaper than Nova Pro
RAG_MODEL_ID = "us.amazon.nova-pro-v1:0"  # Nova Pro for RAG grounding
RAG_FALLBACK_MODEL_ID = "us.amazon.nova-lite-v1:0"  # Fallback on throttle
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1"  # Using v1 for compatibility with existing embeddings

# Session Configuration
SESSION_TTL_MINUTES = 30
MAX_HISTORY_MESSAGES = 10

# Intent Detection Patterns
# NOTE: These patterns are checked AFTER lowercasing. Use re.IGNORECASE for safety.
# Patterns must NOT over-match queries that start social but contain factual asks.
SOCIAL_PATTERNS = [
    r'^(hi|hello|hey|thanks|thank you|ty|okay|ok|got it|cool|nice|great|awesome|perfect)[!.,?\s]*$',
    r'^(doing (great|well|good)|how are you|nice to meet)[!.,?\s]*$',
    r'^(that\'?s? (interesting|helpful|great|good|nice)|i (appreciate|understand|see))[!.,?\s]*$',
    r'(you\'?re? (doing )?(great|well|good|awesome)|good (job|work))[!.,?\s]*$',
]

ACKNOWLEDGMENT_PATTERNS = [
    r'^(got it|okay|ok|i see|understood|makes sense)$',
    r'^(that helps|that makes sense|i understand)\b',
]

INTRODUCTION_PATTERNS = [
    r'^my name is [a-zA-Z]+[!.,?\s]*$',
    r'^(i\'m|i am) (a |an )[a-zA-Z\s]+$',
]

MEMORY_PATTERNS = [
    r'do you (remember|recall|know) (what|my|that)',
    r'(remember|recall) (what|when|that) (i|you)',
]

# Import shared helpers (embeddings, etc.)
import sys
import math
sys.path.insert(0, '/opt/python')
try:
    from flowsync_common.helpers import (
        call_titan_embedding,
        cosine_similarity,
        convert_decimals
    )
    HELPERS_AVAILABLE = True
except ImportError:
    HELPERS_AVAILABLE = False
    # Fallback: define functions if module not available
    def call_titan_embedding(text: str, client):
        """Generate embedding using Titan"""
        response = client.invoke_model(
            modelId=EMBEDDING_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": text})
        )
        result = json.loads(response["body"].read())
        embedding = result.get("embedding")
        if not embedding or len(embedding) != 1536:
            raise ValueError("Titan embedding output shape invalid.")
        return embedding
    
    def cosine_similarity(vec_a: List, vec_b: List) -> float:
        """Calculate cosine similarity between two vectors"""
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)
    
    def convert_decimals(obj):
        """Convert Decimal objects to int/float for JSON serialization"""
        if isinstance(obj, list):
            return [convert_decimals(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: convert_decimals(value) for key, value in obj.items()}
        elif isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        else:
            return obj


# ============================================================================
# INTENT DETECTION - Pre-filter before RAG
# ============================================================================

def should_skip_rag(query: str) -> tuple[bool, Optional[str]]:
    """
    Fast pattern-based check if query is clearly conversational.
    Returns: (should_skip, reason)
    """
    q = query.lower().strip()
    
    # Check very short queries (likely social)
    if len(q) < 8:
        return True, "too_short"
    
    # Social/acknowledgment patterns
    for pattern in SOCIAL_PATTERNS:
        if re.search(pattern, q, re.IGNORECASE):
            return True, "social"
    
    # Simple acknowledgments
    for pattern in ACKNOWLEDGMENT_PATTERNS:
        if re.search(pattern, q, re.IGNORECASE):
            return True, "acknowledgment"
    
    # Introduction (name, role)
    for pattern in INTRODUCTION_PATTERNS:
        if re.search(pattern, q, re.IGNORECASE):
            return True, "introduction"
    
    # Memory/context questions (conversational)
    for pattern in MEMORY_PATTERNS:
        if re.search(pattern, q, re.IGNORECASE):
            return True, "memory_query"
    
    return False, None


def is_rag_response_appropriate(query: str, answer: str, grounded: bool) -> tuple[bool, Optional[str]]:
    """
    Post-RAG validation: Check if RAG answer matches query intent.
    Returns: (is_appropriate, reason)
    """
    if not grounded:
        return True, "not_grounded"  # Already failed, no need to validate
    
    q_lower = query.lower().strip()
    
    # Social query with long technical answer = mismatch
    if any(re.search(p, q_lower) for p in SOCIAL_PATTERNS):
        if len(answer) > 150:  # Too detailed for social query
            return False, "social_query_detailed_answer"
    
    # Acknowledgment with factual dump = mismatch
    if any(re.search(p, q_lower) for p in ACKNOWLEDGMENT_PATTERNS):
        if len(answer) > 100:
            return False, "acknowledgment_got_facts"
    
    # Introduction with technical answer = maybe mismatch
    if any(re.search(p, q_lower) for p in INTRODUCTION_PATTERNS):
        if len(answer) > 200 and 'feature' in answer.lower():
            return False, "introduction_got_technical"
    
    return True, None


def lambda_handler(event, context):
    """Main Lambda handler for chat endpoint"""
    try:
        logger.info(f"Chat request received: {json.dumps(event)}")
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        project_id = body.get('projectId') or event.get('pathParameters', {}).get('projectId')
        message = body.get('message', '').strip()
        session_id = body.get('sessionId')
        branch = body.get('branch')  # Optional branch filter for RAG
        
        # Validate inputs
        if not project_id:
            return error_response(400, "projectId is required")
        if not message:
            return error_response(400, "message is required")
        
        # Get or create session
        session = get_or_create_session(project_id, session_id)
        session_id = session['sessionId']
        
        # Get conversation history
        history = session.get('messages', [])[-MAX_HISTORY_MESSAGES:]
        
        # Generate response using MCP-style approach (try RAG first, fallback to Nova Lite)
        response_data = generate_chat_response(
            project_id=project_id,
            message=message,
            history=history,
            branch=branch
        )
        
        # Update session with new messages and metadata
        update_session(session_id, message, response_data['reply'], response_data.get('ragUsed', False))
        
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
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'ragUsed': response_data.get('ragUsed', False),
                'answerGrounded': response_data.get('answerGrounded', False)
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


def update_session(session_id: str, user_message: str, assistant_reply: str, rag_used: bool = False):
    """Update session with new messages and metadata"""
    table = dynamodb.Table(SESSIONS_TABLE)
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        # Append messages to history with source tracking
        table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET messages = list_append(if_not_exists(messages, :empty_list), :new_messages), lastActivity = :now, #ttl = :ttl',
            ExpressionAttributeNames={'#ttl': 'ttl'},
            ExpressionAttributeValues={
                ':new_messages': [
                    {'role': 'user', 'content': user_message, 'timestamp': now},
                    {
                        'role': 'assistant', 
                        'content': assistant_reply, 
                        'timestamp': now,
                        'source': 'rag_converted' if rag_used else 'lite_direct'
                    }
                ],
                ':empty_list': [],
                ':now': now,
                ':ttl': int((datetime.now(timezone.utc).timestamp() + SESSION_TTL_MINUTES * 60))
            }
        )
        logger.info(f"Updated session {session_id} with new messages (source: {'RAG' if rag_used else 'Lite'})")
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        # Non-critical, continue


# ============================================================================
# CHAT-SPECIFIC RAG - Customized for conversational queries
# ============================================================================

def chat_rag_search(project_id: str, query: str, branch: Optional[str] = None) -> Dict:
    """
    Chat-optimized RAG pipeline with intent filtering.
    
    Differences from standard search_context_rag:
    1. Pre-filters obvious conversational queries (no RAG call)
    2. Post-validates RAG responses for appropriateness
    3. Returns more conversational metadata
    
    Returns:
    {
        'answer': str,
        'answerGrounded': bool,
        'sources': List[Dict],
        'skipReason': Optional[str]  # If RAG was skipped
    }
    """
    
    # STEP 1: Pre-filter obvious conversational queries
    skip_rag, skip_reason = should_skip_rag(query)
    if skip_rag:
        logger.info(f"⏭️  RAG SKIPPED: {skip_reason}")
        return {
            'answer': None,
            'answerGrounded': False,
            'sources': [],
            'skipReason': skip_reason
        }
    
    # STEP 2: Embed query
    try:
        query_embedding = call_titan_embedding(query, bedrock)
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return {
            'answer': None,
            'answerGrounded': False,
            'sources': [],
            'skipReason': 'embedding_error'
        }
    
    # STEP 3: Fetch context records (paginate to get ALL records)
    table = dynamodb.Table(CONTEXT_TABLE)
    records = []
    
    if branch:
        kwargs = {
            'IndexName': 'BranchContextIndex',
            'KeyConditionExpression': 'projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
            'ExpressionAttributeValues': {
                ':pk': project_id,
                ':prefix': f'{branch}#'
            }
        }
    else:
        kwargs = {
            'IndexName': 'ProjectContextIndex',
            'KeyConditionExpression': 'projectId = :pk',
            'ExpressionAttributeValues': {':pk': project_id}
        }
    
    try:
        while True:
            response = table.query(**kwargs)
            records.extend(response.get('Items', []))
            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            kwargs['ExclusiveStartKey'] = last_key
    except Exception as e:
        logger.error(f"DynamoDB query error: {e}")
        return {
            'answer': None,
            'answerGrounded': False,
            'sources': [],
            'skipReason': 'db_error'
        }
    
    if not records:
        return {
            'answer': 'No context records found for this project.',
            'answerGrounded': False,
            'sources': [],
            'skipReason': 'no_records'
        }
    
    # STEP 4: Compute similarities with cross-branch penalty
    CROSS_BRANCH_PENALTY = 0.85
    similarities = []
    for record in records:
        raw_embedding = record.get('embedding')
        if not raw_embedding:
            continue
        embedding = [float(x) for x in raw_embedding]
        if len(embedding) != 1536:
            continue
        score = cosine_similarity(query_embedding, embedding)
        
        # Apply branch affinity penalty for non-main branches
        if not branch:
            rec_branch = record.get('branch', 'main')
            if rec_branch != 'main':
                score *= CROSS_BRANCH_PENALTY
        
        similarities.append((record, score))
    
    # STEP 5: Top 5 results with minimum similarity threshold
    MIN_SIMILARITY = 0.3  # Below this, context is likely irrelevant
    top_results = sorted(similarities, key=lambda x: x[1], reverse=True)[:5]
    top_results = [(r, s) for r, s in top_results if s >= MIN_SIMILARITY]
    
    if not top_results:
        return {
            'answer': 'No relevant context found for this query.',
            'answerGrounded': False,
            'sources': [],
            'skipReason': 'no_relevant_context'
        }
    
    # STEP 6: Build RAG prompt
    context_text = []
    sources = []
    
    for record, score in top_results:
        context_text.append(json.dumps({
            'feature': record.get('feature'),
            'decision': record.get('decision'),
            'tasks': record.get('tasks'),
            'stage': record.get('stage'),
            'risk': record.get('risk'),
            'author': record.get('author'),
            'commitHash': record.get('commitHash'),
            'extractedAt': record.get('extractedAt')
        }, indent=2))
        
        sources.append({
            'eventId': record.get('eventId'),
            'contextId': record.get('contextId'),
            'branch': record.get('branch'),
            'timestamp': record.get('timestamp'),
            'commitHash': record.get('commitHash'),
            'feature': record.get('feature'),
            'stage': record.get('stage'),
            'extractedAt': record.get('extractedAt'),
            'snippet': f"{record.get('feature') or 'N/A'} - {(record.get('decision') or 'N/A')[:100]}...",
            'relevance': round(score, 4)
        })
    
    system_prompt = (
        "You are a factual assistant for software project queries. "
        "Your job: Analyze if the question can be answered using ONLY the provided context records."
    )
    
    user_prompt = f"""Question: {query}

Context records (most relevant first):
{chr(10).join(context_text)}

INSTRUCTIONS:
1. If the question is conversational, social, opinion-based, or about general preferences:
   → Return answerGrounded: false with empty answer
   
2. If the question asks for factual information NOT in the context:
   → Return answerGrounded: false with empty answer
   
3. If the question asks for factual information that IS in the context:
   → Return answerGrounded: true with detailed factual answer citing context

Return JSON in this EXACT structure:
{{
  "answer": "your detailed factual answer here (or empty string if answerGrounded is false)",
  "answerGrounded": true or false,
  "citedSources": [array of commitHash values referenced, or empty array]
}}

Examples:
- "Hello!" → {{"answer": "", "answerGrounded": false, "citedSources": []}}
- "Thanks!" → {{"answer": "", "answerGrounded": false, "citedSources": []}}
- "Who are the developers?" (if in context) → {{"answer": "The developer is aahil-khan", "answerGrounded": true, "citedSources": ["abc123"]}}
- "What's your opinion?" → {{"answer": "", "answerGrounded": false, "citedSources": []}}"""
    
    # STEP 7: Call Nova Pro with fallback
    try:
        try:
            response = bedrock.converse(
                modelId=RAG_MODEL_ID,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                inferenceConfig={"maxTokens": 2000, "temperature": 0.3, "topP": 1}
            )
        except Exception as throttle_err:
            if hasattr(throttle_err, 'response') and throttle_err.response.get('Error', {}).get('Code', '') in (
                'ThrottlingException', 'ModelTimeoutException', 'ServiceUnavailableException'
            ):
                logger.warning(f"Nova Pro throttled, falling back to {RAG_FALLBACK_MODEL_ID}")
                response = bedrock.converse(
                    modelId=RAG_FALLBACK_MODEL_ID,
                    system=[{"text": system_prompt}],
                    messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                    inferenceConfig={"maxTokens": 2000, "temperature": 0.3, "topP": 1}
                )
            else:
                raise
        
        output_text = response['output']['message']['content'][0]['text'].strip()
        
        # Strip markdown code fences
        if output_text.startswith('```json'):
            output_text = output_text.split('```json')[1].split('```')[0].strip()
        elif output_text.startswith('```'):
            output_text = output_text.split('```')[1].split('```')[0].strip()
        
        result = json.loads(output_text)
        
        rag_answer = result.get('answer', '')
        rag_grounded = result.get('answerGrounded', False)
        
        # Treat empty answer as ungrounded regardless of flag
        if not rag_answer or not rag_answer.strip():
            rag_grounded = False
        
        # STEP 8: Post-validate RAG response
        is_appropriate, validation_reason = is_rag_response_appropriate(query, rag_answer, rag_grounded)
        
        if not is_appropriate:
            logger.info(f"⚠️  RAG POST-VALIDATION FAILED: {validation_reason}")
            logger.info(f"   Query: '{query[:50]}...'")
            logger.info(f"   Answer length: {len(rag_answer)} chars")
            return {
                'answer': None,
                'answerGrounded': False,
                'sources': sources,
                'skipReason': f'validation_failed_{validation_reason}'
            }
        
        return {
            'answer': rag_answer,
            'answerGrounded': rag_grounded,
            'sources': sources,
            'skipReason': None
        }
        
    except Exception as e:
        logger.error(f"Error in RAG generation: {str(e)}", exc_info=True)
        return {
            'answer': None,
            'answerGrounded': False,
            'sources': sources,
            'skipReason': 'generation_error'
        }


def generate_chat_response(project_id: str, message: str, history: List[Dict], branch: Optional[str] = None) -> Dict:
    """
    MCP-Style Response Generation:
    1. Always try RAG first (Nova Pro with grounding) - same as MCP search_context tool
    2. If RAG returns grounded answer → Use it (factual with sources)
    3. If RAG can't ground → Fall back to Nova Lite (conversational with history)
    
    This eliminates complex intent detection - let RAG decide if it can answer!
    """
    
    logger.info(f"💬 Chat Query: '{message}'")
    logger.info(f"🔍 Step 1: Attempting RAG (Nova Pro) - Chat-optimized approach")
    
    # STEP 1: Try RAG with intent filtering and validation
    try:
        # Call chat-specific RAG pipeline (with pre/post filtering)
        rag_result = chat_rag_search(
            project_id=project_id,
            query=message,
            branch=branch
        )
        
        # Check if RAG was skipped due to conversational intent
        skip_reason = rag_result.get('skipReason')
        if skip_reason and not rag_result.get('answer'):
            logger.info(f"⏭️  RAG SKIPPED: {skip_reason}")
            logger.info(f"🔄 Step 2: Using Nova Lite directly (conversational query)")
        
        # STEP 2: Check if RAG found grounded answer
        elif rag_result.get('answerGrounded') and rag_result.get('answer'):
            rag_answer = rag_result['answer']
            rag_sources = rag_result.get('sources', [])
            
            logger.info(f"✅ RAG SUCCESS: Grounded answer found (Nova Pro)")
            logger.info(f"   Answer length: {len(rag_answer)} chars")
            logger.info(f"   Sources: {len(rag_sources)}")
            
            # Return RAG answer directly
            return {
                'reply': rag_answer,
                'sources': rag_sources,
                'ragUsed': True,
                'answerGrounded': True
            }
        
        else:
            # RAG couldn't ground the answer or validation failed
            logger.info(f"⚠️  RAG UNGROUNDED: Nova Pro couldn't find specific facts")
            if skip_reason:
                logger.info(f"   Reason: {skip_reason}")
            logger.info(f"🔄 Step 2: Falling back to Nova Lite conversational")
            
    except Exception as e:
        logger.error(f"❌ RAG ERROR: {str(e)}", exc_info=True)
        logger.info(f"🔄 Step 2: Falling back to Nova Lite conversational (RAG error)")
    
    # STEP 3: Fall back to Nova Lite conversational
    logger.info(f"💬 Using Nova Lite for conversational response")
    
    # Retrieve top context for Nova Lite (lightweight - just for system prompt)
    try:
        query_embedding = call_titan_embedding(message, bedrock)
        table = dynamodb.Table(CONTEXT_TABLE)
        response = table.query(
            IndexName='ProjectContextIndex',
            KeyConditionExpression='projectId = :pk',
            ExpressionAttributeValues={':pk': project_id},
            Limit=100
        )
        
        records = response.get('Items', [])
        context = []
        if records:
            # Quick similarity scoring
            for record in records:
                raw_embedding = record.get('embedding')
                if raw_embedding and len(raw_embedding) == 1536:
                    score = cosine_similarity(query_embedding, [float(x) for x in raw_embedding])
                    record['relevance'] = score
                    context.append((record, score))
            # Top 5 for context
            context = [r for r, s in sorted(context, key=lambda x: x[1], reverse=True)[:5]]
            logger.info(f"   Retrieved {len(context)} context snippets for Nova Lite")
    except Exception as e:
        logger.warning(f"Could not retrieve context for Nova Lite: {e}")
        context = []
    
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
                'temperature': 0.6,  # Slightly lower for better consistency with facts
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
            'sources': sources,
            'ragUsed': False,
            'answerGrounded': False
        }
        
    except Exception as e:
        logger.error(f"Error calling Nova Lite: {str(e)}", exc_info=True)
        return {
            'reply': "I apologize, but I encountered an error generating a response. Please try again.",
            'sources': [],
            'ragUsed': False,
            'answerGrounded': False
        }


def build_system_prompt(context: List[Dict]) -> str:
    """Build system prompt with RAG context and conversation awareness"""
    
    prompt = """You are a helpful AI assistant for developers working on a software project.

Context Awareness:
- You have access to project history (commits, features, decisions) shown below
- Previous messages in conversation history may include detailed factual answers
- When you see detailed facts in history, BUILD ON THEM - don't repeat verbatim
- If user asks follow-ups ("explain that", "tell me more"), reference the previous answer

Your Role:
- Provide conversational guidance and support
- Help implement features following project patterns
- Explain concepts, suggest approaches, provide code examples
- Break down complex tasks into actionable steps
- Clarify and extend factual information from previous answers

Guidelines:
- Be conversational, professional, and helpful
- Use project context when available - reference specific features/decisions
- If context is limited, acknowledge it and provide general best practices
- Build on previous answers naturally (extend or clarify, don't duplicate)
- Keep responses concise and focused
- For social messages (greetings, thanks, acknowledgments), respond naturally and briefly
- Use emojis sparingly (max 1 per response, only if it adds value)

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
        prompt += "\n(No specific context retrieved for this query. Provide general development guidance.)\n"
    
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
