import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('TEST: Extension activating...');
	vscode.window.showInformationMessage('TEST: Extension is active!');
	
	const disposable = vscode.commands.registerCommand('samurai-agent.helloWorld', () => {
		vscode.window.showInformationMessage('TEST: Hello World!');
	});
	
	context.subscriptions.push(disposable);
	console.log('TEST: Command registered');
}

export function deactivate() {
	console.log('TEST: Extension deactivating...');
}
