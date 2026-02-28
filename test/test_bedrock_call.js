// Test script to call Bedrock ChatGPT with extraction prompt
const { callBedrock } = require('../backend/bedrockApi');
const fs = require('fs');

(async () => {
  const event = JSON.parse(fs.readFileSync('./backend/test_event.json', 'utf8'));
  const response = await callBedrock(event);
  console.log('Bedrock ChatGPT response:', response);
})();
