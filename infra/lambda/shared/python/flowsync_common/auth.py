"""
FlowSync Authentication Module
Python implementation of scrypt token verification matching Node.js ingestion Lambda pattern.
"""

import hashlib
import hmac
import boto3
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def extract_token(event):
    """
    Extract Bearer token from API Gateway event headers.
    Returns token string or None.
    """
    headers = event.get('headers', {})
    logger.debug(f"[auth] headers present: {list(headers.keys())}")
    
    # API Gateway may preserve casing - check both
    auth_header = headers.get('Authorization') or headers.get('authorization')
    
    if not auth_header:
        logger.warning("[auth] No Authorization header found")
        return None
    
    parts = auth_header.split(' ')
    if len(parts) != 2 or parts[0] != 'Bearer':
        logger.warning(f"[auth] Malformed Authorization header: scheme='{parts[0] if parts else 'empty'}'")
        return None
    
    token = parts[1]
    logger.debug(f"[auth] Extracted token: length={len(token)}, prefix={token[:8]}...")
    return token


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
        logger.error(f"[auth] stored_hash malformed or missing (has colon: {':' in (stored_hash or '')}")
        return False
    
    try:
        salt, expected_hash = stored_hash.split(':')
        logger.debug(f"[auth] verify_token: token_len={len(token)}, salt_len={len(salt)}, expected_hash_len={len(expected_hash)}")
        logger.debug(f"[auth] salt prefix={salt[:8]}..., expected_hash prefix={expected_hash[:8]}...")
        
        # Python scrypt: must specify n, r, p explicitly (Node.js uses defaults)
        # Node.js scryptSync defaults: n=16384, r=8, p=1
        # Node.js scryptSync receives the salt as a UTF-8 string (hex chars),
        # so Python must do the same — encode as UTF-8, NOT bytes.fromhex().
        salt_bytes = salt.encode('utf-8')
        logger.debug(f"[auth] salt_bytes length={len(salt_bytes)} (expect 32 for 16-byte randomBytes hex)")
        
        derived = hashlib.scrypt(
            token.encode(),
            salt=salt_bytes,
            n=16384,
            r=8,
            p=1,
            dklen=64
        )
        
        derived_hex = derived.hex()
        logger.debug(f"[auth] derived_hex prefix={derived_hex[:8]}..., expected prefix={expected_hash[:8]}...")
        
        match = hmac.compare_digest(expected_hash, derived_hex)
        logger.info(f"[auth] verify_token result: {'MATCH' if match else 'MISMATCH'}")
        return match
    except (ValueError, Exception) as e:
        logger.error(f"[auth] Token verification exception: {type(e).__name__}: {str(e)}")
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
    logger.info(f"[auth] authenticate called: project_id={project_id}, table={projects_table_name}")
    
    token = extract_token(event)
    
    if not token:
        logger.warning("[auth] Authentication failed: no token extracted")
        return {
            'success': False,
            'error': {'error': 'invalid_token', 'message': 'Missing Authorization header'},
            'statusCode': 401
        }
    
    # Fetch project from DynamoDB
    table = dynamodb.Table(projects_table_name)
    
    try:
        logger.debug(f"[auth] DynamoDB get_item: table={projects_table_name}, projectId={project_id}")
        response = table.get_item(Key={'projectId': project_id})
        
        if 'Item' not in response:
            logger.warning(f"[auth] Project not found: {project_id}")
            return {
                'success': False,
                'error': {'error': 'project_not_found', 'message': f'Project {project_id} not found'},
                'statusCode': 404
            }
        
        project = response['Item']
        logger.debug(f"[auth] Project found: keys={list(project.keys())}")
        
        stored_hash = project.get('apiTokenHash')
        
        if not stored_hash:
            logger.error(f"[auth] No apiTokenHash field on project {project_id}. Fields present: {list(project.keys())}")
            return {
                'success': False,
                'error': {'error': 'invalid_configuration', 'message': 'Project has no API token configured'},
                'statusCode': 500
            }
        
        logger.debug(f"[auth] apiTokenHash found, length={len(stored_hash)}")
        
        # Verify token
        if not verify_token(token, stored_hash):
            logger.warning(f"[auth] Token mismatch for project {project_id}")
            return {
                'success': False,
                'error': {'error': 'invalid_token', 'message': 'Token verification failed'},
                'statusCode': 401
            }
        
        logger.info(f"[auth] Authentication successful for project {project_id}")
        return {'success': True, 'project': project}
    
    except ClientError as e:
        logger.error(f"[auth] DynamoDB ClientError: {e.response['Error']['Code']}: {e.response['Error']['Message']}")
        return {
            'success': False,
            'error': {'error': 'database_error', 'message': 'Failed to authenticate request'},
            'statusCode': 500
        }
