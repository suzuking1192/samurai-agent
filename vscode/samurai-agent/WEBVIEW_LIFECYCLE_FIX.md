# Webview Lifecycle Fix

## Problem Description

The VS Code extension had critical bugs where:

1. **Webview Lifecycle Issue**: The LLM model list would become empty, chat history would disappear, and settings would not persist when users navigated away from and returned to the Samurai Agent tabs (Chat and Settings) within VS Code.

2. **Message Persistence Issue**: Agent response messages would be missing from the chat history when VS Code was closed and reopened, even though the messages were properly saved to the database.

3. **Tab Switching Issue**: When switching between VS Code tabs and returning to the Samurai Agent chat tab, only one user message would be shown in the chat history, with all other messages disappearing.

## Root Cause Analysis

### Webview Lifecycle Issue

The issue was caused by VS Code's webview lifecycle management:

1. **Webview Visibility Lifecycle**: When switching to a different VS Code plugin tab or closing the Samurai Agent tab, the webview panel is hidden/frozen by VS Code, not destroyed and recreated.

2. **Missing Re-initialization**: When returning to the webview, it becomes visible again, but the webview's JavaScript state wasn't being refreshed because:
   - `DOMContentLoaded` event only fires once when the webview HTML is initially loaded
   - No explicit handler for `webviewView.onDidChangeVisibility()` in the extension host
   - The webview's `chatState` (including `availableModels` and `projectSettings.currentSessionId`) remained stale

3. **Ineffective Internal Tab Handler**: The existing chat tab click handler only worked when explicitly clicking the internal 'chat-tab' element, not when the entire Samurai Agent view became visible again.

### Message Persistence Issue

The message persistence issue was caused by a race condition:

1. **Aggressive Webview Refresh**: The webview refresh mechanism was too aggressive and would clear/reload messages even when they were already properly loaded.

2. **Database Write Timing**: There was a potential race condition where the webview refresh would trigger before the database write was fully flushed to disk.

3. **No Retry Mechanism**: If messages weren't found on the first load attempt, there was no retry mechanism to handle temporary database synchronization issues.

### Tab Switching Issue

The tab switching issue was caused by overly aggressive webview refresh behavior:

1. **Frequent Visibility Changes**: The `onDidChangeVisibility` handler was firing every time users switched between VS Code tabs, triggering unnecessary refreshes.

2. **Poor Message Detection**: The message detection logic was not robust enough to properly identify when messages were already loaded, especially during DOM transitions.

3. **No State Tracking**: There was no mechanism to track whether messages had already been loaded, leading to unnecessary reloading and clearing of existing messages.

4. **Rapid Successive Refreshes**: Multiple refresh events could fire in quick succession, causing race conditions.

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

### 3. Enhanced Settings Tab State Management (settings.js)

- **Added `refreshSettingsState()` function**: Centralized function to refresh settings state
- **Added message listener**: Handles `webviewRefresh` messages for settings tab
- **Added fallback mechanism**: Periodic checks to ensure settings state is maintained
- **Enhanced SettingsManager**: Exposed refresh function for external use

### 4. Fixed Message Persistence Race Condition (chat.js)

- **Enhanced `refreshWebviewState()` function**: Now checks if messages are already loaded before re-initializing
- **Added `loadAndDisplayMessages()` function**: Robust message loading with retry mechanism
- **Added retry logic**: Automatically retries loading messages if none are found on first attempt
- **Enhanced error handling**: Better logging and error recovery for message persistence
- **Improved database write logging**: Added comprehensive logging for message save operations

### 5. Fixed Tab Switching Message Loss (chat.js)

- **Enhanced message detection logic**: More robust detection of existing messages using multiple criteria
- **Added state tracking**: `messagesLoaded` flag to track whether messages have been loaded
- **Added refresh throttling**: Prevents rapid successive refreshes within 2 seconds
- **Improved DOM state checking**: Checks for message elements, innerHTML content, and children count
- **Enhanced logging**: Comprehensive logging for debugging message detection and state tracking

### 6. Key Functions Added

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

#### Enhanced Message Handler (Chat)
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

#### `refreshSettingsState()` (Settings)
```javascript
function refreshSettingsState() {
    console.log('Settings: refreshSettingsState called - refreshing all settings state');
    
    // Reload settings from persistence
    void loadSettingsFromPersistence().then(() => {
        // Re-render settings if the settings tab is currently visible
        const settingsContent = document.getElementById('setting-content');
        if (settingsContent && settingsContent.style.display !== 'none') {
            console.log('Settings: Re-rendering settings after state refresh');
            renderSettings();
        }
    });
    
    console.log('Settings: Settings state refresh completed');
}
```

#### Enhanced Message Handler (Settings)
```javascript
if (message.type === 'webviewRefresh') {
    console.log('Settings: Received webviewRefresh notification, refreshing settings state');
    // Call the refresh function if it's available
    if (window.SettingsManager?.refreshSettingsState) {
        window.SettingsManager.refreshSettingsState();
    }
}
```

