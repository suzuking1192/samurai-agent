"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamuraiAgentPanelWebviewViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const llm_models_1 = require("../common/constants/llm-models");
// Resolve each asset to whichever folder actually has that file
const assetUri = (webview, extUri, filename) => {
    const out = vscode.Uri.joinPath(extUri, "out", "webview", filename);
    const src = vscode.Uri.joinPath(extUri, "src", "webview", filename);
    return fs.existsSync(out.fsPath)
        ? webview.asWebviewUri(out)
        : webview.asWebviewUri(src);
};
class SamuraiAgentPanelWebviewViewProvider {
    _extensionUri;
    static viewType = "samurai-agent.agentPanel";
    dataStore;
    globalDataStore;
    llmProviderService;
    projectDetailService;
    constructor(_extensionUri, dependencies) {
        this._extensionUri = _extensionUri;
        this.llmProviderService = dependencies.llmProviderService;
        this.projectDetailService = dependencies.projectDetailService;
        this.dataStore = dependencies.dataStore;
        this.globalDataStore = dependencies.globalDataStore;
    }
    resolveWebviewView(webviewView, context, _token) {
        console.log("Webview Provider: resolveWebviewView called");
        console.log("Webview Provider: webviewView visible:", webviewView.visible);
        // Allow both src and out roots for maximum compatibility
        const srcRoot = vscode.Uri.joinPath(this._extensionUri, "src", "webview");
        const outRoot = vscode.Uri.joinPath(this._extensionUri, "out", "webview");
        console.log("Webview Provider: Allowing both roots:", {
            src: srcRoot.toString(),
            out: outRoot.toString(),
        });
        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [srcRoot, outRoot], // include BOTH
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log("Webview Provider: HTML set for webview");
        // Send initial settings to webview after a short delay to ensure it's loaded
        setTimeout(() => {
            this.sendInitialSettingsToWebview(webviewView.webview);
        }, 100);
        // Send a test message to verify communication
        setTimeout(() => {
            console.log("Webview Provider: Sending test message to webview");
            webviewView.webview.postMessage({
                type: "test",
                message: "Hello from webview provider!",
            });
        }, 200);
        // Set up message listener
        webviewView.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(webviewView.webview, message));
        // Add debugging for script loading
        console.log("Webview Provider: Setting up webview with options:", {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [srcRoot.toString(), outRoot.toString()],
        });
    }
    /**
     * Handles messages from the webview
     */
    handleWebviewMessage(webview, message) {
        const { command } = message;
        try {
            // LLM chat handling
            if (command === "llm.chat") {
                const command = vscode.commands.executeCommand("samurai-agent.llm.chat", message.payload);
                if (command && typeof command.then === "function") {
                    command.then((result) => {
                        webview.postMessage({
                            type: "success",
                            requestId: message.requestId,
                            payload: result,
                            timestamp: new Date(),
                        });
                    }, (error) => {
                        webview.postMessage({
                            type: "error",
                            requestId: message.requestId,
                            error: error instanceof Error ? error.message : "LLM chat failed",
                            timestamp: new Date(),
                        });
                    });
                }
                return;
            }
            if (command === "projectDetail.ingest") {
                const commandPromise = vscode.commands.executeCommand("samurai-agent.projectDetail.ingest", message.payload);
                if (commandPromise && typeof commandPromise.then === "function") {
                    commandPromise.then((result) => {
                        webview.postMessage({
                            type: "success",
                            requestId: message.requestId,
                            payload: { finalText: result },
                            timestamp: new Date(),
                        });
                    }, (error) => {
                        webview.postMessage({
                            type: "error",
                            requestId: message.requestId,
                            error: error instanceof Error
                                ? error.message
                                : "Project detail ingestion failed",
                            timestamp: new Date(),
                        });
                    });
                }
                return;
            }
            // Route global settings commands to GlobalDataStore
            if (command === "loadGlobalSettings" ||
                command === "saveGlobalSettings") {
                if (!this.globalDataStore) {
                    console.error("GlobalDataStore not initialized");
                    webview.postMessage({
                        type: "error",
                        requestId: message.requestId,
                        error: "GlobalDataStore not initialized",
                        timestamp: new Date(),
                    });
                    return;
                }
                let response;
                if (command === "loadGlobalSettings") {
                    response = this.globalDataStore.loadGlobalSettings(message.requestId);
                }
                else {
                    response = this.globalDataStore.saveGlobalSettings(message.payload, message.requestId);
                    console.log("Webview Provider: Save response:", response.type);
                    // If save was successful, notify all tabs that global settings have been updated
                    if (response.type === "success") {
                        console.log("Webview Provider: Sending globalSettingsUpdated notification");
                        webview.postMessage({
                            type: "globalSettingsUpdated",
                            payload: message.payload,
                            timestamp: new Date(),
                        });
                    }
                }
                webview.postMessage(response);
                return;
            }
            // Route all other commands to DataStore (project-specific)
            if (!this.dataStore) {
                console.error("DataStore not initialized");
                webview.postMessage({
                    type: "error",
                    requestId: message.requestId,
                    error: "DataStore not initialized",
                    timestamp: new Date(),
                });
                return;
            }
            const response = this.dataStore.handleWebviewMessage(message);
            webview.postMessage(response);
        }
        catch (error) {
            console.error("Error handling webview message:", error);
            webview.postMessage({
                type: "error",
                requestId: message.requestId,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                timestamp: new Date(),
            });
        }
    }
    async handleLLMChat(webview, message) {
        const { requestId, payload } = message;
        try {
            const response = await this.llmProviderService.chat(payload);
            webview.postMessage({
                type: "success",
                requestId,
                payload: response,
                timestamp: new Date(),
            });
        }
        catch (error) {
            webview.postMessage({
                type: "error",
                requestId,
                error: error instanceof Error ? error.message : "LLM chat failed",
                timestamp: new Date(),
            });
        }
    }
    async handleProjectDetailIngest(webview, message) {
        const { requestId, payload } = message;
        try {
            const finalText = await this.projectDetailService?.ingestProjectDetail(payload.projectId, payload.rawText, payload.mode);
            webview.postMessage({
                type: "success",
                requestId,
                payload: { finalText },
                timestamp: new Date(),
            });
        }
        catch (error) {
            webview.postMessage({
                type: "error",
                requestId,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                timestamp: new Date(),
            });
        }
    }
    _getHtmlForWebview(webview) {
        // Generate a nonce for CSP
        const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        // Resolve each asset to whichever folder actually has that file
        const agentPanelCssPath = assetUri(webview, this._extensionUri, "agentPanel.css");
        const agentPanelJsPath = assetUri(webview, this._extensionUri, "agentPanel.js");
        const chatCssPath = assetUri(webview, this._extensionUri, "chat.css");
        const chatJsPath = assetUri(webview, this._extensionUri, "chat.js");
        const taskCssPath = assetUri(webview, this._extensionUri, "task.css");
        const taskJsPath = assetUri(webview, this._extensionUri, "task.js");
        const settingsCssPath = assetUri(webview, this._extensionUri, "settings.css");
        const settingsJsPath = assetUri(webview, this._extensionUri, "settings.js");
        const webviewApiJsPath = assetUri(webview, this._extensionUri, "webviewApi.js");
        const testJsPath = assetUri(webview, this._extensionUri, "test.js");
        console.log("Webview Provider: Asset paths:", {
            // CSS paths
            agentPanelCssPath: agentPanelCssPath.toString(),
            chatCssPath: chatCssPath.toString(),
            taskCssPath: taskCssPath.toString(),
            settingsCssPath: settingsCssPath.toString(),
            // JS paths
            webviewApiJsPath: webviewApiJsPath.toString(),
            agentPanelJsPath: agentPanelJsPath.toString(),
            chatJsPath: chatJsPath.toString(),
            taskJsPath: taskJsPath.toString(),
            settingsJsPath: settingsJsPath.toString(),
            testJsPath: testJsPath.toString(),
        });
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                img-src ${webview.cspSource} https: data:;
                style-src ${webview.cspSource} 'unsafe-inline';
                font-src ${webview.cspSource};
                connect-src ${webview.cspSource} https:;
                script-src 'nonce-${nonce}' ${webview.cspSource};
            ">
            <title>Samurai Agent Panel</title>
            <link href="${agentPanelCssPath}" rel="stylesheet">
            <link href="${chatCssPath}" rel="stylesheet">
            <link href="${taskCssPath}" rel="stylesheet">
            <link href="${settingsCssPath}" rel="stylesheet">
        </head>
        <body>
            <div class="agent-panel-container">
                <!-- Tab Header -->
                <div class="tab-header">
                    <div class="tab" id="chat-tab" data-tab="chat">
                        <span>Chat</span>
                    </div>
                    <div class="tab" id="task-tab" data-tab="task">
                        <span>Task</span>
                    </div>
                    <div class="tab" id="setting-tab" data-tab="setting">
                        <span>Setting</span>
                    </div>
                </div>
                
                <!-- Content Areas -->
                <div class="content-area">
                    <!-- Chat Content -->
                    <div class="tab-content" id="chat-content">
                        <!-- Chat Header with API Cost and Start New Conversation Button -->
                        <div class="chat-header">
                            <div class="api-cost-display" id="api-cost-display">
                                API Cost: $0.00 this month
                            </div>
                            <button class="start-new-conversation-btn" id="start-new-conversation-btn">
                                Start New Conversation
                            </button>
                        </div>
                        
                        <div class="chat-container">
                            <div class="chat-messages" id="chatMessages">
                                <!-- Messages will appear here -->
                            </div>
                            <div class="chat-input-container">
                                <input type="text" id="chatInput" placeholder="Type your message here..." />
                                
                                <!-- LLM Model and Mode Dropdowns -->
                                <div class="chat-controls">
                                    <div class="dropdown-container">
                                        <label for="llm-model-select">LLM Model:</label>
                                        <select id="llm-model-select" class="dropdown">
                                            <!-- Options will be populated dynamically based on configured API keys -->
                                        </select>
                                    </div>
                                    <div class="dropdown-container">
                                        <label for="mode-select">Mode:</label>
                                        <select id="mode-select" class="dropdown">
                                            <option value="default">Default Mode</option>
                                            <option value="developer">Developer Mode</option>
                                            <option value="creative">Creative Mode</option>
                                            <option value="analytical">Analytical Mode</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Task Content -->
                    <div class="tab-content" id="task-content" style="display: none;">
                        <!-- Task content will be dynamically rendered by task.js -->
                    </div>
                    
                    <!-- Setting Content -->
                    <div class="tab-content" id="setting-content" style="display: none;">
                        <!-- Settings content will be dynamically rendered by settings.js -->
                    </div>
                </div>
            </div>
            <script nonce="${nonce}">
                console.log('Webview: JavaScript is working!');
                console.log('Webview: About to load external scripts...');
                
                // Test if we can access the DOM
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('Webview: DOM is ready!');
                    console.log('Webview: All scripts should be loaded now');
                });
                
                // Listen for messages from the webview provider
                window.addEventListener('message', function(event) {
                    console.log('Webview: Received message:', event.data);
                    if (event.data.type === 'test') {
                        console.log('Webview: Test message received:', event.data.message);
                    }
                });
                
                // Comprehensive debugging for common issues
                console.log('Webview: Environment check:');
                console.log('- User agent:', navigator.userAgent);
                console.log('- Document ready state:', document.readyState);
                console.log('- Window location:', window.location.href);
                
                // Check for CSP violations
                window.addEventListener('error', function(event) {
                    if (event.message && event.message.includes('CSP')) {
                        console.error('Webview: CSP Error detected:', event.message);
                    }
                });
                
            </script>
            <script nonce="${nonce}" src="${testJsPath}"></script>
            <script nonce="${nonce}" src="${webviewApiJsPath}"></script>
            <script nonce="${nonce}" src="${agentPanelJsPath}"></script>
            <script nonce="${nonce}" src="${chatJsPath}"></script>
            <script nonce="${nonce}" src="${taskJsPath}"></script>
            <script nonce="${nonce}" src="${settingsJsPath}"></script>
            
            <!-- Script loading debugging - runs after external scripts are parsed -->
            <script nonce="${nonce}">
                // Debug script loading after all scripts are parsed
                setTimeout(() => {
                    console.log('Webview: Checking script status...');
                    document.querySelectorAll('script[src]').forEach((script, index) => {
                        console.log('Webview: Script present:', script.getAttribute('src'));
                        // Note: load/error listeners may miss already-fired events
                        script.addEventListener('load', function() {
                            console.log('Webview: Script loaded successfully:', script.src);
                        });
                        script.addEventListener('error', function() {
                            console.error('Webview: Failed to load script:', script.src);
                        });
                    });
                    
                    // Check if key functions are available (indicates successful loading)
                    setTimeout(() => {
                        console.log('Webview: Checking for loaded functions...');
                        if (typeof window.WebviewApi !== 'undefined') {
                            console.log('Webview: ✅ WebviewApi is available');
                            console.log('Webview: WebviewApi methods:', Object.keys(window.WebviewApi));
                        } else {
                            console.log('Webview: ❌ WebviewApi is not available');
                            console.log('Webview: Available globals:', Object.keys(window).filter(k => k.startsWith('Webview') || k.startsWith('post')));
                        }
                        
                        // Check if other expected globals exist
                        if (typeof window.postCommand !== 'undefined') {
                            console.log('Webview: ✅ postCommand is available');
                        } else {
                            console.log('Webview: ❌ postCommand is not available');
                        }
                    }, 100);
                }, 0);
            </script>
        </body>
        </html>`;
    }
    /**
     * Sends initial settings to the webview, including determining the initial primaryLLMModel
     */
    async sendInitialSettingsToWebview(webview) {
        try {
            // Load global settings to check API keys
            const globalSettingsResponse = this.globalDataStore?.loadGlobalSettings();
            const globalSettings = globalSettingsResponse?.payload;
            // Load project settings
            const projectSettingsResponse = this.dataStore?.readProjectSettings();
            const projectSettings = projectSettingsResponse?.payload;
            if (globalSettings && projectSettings) {
                // Determine initial primaryLLMModel if it's null
                let initialPrimaryLLMModel = projectSettings.primaryLLMModel;
                if (!initialPrimaryLLMModel) {
                    // Find the first available model based on API keys
                    const availableModels = this.getAvailableModels(globalSettings);
                    if (availableModels.length > 0) {
                        initialPrimaryLLMModel = availableModels[0].id;
                        // Update project settings with the initial model
                        const updatedProjectSettings = {
                            ...projectSettings,
                            primaryLLMModel: initialPrimaryLLMModel,
                        };
                        // Save the updated project settings
                        this.dataStore?.saveProjectSettings(updatedProjectSettings);
                    }
                }
                // Get available models
                const availableModels = this.getAvailableModels(globalSettings);
                // Send settings to webview
                webview.postMessage({
                    type: "initialSettings",
                    payload: {
                        globalSettings,
                        projectSettings: {
                            ...projectSettings,
                            primaryLLMModel: initialPrimaryLLMModel,
                        },
                        availableModels,
                        llmModels: llm_models_1.LLM_MODELS,
                    },
                    timestamp: new Date(),
                });
            }
        }
        catch (error) {
            console.error("Error sending initial settings to webview:", error);
        }
    }
    /**
     * Gets available models based on configured API keys
     */
    getAvailableModels(globalSettings) {
        const availableModels = [];
        // Check OpenAI models
        if (globalSettings.openaiApiKey && globalSettings.openaiApiKey.trim()) {
            availableModels.push(...llm_models_1.LLM_MODELS.openai);
        }
        // Check Google models
        if (globalSettings.geminiApiKey && globalSettings.geminiApiKey.trim()) {
            availableModels.push(...llm_models_1.LLM_MODELS.google);
        }
        // Check Anthropic models
        if (globalSettings.claudeApiKey && globalSettings.claudeApiKey.trim()) {
            availableModels.push(...llm_models_1.LLM_MODELS.anthropic);
        }
        // Sort alphabetically by provider, then by model name
        return availableModels.sort((a, b) => {
            const providerA = a.provider;
            const providerB = b.provider;
            if (providerA !== providerB) {
                return providerA.localeCompare(providerB);
            }
            return a.name.localeCompare(b.name);
        });
    }
}
exports.SamuraiAgentPanelWebviewViewProvider = SamuraiAgentPanelWebviewViewProvider;
//# sourceMappingURL=SamuraiAgentPanelWebviewViewProvider.js.map