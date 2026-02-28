# ML Day 1 Results (Bedrock, ChatGPT)

## 1. Bedrock Access
- Bedrock API calls for both ChatGPT (`openai.gpt-oss-120b-1:0`) and Titan Embeddings (`amazon.titan-embed-text-v1`) work in `us-east-1`.

## 2. Extraction Prompt
- Prompt template generated from `prompts/prompt_template.md` using event data in `test/test_event.json`.
- Output matches required context and instructions.

## 3. Bedrock ChatGPT Call
- Model: `openai.gpt-oss-120b-1:0`
- Response: Valid, structured output (see `test/test_bedrock_call.js`)
- Usage: { completion_tokens: 990, prompt_tokens: 372, total_tokens: 1362 }

## 4. Titan Embeddings Call
- Model: `amazon.titan-embed-text-v1`
- Response: 1,536-dim embedding vector returned
- Example: `[...1436 more items]` (see `test/titan_test.js`)

## 5. Integration Notes
- All ML Day 1 tasks can be performed via Bedrock in `us-east-1`.
- Extraction schema and prompt templates are ready for pipeline integration.
- Titan Embeddings output shape confirmed for downstream semantic search.

---
**Next Steps:**
- Integrate these calls into the AI Processing Lambda for full pipeline.
- Validate schema on ChatGPT output and handle errors.
- Store model version in context records for traceability.
