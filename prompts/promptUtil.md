# Usage: Bedrock Prompt Utility

This utility helps construct clean, deterministic prompts for AWS Bedrock (gpt-oss-120b) using the template in `prompts/prompt_template.md`.

## How to Use

1. Import the utility in your backend code:
   ```js
   const { buildBedrockPrompt } = require('./promptUtil');
   ```
2. Prepare your event object:
   ```js
   const event = {
     projectName: 'Flowsync',
     eventType: 'Commit',
     eventId: 'evt-123',
     timestamp: '2026-02-28 10:00:00',
     author: 'devuser',
     projectId: 'proj-001',
     commitMessage: 'Refactored backend logic',
     codeDiff: 'diff --git ...',
     developerNote: 'Improved performance',
     source: 'VS Code Extension'
   };
   ```
3. Build the prompt:
   ```js
   const prompt = buildBedrockPrompt(event);
   // Use prompt in Bedrock API call
   ```

## Next Steps
- Integrate with Lambda handler for event processing
- Ensure all event types are supported
- Update documentation as needed
