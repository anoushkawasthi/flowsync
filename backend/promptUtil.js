// Prompt construction utility for AWS Bedrock (gpt-oss-120b)
// Reads template from prompts/prompt_template.md and fills in event details

const fs = require('fs');
const path = require('path');

/**
 * Build a Bedrock prompt from event data using the template.
 * @param {Object} event - Event data (commit, file change, note, etc.)
 * @returns {string} - Filled prompt string
 */
function buildBedrockPrompt(event) {
    const templatePath = path.join(__dirname, '../prompts/prompt_template.md');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders with event data
    template = template.replace('[Project Name]', event.projectName || '')
        .replace('[Commit/File Change/Developer Note]', event.eventType || '')
        .replace('[Unique Identifier]', event.eventId || '')
        .replace('[YYYY-MM-DD HH:MM:SS]', event.timestamp || '')
        .replace('[Name or ID]', event.author || '')
        .replace('[Project Identifier]', event.projectId || '')
        .replace('[If applicable]', event.commitMessage || '')
        .replace('[If applicable]', event.codeDiff || '')
        .replace('[If applicable]', event.developerNote || '')
        .replace('[Event ID]', event.eventId || '')
        .replace('[VS Code Extension/Event Ingestion Backend]', event.source || '');

    return template;
}

module.exports = { buildBedrockPrompt };
