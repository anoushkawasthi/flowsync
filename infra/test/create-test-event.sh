#!/bin/bash
# Create a test event to generate context with embeddings

API_URL="https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod"
PROJECT_ID="28c3fad3-4cbd-414e-bb63-fcc559ea238b"

echo "Creating test event to generate context with embeddings..."
echo ""

curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
  \"projectId\": \"$PROJECT_ID\",
  \"events\": [{
    \"type\": \"push\",
    \"project\": \"flowsync\",
    \"branch\": \"main\",
    \"commit\": {
      \"hash\": \"test-$(date +%s)\",
      \"message\": \"Add hybrid chat with RAG integration - Nova Lite presents Nova Pro answers conversationally for factual questions\",
      \"author\": \"Test Agent\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    },
    \"diff\": \"--- a/chat/handler.py\\n+++ b/chat/handler.py\\n@@ -1,3 +1,10 @@\\n+def needs_factual_answer(message):\\n+    # Detect factual vs conversational\\n+    patterns = ['who', 'what', 'when', 'explain']\\n+    return any(p in message.lower() for p in patterns)\\n+\\n+def generate_chat_response(message):\\n+    if needs_factual_answer(message):\\n+        # Use RAG pipeline (Nova Pro)\\n+        rag_result = search_context_rag()\\n+        # Present with Nova Lite conversationally\\n\",
    \"changedFiles\": [\"chat/handler.py\", \"helpers.py\"]
  }]
}" \
  "$API_URL/api/v1/events" | jq '.'

echo ""
echo "Waiting 5 seconds for async processing..."
sleep 5

echo ""
echo "Checking if new context has embeddings..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"get_project_context\",\"params\":{\"projectId\":\"$PROJECT_ID\",\"limit\":1}}" \
  "$API_URL/mcp" | jq '{
    feature: .recentContext[0].feature,
    hasEmbedding: (.recentContext[0].embedding != null),
    embeddingSize: (.recentContext[0].embedding | length)
  }'
