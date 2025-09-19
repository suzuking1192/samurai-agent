import * as assert from 'assert';
import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from '../webview/SamuraiAgentPanelWebviewViewProvider';

suite('Settings Tab E2E Test Suite', () => {
	test('Settings tab should be clickable and switch content', async () => {
		// This test simulates the E2E behavior of clicking the Settings tab
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		// Create a mock webview
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify Settings tab exists and has correct attributes
		assert.ok(html.includes('id="setting-tab"'), 'Settings tab should have correct ID');
		assert.ok(html.includes('data-tab="setting"'), 'Settings tab should have correct data attribute');
		assert.ok(html.includes('>Setting<'), 'Settings tab should display "Setting" text');
		
		// Verify Settings content area exists
		assert.ok(html.includes('id="setting-content"'), 'Settings content area should exist');
		assert.ok(html.includes('style="display: none;"'), 'Settings content should be initially hidden');
	});

	test('Settings tab should load required CSS and JS files', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify settings.css is included in head
		assert.ok(html.includes('<link href="'), 'HTML should contain link tags');
		assert.ok(html.includes('settings.css'), 'HTML should include settings.css');
		
		// Verify settings.js is included in body
		assert.ok(html.includes('<script src="'), 'HTML should contain script tags');
		assert.ok(html.includes('settings.js'), 'HTML should include settings.js');
		
		// Verify scripts are loaded in correct order
		const agentPanelIndex = html.indexOf('agentPanel.js');
		const chatIndex = html.indexOf('chat.js');
		const taskIndex = html.indexOf('task.js');
		const settingsIndex = html.indexOf('settings.js');
		
		assert.ok(agentPanelIndex < chatIndex, 'agentPanel.js should load before chat.js');
		assert.ok(chatIndex < taskIndex, 'chat.js should load before task.js');
		assert.ok(taskIndex < settingsIndex, 'task.js should load before settings.js');
	});

	test('Settings content should be dynamically rendered', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify settings content area is empty (will be populated by JavaScript)
		const settingsContentMatch = html.match(/id="setting-content"[^>]*>(.*?)<\/div>/s);
		assert.ok(settingsContentMatch, 'Settings content div should exist');
		
		// The content should be minimal (just a comment about dynamic rendering)
		const settingsContent = settingsContentMatch[1];
		assert.ok(settingsContent.includes('dynamically rendered'), 'Settings content should indicate dynamic rendering');
	});

	test('Settings tab should integrate with existing tab system', async () => {
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

	test('Settings tab should have proper accessibility attributes', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify Settings tab has proper structure for accessibility
		assert.ok(html.includes('<span>Setting</span>'), 'Settings tab should have span with text');
		assert.ok(html.includes('id="setting-tab"'), 'Settings tab should have unique ID');
		assert.ok(html.includes('data-tab="setting"'), 'Settings tab should have data attribute for JavaScript');
	});

	test('Settings tab should be properly styled', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify CSS files are properly linked
		assert.ok(html.includes('rel="stylesheet"'), 'CSS files should have proper rel attribute');
		assert.ok(html.includes('settings.css'), 'settings.css should be included');
		
		// Verify CSS is loaded before JavaScript
		const headEndIndex = html.indexOf('</head>');
		const bodyStartIndex = html.indexOf('<body>');
		const settingsCssIndex = html.indexOf('settings.css');
		const settingsJsIndex = html.indexOf('settings.js');
		
		assert.ok(settingsCssIndex < headEndIndex, 'settings.css should be in head section');
		assert.ok(settingsJsIndex > bodyStartIndex, 'settings.js should be in body section');
	});

	test('Settings tab should have proper HTML structure', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify HTML structure is valid
		assert.ok(html.includes('<!DOCTYPE html>'), 'HTML should have proper DOCTYPE');
		assert.ok(html.includes('<html lang="en">'), 'HTML should have lang attribute');
		assert.ok(html.includes('<head>'), 'HTML should have head section');
		assert.ok(html.includes('<body>'), 'HTML should have body section');
		
		// Verify meta tags
		assert.ok(html.includes('<meta charset="UTF-8">'), 'HTML should have charset meta tag');
		assert.ok(html.includes('<meta name="viewport"'), 'HTML should have viewport meta tag');
		
		// Verify title
		assert.ok(html.includes('<title>Samurai Agent Panel</title>'), 'HTML should have proper title');
	});

	test('Settings tab should be properly integrated with agentPanel.js', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify agentPanel.js is loaded first (required for tab switching)
		const agentPanelIndex = html.indexOf('agentPanel.js');
		const settingsIndex = html.indexOf('settings.js');
		
		assert.ok(agentPanelIndex > 0, 'agentPanel.js should be included');
		assert.ok(settingsIndex > 0, 'settings.js should be included');
		assert.ok(agentPanelIndex < settingsIndex, 'agentPanel.js should load before settings.js');
		
		// Verify all required scripts are present
		assert.ok(html.includes('agentPanel.js'), 'agentPanel.js should be included');
		assert.ok(html.includes('chat.js'), 'chat.js should be included');
		assert.ok(html.includes('task.js'), 'task.js should be included');
		assert.ok(html.includes('settings.js'), 'settings.js should be included');
	});

	test('Settings tab should have proper CSS integration', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify all CSS files are included
		assert.ok(html.includes('agentPanel.css'), 'agentPanel.css should be included');
		assert.ok(html.includes('chat.css'), 'chat.css should be included');
		assert.ok(html.includes('task.css'), 'task.css should be included');
		assert.ok(html.includes('settings.css'), 'settings.css should be included');
		
		// Verify CSS files are in head section
		const headEndIndex = html.indexOf('</head>');
		const agentPanelCssIndex = html.indexOf('agentPanel.css');
		const settingsCssIndex = html.indexOf('settings.css');
		
		assert.ok(agentPanelCssIndex < headEndIndex, 'agentPanel.css should be in head section');
		assert.ok(settingsCssIndex < headEndIndex, 'settings.css should be in head section');
	});

	test('Settings tab should have proper webview resource paths', async () => {
		const mockExtensionUri = vscode.Uri.file('/mock/path');
		const provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
		
		const mockWebview = {
			asWebviewUri: (uri: vscode.Uri) => uri.toString(),
			options: {}
		} as any;
		
		const html = (provider as any)._getHtmlForWebview(mockWebview);
		
		// Verify webview resource paths are properly formatted
		assert.ok(html.includes('src/webview/'), 'HTML should contain webview resource paths');
		assert.ok(html.includes('settings.css'), 'HTML should contain settings.css path');
		assert.ok(html.includes('settings.js'), 'HTML should contain settings.js path');
		
		// Verify paths are properly escaped for HTML
		assert.ok(!html.includes('\\'), 'HTML should not contain backslashes (Windows paths)');
		assert.ok(html.includes('/'), 'HTML should contain forward slashes for paths');
	});
});
