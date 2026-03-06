#!/bin/bash
# FlowSync Chat Lambda Test Script - MCP-Style Architecture
# Tests hybrid Nova Pro RAG (factual) + Nova Lite (conversational) approach

API_URL="https://86tzell2w9.execute-api.us-east-1.amazonaws.com/prod"
PROJECT_ID="5bc7728e-ed1e-4e62-b94c-bd2e4238c252"
TOKEN="1e82dd7e6d1e8e21da1f348b1d8ee6d3c45f50ff91c0080693203e9f9a733f63"

# Lambda configuration
LOG_GROUP="/aws/lambda/flowsync-chat"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Output file
OUTPUT_FILE="chat-conversation-$(date +%Y%m%d-%H%M%S).txt"
LOG_FILE="chat-logs-$(date +%Y%m%d-%H%M%S).txt"

# Track start time for log filtering
TEST_START_TIME=$(date +%s)000  # milliseconds

# Function to fetch and display relevant Lambda logs
fetch_logs() {
    local test_num=$1
    local message=$2
    
    # Wait longer for logs to be available in CloudWatch
    sleep 4
    
    # Calculate time range (last 15 seconds to be safe)
    local end_time=$(date +%s)000
    local start_time=$((end_time - 15000))
    
    # Fetch logs for this time window
    echo -e "${CYAN}--- Lambda Logs for Test $test_num ---${NC}" | tee -a "$LOG_FILE" >&2
    
    # Get the most recent log entries for MCP-style flow
    # New patterns: Chat Query, Step 1 RAG attempt, RAG SUCCESS/UNGROUNDED, Step 2 fallback
    aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --region "$REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null | \
    grep -E "(💬 Chat Query|🔍 Step 1|✅ RAG SUCCESS|⚠️.*RAG UNGROUNDED|🔄 Step 2|💬 Using Nova Lite|Answer length|Sources:|Retrieved.*context)" | \
    tail -20 | \
    while IFS= read -r line; do
        echo "$line" | tee -a "$LOG_FILE" >&2
    done
    
    echo "" | tee -a "$LOG_FILE" >&2
}

echo "=========================================" | tee "$OUTPUT_FILE"
echo "FlowSync Chat - MCP-Style Architecture" | tee -a "$OUTPUT_FILE"
echo "Nova Pro RAG + Nova Lite Conversational" | tee -a "$OUTPUT_FILE"
echo "=========================================" | tee -a "$OUTPUT_FILE"
echo "Project ID: $PROJECT_ID" | tee -a "$OUTPUT_FILE"
echo "Token: ${TOKEN:0:20}..." | tee -a "$OUTPUT_FILE"
echo "Output File: $OUTPUT_FILE" | tee -a "$OUTPUT_FILE"
echo "Log File: $LOG_FILE" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"
echo "Architecture:" | tee -a "$OUTPUT_FILE"
echo "  1. Every query tries RAG first (Nova Pro)" | tee -a "$OUTPUT_FILE"
echo "  2. If grounded → Return factual answer" | tee -a "$OUTPUT_FILE"
echo "  3. If not grounded → Fall back to Nova Lite" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Function to send a message and log the response
send_message() {
    local test_num=$1
    local message=$2
    local type=$3
    local session_id=$4
    
    # All output goes to file and stderr (>&2) so it doesn't interfere with session ID capture
    echo -e "${BLUE}=== Test $test_num [$type] ===${NC}" | tee -a "$OUTPUT_FILE" >&2
    echo "Q: $message" | tee -a "$OUTPUT_FILE" >&2
    
    # Build the JSON payload
    if [ -z "$session_id" ] || [ "$session_id" = "null" ]; then
        JSON_PAYLOAD="{\"projectId\": \"$PROJECT_ID\", \"message\": \"$message\"}"
    else
        JSON_PAYLOAD="{\"projectId\": \"$PROJECT_ID\", \"message\": \"$message\", \"sessionId\": \"$session_id\"}"
    fi
    
    # Make the API call
    RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$JSON_PAYLOAD" \
      "$API_URL/api/v1/chat")
    
    # Parse response with error checking
    if [ -z "$RESPONSE" ]; then
        echo "A: [ERROR: Empty response]" | tee -a "$OUTPUT_FILE" >&2
        echo "   [RAG: N/A | Sources: 0 | Session: N/A]" | tee -a "$OUTPUT_FILE" >&2
        echo "" | tee -a "$OUTPUT_FILE" >&2
        echo "" >&2
        return
    fi
    
    REPLY=$(echo "$RESPONSE" | jq -r '.reply // "ERROR: No reply"')
    RAG_USED=$(echo "$RESPONSE" | jq -r '.ragUsed // false')
    NEW_SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId // empty')
    SOURCES_COUNT=$(echo "$RESPONSE" | jq -r '.sources | length // 0')
    
    echo "A: $REPLY" | tee -a "$OUTPUT_FILE" >&2
    echo "   [RAG: $RAG_USED | Sources: $SOURCES_COUNT | Session: ${NEW_SESSION_ID:0:8}...]" | tee -a "$OUTPUT_FILE" >&2
    echo "" | tee -a "$OUTPUT_FILE" >&2
    
    # Small delay between requests to avoid rate limiting
    sleep 1
    
    # Return ONLY the session ID to stdout (this is captured by the caller)
    echo "$NEW_SESSION_ID"
}

