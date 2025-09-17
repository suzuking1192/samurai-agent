import * as vscode from 'vscode';
import { SamuraiChatWebviewViewProvider } from './webview/SamuraiChatWebviewViewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('TEST: Extension activating...');
	vscode.window.showInformationMessage('TEST: Extension is active!');
	
	// Register the Hello World command
	const disposable = vscode.commands.registerCommand('samurai-agent.helloWorld', () => {
		vscode.window.showInformationMessage('TEST: Hello World!');
	});
	
	// Register the chat webview provider
	const chatProvider = new SamuraiChatWebviewViewProvider(context.extensionUri);
	const chatWebviewDisposable = vscode.window.registerWebviewViewProvider(
		SamuraiChatWebviewViewProvider.viewType,
		chatProvider
	);
	
	context.subscriptions.push(disposable, chatWebviewDisposable);
	console.log('TEST: Command and webview provider registered');
}

export function deactivate() {
	console.log('TEST: Extension deactivating...');
}
