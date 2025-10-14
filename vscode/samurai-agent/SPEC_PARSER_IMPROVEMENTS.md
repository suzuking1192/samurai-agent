# Spec Generation Parser Improvements

## Problem
The LLM parser was failing to parse spec generation responses due to:
1. Markdown syntax (backticks, code blocks) inside JSON string values
2. Long descriptions containing unescaped special characters
3. Malformed JSON in the middle of the array causing complete parsing failure

Error example:
```
Expected ',' or '}' after property value in JSON at position 20213
LLM response is not an array of specs
```

## Solution
Added a specialized parser for spec generation responses that maintains backward compatibility while providing enhanced error recovery.

### Key Improvements

#### 1. Specialized Spec Generation Parser
- **Location**: `src/common/utils/llmResponseParser.ts`
- **Function**: `parseSpecGenerationResponse()`
- Automatically handles markdown syntax in JSON strings
- Multiple fallback strategies for resilient parsing

#### 2. Enhanced Parsing Strategies

**Strategy 1: Standard Parsing First**
- Tries existing parser first (backward compatible)
- Falls through to specialized strategies only if needed

**Strategy 2: Markdown Sanitization**
- Escapes unescaped backticks within JSON string values
- Extracts valid specs before error points
- Handles partial JSON arrays by completing them

**Strategy 3: Individual Spec Extraction**
- Parses individual spec objects when full array parsing fails
- Returns partial results instead of complete failure
- Recovers from malformed specs in the middle of the array

#### 3. Backward Compatibility
- All existing code continues to work unchanged
- New `options` parameter is optional
- Only spec generation explicitly uses the specialized parser

### Usage

#### For Spec Generation (Enhanced Parsing)
```typescript
const result = extractJsonFromLLMResponse(llmOutput, { isSpecGeneration: true });
```

#### For Other Purposes (Standard Parsing)
```typescript
const result = extractJsonFromLLMResponse(llmOutput);
// or explicitly:
const result = extractJsonFromLLMResponse(llmOutput, { isSpecGeneration: false });
```

### Implementation Details

#### Modified Files
1. **`src/common/utils/llmResponseParser.ts`**
   - Added `parseSpecGenerationResponse()` function
   - Renamed main implementation to `extractJsonFromLLMResponseInternal()`
   - Updated `extractJsonFromLLMResponse()` to route to appropriate parser

2. **`src/agent/core/samuraiAgent.ts`**
   - Updated `handleGeneratingSpecs()` to use spec generation parser
   - Added `{ isSpecGeneration: true }` option

3. **`tests/utils/llmResponseParser.spec.test.ts`** (New)
   - Comprehensive test suite for spec generation parsing
   - Tests for backward compatibility
   - Tests for error recovery scenarios

### Benefits

1. **Robust Error Handling**
   - Extracts partial results instead of failing completely
   - Multiple fallback strategies ensure better success rate

2. **Markdown-Aware**
   - Handles backticks, code blocks, and other markdown syntax
   - Escapes special characters automatically

3. **Backward Compatible**
   - No changes required to existing code
   - All existing parsers continue to work exactly as before

4. **Better User Experience**
   - Users get partial specs even when LLM output is malformed
   - More detailed logging for debugging
   - Graceful degradation instead of complete failure

### Error Recovery Example

**Before**: Complete failure, no specs returned
```
[JSON Parser] ✗ Failed to parse JSON using brace counting
[JSON Parser] ✗ All parsing strategies exhausted
Error: LLM response is not an array of specs
```

**After**: Partial success, valid specs returned
```
[Spec Parser] Using specialized spec generation parser
[Spec Parser] Strategy 2: Sanitizing markdown syntax
[Spec Parser] Extracted 2 valid specs before error
Result: Returns first 2 valid specs even if 3rd is malformed
```

## Testing

Run the test suite:
```bash
npm test -- llmResponseParser.spec.test.ts
```

## Future Enhancements

Potential improvements for the future:
1. Add more sophisticated markdown detection and escaping
2. Support for nested code blocks with triple backticks
3. LLM prompt improvements to reduce malformed output
4. Token-level validation for better error messages

