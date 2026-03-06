"""
FlowSync Shared Helpers
Reusable functions for MCP and Query Lambda functions.
"""

import json
import os
import hashlib
import boto3
import math
from decimal import Decimal


# Model configuration
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1"  # Using v1 for compatibility with existing embeddings
MODEL_ID = "us.amazon.nova-pro-v1:0"
FALLBACK_MODEL_ID = os.environ.get("FALLBACK_MODEL_ID", "us.amazon.nova-lite-v1:0")


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


def check_cache(dynamodb, cache_table_name, cache_key):
    """Check DynamoDB cache for a RAG response. Returns cached response dict or None."""
    try:
        table = dynamodb.Table(cache_table_name)
        item = table.get_item(Key={'cacheKey': cache_key}).get('Item')
        if item:
            print(f"Cache HIT: {cache_key[:16]}...")
            return convert_decimals(dict(item.get('response', {})))
    except Exception as e:
        print(f"Cache check failed (non-fatal): {str(e)}")
    return None


def write_cache(dynamodb, cache_table_name, cache_key, response, ttl_seconds=3600):
    """Write a RAG response to the DynamoDB cache with 1-hour TTL."""
    import time
    try:
        table = dynamodb.Table(cache_table_name)
        table.put_item(Item={
            'cacheKey': cache_key,
            'response': convert_floats_to_decimal(response),
            'expiresAt': int(time.time()) + ttl_seconds,
        })
        print(f"Cache WRITE: {cache_key[:16]}...")
    except Exception as e:
        print(f"Cache write failed (non-fatal): {str(e)}")


def search_context_rag(project_id, query, branch, bedrock_client, dynamodb, context_table_name, cache_table_name=None):
    """
    RAG pipeline for semantic search + answer generation.

    Steps:
    1. Check DynamoDB cache (if cache_table_name provided)
    2. Embed query using Titan
    3. Fetch all context records for project (paginated)
    4. Compute cosine similarity; apply branch-affinity boost if branch requested
    5. Take top 5 results
    6. Feed top 5 to Nova Pro for answer generation (falls back to FALLBACK_MODEL_ID on throttle)
    7. Write result to cache
    8. Return answer + source citations
    """
    # Step 1: Check cache before running the expensive pipeline
    cache_key = None
    if cache_table_name:
        cache_key = hashlib.sha256(f"{project_id}:{query}:{branch or 'all'}".encode()).hexdigest()
        cached = check_cache(dynamodb, cache_table_name, cache_key)
        if cached:
            cached['cached'] = True
            return cached

    # Step 2: Embed query
    query_embedding = call_titan_embedding(query, bedrock_client)

    # Step 3: Fetch context records (paginate to get ALL records, not just first DDB page)
    table = dynamodb.Table(context_table_name)
    records = []

    if branch:
        # Query BranchContextIndex for specific branch
        kwargs = {
            'IndexName': 'BranchContextIndex',
            'KeyConditionExpression': 'projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
            'ExpressionAttributeValues': {
                ':pk': project_id,
                ':prefix': f'{branch}#'
            }
        }
    else:
        # Query ProjectContextIndex for all branches
        kwargs = {
            'IndexName': 'ProjectContextIndex',
            'KeyConditionExpression': 'projectId = :pk',
            'ExpressionAttributeValues': {':pk': project_id}
        }

    while True:
        response = table.query(**kwargs)
        records.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    
    if not records:
        return {
            'answer': 'No context records found for this project.',
            'answerGrounded': False,
            'sources': []
        }
    
    # Step 4: Compute similarities (convert Decimal embeddings to float)
    # When no branch is specified, apply a 0.85× score penalty to non-main records
    # to prevent cross-branch pollution from dominating results.
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
        # Apply branch affinity: penalise records not on the requested/main branch
        if not branch:
            rec_branch = record.get('branch', 'main')
            if rec_branch != 'main':
                score *= CROSS_BRANCH_PENALTY
        similarities.append((record, score))
    
    # Step 5: Top 5 results by similarity
    top_results = sorted(similarities, key=lambda x: x[1], reverse=True)[:5]
    
    if not top_results:
        return {
            'answer': 'No relevant context found for this query.',
            'answerGrounded': False,
            'sources': []
        }
    
    # Step 6: Build RAG prompt and call Nova Pro (with fallback to FALLBACK_MODEL_ID on throttle)
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
    
    # Call Nova Pro via Converse API; fall back to FALLBACK_MODEL_ID on throttling
    try:
        try:
            response = bedrock_client.converse(
                modelId=MODEL_ID,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                inferenceConfig={"maxTokens": 2000, "temperature": 0.3, "topP": 1}
            )
        except Exception as throttle_err:
            err_code = getattr(getattr(throttle_err, 'response', {}).get('Error', {}), 'get', lambda k, d=None: d)('Code', '')
            # botocore ClientError stores error code in response dict
            if hasattr(throttle_err, 'response') and throttle_err.response.get('Error', {}).get('Code', '') in (
                'ThrottlingException', 'ModelTimeoutException', 'ServiceUnavailableException'
            ):
                print(f"Nova Pro throttled, falling back to {FALLBACK_MODEL_ID}")
                response = bedrock_client.converse(
                    modelId=FALLBACK_MODEL_ID,
                    system=[{"text": system_prompt}],
                    messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                    inferenceConfig={"maxTokens": 2000, "temperature": 0.3, "topP": 1}
                )
            else:
                raise
        
        output_text = response['output']['message']['content'][0]['text'].strip()
        
        # Strip markdown code fences if present
        if output_text.startswith('```json'):
            output_text = output_text.split('```json')[1].split('```')[0].strip()
        elif output_text.startswith('```'):
            output_text = output_text.split('```')[1].split('```')[0].strip()
        
        result = json.loads(output_text)
        
        # Step 7: Build final response and write to cache
        final_response = {
            'answer': result.get('answer', 'Unable to generate answer.'),
            'answerGrounded': result.get('answerGrounded', False),
            'sources': sources
        }
        if cache_key and cache_table_name:
            write_cache(dynamodb, cache_table_name, cache_key, final_response)
        return final_response
    except Exception as e:
        print(f"Error calling Nova Pro for RAG: {str(e)}")
        return {
            'answer': f'Error generating answer: {str(e)}',
            'answerGrounded': False,
            'sources': sources
        }
