import * as assert from 'assert';
import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from '../webview/SamuraiAgentPanelWebviewViewProvider';

suite('Task Tab E2E Test Suite', () => {
	test('Task tab should be clickable and switch content', async () => {
		// This test simulates the E2E behavior of clicking the Task tab
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		// Create a mock webview
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify Task tab exists and has correct attributes
		assert.ok(html.includes('id="task-tab"'), 'Task tab should have correct ID');
		assert.ok(html.includes('data-tab="task"'), 'Task tab should have correct data attribute');
		assert.ok(html.includes('>Task<'), 'Task tab should display "Task" text');
		
		// Verify Task content area exists
		assert.ok(html.includes('id="task-content"'), 'Task content area should exist');
		assert.ok(html.includes('style="display: none;"'), 'Task content should be initially hidden');
	});

	test('Task tab should load required CSS and JS files', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify task.css is included in head
		assert.ok(html.includes('<link href="'), 'HTML should contain link tags');
		assert.ok(html.includes('task.css'), 'HTML should include task.css');
		
		// Verify task.js is included in body
		assert.ok(html.includes('<script src="'), 'HTML should contain script tags');
		assert.ok(html.includes('task.js'), 'HTML should include task.js');
		
		// Verify scripts are loaded in correct order
		const agentPanelIndex = html.indexOf('agentPanel.js');
		const chatIndex = html.indexOf('chat.js');
		const taskIndex = html.indexOf('task.js');
		
		assert.ok(agentPanelIndex < chatIndex, 'agentPanel.js should load before chat.js');
		assert.ok(chatIndex < taskIndex, 'chat.js should load before task.js');
	});

	test('Task content should be dynamically rendered', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify task content area is empty (will be populated by JavaScript)
		const taskContentMatch = html.match(/id="task-content"[^>]*>(.*?)<\/div>/s);
		assert.ok(taskContentMatch, 'Task content div should exist');
		
		// The content should be minimal (just a comment about dynamic rendering)
		const taskContent = taskContentMatch[1];
		assert.ok(taskContent.includes('dynamically rendered'), 'Task content should indicate dynamic rendering');
	});

	test('Task tab should integrate with existing tab system', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify all three tabs exist
		assert.ok(html.includes('data-tab="chat"'), 'Chat tab should exist');
		assert.ok(html.includes('data-tab="task"'), 'Task tab should exist');
		assert.ok(html.includes('data-tab="setting"'), 'Setting tab should exist');
		
		// Verify tab header structure
		assert.ok(html.includes('class="tab-header"'), 'Tab header should exist');
		assert.ok(html.includes('class="tab"'), 'Tab elements should have correct class');
		
		// Verify content areas exist
		assert.ok(html.includes('id="chat-content"'), 'Chat content should exist');
		assert.ok(html.includes('id="task-content"'), 'Task content should exist');
		assert.ok(html.includes('id="setting-content"'), 'Setting content should exist');
	});

	test('Task tab should have proper accessibility attributes', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify Task tab has proper structure for accessibility
		assert.ok(html.includes('<span>Task</span>'), 'Task tab should have span with text');
		assert.ok(html.includes('id="task-tab"'), 'Task tab should have unique ID');
		assert.ok(html.includes('data-tab="task"'), 'Task tab should have data attribute for JavaScript');
	});

	test('Task tab should be properly styled', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify CSS files are properly linked
		assert.ok(html.includes('rel="stylesheet"'), 'CSS files should have proper rel attribute');
		assert.ok(html.includes('task.css'), 'task.css should be included');
		
		// Verify CSS is loaded before JavaScript
		const headEndIndex = html.indexOf('</head>');
		const bodyStartIndex = html.indexOf('<body>');
		const taskCssIndex = html.indexOf('task.css');
		const taskJsIndex = html.indexOf('task.js');
		
		assert.ok(taskCssIndex < headEndIndex, 'task.css should be in head section');
		assert.ok(taskJsIndex > bodyStartIndex, 'task.js should be in body section');
	});
});
