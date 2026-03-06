# FlowSync — Infrastructure (AWS CDK)

*Persistent Memory for AI Coding Agents.*

AWS CDK TypeScript stack that provisions all backend resources for FlowSync.

---

## What's deployed

### DynamoDB tables

| Table | PK | SK | Purpose |
|---|---|---|---|
| `flowsync-projects` | `projectId` | — | Project metadata and API tokens |
| `flowsync-events` | `projectId` | `timestampEventId` | Raw ingested push events |
| `flowsync-context` | `eventId` | — | AI-extracted context records with embeddings |

**GSIs on `flowsync-events`:** `EventIdIndex` (by `eventId`), `BranchIndex` (by `projectId` + `branchTimestamp`)

**GSIs on `flowsync-context`:** `ProjectContextIndex` (by `projectId` + `extractedAt`), `BranchContextIndex` (by `projectId` + `branchExtractedAt`)

### Lambda functions

| Function | Runtime | Trigger | Purpose |
|---|---|---|---|
| `ingestion` | Python 3.12 | API Gateway POST /events | Validates push payloads, writes to `flowsync-events`, invokes AI processing asynchronously; also detects merges and triggers branch propagation |
| `ai_processing` | Python 3.12 | Invoked async by ingestion | Calls Bedrock Nova Pro to extract context, generates Titan Embeddings, writes to `flowsync-context`; handles merge propagation |
| `mcp` | Python 3.12 | API Gateway POST /mcp | Routes the 5 MCP tool calls: `get_project_context`, `get_recent_changes`, `search_context`, `log_context`, `get_events` |
| `query` | Python 3.12 | API Gateway POST /query | Natural language Q&A — RAG pipeline using Titan Embeddings cosine similarity + Nova Pro |
| `chat` | Python 3.12 | API Gateway POST /chat | Conversational chat over project context using Nova Lite |

### API Gateway

Single REST API at `https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod` with routes:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/events` | Bearer token | Ingest push event from VS Code extension |
| POST | `/projects` | None | Create a new project |
| GET | `/api/v1/projects/{id}/events` | Bearer token | Fetch context records for dashboard |
| POST | `/mcp` | None | MCP tool dispatch |
| POST | `/query` | Bearer token | Natural language Q&A |
| POST | `/chat` | Bearer token | Conversational chat |

### S3

One bucket (`flowsync-raw-events-*`) used to archive raw event payloads.

---

## Setup & deployment

```bash
cd infra
npm install
npm run build

# First time only
npx cdk bootstrap

# Deploy
npx cdk deploy

# Preview changes
npx cdk diff

# Synthesize CloudFormation template without deploying
npx cdk synth
```

> Requires AWS CLI configured with credentials for `us-east-1`.

## Other commands

```bash
npm run watch   # watch & recompile TypeScript
npm test        # run CDK unit tests (Jest)
```

---

## Notes

- All tables use `PAY_PER_REQUEST` billing (no capacity planning needed)
- All resources have `removalPolicy: DESTROY` for easy teardown after the hackathon
- `shared/` contains Python utilities shared across Lambda functions (copied at deploy time)
