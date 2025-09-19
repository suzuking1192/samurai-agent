/**
 * Main Backend Entry Point for Samurai Agent VS Code Extension
 * 
 * This file serves as the primary backend handler for the extension, managing:
 * - VS Code command registrations and handlers
 * - Webview provider registrations for UI communication
 * - Extension lifecycle management (activate/deactivate)
 * - Future backend endpoint registrations for AI agent functionality
 * 
 * The extension acts as a bridge between VS Code's API and the AI agent core logic,
 * providing the necessary infrastructure for command handling, webview communication,
 * and integration with the broader agent ecosystem.
 */

import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from './webview/SamuraiAgentPanelWebviewViewProvider';

/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('TEST: Extension activating...');
	vscode.window.showInformationMessage('TEST: Extension is active!');
	
	// ============================================================================
	// COMMAND REGISTRATIONS - Backend Endpoints for VS Code Commands
	// ============================================================================
	// TODO: Add future command handlers here for AI agent functionality
	// Example: samurai-agent.analyzeCode, samurai-agent.generateTasks, etc.
	
	// Register the Hello World command (initial test command)
	const disposable = vscode.commands.registerCommand('samurai-agent.helloWorld', () => {
		vscode.window.showInformationMessage('TEST: Hello World!');
	});
	
	// ============================================================================
	// WEBVIEW PROVIDER REGISTRATIONS - Backend Communication with Frontend
	// ============================================================================
	// TODO: Add webview message listeners here for handling frontend requests
	// Example: agent analysis requests, task generation, memory operations, etc.
	
	// Register the agent panel webview provider (main UI communication channel)
	const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider(context.extensionUri);
	const agentPanelWebviewDisposable = vscode.window.registerWebviewViewProvider(
		SamuraiAgentPanelWebviewViewProvider.viewType,
		agentPanelProvider
	);
	
	// ============================================================================
	// FUTURE BACKEND ENDPOINT REGISTRATIONS
	// ============================================================================
	// TODO: Add additional backend endpoints here as the agent system grows:
	// - Agent core initialization and management
	// - LLM provider integrations and API endpoints
	// - Memory management and persistence endpoints
	// - Tool integration and function call handlers
	// - Context management and analysis endpoints
	// - Response generation and formatting services
	
	context.subscriptions.push(disposable, agentPanelWebviewDisposable);
	console.log('TEST: Command and webview provider registered');
}

export function deactivate() {
	console.log('TEST: Extension deactivating...');
}
