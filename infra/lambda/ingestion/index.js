'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// FlowSync — Ingestion Lambda
// Runtime: Node.js 20.x | Handler: index.handler
//
// Routes (REST API v1 — event.resource gives the route pattern):
//   POST /api/v1/projects              → createProject()
//   POST /api/v1/events                → ingestEvent()
//   GET  /api/v1/projects/{projectId}  → getProject()   (join-flow token check)
//
// No external npm packages — uses only:
//   • @aws-sdk v3  (built into Node.js 20.x Lambda runtime)
//   • crypto       (Node.js built-in)
// ─────────────────────────────────────────────────────────────────────────────

// ── AWS SDK v3 (built into Node.js 20.x Lambda runtime — no npm install needed) ──
const { DynamoDBClient }            = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient,
        PutCommand, GetCommand }    = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand}= require('@aws-sdk/client-lambda');
const crypto                        = require('crypto');           // Node.js built-in

// ── Config — from Lambda environment variables set by CDK ──────────────────
const PROJECTS_TABLE  = process.env.PROJECTS_TABLE;               // flowsync-projects
const EVENTS_TABLE    = process.env.EVENTS_TABLE;                 // flowsync-events
const AUDIT_TABLE     = process.env.AUDIT_TABLE;                  // flowsync-audit
const RAW_EVENTS_BUCKET = process.env.RAW_EVENTS_BUCKET;          // flowsync-raw-events-{account}
const AI_FUNCTION     = process.env.AI_PROCESSING_FUNCTION_NAME;  // flowsync-ai-processing

// ── Singleton SDK clients ───────────────────────────────────────────────────
// Created once per cold-start and reused across warm invocations (AWS best practice).
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' }),
  { marshallOptions: { removeUndefinedValues: true } },  // prevents SerializationException on undefined attrs
);
const s3     = new S3Client({ region: 'us-east-1' });
const lambda = new LambdaClient({ region: 'us-east-1' });

