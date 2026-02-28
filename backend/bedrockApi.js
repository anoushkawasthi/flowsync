// AWS Bedrock API integration for gpt-oss-120b
// Uses promptUtil to build prompt and calls Bedrock

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { buildBedrockPrompt } = require('./promptUtil');

// Configure AWS Bedrock client
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

/**
 * Calls AWS Bedrock with constructed prompt and returns response
 * @param {Object} event - Event data for prompt construction
 * @returns {Promise<string>} - Model response
 */
async function callBedrock(event) {
    const prompt = buildBedrockPrompt(event);
    const input = {
        modelId: 'openai.gpt-oss-120b-1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            inference_config: {
                maxTokens: 512,
                temperature: 1,
                topP: 0.5
            },
            additional_model_request_fields: {},
            performance_config: {
                latency: "standard"
            }
        })
    };
    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    // Decode response from Buffer to UTF-8 string
    const buffer = Buffer.from(response.body);
    const text = buffer.toString('utf8');
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

module.exports = { callBedrock };
