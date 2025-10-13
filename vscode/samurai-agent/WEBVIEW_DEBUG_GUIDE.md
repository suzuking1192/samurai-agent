# Webview Debugging Guide for Samurai Agent

## What Was Fixed

The "There is no data provider registered" error has been addressed with the following fixes:

### 1. ✅ View ID Configuration
- **Confirmed Match**: The view ID in `package.json` (`samurai-agent.agentPanel`) matches the `viewType` in `SamuraiAgentPanelWebviewViewProvider`
- **Activation Event**: Using `"*"` to ensure extension activates on startup

### 2. ✅ Comprehensive Error Handling
Added try-catch wrapper around the entire `activate()` function with:
- Detailed logging at each initialization step
- Error messages displayed to the user if activation fails
- Proper error propagation to help diagnose issues

### 3. ✅ Detailed Logging
Every service initialization now logs its status:
```
[Samurai Agent] 🚀 Extension activation starting...
[Samurai Agent] ✓ GlobalDataStore initialized
[Samurai Agent] ✓ TelemetryService initialized
[Samurai Agent] Workspace root: /path/to/workspace
[Samurai Agent] ✓ DataStore initialized: available
... (and so on)
[Samurai Agent] ✅ Webview provider registered successfully! ViewType: samurai-agent.agentPanel
[Samurai Agent] 🎉 Extension activation completed successfully!
```

### 4. ✅ Auto-Compilation
Added `preLaunchTask: "npm: compile"` to `.vscode/launch.json` so the extension automatically compiles before debugging

## How to Debug

### Step 1: Press F5
- The extension will automatically compile
- Then launch in the Extension Development Host

### Step 2: Open Debug Console
In your Extension Development Host window:
1. Go to **View → Output**
2. Select **"Extension Host"** from the dropdown
3. Or press **Cmd+Shift+U** (Mac) / **Ctrl+Shift+U** (Windows/Linux)

### Step 3: Look for Activation Logs
You should see logs like:
```
[Samurai Agent] 🚀 Extension activation starting...
[Samurai Agent] ✓ GlobalDataStore initialized
[Samurai Agent] ✓ TelemetryService initialized
```

### Step 4: Check for Errors
If activation fails, you'll see:
```
[Samurai Agent] ❌ FATAL: Extension activation failed: [error message]
```

And a popup notification with the error details.

### Step 5: Open the Webview
1. Click the Samurai Agent icon in the Activity Bar (left sidebar)
2. The webview should now appear

## Common Issues and Solutions

### Issue: "No workspace folder open"
**Solution**: Open a folder in VS Code before pressing F5. Many services require a workspace.

### Issue: Extension doesn't activate
**Symptoms**: No logs appear in Debug Console
**Solution**: 
- Check that `activationEvents: ["*"]` is in `package.json`
- Restart VS Code and try again

### Issue: Webview shows but is blank
**Symptoms**: Panel opens but nothing displays
**Solution**: 
- Check browser DevTools: Right-click in the webview → "Inspect"
- Look for JavaScript errors in the webview console

### Issue: "Cannot find module" errors
**Symptoms**: Errors about missing TypeScript files
**Solution**: 
- Run `npm install` in the extension directory
- Run `npm run compile` manually
- Check that all dependencies are installed

## Configuration Files Modified

1. **`src/extension.ts`**
   - Added comprehensive logging
   - Wrapped in try-catch for error handling
   - All code properly indented inside try block

2. **`.vscode/launch.json`**
   - Added `preLaunchTask: "npm: compile"`
   - Ensures fresh build before each debug session

3. **`package.json`**
   - View configuration verified: `id: "samurai-agent.agentPanel"`
   - Activation event set to `"*"`

## Next Steps

1. **Stop any running debug session**
2. **Press F5** to launch with the new debugging features
3. **Open the Debug Console** to see activation progress
4. **Report any errors** you see in the console

The detailed logging will help us identify exactly where the issue is if the webview still doesn't appear.

