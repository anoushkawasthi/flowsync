// Test script for end-to-end Bedrock prompt flow
// Simulates an event and prints Bedrock response

const { callBedrock } = require('../backend/bedrockApi');

const testEvent = {
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

(async () => {
    try {
        const response = await callBedrock(testEvent);
        console.log('Bedrock Response:', response);
    } catch (err) {
        console.error('Error calling Bedrock:', err);
    }
})();
