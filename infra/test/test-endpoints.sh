#!/bin/bash
# FlowSync API Test Script

API_URL="https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod"
PROJECT_ID="28c3fad3-4cbd-414e-bb63-fcc559ea238b"

echo "========================================="
echo "FlowSync API Endpoint Tests"
echo "========================================="
echo ""

# MCP Lambda Tests (No Auth Required)
echo "1. Testing MCP: get_recent_changes"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"get_recent_changes\",\"params\":{\"projectId\":\"$PROJECT_ID\",\"limit\":2}}" \
  "$API_URL/mcp" | jq '.changes | length' | xargs echo "   ✅ Returned records:"
echo ""

echo "2. Testing MCP: get_project_context"
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"get_project_context\",\"params\":{\"projectId\":\"$PROJECT_ID\",\"branch\":\"main\"}}" \
  "$API_URL/mcp" | jq '.recentContext | length' | xargs echo "   ✅ Returned records:"
echo ""

echo "3. Testing MCP: search_context (RAG)"
ANSWER=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"search_context\",\"params\":{\"projectId\":\"$PROJECT_ID\",\"query\":\"What features were implemented?\"}}" \
  "$API_URL/mcp" | jq -r '.answer' | head -c 80)
echo "   ✅ Answer: $ANSWER..."
echo ""

echo "4. Testing MCP: log_context (write)"
RESULT=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"log_context\",\"params\":{\"projectId\":\"$PROJECT_ID\",\"branch\":\"main\",\"author\":\"test-agent\",\"reasoning\":\"Testing MCP write capability\",\"decision\":\"Implemented comprehensive API testing\"}}" \
  "$API_URL/mcp" | jq -r '.success')
echo "   ✅ Log context result: $RESULT"
echo ""

# Query Lambda Tests (Auth Required)
echo "========================================="
echo "Query Lambda Tests (Require Auth Token)"
echo "========================================="
echo ""

echo "5. Testing Query GET /events (without auth - should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API_URL/api/v1/projects/$PROJECT_ID/events?limit=2")
if [ "$STATUS" = "401" ]; then
  echo "   ✅ Auth protection working (401 returned)"
else
  echo "   ⚠️  Unexpected status: $STATUS"
fi
echo ""

echo "6. Testing Query POST /query (without auth - should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"query\":\"test\"}" \
  "$API_URL/api/v1/query")
if [ "$STATUS" = "401" ]; then
  echo "   ✅ Auth protection working (401 returned)"
else
  echo "   ⚠️  Unexpected status: $STATUS"
fi
echo ""

echo "========================================="
echo "To test authenticated endpoints:"
echo "export TOKEN='your-api-token'"
echo "curl -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  \"$API_URL/api/v1/projects/$PROJECT_ID/events?limit=5\""
echo "========================================="
