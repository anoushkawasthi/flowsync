import json
import boto3
import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from botocore.exceptions import ClientError

# Model and embedding configuration
MODEL_ID = "openai.gpt-oss-120b-1:0"
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1"

# DynamoDB table names (set via environment variables or hardcoded for prototype)
CONTEXT_TABLE = os.environ.get("CONTEXT_TABLE", "flowsync-context")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE", "flowsync-audit")
PROJECTS_TABLE = os.environ.get("PROJECTS_TABLE", "flowsync-projects")

bedrock_client = boto3.client("bedrock-runtime")
dynamodb = boto3.resource("dynamodb")
cloudwatch = boto3.client("cloudwatch")

def call_bedrock(diff):
    """Call Bedrock with the given diff and return extracted context."""
    prompt = f"""Analyze this git diff and extract structured context. Return ONLY valid JSON with these fields:
- feature: string (what feature/component changed)
- decision: string (key decision or change made)
- tasks: array of strings (tasks completed)
- stage: string (development stage: planning/implementation/testing/deployment)
- risk: string (low/medium/high)
- confidence: number (0.0-1.0)
- entities: array of strings (files, functions, classes affected)

Diff:
{diff}

Return ONLY the JSON object, no markdown or explanation."""

    # Use invoke_model to match JavaScript implementation
    body = {
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "inference_config": {
            "maxTokens": 512,
            "temperature": 1,
            "topP": 0.5
        },
        "additional_model_request_fields": {},
        "performance_config": {
            "latency": "standard"
        }
    }
    
    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body)
    )
    
    # Decode response body
    response_body = json.loads(response['body'].read())
    print(f"Bedrock response: {json.dumps(response_body, default=str)}")
    
    # Extract text from response - GPT-OSS format
    try:
        # GPT-OSS response format: {"choices": [{"message": {"content": "..."}}]}
        if 'choices' in response_body and len(response_body['choices']) > 0:
            output_text = response_body['choices'][0]['message']['content']
        elif 'output' in response_body and 'message' in response_body['output']:
            output_text = response_body['output']['message']['content'][0]['text']
        elif 'content' in response_body:
            output_text = response_body['content'][0]['text'] if isinstance(response_body['content'], list) else response_body['content']
        elif 'completion' in response_body:
            output_text = response_body['completion']
        else:
            output_text = str(response_body)
    except (KeyError, IndexError, TypeError) as e:
        print(f"Error extracting text from response: {e}")
        print(f"Response body keys: {response_body.keys() if isinstance(response_body, dict) else type(response_body)}")
        raise ValueError(f"Unexpected Bedrock response structure: {e}")
    
    # Parse JSON from response
    output_text = output_text.strip()
    
    # Strip reasoning tags if present
    if '<reasoning>' in output_text:
        # Remove everything between <reasoning> and </reasoning>
        import re
        output_text = re.sub(r'<reasoning>.*?</reasoning>', '', output_text, flags=re.DOTALL).strip()
    
    # Strip markdown code blocks if present
    if output_text.startswith('```json'):
        output_text = output_text.split('```json')[1].split('```')[0].strip()
    elif output_text.startswith('```'):
        output_text = output_text.split('```')[1].split('```')[0].strip()
    
    result = json.loads(output_text)
    return result

def validate_extraction_schema(data):
    """Validate Bedrock output against expected schema."""
    required_fields = [
        "feature", "decision", "tasks", "stage", "risk", "confidence", "entities"
    ]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")
    return True

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

def call_titan_embedding(text):
    """Call Titan Embeddings to generate a vector for the given text."""
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

def write_context_record(context_record):
    """Write the context record to DynamoDB."""
    table = dynamodb.Table(CONTEXT_TABLE)
    # Convert floats to Decimal for DynamoDB compatibility
    context_record = convert_floats_to_decimal(context_record)
    table.put_item(Item=context_record)

def write_audit_record(audit_record):
    """Write the audit record to DynamoDB."""
    table = dynamodb.Table(AUDIT_TABLE)
    table.put_item(Item=audit_record)

def update_project_activity(project_id, timestamp):
    """Update lastActivityAt and increment eventCount in projects table."""
    table = dynamodb.Table(PROJECTS_TABLE)
    table.update_item(
        Key={"projectId": project_id},
        UpdateExpression="SET lastActivityAt = :ts ADD eventCount :inc",
        ExpressionAttributeValues={":ts": timestamp, ":inc": 1}
    )

def find_orphaned_record(project_id, branch, author, timestamp):
    """
    Find an uncommitted record (commitHash: null) for the same branch and author
    within 30 minutes of the given timestamp. Direction B: log-first scenario.
    """
    table = dynamodb.Table(CONTEXT_TABLE)
    
    # Calculate time window (30 minutes before timestamp)
    time_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    window_start = (time_obj - timedelta(minutes=30)).isoformat().replace('+00:00', 'Z')
    
    try:
        # Query using BranchContextIndex GSI (assuming it exists)
        # projectId-branch as partition key, extractedAt as sort key
        response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='#pk = :pk AND #sk BETWEEN :start AND :end',
            FilterExpression='commitHash = :null AND author = :author',
            ExpressionAttributeNames={
                '#pk': 'projectId-branch',
                '#sk': 'extractedAt'
            },
            ExpressionAttributeValues={
                ':pk': f"{project_id}#{branch}",
                ':start': window_start,
                ':end': timestamp,
                ':null': None,
                ':author': author
            },
            Limit=1,
            ScanIndexForward=False  # Most recent first
        )
        
        if response.get('Items'):
            return response['Items'][0]
        return None
    except ClientError as e:
        print(f"Error finding orphaned record: {str(e)}")
        return None

