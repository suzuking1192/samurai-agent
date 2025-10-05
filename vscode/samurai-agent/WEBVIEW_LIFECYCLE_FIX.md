# Webview Lifecycle Fix

## Problem Description

The VS Code extension had a critical bug where the LLM model list would become empty and chat history would disappear when users navigated away from and returned to the Samurai Agent chat tab within VS Code.

## Root Cause Analysis

The issue was caused by VS Code's webview lifecycle management:

1. **Webview Visibility Lifecycle**: When switching to a different VS Code plugin tab or closing the Samurai Agent tab, the webview panel is hidden/frozen by VS Code, not destroyed and recreated.

2. **Missing Re-initialization**: When returning to the webview, it becomes visible again, but the webview's JavaScript state wasn't being refreshed because:
   - `DOMContentLoaded` event only fires once when the webview HTML is initially loaded
   - No explicit handler for `webviewView.onDidChangeVisibility()` in the extension host
   - The webview's `chatState` (including `availableModels` and `projectSettings.currentSessionId`) remained stale

3. **Ineffective Internal Tab Handler**: The existing chat tab click handler only worked when explicitly clicking the internal 'chat-tab' element, not when the entire Samurai Agent view became visible again.

## Solution Implemented

### 1. Added Visibility Change Handler (SamuraiAgentPanelWebviewViewProvider.ts)

```typescript
// CRITICAL FIX: Add visibility change handler to re-initialize webview state
webviewView.onDidChangeVisibility(() => {
  console.log("Webview Provider: Visibility changed, visible:", webviewView.visible);
  if (webviewView.visible) {
    // When webview becomes visible, re-send initial settings to refresh state
    console.log("Webview Provider: Webview became visible, re-initializing state");
    setTimeout(() => {
      this.sendInitialSettingsToWebview(webviewView.webview);
      
      // Also send a refresh message to trigger webview state refresh
      webviewView.webview.postMessage({
        type: "webviewRefresh",
        message: "Webview became visible, refreshing state",
        timestamp: new Date(),
      });
    }, 50); // Small delay to ensure webview is ready
  }
});
```

### 2. Enhanced Webview State Management (chat.js)

- **Added `refreshWebviewState()` function**: Centralized function to refresh all webview state
- **Enhanced message handling**: Added handler for `webviewRefresh` messages
- **Added fallback mechanisms**: Periodic checks and timeout-based refreshes to handle edge cases
- **Improved logging**: Added comprehensive logging for debugging

### 3. Key Functions Added

#### `refreshWebviewState()`
```javascript
function refreshWebviewState() {
    console.log('Chat: refreshWebviewState called - refreshing all state');
    
    // Refresh LLM model dropdown
    void refreshLLMModelDropdown();
    
    // Re-initialize chat session if we have project settings
    if (chatState.projectSettings) {
        void initializeChatSession();
    }
    
    // Refresh cost display
    updateApiCostDisplay(0);
    
    console.log('Chat: Webview state refresh completed');
}
```

#### Enhanced Message Handler
```javascript
if (type === 'webviewRefresh') {
    console.log('Chat: Received webviewRefresh notification, refreshing webview state');
    // Call the refresh function if it's available
    if (globalScope.ChatManager?.refreshWebviewState) {
        globalScope.ChatManager.refreshWebviewState();
    }
    chatMessagesElement?.dispatchEvent(new CustomEvent('webview-refreshed'));
}
```

## Testing the Fix

To test the fix:

1. **Open VS Code with the Samurai Agent extension**
2. **Navigate to the Samurai Agent chat tab**
3. **Verify LLM model dropdown is populated**
4. **Send a test message to create chat history**
5. **Navigate away from the Samurai Agent tab (click on another extension or file)**
6. **Return to the Samurai Agent tab**
7. **Verify**:
   - LLM model dropdown is still populated
   - Chat history is still visible
   - All functionality works as expected

## Fallback Mechanisms

The fix includes multiple fallback mechanisms to ensure robustness:

1. **Primary**: Visibility change handler triggers immediate refresh
2. **Secondary**: 2-second timeout fallback for initial load
3. **Tertiary**: 10-second periodic check for edge cases
4. **Manual**: Chat tab click handler still works as before

## Files Modified

- `src/webview/SamuraiAgentPanelWebviewViewProvider.ts`: Added visibility change handler
- `src/webview/chat.js`: Enhanced state management and refresh mechanisms

## Impact

This fix ensures that:
- ✅ LLM model list persists when navigating away and back
- ✅ Chat history persists when navigating away and back  
- ✅ All webview state is properly re-initialized
- ✅ Robust fallback mechanisms handle edge cases
- ✅ No breaking changes to existing functionality
