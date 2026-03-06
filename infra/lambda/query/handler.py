"""
FlowSync Query Lambda
Handles dashboard API endpoints: timeline (GET /events) and search (POST /query).
"""

import json
import boto3
import os
from botocore.config import Config as BotoConfig
from flowsync_common.helpers import respond, strip_embeddings, search_context_rag
from flowsync_common.auth import authenticate

# Environment variables
CONTEXT_TABLE = os.environ.get("CONTEXT_TABLE", "flowsync-context")
PROJECTS_TABLE = os.environ.get("PROJECTS_TABLE", "flowsync-projects")
CACHE_TABLE = os.environ.get("CACHE_TABLE", "")

# AWS clients — Bedrock with adaptive retry (handles ThrottlingException automatically)
_bedrock_retry_config = BotoConfig(retries={'max_attempts': 3, 'mode': 'adaptive'})
bedrock_client = boto3.client("bedrock-runtime", config=_bedrock_retry_config)
dynamodb = boto3.resource("dynamodb")
cloudwatch = boto3.client("cloudwatch")


def publish_metric(metric_name, value, project_id):
    """Publish CloudWatch metric for monitoring."""
    try:
        cloudwatch.put_metric_data(
            Namespace='FlowSync',
            MetricData=[{
                'MetricName': metric_name,
                'Value': value,
                'Unit': 'Count',
                'Dimensions': [{'Name': 'ProjectId', 'Value': project_id}]
            }]
        )
    except Exception as e:
        print(f"Failed to publish metric: {str(e)}")


def get_events(event):
    """
    Route: GET /api/v1/projects/{projectId}/events
    
    Query params:
      - branch (optional): Filter by branch
      - since (optional): ISO timestamp - get events after this time
      - limit (optional): Max results (default 20, max 50)
    
    Returns: {events: [...], count: N, lastTimestamp: "..."}
    """
    try:
        # Extract parameters
        project_id = event['pathParameters']['projectId']
        params = event.get('queryStringParameters') or {}
        
        branch = params.get('branch')
        since = params.get('since')
        limit = min(int(params.get('limit', 20)), 50)
        
        # Authenticate
        auth_result = authenticate(event, project_id, dynamodb, PROJECTS_TABLE)
        if not auth_result['success']:
            return respond(auth_result['statusCode'], auth_result['error'])
        
        # Query DynamoDB
        table = dynamodb.Table(CONTEXT_TABLE)
        
        if branch:
            # Query BranchContextIndex GSI
            key_condition = 'projectId = :pk'
            expr_values = {':pk': project_id}
            
            if since:
                key_condition += ' AND branchExtractedAt > :since'
                expr_values[':since'] = f"{branch}#{since}"
            else:
                key_condition += ' AND begins_with(branchExtractedAt, :prefix)'
                expr_values[':prefix'] = f'{branch}#'
            
            response = table.query(
                IndexName='BranchContextIndex',
                KeyConditionExpression=key_condition,
                ExpressionAttributeValues=expr_values,
                ScanIndexForward=False,  # Newest first
                Limit=limit
            )
        else:
            # Query ProjectContextIndex GSI (all branches)
            key_condition = 'projectId = :pk'
            expr_values = {':pk': project_id}
            
            if since:
                key_condition += ' AND extractedAt > :since'
                expr_values[':since'] = since
            
            response = table.query(
                IndexName='ProjectContextIndex',
                KeyConditionExpression=key_condition,
                ExpressionAttributeValues=expr_values,
                ScanIndexForward=False,  # Newest first
                Limit=limit
            )
        
        records = response.get('Items', [])
        
        # Strip embeddings to reduce response size
        records = strip_embeddings(records)
        
        # Get last timestamp
        last_timestamp = records[-1]['extractedAt'] if records else None
        
        return respond(200, {
            'events': records,
            'count': len(records),
            'lastTimestamp': last_timestamp
        })
    
    except KeyError as e:
        print(f"Missing required parameter: {str(e)}")
        return respond(400, {'error': 'bad_request', 'message': f'Missing parameter: {str(e)}'})
    except ValueError as e:
        print(f"Invalid parameter value: {str(e)}")
        return respond(400, {'error': 'bad_request', 'message': str(e)})
    except Exception as e:
        print(f"Error in get_events: {str(e)}")
        publish_metric('QueryFailure', 1, event.get('pathParameters', {}).get('projectId', 'unknown'))
        return respond(500, {'error': 'internal_error', 'message': str(e)})


def query_search(event):
    """
    Route: POST /api/v1/query
    
    Request body: {projectId, query, branch (optional)}
    
    Returns: {answer, answerGrounded, sources: [...]}
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        project_id = body.get('projectId')
        query = body.get('query')
        branch = body.get('branch')
        
        if not project_id:
            return respond(400, {'error': 'bad_request', 'message': 'Missing projectId'})
        if not query:
            return respond(400, {'error': 'bad_request', 'message': 'Missing query'})
        
        # Authenticate
        auth_result = authenticate(event, project_id, dynamodb, PROJECTS_TABLE)
        if not auth_result['success']:
            return respond(auth_result['statusCode'], auth_result['error'])
        
        # Call RAG pipeline (shared with MCP Lambda)
        result = search_context_rag(
            project_id=project_id,
            query=query,
            branch=branch,
            bedrock_client=bedrock_client,
            dynamodb=dynamodb,
            context_table_name=CONTEXT_TABLE,
            cache_table_name=CACHE_TABLE or None
        )
        
        return respond(200, result)
    
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in request body: {str(e)}")
        return respond(400, {'error': 'bad_request', 'message': 'Invalid JSON'})
    except Exception as e:
        print(f"Error in query_search: {str(e)}")
        publish_metric('QueryFailure', 1, body.get('projectId', 'unknown') if 'body' in locals() else 'unknown')
        return respond(500, {'error': 'internal_error', 'message': str(e)})


def handler(event, context):
    """Main handler - routes requests to appropriate function."""
    print('Query Lambda invoked', json.dumps(event))
    
    method = event.get('httpMethod', '')
    resource = event.get('resource', '')
    
    try:
        if method == 'GET' and resource == '/api/v1/projects/{projectId}/events':
            return get_events(event)
        elif method == 'POST' and resource == '/api/v1/query':
            return query_search(event)
        else:
            return respond(404, {'error': 'not_found', 'message': 'Endpoint not found'})
    except Exception as e:
        print(f"Unhandled error in handler: {str(e)}")
        return respond(500, {'error': 'internal_error', 'message': str(e)})