def update_orphaned_record(event_id, commit_hash, timestamp):
    """Bind commitHash to an existing uncommitted record."""
    table = dynamodb.Table(CONTEXT_TABLE)
    table.update_item(
        Key={"eventId": event_id},
        UpdateExpression="SET commitHash = :hash, #status = :status, committedAt = :ts",
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':hash': commit_hash,
            ':status': 'complete',
            ':ts': timestamp
        }
    )
    print(f"Updated orphaned record {event_id} with commitHash {commit_hash}")

def publish_cloudwatch_metric(metric_name, value, project_id):
    """Publish a custom CloudWatch metric for monitoring."""
    try:
        cloudwatch.put_metric_data(
            Namespace='FlowSync',
            MetricData=[
                {
                    'MetricName': metric_name,
                    'Value': value,
                    'Unit': 'Count',
                    'Timestamp': datetime.utcnow(),
                    'Dimensions': [
                        {
                            'Name': 'ProjectId',
                            'Value': project_id
                        }
                    ]
                }
            ]
        )
        print(f"Published CloudWatch metric: {metric_name} = {value}")
    except Exception as e:
        print(f"Failed to publish CloudWatch metric: {str(e)}")

def handler(event, context):
    print("AI Processing Lambda invoked", json.dumps(event))
    project_id = event.get("projectId", "test-project")
    
    try:
        # Day 1: Use hardcoded diff for initial test
        diff = event.get("diff") or "diff --git a/file.txt b/file.txt\n..."
        commit_hash = event.get("commitHash", None)
        branch = event.get("branch", "main")
        author = event.get("author", "unknown")
        timestamp = event.get("timestamp", "2026-03-01T00:00:00Z")

        # Direction B: Check for orphaned record if this is a commit event
        if commit_hash:
            orphaned = find_orphaned_record(project_id, branch, author, timestamp)
            if orphaned:
                # Update existing record with commitHash instead of creating new one
                update_orphaned_record(orphaned['eventId'], commit_hash, timestamp)
                
                # Write audit record
                audit_record = {
                    "entityId": orphaned['eventId'],
                    "action": "commit_linked",
                    "timestamp": timestamp,
                    "projectId": project_id,
                    "branch": branch,
                    "author": author
                }
                write_audit_record(audit_record)
                
                # Update project activity
                update_project_activity(project_id, timestamp)
                
                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({
                        "message": "Orphaned record updated with commitHash",
                        "eventId": orphaned['eventId']
                    })
                }

        # Call Bedrock for extraction
        extraction = call_bedrock(diff)
        validate_extraction_schema(extraction)

        # Generate Titan embedding
        embedding_input = json.dumps(extraction)
        embedding = call_titan_embedding(embedding_input)

        # Build context record
        context_record = {
            "eventId": event.get("eventId", "test-event"),
            "projectId": project_id,
            "branch": branch,
            "commitHash": commit_hash,
            "status": "complete" if commit_hash else "uncommitted",
            "feature": extraction["feature"],
            "decision": extraction["decision"],
            "tasks": extraction["tasks"],
            "stage": extraction["stage"],
            "risk": extraction["risk"],
            "confidence": extraction["confidence"],
            "entities": extraction["entities"],
            "author": author,
            "modelVersion": MODEL_ID,
            "embedding": embedding,
            "extractedAt": timestamp,
            "processingDuration": 0  # Set real duration if needed
        }
        write_context_record(context_record)

        # Write audit record
        audit_record = {
            "entityId": context_record["eventId"],
            "action": "context_extracted",
            "timestamp": timestamp,
            "projectId": project_id,
            "branch": branch,
            "author": author
        }
        write_audit_record(audit_record)

        # Update project activity
        update_project_activity(project_id, timestamp)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "Context record written", "eventId": context_record["eventId"]})
        }
    except ValueError as e:
        # Schema validation or embedding failure
        print(f"SCHEMA_VALIDATION_ERROR: {str(e)}")
        publish_cloudwatch_metric('SchemaValidationFailure', 1, project_id)
        
        # Mark event as failed
        failed_record = {
            "eventId": event.get("eventId", "test-event"),
            "projectId": project_id,
            "status": "failed",
            "error": str(e),
            "timestamp": event.get("timestamp", "2026-03-01T00:00:00Z")
        }
        write_context_record(failed_record)
        
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Schema validation failed: {str(e)}"})
        }
    except Exception as e:
        print(f"Error in AI Processing Lambda: {str(e)}")
        publish_cloudwatch_metric('ProcessingFailure', 1, project_id)
        
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
