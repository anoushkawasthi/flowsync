// Test script to call Titan Embeddings via Bedrock
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

async function callTitanEmbedding(text) {
    const input = {
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            inputText: text
        })
    };
    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    const buffer = Buffer.from(response.body);
    const result = JSON.parse(buffer.toString('utf8'));
    return result;
}

(async () => {
    const text = 'Flowsync embedding test for JWT refresh token.';
    const result = await callTitanEmbedding(text);
    console.log('Titan Embedding result:', result);
})();
