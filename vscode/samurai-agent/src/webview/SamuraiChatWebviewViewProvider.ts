import * as vscode from 'vscode';
import * as path from 'path';

export class SamuraiChatWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'samurai-agent.chatView';

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
            <title>Samurai Agent Chat</title>
            <link href="${chatCssPath}" rel="stylesheet">
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-messages" id="chatMessages">
                    <!-- Messages will appear here -->
                </div>
                <div class="chat-input-container">
                    <input type="text" id="chatInput" placeholder="Type your message here..." />
                </div>
            </div>
            <script src="${chatJsPath}"></script>
        </body>
        </html>`;
    }
}
