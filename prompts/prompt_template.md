# Bedrock Prompt Template

<!--
  Purpose: Template for constructing prompts sent to AWS Bedrock (gpt-oss-120b).
  Usage: Fill in event details and context before sending to the AI model.
  Traceability: Always include originating event ID and project ID.
-->

## Context
- Project: [Project Name]
- Event Type: [Commit/File Change/Developer Note]
- Event ID: [Unique Identifier]
- Timestamp: [YYYY-MM-DD HH:MM:SS]
- Author: [Name or ID]
- Project ID: [Project Identifier]

## Event Details
- Commit Message: [If applicable]
- Code Diff: [If applicable]
- Developer Note: [If applicable]

## Instructions
- Extract developer intent and purpose of changes.
- Identify changed functions, classes, modules.
- Detect relationships between modified files.
- Extract key concepts, decisions, and action items.
- Output must be deterministic for identical input.

## Source
- Originating Event ID: [Event ID]
- Source: [VS Code Extension/Event Ingestion Backend]
