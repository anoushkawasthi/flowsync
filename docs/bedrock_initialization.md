# AWS Bedrock Initialization Guide

This document explains how AWS Bedrock is initialized and integrated in the Flowsync project.

## Prerequisites
- AWS account with Bedrock access in the desired region (e.g., us-east-1)
- IAM user/role with permissions: `bedrock:InvokeModel`, `bedrock:ListFoundationModels`
- AWS CLI v2 installed and configured (`aws configure`)
- Node.js and npm installed

## Steps to Initialize Bedrock

1. **Configure AWS Credentials**
   - Run `aws configure` and enter your Access Key, Secret Key, region, and output format.
   - Example:
     ```sh
     aws configure
     # AWS Access Key ID: <your-key>
     # AWS Secret Access Key: <your-secret>
     # Default region name: us-east-1
     # Default output format: json
     ```

2. **Install AWS SDK**
   - In your project directory, run:
     ```sh
     npm install @aws-sdk/client-bedrock-runtime
     ```

3. **Initialize Bedrock Client in Code**
   - Example (Node.js):
     ```js
     const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
     const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
     ```

4. **Invoke Bedrock Model**
   - Use the correct model ID (e.g., `openai.gpt-oss-120b-1:0`).
   - Send a properly formatted JSON request body.
   - Example:
     ```js
     const input = {
       modelId: 'openai.gpt-oss-120b-1:0',
       contentType: 'application/json',
       accept: 'application/json',
       body: JSON.stringify({
         messages: [{ role: 'user', content: 'Your prompt here' }],
         inference_config: { maxTokens: 512, temperature: 1, topP: 0.5 },
         additional_model_request_fields: {},
         performance_config: { latency: 'standard' }
       })
     };
     ```

5. **Handle the Response**
   - Decode the response from Buffer to UTF-8 string and parse as JSON.
   - Example:
     ```js
     const buffer = Buffer.from(response.body);
     const text = buffer.toString('utf8');
     const result = JSON.parse(text);
     ```

## Troubleshooting
- Ensure your IAM permissions are correct.
- Use the correct model ID and region.
- Check network/firewall settings if you encounter timeouts.

## References
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [Flowsync README](../README.md)
