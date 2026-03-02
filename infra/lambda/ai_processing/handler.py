import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
from botocore.exceptions import ClientError

# Model and embedding configuration
MODEL_ID = "us.amazon.nova-pro-v1:0"
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v1"

# DynamoDB table names (set via environment variables or hardcoded for prototype)
CONTEXT_TABLE = os.environ.get("CONTEXT_TABLE", "flowsync-context")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE", "flowsync-audit")
PROJECTS_TABLE = os.environ.get("PROJECTS_TABLE", "flowsync-projects")

bedrock_client = boto3.client("bedrock-runtime")
dynamodb = boto3.resource("dynamodb")
cloudwatch = boto3.client("cloudwatch")

def call_bedrock(event_data):
    """Call Nova Pro via Bedrock Converse API with commit metadata and return extracted context as JSON."""
    diff         = event_data.get('diff', '')
    commit_hash  = event_data.get('commitHash', '')
    message      = event_data.get('message', '')
    author       = event_data.get('author', '')
    branch       = event_data.get('branch', 'main')
    changed_files = event_data.get('changedFiles', [])

    system_prompt = (
        "You are a deterministic software project intelligence extractor. "
        "Return STRICT JSON only. No explanation, no markdown, no free text outside the JSON object."
    )

    user_prompt = f"""Analyze this Git push and extract structured project intelligence.

Commit Hash: {commit_hash}
Commit Message: {message}
Author: {author}
Branch: {branch}
Changed Files: {', '.join(changed_files) if changed_files else 'not provided'}

Diff:
{diff}

Return ONLY a valid JSON object with this exact structure:
{{
  "feature": "name of the feature or module being modified (e.g. 'Auth pipeline', 'Event ingestion', 'Dashboard UI')",
  "decision": "<see rules below>",
  "tasks": ["specific remaining task inferred from TODOs, partial implementations, or stub functions — empty array if none visible"],
  "stage": "one of: Setup | Feature Development | Refactoring | Bug Fix | Testing | Documentation",
  "risk": "a concrete risk visible in the diff (e.g. 'No error handling on DB write', 'Token logged in plaintext', 'No input validation') — null if none",
  "confidence": 0.85,
  "entities": ["every function name, class name, or filename directly modified in this diff"]
}}

Rules for 'decision' field:
- SET to a concise string when the diff shows ANY of these patterns:
    * One technology/library/approach REPLACED by another (e.g. removed bcrypt import, added scrypt call)
    * An explicit design choice in data structures (e.g. storing token as salt:hash, using GSI for query)
    * A new architectural pattern introduced (e.g. fire-and-forget async invoke, singleton SDK client)
    * A change in API style or protocol (e.g. switched from invoke_model to converse API)
    * A security or performance tradeoff made explicit in the code or commit message
    * Added/removed a dependency that implies a deliberate choice
- SET to null ONLY when the diff is purely additive content with no technology or approach choice visible
- Be specific: write WHAT was chosen and WHY if evident (e.g. 'Used Bedrock Converse API over invoke_model for model-agnostic interface')

Extract only factual information present in the diff and message. Do not invent or assume."""

    # Bedrock Converse API — works with Nova Pro and all Amazon/Meta models
    response = bedrock_client.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        inferenceConfig={"maxTokens": 2000, "temperature": 0, "topP": 1}
    )

    print(f"Bedrock response metadata: {json.dumps(response.get('usage', {}), default=str)}")

    # Converse API response format: output.message.content[0].text
    try:
        output_text = response['output']['message']['content'][0]['text'].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError(f"Unexpected Bedrock Converse response structure: {e}. Response: {response}")

    # Strip markdown code fences if present
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
        # BranchContextIndex GSI: PK=projectId, SK=branch#extractedAt
        # Filter for uncommitted records (commitHash is None) by this author
        response = table.query(
            IndexName='BranchContextIndex',
            KeyConditionExpression='projectId = :pk AND branchExtractedAt BETWEEN :start AND :end',
            FilterExpression='commitHash = :null AND author = :author',
            ExpressionAttributeValues={
                ':pk': project_id,
                ':start': f"{branch}#{window_start}",
                ':end': f"{branch}#{timestamp}",
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
        # Extract all fields from the event payload (forwarded by Ingestion Lambda)
        payload      = event.get("payload", event)   # support both wrapped and flat
        diff         = payload.get("diff") or event.get("diff") or "diff --git a/file.txt b/file.txt\n..."
        commit_hash  = payload.get("commitHash") or event.get("commitHash", None)
        branch       = event.get("branch", "main")
        author       = payload.get("author") or event.get("author", "unknown")
        timestamp    = event.get("timestamp", datetime.utcnow().isoformat() + "Z")
        parent_branch = event.get("parentBranch", None)
        changed_files = payload.get("changedFiles", [])
        message       = payload.get("message") or event.get("message", "")

        event_data = {
            "diff": diff, "commitHash": commit_hash, "message": message,
            "author": author, "branch": branch, "changedFiles": changed_files
        }

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
        extraction = call_bedrock(event_data)
        validate_extraction_schema(extraction)

        # Generate Titan embedding
        embedding_input = json.dumps(extraction)
        embedding = call_titan_embedding(embedding_input)

        # Build context record — matches flowsync-context schema exactly
        context_record = {
            "eventId":            event.get("eventId", "test-event"),
            "projectId":          project_id,
            "branch":             branch,
            "branchExtractedAt":  f"{branch}#{timestamp}",   # BranchContextIndex GSI SK
            "parentBranch":       parent_branch,
            "commitHash":         commit_hash,
            "status":             "complete" if commit_hash else "uncommitted",
            "feature":            extraction["feature"],
            "decision":           extraction["decision"],
            "tasks":              extraction["tasks"],
            "stage":              extraction["stage"],
            "risk":               extraction["risk"],
            "confidence":         extraction["confidence"],
            "entities":           extraction["entities"],
            "author":             author,
            "agentReasoning":     None,
            "modelVersion":       MODEL_ID,
            "embedding":          embedding,
            "extractedAt":        timestamp,
            "processingDuration": 0
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