# Start conversation
SESSION_ID=""

# Test labels indicate EXPECTED behavior:
# [RAG] = Should find grounded facts and return Nova Pro answer
# [CONVO] = Should fall back to Nova Lite conversational
# Note: ALL queries try RAG first - labels show expected outcome

# Test 1: Conversational - Greeting
SESSION_ID=$(send_message 1 "Hello! How are you doing today?" "CONVO" "$SESSION_ID")

# Test 2: RAG - Who question
SESSION_ID=$(send_message 2 "Who are the developers working on this project?" "RAG" "$SESSION_ID")
fetch_logs 2 "Who are the developers"

# Test 3: Conversational - Follow-up
SESSION_ID=$(send_message 3 "That's interesting, thanks for sharing" "CONVO" "$SESSION_ID")

# Test 4: Conversational - Opinion
SESSION_ID=$(send_message 4 "What do you think about the quality of this codebase?" "CONVO" "$SESSION_ID")

# Test 5: RAG - What question
SESSION_ID=$(send_message 5 "What features were implemented recently?" "RAG" "$SESSION_ID")
fetch_logs 5 "What features were implemented"

# Test 6: Conversational - Clarification
SESSION_ID=$(send_message 6 "Can you explain that in simpler terms?" "CONVO" "$SESSION_ID")

# Test 7: Conversational - Appreciation
SESSION_ID=$(send_message 7 "Thanks, that makes more sense now" "CONVO" "$SESSION_ID")

# Test 8: RAG - When question
SESSION_ID=$(send_message 8 "When was the last commit made?" "RAG" "$SESSION_ID")
fetch_logs 8 "When was the last commit"

# Test 9: Conversational - Reflection
SESSION_ID=$(send_message 9 "I'm trying to understand the project timeline better" "CONVO" "$SESSION_ID")
fetch_logs 9 "project timeline"

# Test 10: RAG - Explain question
SESSION_ID=$(send_message 10 "Explain what changes were made in the infrastructure" "RAG" "$SESSION_ID")

# Test 11: Conversational - Assistance
SESSION_ID=$(send_message 11 "Could you help me get started with understanding this?" "CONVO" "$SESSION_ID")

# Test 12: Conversational - Preference
SESSION_ID=$(send_message 12 "I prefer detailed explanations, is that okay?" "CONVO" "$SESSION_ID")

# Test 13: RAG - List question
SESSION_ID=$(send_message 13 "List the main components of the system" "RAG" "$SESSION_ID")
fetch_logs 13 "List the main components"

