import * as vscode from 'vscode';
import * as path from 'path';
import { DataStore } from '../persistence/dataStore';
import { GlobalDataStore } from '../persistence/globalDataStore';

export class SamuraiAgentPanelWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'samurai-agent.agentPanel';
    private dataStore: DataStore | undefined;
    private globalDataStore: GlobalDataStore | undefined;

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
        
        // Initialize data stores
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot && !this.dataStore) {
            this.dataStore = new DataStore(workspaceRoot);
        }
        if (!this.globalDataStore) {
            this.globalDataStore = new GlobalDataStore();
        }
        
        // Set up message listener
        webviewView.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(webviewView.webview, message)
        );
    }
    
    /**
     * Handles messages from the webview
     */
    private handleWebviewMessage(webview: vscode.Webview, message: any) {
        const { command } = message;
        
        try {
            // Route global settings commands to GlobalDataStore
            if (command === 'loadGlobalSettings' || command === 'saveGlobalSettings') {
                if (!this.globalDataStore) {
                    console.error('GlobalDataStore not initialized');
                    webview.postMessage({
                        type: 'error',
                        requestId: message.requestId,
                        error: 'GlobalDataStore not initialized',
                        timestamp: new Date()
                    });
                    return;
                }
                
                let response;
                if (command === 'loadGlobalSettings') {
                    response = this.globalDataStore.loadGlobalSettings(message.requestId);
                } else {
                    response = this.globalDataStore.saveGlobalSettings(message.payload, message.requestId);
                }
                webview.postMessage(response);
                return;
            }
            
            // Route all other commands to DataStore (project-specific)
            if (!this.dataStore) {
                console.error('DataStore not initialized');
                webview.postMessage({
                    type: 'error',
                    requestId: message.requestId,
                    error: 'DataStore not initialized',
                    timestamp: new Date()
                });
                return;
            }
            
            const response = this.dataStore.handleWebviewMessage(message);
            webview.postMessage(response);
        } catch (error) {
            console.error('Error handling webview message:', error);
            webview.postMessage({
                type: 'error',
                requestId: message.requestId,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp: new Date()
            });
        }
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
        const taskCssPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'task.css')
        );
        const taskJsPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'task.js')
        );
        const settingsCssPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'settings.css')
        );
        const settingsJsPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'settings.js')
        );
        const webviewApiJsPath = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'webviewApi.js')
        );

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
            <script src="${webviewApiJsPath}"></script>
            <script src="${agentPanelJsPath}"></script>
            <script src="${chatJsPath}"></script>
            <script src="${taskJsPath}"></script>
            <script src="${settingsJsPath}"></script>
        </body>
        </html>`;
    }
}
