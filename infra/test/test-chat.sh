#!/bin/bash
# FlowSync Chat Lambda Test Script

API_URL="https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod"
PROJECT_ID="28c3fad3-4cbd-414e-bb63-fcc559ea238b"

echo "========================================="
echo "FlowSync Chat Lambda Tests"
echo "========================================="
echo ""

# Test 1: Conversational question (should use direct Nova Lite)
echo "1. Testing Conversational Question"
echo "   Message: 'Can you help me understand this project?'"
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"Can you help me understand this project?\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE" | jq -r '{
  reply: (.reply | .[0:100]),
  ragUsed: .ragUsed,
  answerGrounded: .answerGrounded,
  sourcesCount: (.sources | length)
}'
echo ""

# Test 2: Factual question - "who" (should trigger RAG)
echo "2. Testing Factual Question (Who)"
echo "   Message: 'Who are the developers?'"
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"Who are the developers?\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE" | jq -r '{
  reply: (.reply | .[0:100]),
  ragUsed: .ragUsed,
  answerGrounded: .answerGrounded,
  sourcesCount: (.sources | length)
}'
echo ""

# Test 3: Factual question - "what" (should trigger RAG)
echo "3. Testing Factual Question (What)"
echo "   Message: 'What features were implemented?'"
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"What features were implemented?\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE" | jq -r '{
  reply: (.reply | .[0:100]),
  ragUsed: .ragUsed,
  answerGrounded: .answerGrounded,
  sourcesCount: (.sources | length)
}'
echo ""

# Test 4: Factual question - "explain" (should trigger RAG)
echo "4. Testing Factual Question (Explain)"
echo "   Message: 'Explain the decisions made in this project'"
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"Explain the decisions made in this project\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE" | jq -r '{
  reply: (.reply | .[0:100]),
  ragUsed: .ragUsed,
  answerGrounded: .answerGrounded,
  sourcesCount: (.sources | length)
}'
echo ""

# Test 5: Session persistence test
echo "5. Testing Session Persistence"
echo "   First message: 'My name is Alice'"
RESPONSE1=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"My name is Alice\"
  }" \
  "$API_URL/api/v1/chat")

SESSION_ID=$(echo "$RESPONSE1" | jq -r '.sessionId')
echo "   Session ID: $SESSION_ID"

echo "   Second message: 'What is my name?' (should remember)"
RESPONSE2=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"What is my name?\",
    \"sessionId\": \"$SESSION_ID\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE2" | jq -r '{
  reply: .reply,
  rememberedName: (if (.reply | contains("Alice")) then "✅ Yes" else "❌ No" end)
}'
echo ""

# Test 6: Branch-specific query
echo "6. Testing Branch-Specific Query"
echo "   Message: 'What features were added?' (branch: main)"
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"message\": \"What features were added?\",
    \"branch\": \"main\"
  }" \
  "$API_URL/api/v1/chat")

echo "$RESPONSE" | jq -r '{
  reply: (.reply | .[0:100]),
  ragUsed: .ragUsed,
  answerGrounded: .answerGrounded,
  sourcesCount: (.sources | length)
}'
echo ""

echo "========================================="
echo "Expected Results:"
echo "- Test 1: ragUsed=false (conversational)"
echo "- Tests 2-4: ragUsed=true (factual questions)"
echo "- Test 5: Reply should contain 'Alice'"
echo "- Test 6: ragUsed=true (factual with branch)"
echo "========================================="
