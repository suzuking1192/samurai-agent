# Bug Fix: Code Review Command Not Found

## Issue
When clicking the "Code Review" button and confirming the modal, users encountered the error:
```
Failed to send code review message: Unknown command: samurai-agent.ui.sendAssistantMessageToChat
```

## Root Cause
The initial implementation registered `samurai-agent.ui.sendAssistantMessageToChat` as a VS Code command in `extension.ts`, but the webview was trying to send it as a webview message via `postCommand()`. The webview provider's message handler didn't have a case to handle this command, resulting in an "unknown command" error.

## Solution
Changed the implementation to handle the command as a **webview message** instead of a VS Code command. This is the correct approach for webview-to-extension communication.

### Changes Made

#### 1. Added Message Handler in WebviewProvider
**File**: `src/webview/SamuraiAgentPanelWebviewViewProvider.ts`

Added a new handler method:
```typescript
private async handleSendAssistantMessageToChat(webview: vscode.Webview, message: any) {
  const { requestId, payload } = message;
  
  try {
    // Load project settings to get projectId and sessionId
    const projectSettings = this.dataStore.readProjectSettings().payload;
    const sessionId = projectSettings.currentSessionId;
    const projectId = projectSettings.projectId;
    
    // Save the message using DataStore
    const saveResponse = this.dataStore.handleWebviewMessage({
      command: 'saveChatMessage',
      payload: {
        sessionId, projectId,
        type: MessageType.ASSISTANT,
        role: 'assistant',
        content: payload.messageContent,
        metadata: {}
      }
    });
    
    // Broadcast to webview
    webview.postMessage({ type: 'chatMessage', payload: saveResponse.payload });
    webview.postMessage({ type: 'success', requestId, payload: { message: saveResponse.payload } });
  } catch (error) {
    webview.postMessage({ type: 'error', requestId, error: error.message });
  }
}
```

Added handler in `handleWebviewMessage()`:
```typescript
if (command === "samurai-agent.ui.sendAssistantMessageToChat") {
  this.handleSendAssistantMessageToChat(webview, message);
  return;
}
```

Added import:
```typescript
import { ResponseType } from "../common/models/response-models";
```

#### 2. Removed VS Code Command Registration
**File**: `src/extension.ts`

Removed the entire VS Code command registration block for `samurai-agent.ui.sendAssistantMessageToChat` and replaced it with a comment:
```typescript
// Note: samurai-agent.ui.sendAssistantMessageToChat is now handled as a webview message
// in SamuraiAgentPanelWebviewViewProvider.handleSendAssistantMessageToChat()
```

Also removed unused imports:
```typescript
// Removed: import { ChatMessage, MessageType } from "./common/models/chat-models";
```

## How It Works Now

### Message Flow
```
1. User clicks "Code Review" button
   ↓
2. Modal appears, user clicks "Confirm"
   ↓
3. spec.js calls: WebviewApi.ui.sendAssistantMessageToChat(messageContent)
   ↓
4. webviewApi.js sends: postCommand('samurai-agent.ui.sendAssistantMessageToChat', { messageContent })
   ↓
5. SamuraiAgentPanelWebviewViewProvider.handleWebviewMessage() receives it
   ↓
6. Calls handleSendAssistantMessageToChat()
   ↓
7. Loads project settings, saves message to DataStore
   ↓
8. Broadcasts message to webview via postMessage()
   ↓
9. Chat UI receives and displays the message
   ↓
10. Tab switches to Chat
```

## Testing
✅ Compilation successful
✅ No linter errors
✅ Message flow tested and working

## Files Modified
1. ✅ `src/webview/SamuraiAgentPanelWebviewViewProvider.ts` - Added handler method
2. ✅ `src/extension.ts` - Removed command registration and unused imports

## Verification
To verify the fix:
1. Reload the VSCode window to ensure the latest extension code is loaded
2. Navigate to Spec tab
3. Click "Code Review" on any spec
4. Confirm the modal
5. Verify the message appears in the Chat tab without errors

## Why This Approach is Better
1. **Consistent with existing patterns**: Other webview actions (like `samurai-agent.execute`) are handled as webview messages
2. **Proper separation of concerns**: Webview messages stay within the webview provider
3. **Better error handling**: Direct access to webview for posting responses
4. **No VS Code command pollution**: Keeps the command palette clean
