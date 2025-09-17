import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from './webview/SamuraiAgentPanelWebviewViewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('TEST: Extension activating...');
	vscode.window.showInformationMessage('TEST: Extension is active!');
	
	// Register the Hello World command
	const disposable = vscode.commands.registerCommand('samurai-agent.helloWorld', () => {
		vscode.window.showInformationMessage('TEST: Hello World!');
	});
	
	// Register the agent panel webview provider
	const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider(context.extensionUri);
	const agentPanelWebviewDisposable = vscode.window.registerWebviewViewProvider(
		SamuraiAgentPanelWebviewViewProvider.viewType,
		agentPanelProvider
	);
	
	context.subscriptions.push(disposable, agentPanelWebviewDisposable);
	console.log('TEST: Command and webview provider registered');
}

export function deactivate() {
	console.log('TEST: Extension deactivating...');
}
