import json

def handler(event, context):
    print('Query Lambda invoked', json.dumps(event))
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'message': 'Query stub — not yet implemented'}),
    }
