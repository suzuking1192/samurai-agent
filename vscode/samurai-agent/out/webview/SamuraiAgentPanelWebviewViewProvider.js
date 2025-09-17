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
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Samurai Agent Panel</title>
            <link href="${agentPanelCssPath}" rel="stylesheet">
            <link href="${chatCssPath}" rel="stylesheet">
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
                        <div class="chat-container">
                            <div class="chat-messages" id="chatMessages">
                                <!-- Messages will appear here -->
                            </div>
                            <div class="chat-input-container">
                                <input type="text" id="chatInput" placeholder="Type your message here..." />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Task Content -->
                    <div class="tab-content" id="task-content" style="display: none;">
                        <div class="task-container">
                            <h3>Task Management</h3>
                            <p>Task management functionality will be implemented here.</p>
                        </div>
                    </div>
                    
                    <!-- Setting Content -->
                    <div class="tab-content" id="setting-content" style="display: none;">
                        <div class="setting-container">
                            <h3>Settings</h3>
                            <p>Settings and configuration options will be implemented here.</p>
                        </div>
                    </div>
                </div>
            </div>
            <script src="${agentPanelJsPath}"></script>
            <script src="${chatJsPath}"></script>
        </body>
        </html>`;
    }
}
exports.SamuraiAgentPanelWebviewViewProvider = SamuraiAgentPanelWebviewViewProvider;
//# sourceMappingURL=SamuraiAgentPanelWebviewViewProvider.js.map