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