# Test 14: Conversational - Confirmation
SESSION_ID=$(send_message 14 "Got it, that helps a lot" "CONVO" "$SESSION_ID")

# Test 15: Conversational - Context sharing
SESSION_ID=$(send_message 15 "I'm working on a similar project myself" "CONVO" "$SESSION_ID")
fetch_logs 15 "working on similar project"

# Test 16: RAG - Describe question
SESSION_ID=$(send_message 16 "Describe the architecture of this application" "RAG" "$SESSION_ID")
fetch_logs 16 "Describe the architecture"

# Test 17: Conversational - Comparison
SESSION_ID=$(send_message 17 "How does that compare to typical setups?" "CONVO" "$SESSION_ID")

# Test 18: Conversational - Personal note
SESSION_ID=$(send_message 18 "My name is Alex and I'm a software engineer" "CONVO" "$SESSION_ID")

# Test 19: RAG - Find question
SESSION_ID=$(send_message 19 "Find information about the database schema" "RAG" "$SESSION_ID")

# Test 20: Conversational - Memory test
SESSION_ID=$(send_message 20 "Do you remember what I said my name was?" "CONVO" "$SESSION_ID")

# Test 21: Conversational - Feedback
SESSION_ID=$(send_message 21 "You're doing great with these answers" "CONVO" "$SESSION_ID")

# Test 22: RAG - Summary question
SESSION_ID=$(send_message 22 "Summarize the main goals of this project" "RAG" "$SESSION_ID")

# Test 23: Conversational - Elaboration request
SESSION_ID=$(send_message 23 "Could you elaborate on that last point?" "CONVO" "$SESSION_ID")

# Test 24: Conversational - Small talk
SESSION_ID=$(send_message 24 "This is quite helpful for my research" "CONVO" "$SESSION_ID")

# Test 25: RAG - Detail question
SESSION_ID=$(send_message 25 "What technologies are used in the backend?" "RAG" "$SESSION_ID")

# Test 26: Conversational - Understanding check
SESSION_ID=$(send_message 26 "I want to make sure I understand correctly" "CONVO" "$SESSION_ID")

# Test 27: RAG - Timeline question
SESSION_ID=$(send_message 27 "Show me the commit history for the last week" "RAG" "$SESSION_ID")

# Test 28: Conversational - Wrap-up
SESSION_ID=$(send_message 28 "This has been very informative" "CONVO" "$SESSION_ID")

# Test 29: RAG - Final factual question
SESSION_ID=$(send_message 29 "What are the key files I should review?" "RAG" "$SESSION_ID")

# Test 30: Conversational - Closing
SESSION_ID=$(send_message 30 "Thank you so much for your help!" "CONVO" "$SESSION_ID")

echo "=========================================" | tee -a "$OUTPUT_FILE"
echo "Test Complete!" | tee -a "$OUTPUT_FILE"
echo "=========================================" | tee -a "$OUTPUT_FILE"
echo -e "${GREEN}30 tests completed successfully${NC}" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"
echo "Test Distribution:" | tee -a "$OUTPUT_FILE"
echo "  Expected RAG (factual): 10 tests" | tee -a "$OUTPUT_FILE"
echo "  Expected Conversational: 20 tests" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"
echo "MCP-Style Architecture:" | tee -a "$OUTPUT_FILE"
echo "  • All queries tried RAG first (Nova Pro)" | tee -a "$OUTPUT_FILE"
echo "  • Grounded answers used RAG directly" | tee -a "$OUTPUT_FILE"
echo "  • Ungrounded queries fell back to Nova Lite" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"
echo "Session ID: ${SESSION_ID:0:16}..." | tee -a "$OUTPUT_FILE"
echo "Full transcript saved to: $OUTPUT_FILE" | tee -a "$OUTPUT_FILE"
echo "Lambda logs saved to: $LOG_FILE" | tee -a "$OUTPUT_FILE"
echo ""
echo -e "${CYAN}Review logs to see RAG → Nova Lite fallback flow${NC}"
echo ""
