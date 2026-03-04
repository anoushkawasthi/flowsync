#!/usr/bin/env python3
"""
Backfill embeddings for existing context records
Adds Titan v2 embeddings to records that are missing them
"""

import boto3
import json
from decimal import Decimal

# Configuration
CONTEXT_TABLE = 'flowsync-context'
PROJECT_ID = '28c3fad3-4cbd-414e-bb63-fcc559ea238b'
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"

# AWS clients
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def generate_embedding(text):
    """Generate embedding using Titan v2"""
    response = bedrock.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({"inputText": text})
    )
    result = json.loads(response["body"].read())
    embedding = result.get("embedding")
    if not embedding or len(embedding) != 1536:
        raise ValueError(f"Invalid embedding: expected 1536 dims, got {len(embedding) if embedding else 0}")
    return [Decimal(str(float(x))) for x in embedding]

def backfill_embeddings():
    """Add embeddings to all context records that are missing them"""
    table = dynamodb.Table(CONTEXT_TABLE)
    
    # Get all context records for project
    response = table.query(
        IndexName='ProjectContextIndex',
        KeyConditionExpression='projectId = :pk',
        ExpressionAttributeValues={':pk': PROJECT_ID}
    )
    
    records = response.get('Items', [])
    print(f"Found {len(records)} context records")
    
    updated = 0
    for record in records:
        event_id = record['eventId']
        has_embedding = record.get('embedding') is not None
        
        if has_embedding:
            print(f"  ✓ {event_id[:8]}: Already has embedding")
            continue
        
        # Generate embedding text from record
        embedding_text = json.dumps({
            'feature': record.get('feature', ''),
            'decision': record.get('decision', ''),
            'tasks': record.get('tasks', []),
            'stage': record.get('stage', ''),
            'risk': record.get('risk'),
            'entities': record.get('entities', [])
        })
        
        try:
            print(f"  → {event_id[:8]}: Generating embedding...")
            embedding = generate_embedding(embedding_text)
            
            # Update record with embedding
            table.update_item(
                Key={'eventId': event_id},
                UpdateExpression='SET embedding = :emb',
                ExpressionAttributeValues={':emb': embedding}
            )
            
            print(f"    ✓ Updated with {len(embedding)}-dim embedding")
            updated += 1
            
        except Exception as e:
            print(f"    ✗ Error: {str(e)}")
    
    print(f"\n✅ Backfill complete: {updated}/{len(records)} records updated")

if __name__ == '__main__':
    print("=" * 50)
    print("FlowSync Embedding Backfill")
    print("=" * 50)
    print(f"Project: {PROJECT_ID}")
    print(f"Model: {EMBEDDING_MODEL_ID}")
    print()
    backfill_embeddings()
