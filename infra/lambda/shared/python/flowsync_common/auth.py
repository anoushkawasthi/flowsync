"""
FlowSync Authentication Module
Python implementation of scrypt token verification matching Node.js ingestion Lambda pattern.
"""

import hashlib
import boto3
from botocore.exceptions import ClientError


def extract_token(event):
    """
    Extract Bearer token from API Gateway event headers.
    Returns token string or None.
    """
    headers = event.get('headers', {})
    
    # API Gateway may preserve casing - check both
    auth_header = headers.get('Authorization') or headers.get('authorization')
    
    if not auth_header:
        return None
    
    parts = auth_header.split(' ')
    if len(parts) != 2 or parts[0] != 'Bearer':
        return None
    
    return parts[1]


def verify_token(token, stored_hash):
    """
    Verify token using scrypt KDF matching Node.js pattern.
    
    Node.js pattern:
      const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
    
    Python equivalent:
      hashlib.scrypt(token.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=64)
    
    Args:
        token: Plaintext token string
        stored_hash: Format "salt:hash" (both hex strings)
    
    Returns:
        True if token matches, False otherwise
    """
    if not stored_hash or ':' not in stored_hash:
        return False
    
    try:
        salt, expected_hash = stored_hash.split(':')
        
        # Python scrypt: must specify n, r, p explicitly (Node.js uses defaults)
        # Node.js scryptSync defaults: n=16384, r=8, p=1
        derived = hashlib.scrypt(
            token.encode(),
            salt=bytes.fromhex(salt),
            n=16384,
            r=8,
            p=1,
            dklen=64
        )
        
        derived_hex = derived.hex()
        
        # Timing-safe comparison (Python 3.3+)
        return hashlib.compare_digest(expected_hash, derived_hex)
    except (ValueError, Exception) as e:
        print(f"Token verification error: {str(e)}")
        return False


def authenticate(event, project_id, dynamodb, projects_table_name):
    """
    Authenticate request against project's API token.
    
    Args:
        event: API Gateway event
        project_id: Project ID from path parameters
        dynamodb: boto3 DynamoDB resource
        projects_table_name: DynamoDB table name
    
    Returns:
        dict: {'success': True, 'project': {...}} or {'success': False, 'error': ..., 'statusCode': ...}
    """
    token = extract_token(event)
    
    if not token:
        return {
            'success': False,
            'error': {'error': 'invalid_token', 'message': 'Missing Authorization header'},
            'statusCode': 401
        }
    
    # Fetch project from DynamoDB
    table = dynamodb.Table(projects_table_name)
    
    try:
        response = table.get_item(Key={'projectId': project_id})
        
        if 'Item' not in response:
            return {
                'success': False,
                'error': {'error': 'project_not_found', 'message': f'Project {project_id} not found'},
                'statusCode': 404
            }
        
        project = response['Item']
        stored_hash = project.get('apiTokenHash')
        
        if not stored_hash:
            return {
                'success': False,
                'error': {'error': 'invalid_configuration', 'message': 'Project has no API token configured'},
                'statusCode': 500
            }
        
        # Verify token
        if not verify_token(token, stored_hash):
            return {
                'success': False,
                'error': {'error': 'invalid_token', 'message': 'Token verification failed'},
                'statusCode': 401
            }
        
        return {'success': True, 'project': project}
    
    except ClientError as e:
        print(f"DynamoDB error during authentication: {str(e)}")
        return {
            'success': False,
            'error': {'error': 'database_error', 'message': 'Failed to authenticate request'},
            'statusCode': 500
        }
