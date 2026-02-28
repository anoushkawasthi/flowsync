// Test script to build Bedrock prompt for ChatGPT extraction
const { buildBedrockPrompt } = require('../backend/promptUtil');
const fs = require('fs');

const event = JSON.parse(fs.readFileSync('./backend/test_event.json', 'utf8'));
const prompt = buildBedrockPrompt(event);
console.log(prompt);
