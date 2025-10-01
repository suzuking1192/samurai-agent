# Code Context Injection Debugging

## Issue
The code extraction tool is working correctly (extracting 14 files), but the AI is responding that it hasn't received any code to review. This suggests the extracted code context is not being injected into the LLM prompt properly.

## Debug Logs Added

I've added detailed console logging in the `handlePureDiscussion` method to diagnose where the code context is getting lost:

### Debug Output Location
`src/agent/core/samuraiAgent.ts` - Lines 368-393

### What to Look For

After reloading VSCode and triggering a code review, check the Developer Tools Console for these logs:

```javascript
[DEBUG handlePureDiscussion] codeContexts received: <number>
[DEBUG handlePureDiscussion] formattedCodeContexts length: <number>
[DEBUG handlePureDiscussion] formattedCodeContexts preview: <string>
[DEBUG handlePureDiscussion] systemPrompt contains CODE CONTEXT section: <boolean>
[DEBUG handlePureDiscussion] systemPrompt codeContexts section preview: <string>
```

## Diagnostic Steps

### 1. Check Code Context Count
```
[DEBUG handlePureDiscussion] codeContexts received: 1
```
- **If 0**: Code contexts are not being loaded from DataStore
- **If > 0**: Code contexts are being loaded correctly

### 2. Check Formatted Context
```
[DEBUG handlePureDiscussion] formattedCodeContexts length: 5000
[DEBUG handlePureDiscussion] formattedCodeContexts preview: // File: /Users/...
```
- **If "No code context available"**: Formatting failed or contexts are empty
- **If showing file paths**: Formatting is working correctly

### 3. Check System Prompt Injection
```
[DEBUG handlePureDiscussion] systemPrompt contains CODE CONTEXT section: true
[DEBUG handlePureDiscussion] systemPrompt codeContexts section preview: ## CODE CONTEXT
// File: /Users/...
```
- **If false**: Template not loading correctly
- **If true but shows "No code context available"**: Placeholder replacement failed
- **If true and shows actual code**: Everything is working correctly

## Potential Issues & Solutions

### Issue 1: Code Contexts Not Loading (Count = 0)
**Symptoms:**
```
[DEBUG handlePureDiscussion] codeContexts received: 0
```

**Cause**: 
- Session.codeContextIds is empty
- DataStore.loadAllCodeContextForSession is failing

**Solution**:
- Check if code context was actually saved to session
- Verify code_contexts directory exists in .vscode/samurai-agent/
- Check for file read errors in DataStore

### Issue 2: Formatting Returns "No code context available"
**Symptoms:**
```
[DEBUG handlePureDiscussion] formattedCodeContexts preview: No code context available.
```

**Cause**:
- Code contexts have empty `relevantCodeElements`
- Data structure mismatch between saved data and expected format

**Solution**:
- Check the actual JSON files in `.vscode/samurai-agent/code_contexts/`
- Verify structure matches `ExtractCodeToolResultPayload` interface
- Look for `relevantCodeElements` array with `elements` and `snippet`

### Issue 3: Placeholder Not Replaced
**Symptoms:**
```
[DEBUG handlePureDiscussion] systemPrompt codeContexts section preview: ## CODE CONTEXT
{codeContexts}
```

**Cause**:
- `_loadAndFormatSystemPrompt` not replacing `{codeContexts}` placeholder
- Typo in placeholder name

**Solution**:
- Verify `_loadAndFormatSystemPrompt` replaces all placeholders
- Check that `codeContexts` key matches in both places

### Issue 4: Code Context Truncated
**Symptoms**:
- Debug shows code context exists
- But AI says "no code provided"
- Token limit might be cutting it off

**Solution**:
- Check total token count of system prompt
- May need to reduce code context size
- Implement smarter truncation

## Testing Procedure

1. **Reload VSCode Window**
   - `Cmd+Shift+P` → "Reload Window"

2. **Open Developer Tools**
   - `Help` → `Toggle Developer Tools`
   - Go to Console tab

3. **Trigger Code Review**
   - Go to Spec tab
   - Click "Code Review" on any spec
   - Confirm modal

4. **Check Console Logs**
   - Look for `[DEBUG handlePureDiscussion]` logs
   - Copy/paste the output

5. **Analyze Output**
   - Compare with patterns above
   - Identify which issue matches

## Expected Correct Output

```
[DEBUG handlePureDiscussion] codeContexts received: 1
[DEBUG handlePureDiscussion] formattedCodeContexts length: 15432
[DEBUG handlePureDiscussion] formattedCodeContexts preview: // File: /Users/yutosuzuki/code/samurai-agent/vscode/samurai-agent/src/extension.ts
// [Function]: activate
// [Class]: SomeClass

export function activate(context: vscode.ExtensionContext) {
  const globalDataStore = new GlobalDataStore();
  ...

[DEBUG handlePureDiscussion] systemPrompt contains CODE CONTEXT section: true
[DEBUG handlePureDiscussion] systemPrompt codeContexts section preview: ## CODE CONTEXT
// File: /Users/yutosuzuki/code/samurai-agent/vscode/samurai-agent/src/extension.ts
// [Function]: activate
// [Class]: SomeClass

export function activate(context: vscode.ExtensionContext) {
  const globalDataStore = new GlobalDataStore();
  ...
```

## Next Steps

After gathering the debug output:

1. **Share the console logs** - This will show exactly where the issue is
2. **Check the saved JSON files** - Look in `.vscode/samurai-agent/code_contexts/`
3. **Verify data structure** - Compare saved JSON with expected interface

## Files to Check

1. **Session file**: `.vscode/samurai-agent/sessions.json`
   - Look for your session
   - Check if `codeContextIds` array has values

2. **Code context files**: `.vscode/samurai-agent/code_contexts/<uuid>.json`
   - Verify structure has `relevantCodeElements`
   - Check if `elements` and `snippet` exist

3. **System prompt**: `src/agent/prompts/pureDiscussion/system_prompt.md`
   - Verify `{codeContexts}` placeholder exists on line 12

## Temporary Workaround

If code context is being extracted but not injected, you can manually verify it's working by:

1. Opening: `.vscode/samurai-agent/code_contexts/<latest-uuid>.json`
2. Copying the relevant code snippets
3. Including them directly in your code review request

This will at least allow the review to proceed while we fix the injection issue.
