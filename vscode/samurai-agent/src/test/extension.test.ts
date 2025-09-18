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

	test('Chat content should contain Start New Conversation button and API cost display', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify chat header elements are present
		assert.ok(html.includes('chat-header'), 'HTML should contain chat-header class');
		assert.ok(html.includes('id="start-new-conversation-btn"'), 'HTML should contain Start New Conversation button');
		assert.ok(html.includes('Start New Conversation'), 'HTML should contain Start New Conversation button text');
		assert.ok(html.includes('id="api-cost-display"'), 'HTML should contain API cost display');
		assert.ok(html.includes('API Cost: $0.00 this month'), 'HTML should contain API cost display text');
	});

	test('Chat content should contain LLM Model and Mode dropdowns', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify dropdown elements are present
		assert.ok(html.includes('chat-controls'), 'HTML should contain chat-controls class');
		assert.ok(html.includes('id="llm-model-select"'), 'HTML should contain LLM Model dropdown');
		assert.ok(html.includes('id="mode-select"'), 'HTML should contain Mode dropdown');
		assert.ok(html.includes('LLM Model:'), 'HTML should contain LLM Model label');
		assert.ok(html.includes('Mode:'), 'HTML should contain Mode label');
		
		// Verify dropdown options are present
		assert.ok(html.includes('GPT-4'), 'HTML should contain GPT-4 option');
		assert.ok(html.includes('GPT-3.5 Turbo'), 'HTML should contain GPT-3.5 Turbo option');
		assert.ok(html.includes('Claude 3 Opus'), 'HTML should contain Claude 3 Opus option');
		assert.ok(html.includes('Default Mode'), 'HTML should contain Default Mode option');
		assert.ok(html.includes('Developer Mode'), 'HTML should contain Developer Mode option');
	});

	test('HTML should include task.css and task.js files', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify task CSS and JS files are included
		assert.ok(html.includes('task.css'), 'HTML should include task.css');
		assert.ok(html.includes('task.js'), 'HTML should include task.js');
	});

	test('Task content should be properly structured', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify task content structure
		assert.ok(html.includes('id="task-content"'), 'HTML should contain task-content div');
		assert.ok(html.includes('style="display: none;"'), 'Task content should be initially hidden');
		assert.ok(html.includes('data-tab="task"'), 'HTML should contain task tab with correct data attribute');
	});

	test('Scripts should be loaded in correct order', () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;

		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify script loading order (agentPanel.js should load first)
		const agentPanelIndex = html.indexOf('agentPanel.js');
		const chatIndex = html.indexOf('chat.js');
		const taskIndex = html.indexOf('task.js');
		
		assert.ok(agentPanelIndex < chatIndex, 'agentPanel.js should load before chat.js');
		assert.ok(chatIndex < taskIndex, 'chat.js should load before task.js');
	});
});