// ── Validation regex ────────────────────────────────────────────────────────
const UUID_V4     = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_HASH = /^[0-9a-f]{40}$/i;
const ISO_8601    = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const NAME_REGEX  = /^[a-zA-Z0-9_-]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN HELPERS  (crypto built-in — no bcryptjs needed)
//
// hashToken:   scrypt KDF — produces "salt:hash", stored in DynamoDB
// verifyToken: timing-safe comparison to prevent timing attacks
// ─────────────────────────────────────────────────────────────────────────────
function hashToken(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyToken(plaintext, stored) {
  const [salt, hash] = (stored ?? '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(plaintext, salt, 64).toString('hex');
  // timingSafeEqual prevents timing-based token enumeration attacks
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE BUILDER
// API Gateway REST API expects { statusCode, headers, body: string }
// ─────────────────────────────────────────────────────────────────────────────
function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin':  '*',                          // CDK adds CORS but belt-and-suspenders
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// Extracts Bearer token → looks up project in DynamoDB → verifies hash
// Returns { project } on success, { error, statusCode } on failure
// ─────────────────────────────────────────────────────────────────────────────
function extractToken(headers) {
  // REST API preserves casing; handle both just in case
  const raw = headers?.Authorization ?? headers?.authorization;
  if (!raw) return null;
  const [scheme, token] = raw.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function authenticate(headers, projectId) {
  const token = extractToken(headers);
  if (!token) return { error: { error: 'invalid_token', message: 'Missing Authorization header' }, statusCode: 401 };

  const { Item } = await dynamo.send(new GetCommand({ TableName: PROJECTS_TABLE, Key: { projectId } }));

  if (!Item?.apiTokenHash) return { error: { error: 'invalid_token' }, statusCode: 401 };
  if (!verifyToken(token, Item.apiTokenHash)) return { error: { error: 'invalid_token' }, statusCode: 401 };

  return { project: Item };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
function validateProjectInput(input) {
  const errors = [];
  if (!input.name)                          errors.push('name: required');
  else if (!NAME_REGEX.test(input.name))    errors.push('name: alphanumeric, hyphens, underscores only');
  if (!input.description)                   errors.push('description: required');
  if (!Array.isArray(input.languages) || input.languages.length === 0)
                                            errors.push('languages: required, must be a non-empty array');
  if (!input.defaultBranch)                 errors.push('defaultBranch: required');
  if (input.frameworks  && !Array.isArray(input.frameworks))  errors.push('frameworks: must be an array');
  if (input.teamMembers && !Array.isArray(input.teamMembers)) errors.push('teamMembers: must be an array');
  else if (Array.isArray(input.teamMembers)) {
    input.teamMembers.forEach((m, i) => {
      if (!m.name) errors.push(`teamMembers[${i}].name: required`);
      if (!m.role) errors.push(`teamMembers[${i}].role: required`);
    });
  }
  return errors;
}

function validateEvent(ev) {
  const errors = [];
  if (!ev.eventId)                          errors.push('eventId: required');
  else if (!UUID_V4.test(ev.eventId))       errors.push('eventId: must be a valid UUID v4');
  if (!ev.projectId)                        errors.push('projectId: required');
  if (!['push','developer_note'].includes(ev.eventType))
                                            errors.push('eventType: must be push or developer_note');
  if (!ev.timestamp)                        errors.push('timestamp: required');
  else if (!ISO_8601.test(ev.timestamp))    errors.push('timestamp: must be valid ISO 8601 UTC');
  if (!ev.branch)                           errors.push('branch: required');
  else if (ev.branch.length > 255)          errors.push('branch: max 255 characters');

  if (!ev.payload) { errors.push('payload: required'); return errors; }

  if (ev.eventType === 'push') {
    const p = ev.payload;
    if (!p.commitHash)                      errors.push('commitHash: required for push events');
    else if (!COMMIT_HASH.test(p.commitHash)) errors.push('commitHash: must be exactly 40 hex characters');
    if (p.message == null)                  errors.push('message: required for push events');
    if (!p.author)                          errors.push('author: required for push events');
    if (p.changedFiles && !Array.isArray(p.changedFiles)) errors.push('changedFiles: must be an array');
    if (typeof p.diff === 'string' && p.diff.length > 50_000) errors.push('diff: max 50000 characters');
  }

  if (ev.eventType === 'developer_note') {
    const p = ev.payload;
    if (!p.text)                            errors.push('text: required for developer_note events');
    if (!p.filePath)                        errors.push('filePath: required for developer_note events');
    else if (p.filePath.includes('..'))     errors.push('filePath: directory traversal (..) not allowed');
    if (p.lineNumber == null)               errors.push('lineNumber: required for developer_note events');
    else if (!Number.isInteger(p.lineNumber) || p.lineNumber < 0)
                                            errors.push('lineNumber: must be a non-negative integer');
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST /api/v1/projects
// Creates a new project, generates + hashes API token, returns plaintext once.
// ─────────────────────────────────────────────────────────────────────────────
async function createProject(body) {
  const input = typeof body === 'string' ? JSON.parse(body) : body;

  const errors = validateProjectInput(input);
  if (errors.length) return respond(400, { error: 'validation_failed', details: errors });

  const projectId    = crypto.randomUUID();                        // built-in Node.js 20.x
  const apiToken     = crypto.randomBytes(32).toString('hex');     // 64-char hex, 256-bit entropy
  const apiTokenHash = hashToken(apiToken);                        // scrypt hash — never stored in plaintext

  const now = new Date().toISOString();
  const record = {
    projectId,
    name:           input.name,
    description:    input.description,
    languages:      input.languages,
    frameworks:     input.frameworks    ?? [],
    defaultBranch:  input.defaultBranch,
    teamMembers:    input.teamMembers   ?? [],
    apiTokenHash,
    createdAt:      now,
    lastActivityAt: now,
    eventCount:     0,
  };

  // ── Critical write ──
  await dynamo.send(new PutCommand({ TableName: PROJECTS_TABLE, Item: record }));

  // ── Non-fatal: audit record ──
  try {
    await dynamo.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        entityId:   projectId,
        timestamp:  now,
        entityType: 'project',
        action:     'created',
        actor:      'system',
        changes:    { name: input.name, defaultBranch: input.defaultBranch },
        reason:     'Project initialised via onboarding wizard',
      },
    }));
  } catch (err) { console.error('[non-fatal] Audit write failed:', err.message); }

  // Plaintext token returned ONCE — after this it is unrecoverable from the backend
  return respond(200, { projectId, apiToken });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST /api/v1/events
// Validates → writes to DynamoDB → archives to S3 → invokes AI Lambda → returns.
// SLA: response within 500 ms (returns after DynamoDB write, not after AI).
// ─────────────────────────────────────────────────────────────────────────────
async function ingestEvent(headers, body) {
  let event;
  try   { event = typeof body === 'string' ? JSON.parse(body) : body; }
  catch { return respond(400, { error: 'invalid_json', message: 'Body must be valid JSON' }); }

  // Auth — Bearer token vs project hash
  const auth = await authenticate(headers, event.projectId);
  if (auth.error) return respond(auth.statusCode, auth.error);

  // Schema validation
  const errors = validateEvent(event);
  if (errors.length) return respond(400, { error: 'validation_failed', details: errors });

  const receivedAt = new Date().toISOString();

  // Build event record
  // timestampEventId  → SK for flowsync-events (chronological order within project)
  // branchTimestamp   → SK for BranchIndex GSI  (CDK defines this as a separate attribute)
  const record = {
    projectId:        event.projectId,
    timestampEventId: `${event.timestamp}#${event.eventId}`,     // flowsync-events SK
    branchTimestamp:  `${event.branch}#${event.timestamp}`,      // BranchIndex GSI SK
    eventId:          event.eventId,
    eventType:        event.eventType,
    branch:           event.branch,
    parentBranch:     event.payload.parentBranch ?? null,
    payload:          event.payload,
    receivedAt,
    processingStatus: 'pending',
  };

  // ── Critical write — everything else is non-fatal ──
  await dynamo.send(new PutCommand({ TableName: EVENTS_TABLE, Item: record }));

  // ── Non-fatal: S3 archive ──
  try {
    await s3.send(new PutObjectCommand({
      Bucket:      RAW_EVENTS_BUCKET,
      Key:         `raw-events/${event.projectId}/${event.eventId}.json`,
      Body:        JSON.stringify(event, null, 2),
      ContentType: 'application/json',
    }));
  } catch (err) { console.error('[non-fatal] S3 archive failed:', err.message); }

  // ── Non-fatal: AI Processing Lambda (fire-and-forget) ──
  // InvocationType: 'Event' → Lambda queues it and returns HTTP 202 instantly.
  // We do NOT wait — this is what keeps us inside the 500 ms SLA.
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: AI_FUNCTION,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({       // SDK v3 requires Buffer/Uint8Array, not raw string
        eventId:      event.eventId,
        projectId:    event.projectId,
        eventType:    event.eventType,
        branch:       event.branch,
        parentBranch: event.payload.parentBranch ?? null,
        payload:      event.payload,
        timestamp:    event.timestamp,
      })),
    }));
  } catch (err) { console.error('[non-fatal] AI invoke failed:', err.message); }

  // ── Non-fatal: audit record ──
  try {
    await dynamo.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        entityId:   event.eventId,
        timestamp:  receivedAt,
        entityType: 'event',
        action:     'created',
        actor:      event.payload.author ?? 'system',
        changes: {
          eventType:  event.eventType,
          branch:     event.branch,
          commitHash: event.payload.commitHash ?? null,
        },
      },
    }));
  } catch (err) { console.error('[non-fatal] Audit write failed:', err.message); }

  // ── 200 response — within 500 ms SLA ──
  return respond(200, {
    eventId:   event.eventId,
    projectId: event.projectId,
    branch:    event.branch,
    status:    'processing',
    receivedAt,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET /api/v1/projects/{projectId}
// Used by Dev 2+ join flow — validates token, returns project info (no hash).
// ─────────────────────────────────────────────────────────────────────────────
async function getProject(headers, pathParameters) {
  const { projectId } = pathParameters ?? {};
  if (!projectId) return respond(400, { error: 'validation_failed', details: ['projectId: required'] });

  const auth = await authenticate(headers, projectId);
  if (auth.error) return respond(auth.statusCode, auth.error);

  const p = auth.project;
  return respond(200, {
    projectId:      p.projectId,
    name:           p.name,
    description:    p.description,
    languages:      p.languages,
    frameworks:     p.frameworks,
    defaultBranch:  p.defaultBranch,
    teamMembers:    p.teamMembers,
    lastActivityAt: p.lastActivityAt,
    eventCount:     p.eventCount,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
//
// API Gateway REST API (v1) passes:
//   event.httpMethod   — GET, POST, etc.
//   event.resource     — route pattern: /api/v1/projects/{projectId}
//   event.pathParameters — { projectId: 'actual-value' }
//   event.headers      — request headers
//   event.body         — raw request body string
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  console.log(JSON.stringify({ msg: 'request', method: event.httpMethod, resource: event.resource }));

  try {
    const method   = event.httpMethod ?? '';
    const resource = event.resource   ?? '';

    if (method === 'OPTIONS') return respond(200, { ok: true });

    if (method === 'POST' && resource === '/api/v1/projects')
      return await createProject(event.body);

    if (method === 'POST' && resource === '/api/v1/events')
      return await ingestEvent(event.headers, event.body);

    if (method === 'GET' && resource === '/api/v1/projects/{projectId}')
      return await getProject(event.headers, event.pathParameters);

    return respond(404, { error: 'not_found', message: `No route for ${method} ${resource}` });

  } catch (err) {
    console.error('Unhandled error:', err);
    return respond(500, { error: 'internal_error', message: 'An unexpected error occurred' });
  }
};