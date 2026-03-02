# FlowSync End-to-End Test Flow

## Prerequisites
- VSIX already compiled: `extension/flowsync-*.vsix`
- Test repo: `~/OneDrive/Documents/vs/myshit/flowsynctest`
- AWS CLI access to account 357229249502, region us-east-1

---

## 1. Install New Extension VSIX

```bash
# If VS Code has the old extension installed, uninstall it first
# Extensions → FlowSync → Uninstall

# Then install the new one (use absolute path to the .vsix file)
code --install-extension c:/Users/aahil/OneDrive/Documents/vs/flowsync/extension/flowsync-*.vsix

# Or manually in VS Code: Extensions → ... (three dots) → Install from VSIX → select file
```

Verify the new extension is active (should show version date matching today).

---

## 2. Clean Up Old Hook

```bash
cd ~/OneDrive/Documents/vs/myshit/flowsynctest

# Delete the dead post-push hook
rm .git/hooks/post-push

# Verify it's gone
ls -la .git/hooks/ | grep -E "(pre|post)-push"
# Should show nothing (or just pre-push if reinit has already run)
```

---

## 3. Reinitialize Project in VS Code

In the `flowsynctest` repo VS Code window:

```
Command Palette (Ctrl+Shift+P) → FlowSync: Initialize Project
```

This will:
- Prompt for project name → enter `flowsynctest` (or whatever you called it)
- Find available port (should be 38475)
- Show API token in modal → **COPY IT** (auto-copied to clipboard)
- Write `.git/hooks/pre-push` with the curl command
- Display success notification

**Verify the hook:**
```bash
cat .git/hooks/pre-push
# Should include: curl -s -X POST http://localhost:38475/hook -d '{"event":"push"}'
```

---

## 4. Make a Git Commit

```bash
cd ~/OneDrive/Documents/vs/myshit/flowsynctest

# Create or modify a file
echo "test commit $(date)" >> test.txt

# Stage and commit
git add test.txt
git commit -m "test: push event capture"
```

---

## 5. Push to Trigger Hook

```bash
git push
```

**Expected behavior:**
- Push completes normally (non-blocking)
- VS Code Output panel (Debug → FlowSync output) should show:
  - `[hookListener] received POST /hook`
  - `getDiff()` output
  - `getLastCommitInfo()` output
  - `[eventTransmitter] POST to /events successful`
  - Notification: "FlowSync: Push event captured and sent"

**If you don't see the listener running:**
```bash
# Check if listener started
ps | grep node | grep 38475
# Or in VS Code Output → look for "[extension] Starting hook listener on port 38475"
```

---

## 6. Verify Event in DynamoDB

```bash
# Query flowsync-events table for this project
MSYS_NO_PATHCONV=1 aws dynamodb query \
  --table-name flowsync-events \
  --key-condition-expression "projectId = :pid" \
  --expression-attribute-values '{":pid": {"S": "<YOUR_PROJECT_ID>"}}' \
  --region us-east-1 \
  --output json | jq '.Items | length'

# Should return 1 or more (new event)
# Then inspect the actual item:
MSYS_NO_PATHCONV=1 aws dynamodb query \
  --table-name flowsync-events \
  --key-condition-expression "projectId = :pid" \
  --expression-attribute-values '{":pid": {"S": "<YOUR_PROJECT_ID>"}}' \
  --region us-east-1 \
  --output json | jq '.Items[-1]'
```

---

## 7. Verify Context in DynamoDB (AI Processing)

```bash
# Query flowsync-context table
MSYS_NO_PATHCONV=1 aws dynamodb query \
  --table-name flowsync-context \
  --key-condition-expression "projectId = :pid" \
  --expression-attribute-values '{":pid": {"S": "<YOUR_PROJECT_ID>"}}' \
  --region us-east-1 \
  --output json | jq '.Items | length'

# Should return 1 or more (AI Lambda processes the event asynchronously)
# Inspect the latest:
MSYS_NO_PATHCONV=1 aws dynamodb query \
  --table-name flowsync-context \
  --key-condition-expression "projectId = :pid" \
  --expression-attribute-values '{":pid": {"S": "<YOUR_PROJECT_ID>"}}' \
  --region us-east-1 \
  --output json | jq '.Items[-1]'

# Should show: stage, keywords array, summary, decision field, embedding vector
```

---

## 8. Check Logs (Optional)

### Extension logs:
```
VS Code Output → FlowSync (top-right dropdown)
```
Should show step-by-step: listener started, hook received POST, git commands executed, event transmitted.

### Lambda logs:
```bash
# Ingestion Lambda
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/flowsync-ingestion --follow --region us-east-1

# AI Processing Lambda
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/flowsync-ai-processing --follow --region us-east-1
```

---

## Expected Project IDs (pick one)

If you don't remember the projectId:

```bash
# List all projects
MSYS_NO_PATHCONV=1 aws dynamodb scan \
  --table-name flowsync-projects \
  --projection-expression "projectId, projectName" \
  --region us-east-1 \
  --output json | jq '.Items[] | {projectId: .projectId.S, projectName: .projectName.S}'
```

Look for `flowsynctest` or the name you used in step 3.

---

## Troubleshooting

### Extension doesn't activate
```bash
# Check the terminal logs:
# Command Palette → Developer: Show Logs (Extension Host)
```

### Listener won't start
```bash
# Check if port 38475 is taken:
lsof -i :38475
# If taken, extension will try 38476, 38477, etc. (check .flowsync.json for actual port)
```

### Push goes through but no event in DynamoDB
```bash
# Check extension Output for error messages
# Likely causes:
# - API token wrong
# - API Gateway endpoint changed
# - Network connectivity
```

### Event in table but no context
```bash
# Wait a few seconds (Lambda async) then requery
# If still nothing, check AI Processing Lambda logs:
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/flowsync-ai-processing --follow --region us-east-1
# Look for error or validation failure
```

---

## Success Criteria

✅ `git push` completes without delay  
✅ VS Code shows "Push event captured and sent" notification  
✅ `flowsync-events` table has 1+ new event with `projectId`, `eventId`, `diff`, `commitMessage`  
✅ `flowsync-context` table has 1+ new record with `stage`, `keywords`, `summary`, `embedding`  
✅ Extension Output shows clean flow: listener → getDiff() → getLastCommitInfo() → transmit  

If all ✅, the fix is working and the extension is ready for the next phase.
