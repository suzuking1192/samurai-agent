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
class SamuraiAgentPanelWebviewViewProvider {
    _extensionUri;
    static viewType = 'samurai-agent.agentPanel';
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }
    _getHtmlForWebview(webview) {
        // Get paths to local resources
        const agentPanelCssPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'agentPanel.css'));
        const agentPanelJsPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'agentPanel.js'));
        const chatCssPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.css'));
        const chatJsPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.js'));
        const taskCssPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'task.css'));
        const taskJsPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'task.js'));
        const settingsCssPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'settings.css'));
        const settingsJsPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'settings.js'));
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                                            <option value="gpt-4">GPT-4</option>
                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                            <option value="claude-3-opus">Claude 3 Opus</option>
                                            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                                            <option value="gemini-pro">Gemini Pro</option>
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
            <script src="${agentPanelJsPath}"></script>
            <script src="${chatJsPath}"></script>
            <script src="${taskJsPath}"></script>
            <script src="${settingsJsPath}"></script>
        </body>
        </html>`;
    }
}
exports.SamuraiAgentPanelWebviewViewProvider = SamuraiAgentPanelWebviewViewProvider;
//# sourceMappingURL=SamuraiAgentPanelWebviewViewProvider.js.map