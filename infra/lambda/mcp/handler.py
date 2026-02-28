import json

def handler(event, context):
    print('MCP Lambda invoked', json.dumps(event))
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'message': 'MCP stub — not yet implemented'}),
    }
