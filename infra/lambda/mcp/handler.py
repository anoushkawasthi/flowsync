"""
FlowSync MCP Lambda
Model Context Protocol (MCP) server for AI agents (Copilot, Claude Desktop).
Provides 4 tools: get_project_context, get_recent_changes, search_context, log_context.
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
from flowsync_common.helpers import respond, strip_embeddings, search_context_rag, convert_floats_to_decimal

# Environment variables
CONTEXT_TABLE = os.environ.get("CONTEXT_TABLE", "flowsync-context")
PROJECTS_TABLE = os.environ.get("PROJECTS_TABLE", "flowsync-projects")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE", "flowsync-audit")

# AWS clients
bedrock_client = boto3.client("bedrock-runtime")
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


def get_project_context(params):
    """
    Tool 1: Get last 10 context records for a branch with parent branch inheritance.
    
    Params:
      - projectId (required)
      - branch (required)
    
    Returns: {recentContext: [...]}
    """
    project_id = params.get('projectId')
    branch = params.get('branch', 'main')
    
    if not project_id:
        return respond(400, {'error': 'bad_request', 'message': 'Missing projectId'})
    
    table = dynamodb.Table(CONTEXT_TABLE)
    
    # Query branch-specific context
    response = table.query(
        IndexName='BranchContextIndex',
        KeyConditionExpression='projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
        ExpressionAttributeValues={
            ':pk': project_id,
            ':prefix': f'{branch}#'
        },
        ScanIndexForward=False,  # Newest first
        Limit=10
    )
    
    branch_records = response.get('Items', [])
    
    # If not main branch, also fetch main branch context for inheritance
    all_records = branch_records
    if branch != 'main':
        main_response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
            ExpressionAttributeValues={
                ':pk': project_id,
                ':prefix': 'main#'
            },
            ScanIndexForward=False,
            Limit=10
        )
        
        main_records = main_response.get('Items', [])
        
        # Merge: branch records override main records by feature name
        branch_features = {r['feature']: r for r in branch_records}
        for main_record in main_records:
            feature = main_record['feature']
            if feature not in branch_features:
                all_records.append(main_record)
        
        # Limit to 10 most recent
        all_records = sorted(all_records, key=lambda x: x['extractedAt'], reverse=True)[:10]
    
    # Strip embeddings
    all_records = strip_embeddings(all_records)
    
    return respond(200, {'recentContext': all_records})


def get_recent_changes(params):
    """
    Tool 2: Get last N context records chronologically.
    
    Params:
      - projectId (required)
      - branch (optional)
      - limit (optional, default 10, max 50)
    
    Returns: {changes: [...]}
    """
    project_id = params.get('projectId')
    branch = params.get('branch')
    limit = min(int(params.get('limit', 10)), 50)
    
    if not project_id:
        return respond(400, {'error': 'bad_request', 'message': 'Missing projectId'})
    
    table = dynamodb.Table(CONTEXT_TABLE)
    
    if branch:
        # Query BranchContextIndex for specific branch
        response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='projectId = :pk AND begins_with(branchExtractedAt, :prefix)',
            ExpressionAttributeValues={
                ':pk': project_id,
                ':prefix': f'{branch}#'
            },
            ScanIndexForward=False,
            Limit=limit
        )
    else:
        # Query ProjectContextIndex for all branches
        response = table.query(
            IndexName='ProjectContextIndex',
            KeyConditionExpression='projectId = :pk',
            ExpressionAttributeValues={':pk': project_id},
            ScanIndexForward=False,
            Limit=limit
        )
    
    records = response.get('Items', [])
    records = strip_embeddings(records)
    
    return respond(200, {'changes': records})


def search_context(params):
    """
    Tool 3: Semantic search with RAG answer generation.
    
    Params:
      - projectId (required)
      - query (required)
      - branch (optional)
    
    Returns: {answer, answerGrounded, sources: [...]}
    """
    project_id = params.get('projectId')
    query = params.get('query')
    branch = params.get('branch')
    
    if not project_id:
        return respond(400, {'error': 'bad_request', 'message': 'Missing projectId'})
    if not query:
        return respond(400, {'error': 'bad_request', 'message': 'Missing query'})
    
    # Call shared RAG pipeline
    try:
        result = search_context_rag(
            project_id=project_id,
            query=query,
            branch=branch,
            bedrock_client=bedrock_client,
            dynamodb=dynamodb,
            context_table_name=CONTEXT_TABLE
        )
        return respond(200, result)
    except Exception as e:
        print(f"Error in search_context: {str(e)}")
        publish_metric('MCPToolFailure', 1, project_id)
        return respond(500, {'error': 'search_failed', 'message': str(e)})


def log_context(params):
    """
    Tool 4: Agent writes reasoning to context (MCP write operation).
    
    Params:
      - projectId (required)
      - branch (required)
      - author (required)
      - reasoning (required)
      - decision (optional)
      - tasks (optional)
      - risk (optional)
    
    Returns: {success: true, eventId: "..."}
    """
    project_id = params.get('projectId')
    branch = params.get('branch', 'main')
    author = params.get('author')
    reasoning = params.get('reasoning')
    decision = params.get('decision')
    tasks = params.get('tasks', [])
    risk = params.get('risk')
    
    if not project_id or not author or not reasoning:
        return respond(400, {
            'error': 'bad_request',
            'message': 'Missing required params: projectId, author, reasoning'
        })
    
    table = dynamodb.Table(CONTEXT_TABLE)
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    # Find existing complete record (same projectId, branch, author, within 30 min)
    time_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    window_start = (time_obj - timedelta(minutes=30)).isoformat().replace('+00:00', 'Z')
    
    try:
        response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='projectId = :pk AND branchExtractedAt BETWEEN :start AND :end',
            FilterExpression='author = :author AND #status = :complete',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':pk': project_id,
                ':start': f"{branch}#{window_start}",
                ':end': f"{branch}#{timestamp}",
                ':author': author,
                ':complete': 'complete'
            },
            Limit=1,
            ScanIndexForward=False
        )
        
        existing = response.get('Items')
        
        if existing:
            # Update existing record with agent reasoning
            event_id = existing[0]['eventId']
            
            update_expr = "SET agentReasoning = :reasoning"
            expr_values = {':reasoning': reasoning}
            
            if decision:
                update_expr += ", decision = :decision"
                expr_values[':decision'] = decision
            
            if tasks:
                update_expr += ", tasks = :tasks"
                expr_values[':tasks'] = tasks
            
            if risk:
                update_expr += ", risk = :risk"
                expr_values[':risk'] = risk
            
            table.update_item(
                Key={'eventId': event_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_values
            )
            
            # Write audit record
            audit_table = dynamodb.Table(AUDIT_TABLE)
            audit_table.put_item(Item={
                'entityId': event_id,
                'timestamp': timestamp,
                'action': 'agent_reasoning_added',
                'projectId': project_id,
                'branch': branch,
                'author': author
            })
            
            return respond(200, {'success': True, 'eventId': event_id, 'action': 'updated'})
        
        else:
            # Create orphaned record (no commit yet)
            import uuid
            event_id = str(uuid.uuid4())
            
            orphaned_record = {
                'eventId': event_id,
                'projectId': project_id,
                'branch': branch,
                'branchExtractedAt': f"{branch}#{timestamp}",
                'commitHash': None,
                'status': 'uncommitted',
                'feature': 'Agent reasoning',
                'decision': decision,
                'tasks': tasks,
                'stage': 'Feature Development',
                'risk': risk,
                'confidence': Decimal('0.5'),
                'entities': [],
                'author': author,
                'agentReasoning': reasoning,
                'modelVersion': 'mcp-agent',
                'embedding': None,
                'extractedAt': timestamp
            }
            
            orphaned_record = convert_floats_to_decimal(orphaned_record)
            table.put_item(Item=orphaned_record)
            
            # Write audit record
            audit_table = dynamodb.Table(AUDIT_TABLE)
            audit_table.put_item(Item={
                'entityId': event_id,
                'timestamp': timestamp,
                'action': 'agent_reasoning_logged',
                'projectId': project_id,
                'branch': branch,
                'author': author
            })
            
            return respond(200, {'success': True, 'eventId': event_id, 'action': 'created'})
    
    except Exception as e:
        print(f"Error in log_context: {str(e)}")
        publish_metric('MCPToolFailure', 1, project_id)
        return respond(500, {'error': 'log_failed', 'message': str(e)})


def handler(event, context):
    """Main handler - routes MCP tool calls."""
    print('MCP Lambda invoked', json.dumps(event))
    
    try:
        # Parse request body (API Gateway sends as string)
        body = json.loads(event.get('body', '{}'))
        tool_name = body.get('tool')
        params = body.get('params', {})
        
        if not tool_name:
            return respond(400, {'error': 'bad_request', 'message': 'Missing tool name'})
        
        # Route to appropriate tool
        if tool_name == 'get_project_context':
            return get_project_context(params)
        elif tool_name == 'get_recent_changes':
            return get_recent_changes(params)
        elif tool_name == 'search_context':
            return search_context(params)
        elif tool_name == 'log_context':
            return log_context(params)
        else:
            return respond(400, {'error': 'invalid_tool', 'message': f'Unknown tool: {tool_name}'})
    
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in request body: {str(e)}")
        return respond(400, {'error': 'bad_request', 'message': 'Invalid JSON'})
    except Exception as e:
        print(f"Unhandled error in MCP handler: {str(e)}")
        return respond(500, {'error': 'internal_error', 'message': str(e)})
