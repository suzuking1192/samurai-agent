import * as assert from 'assert';
import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from '../webview/SamuraiAgentPanelWebviewViewProvider';

suite('Samurai Agent Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('SamuraiAgentPanelWebviewViewProvider should have correct viewType', () => {
		assert.strictEqual(
			SamuraiAgentPanelWebviewViewProvider.viewType,
			'samurai-agent.agentPanel',
			'ViewType should be samurai-agent.agentPanel'
		);
	});

	test('SamuraiAgentPanelWebviewViewProvider should be instantiable', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		assert.ok(provider, 'Provider should be instantiable');
	});

	test('SamuraiAgentPanelWebviewViewProvider should generate HTML with multi-tabbed layout', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		// Create a mock webview
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		// Access the private method for testing
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify the HTML contains the expected multi-tabbed structure
		assert.ok(html.includes('agent-panel-container'), 'HTML should contain agent-panel-container');
		assert.ok(html.includes('tab-header'), 'HTML should contain tab-header');
		assert.ok(html.includes('chat-tab'), 'HTML should contain chat-tab');
		assert.ok(html.includes('task-tab'), 'HTML should contain task-tab');
		assert.ok(html.includes('setting-tab'), 'HTML should contain setting-tab');
		assert.ok(html.includes('chat-content'), 'HTML should contain chat-content');
		assert.ok(html.includes('task-content'), 'HTML should contain task-content');
		assert.ok(html.includes('setting-content'), 'HTML should contain setting-content');
		assert.ok(html.includes('agentPanel.css'), 'HTML should include agentPanel.css');
		assert.ok(html.includes('agentPanel.js'), 'HTML should include agentPanel.js');
		assert.ok(html.includes('chat.css'), 'HTML should include chat.css');
		assert.ok(html.includes('chat.js'), 'HTML should include chat.js');
	});

	test('HTML should contain proper tab labels', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify tab labels are present
		assert.ok(html.includes('>Chat<'), 'HTML should contain Chat tab label');
		assert.ok(html.includes('>Task<'), 'HTML should contain Task tab label');
		assert.ok(html.includes('>Setting<'), 'HTML should contain Setting tab label');
	});
});