#### `loadAndDisplayMessages()` (Message Persistence Fix)
```javascript
async function loadAndDisplayMessages(sessionId, retryCount = 0) {
    try {
        console.log(`Chat: Loading messages for session ${sessionId} (attempt ${retryCount + 1})`);
        const messages = await globalScope.WebviewApi.persistence.loadChatMessagesForSession(sessionId);
        
        if (Array.isArray(messages)) {
            console.log(`Chat: Loaded ${messages.length} messages from database`);
            
            // Clear existing messages before loading new ones
            const chatMessages = safeGetDocumentElement('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            messages.forEach(displayMessage);
            
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // If we have messages, we're done
            if (messages.length > 0) {
                console.log('Chat: Messages loaded successfully');
                return;
            }
        }
        
        // If no messages found and this is the first attempt, retry after a short delay
        // This handles cases where the database write hasn't been flushed yet
        if (retryCount === 0) {
            console.log('Chat: No messages found on first attempt, retrying after delay...');
            setTimeout(() => {
                void loadAndDisplayMessages(sessionId, 1);
            }, 1000); // Wait 1 second before retry
        } else {
            console.log('Chat: No messages found after retry, session may be empty');
        }
    } catch (error) {
        console.error('Chat: Failed to load messages:', error);
        
        // Retry once on error
        if (retryCount === 0) {
            console.log('Chat: Error loading messages, retrying after delay...');
            setTimeout(() => {
                void loadAndDisplayMessages(sessionId, 1);
            }, 1000);
        }
    }
}
```

## Testing the Fix

To test the fix:

### Chat Tab Test:
1. **Open VS Code with the Samurai Agent extension**
2. **Navigate to the Samurai Agent chat tab**
3. **Verify LLM model dropdown is populated**
4. **Send a test message to create chat history**
5. **Navigate away from the Samurai Agent tab (click on another extension or file)**
6. **Return to the Samurai Agent chat tab**
7. **Verify**:
   - LLM model dropdown is still populated
   - Chat history is still visible
   - All functionality works as expected

### Settings Tab Test:
1. **Navigate to the Samurai Agent settings tab**
2. **Verify API keys and project details are loaded**
3. **Make some changes to settings (if desired)**
4. **Navigate away from the Samurai Agent tab**
5. **Return to the Samurai Agent settings tab**
6. **Verify**:
   - API keys are still populated
   - Project details are still visible
   - All settings are preserved
   - Settings functionality works as expected

### Message Persistence Test:
1. **Open VS Code with the Samurai Agent extension**
2. **Navigate to the Samurai Agent chat tab**
3. **Send a message to the agent and wait for a response**
4. **Verify the agent's response is displayed**
5. **Close VS Code completely**
6. **Reopen VS Code and navigate back to the Samurai Agent chat tab**
7. **Verify**:
   - All previous messages (including the agent's last response) are still visible
   - Chat history is complete and in the correct order
   - No messages are missing from the conversation

### Tab Switching Test:
1. **Open VS Code with the Samurai Agent extension**
2. **Navigate to the Samurai Agent chat tab**
3. **Send multiple messages to create a conversation history**
4. **Switch to a different VS Code tab (e.g., Explorer, Source Control, etc.)**
5. **Return to the Samurai Agent chat tab**
6. **Verify**:
   - All previous messages are still visible
   - No messages have disappeared
   - Chat history is complete and intact
   - LLM model dropdown is still populated

## Fallback Mechanisms

The fix includes multiple fallback mechanisms to ensure robustness:

1. **Primary**: Visibility change handler triggers immediate refresh
2. **Secondary**: 2-second timeout fallback for initial load
3. **Tertiary**: 10-second periodic check for edge cases
4. **Manual**: Chat tab click handler still works as before

## Files Modified

- `src/webview/SamuraiAgentPanelWebviewViewProvider.ts`: Added visibility change handler
- `src/webview/chat.js`: Enhanced state management and refresh mechanisms
- `src/webview/settings.js`: Enhanced settings state management and refresh mechanisms

## Impact

This fix ensures that:
- ✅ LLM model list persists when navigating away and back
- ✅ Chat history persists when navigating away and back  
- ✅ Settings (API keys, project details) persist when navigating away and back
- ✅ Agent response messages persist after VS Code restart
- ✅ All messages persist when switching between VS Code tabs
- ✅ All webview state is properly re-initialized for both Chat and Settings tabs
- ✅ Robust fallback mechanisms handle edge cases
- ✅ Retry mechanisms handle database synchronization issues
- ✅ State tracking prevents unnecessary message reloading
- ✅ Refresh throttling prevents rapid successive refreshes
- ✅ No breaking changes to existing functionality
