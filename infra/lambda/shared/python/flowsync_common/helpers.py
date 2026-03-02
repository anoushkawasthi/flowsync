"""
FlowSync Shared Helpers
Reusable functions for MCP and Query Lambda functions.
"""

import json
import boto3
import math
from decimal import Decimal


# Model configuration
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1"
MODEL_ID = "us.amazon.nova-pro-v1:0"


def convert_decimals(obj):
    """Convert Decimal objects to int/float for JSON serialization."""
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj


def respond(status_code, body):
    """Build standard API Gateway response."""
    # Convert Decimals in body before JSON serialization
    body = convert_decimals(body)
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(body)
    }


def call_titan_embedding(text, bedrock_client):
    """Generate 1536-dimensional embedding using Titan."""
    response = bedrock_client.invoke_model(
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


def cosine_similarity(vec_a, vec_b):
    """Calculate cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def strip_embeddings(records):
    """Remove embedding field from context records (reduces response size by ~12KB per record)."""
    if isinstance(records, dict):
        records = [records]
    for record in records:
        record.pop('embedding', None)
    # Also convert Decimal objects to regular numbers for JSON serialization
    records = convert_decimals(records)
    return records


def convert_floats_to_decimal(obj):
    """Convert all float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_floats_to_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj


def search_context_rag(project_id, query, branch, bedrock_client, dynamodb, context_table_name):
    """
    RAG pipeline for semantic search + answer generation.
    
    Steps:
    1. Embed query using Titan
    2. Fetch all context records for project
    3. Compute cosine similarity between query and each record
    4. Take top 5 results
    5. Feed top 5 to Nova Pro for answer generation
    6. Return answer + source citations
    """
    # Step 1: Embed query
    query_embedding = call_titan_embedding(query, bedrock_client)
    
    # Step 2: Fetch context records
    table = dynamodb.Table(context_table_name)
    
    # Determine which index to use
    if branch:
        # Query BranchContextIndex for specific branch
        response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
            ExpressionAttributeValues={
                ':pk': project_id,
                ':prefix': f'{branch}#'
            }
        )
    else:
        # Query ProjectContextIndex for all branches
        response = table.query(
            IndexName='ProjectContextIndex',
            KeyConditionExpression='projectId = :pk',
            ExpressionAttributeValues={':pk': project_id}
        )
    
    records = response.get('Items', [])
    
    if not records:
        return {
            'answer': 'No context records found for this project.',
            'answerGrounded': False,
            'sources': []
        }
    
    # Step 3: Compute similarities (convert Decimal embeddings to float)
    similarities = []
    for record in records:
        # Critical: DynamoDB stores embeddings as Decimal, must convert to float.
        # Must check for None explicitly — orphaned (uncommitted) records store
        # embedding as DynamoDB null, which boto3 deserializes as Python None.
        # .get('embedding', []) returns None (not []) when null is present.
        raw_embedding = record.get('embedding')
        if not raw_embedding:
            continue
        embedding = [float(x) for x in raw_embedding]
        if len(embedding) != 1536:
            continue
        score = cosine_similarity(query_embedding, embedding)
        similarities.append((record, score))
    
    # Step 4: Top 5 results by similarity
    top_results = sorted(similarities, key=lambda x: x[1], reverse=True)[:5]
    
    if not top_results:
        return {
            'answer': 'No relevant context found for this query.',
            'answerGrounded': False,
            'sources': []
        }
    
    # Step 5: Build RAG prompt and call Nova Pro
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
            'commitHash': record.get('commitHash'),
            'feature': record.get('feature'),
            'extractedAt': record.get('extractedAt'),
            'relevanceScore': round(score, 4)
        })
    
    system_prompt = (
        "You are a helpful assistant that answers questions about software projects. "
        "Answer ONLY using the provided context records. "
        "If the answer is not in the context, say 'I don't have enough context to answer that.' "
        "Be specific and cite relevant details from the context."
    )
    
    user_prompt = f"""Question: {query}

Context records (most relevant first):
{chr(10).join(context_text)}

Return a JSON object with this exact structure:
{{
  "answer": "your answer here",
  "answerGrounded": true or false (false if you couldn't answer from context),
  "citedSources": [array of commitHash values you referenced, empty if none]
}}"""
    
    # Call Nova Pro via Converse API
    try:
        response = bedrock_client.converse(
            modelId=MODEL_ID,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={"maxTokens": 2000, "temperature": 0.3, "topP": 1}
        )
        
        output_text = response['output']['message']['content'][0]['text'].strip()
        
        # Strip markdown code fences if present
        if output_text.startswith('```json'):
            output_text = output_text.split('```json')[1].split('```')[0].strip()
        elif output_text.startswith('```'):
            output_text = output_text.split('```')[1].split('```')[0].strip()
        
        result = json.loads(output_text)
        
        # Return with sources
        return {
            'answer': result.get('answer', 'Unable to generate answer.'),
            'answerGrounded': result.get('answerGrounded', False),
            'sources': sources
        }
    except Exception as e:
        print(f"Error calling Nova Pro for RAG: {str(e)}")
        return {
            'answer': f'Error generating answer: {str(e)}',
            'answerGrounded': False,
            'sources': sources
        }
