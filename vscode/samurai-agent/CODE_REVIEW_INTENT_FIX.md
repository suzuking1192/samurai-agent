# Code Review Feature - Intent Detection Fix

## Issue
Code review requests were not working as intended because the AI was using the spec clarification prompt instead of the general discussion prompt. This caused the AI to focus on clarifying specifications rather than conducting an actual code review.

## Root Cause
The `analyzeUserIntent()` method in `samuraiAgent.ts` was using LLM-based intent analysis for code review messages, which sometimes classified them incorrectly. Since code review messages have a very specific, predictable format starting with "Please conduct a thorough code review", they should be detected via keyword matching (like spec generation) rather than LLM analysis.

## Solution
Added keyword-based detection for code review requests in the `analyzeUserIntent()` method. When code review keywords are detected, the intent is immediately set to `PURE_DISCUSSION`, which uses the appropriate general-purpose prompt for code review tasks.

### Implementation

#### Location
`src/agent/core/samuraiAgent.ts` - `analyzeUserIntent()` method

#### Code Added
```typescript
// Step 1.5: Check for code review keyword matching
const codeReviewKeywords = [
  "please conduct a thorough code review",
  "conduct a thorough code review",
  "conduct a code review"
];

for (const keyword of codeReviewKeywords) {
  if (messageContent.includes(keyword)) {
    this.logInvocation("analyzeUserIntent", `Code review keyword match found: ${keyword} -> PURE_DISCUSSION`);
    return UserIntentEnum.PURE_DISCUSSION;
  }
}
```

### Detection Flow

```
User Intent Analysis Flow:
├─ Check for spec generation keywords
│  ├─ "create specs now" → SPEC_GENERATION
│  ├─ "create a spec" → SPEC_GENERATION
│  └─ "create specs" → SPEC_GENERATION
│
├─ Check for code review keywords ✅ NEW
│  ├─ "please conduct a thorough code review" → PURE_DISCUSSION
│  ├─ "conduct a thorough code review" → PURE_DISCUSSION
│  └─ "conduct a code review" → PURE_DISCUSSION
│
└─ If no keyword match → LLM-based intent analysis
```

### Keywords Detected

The following phrases will trigger `PURE_DISCUSSION` intent:

1. **"please conduct a thorough code review"** - Exact phrase from Code Review feature
2. **"conduct a thorough code review"** - Variation without "please"
3. **"conduct a code review"** - Shorter variation

All keyword matching is **case-insensitive** (converted to lowercase before comparison).

## User Intent Mapping

| Intent | Prompt Used | When to Use |
|--------|-------------|-------------|
| `PURE_DISCUSSION` | General discussion prompt | Code reviews, general questions, discussions |
| `SPEC_GENERATION` | Spec generation prompt | Creating specifications |
| `SPEC_CLARIFICATION` | Spec clarification prompt | Clarifying existing specs |
| `FEATURE_EXPLORATION` | Feature exploration prompt | Exploring new features |

## Benefits

### 1. Correct Prompt Selection
✅ Code review requests now use the `PURE_DISCUSSION` prompt  
✅ AI focuses on code review instead of spec clarification  
✅ Proper analysis of code against specifications  

### 2. Reliable Detection
✅ Keyword-based detection is fast and deterministic  
✅ No dependency on LLM interpretation  
✅ Consistent behavior across different models  

### 3. Better Performance
✅ Skips LLM call for intent analysis  
✅ Faster response time  
✅ Lower token usage  

## Code Review Message Format

The Code Review feature sends messages with this structure:

```
Attention required: Please conduct a thorough code review. Verify the latest codebase against the following specifications to ensure accurate and complete implementation:

**Spec Title 1**

```
Spec content 1
```

**Spec Title 2**

```
Spec content 2
```
```

The phrase **"Please conduct a thorough code review"** at the beginning ensures keyword detection works reliably.

## Testing

### Manual Test
1. Reload VSCode window
2. Go to Spec tab
3. Click "Code Review" on any spec
4. Confirm the modal
5. **Expected**: AI responds with actual code review analysis (not spec clarification)

### Console Logs
When code review is detected, you should see:
```
[SamuraiAgent] analyzeUserIntent: Code review keyword match found: please conduct a thorough code review -> PURE_DISCUSSION
```

## Files Modified
- ✅ `src/agent/core/samuraiAgent.ts` - Added code review keyword detection in `analyzeUserIntent()`

## Compilation
✅ Code compiles successfully  
✅ No linter errors  
✅ No breaking changes  

## Future Enhancements

### Additional Keywords (if needed)
If users want to trigger code reviews with other phrases:
```typescript
const codeReviewKeywords = [
  "please conduct a thorough code review",
  "conduct a thorough code review",
  "conduct a code review",
  "review this code",           // Additional
  "code review requested",      // Additional
  "verify against specs"        // Additional
];
```

### Custom Intent
If code review needs specialized handling in the future:
1. Add `CODE_REVIEW` to `UserIntentEnum`
2. Create `code_review_prompt.md`
3. Update `analyzeUserIntent()` to return `UserIntentEnum.CODE_REVIEW`
4. Update prompt selection logic in `execute()` method

## Summary

Code review requests are now **correctly detected** via keyword matching and use the **PURE_DISCUSSION** intent, ensuring the AI provides proper code review analysis instead of spec clarification. This fix is:

- ✅ Simple and maintainable (keyword-based)
- ✅ Fast and efficient (no LLM call)
- ✅ Reliable and deterministic (predictable behavior)
- ✅ Follows existing patterns (like spec generation)
