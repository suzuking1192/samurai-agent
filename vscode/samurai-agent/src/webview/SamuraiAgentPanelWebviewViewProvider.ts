import * as vscode from 'vscode';
import * as path from 'path';

export class SamuraiAgentPanelWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'samurai-agent.agentPanel';

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get paths to local resources
        const agentPanelCssPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'agentPanel.css')
        );
        const agentPanelJsPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'agentPanel.js')
        );
        const chatCssPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.css')
        );
        const chatJsPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.js')
        );

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
