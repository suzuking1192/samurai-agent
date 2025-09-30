"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const SamuraiAgentPanelWebviewViewProvider_1 = require("./webview/SamuraiAgentPanelWebviewViewProvider");
const globalDataStore_1 = require("./persistence/globalDataStore");
const dataStore_1 = require("./persistence/dataStore");
const llmProviderService_1 = require("./agent/llm/llmProviderService");
const openaiChatClient_1 = require("./agent/llm/openaiChatClient");
const geminiChatClient_1 = require("./agent/llm/geminiChatClient");
const anthropicChatClient_1 = require("./agent/llm/anthropicChatClient");
const projectDetailService_1 = require("./agent/memory/projectDetailService");
const TreeSitterLoaderService_1 = require("./agent/code_parser/TreeSitterLoaderService");
const extractCodeTool_1 = require("./agent/tools/extractCodeTool");
const createSpecTool_1 = require("./agent/tools/createSpecTool");
const CodeParserService_1 = require("./agent/code_parser/CodeParserService");
const samuraiAgent_1 = require("./agent/core/samuraiAgent");
const llmCostStorage_1 = require("./storage/llmCostStorage");
const llmCostCalculator_1 = require("./common/utils/llmCostCalculator");
const response_models_1 = require("./common/models/response-models");
/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
function activate(context) {
    const globalDataStore = new globalDataStore_1.GlobalDataStore();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const dataStore = workspaceRoot ? new dataStore_1.DataStore(workspaceRoot) : undefined;
    // Initialize LLM Cost Storage
    const llmCostStorage = new llmCostStorage_1.LLMCostStorage(context);
    // Create status bar item for cost display
    const costStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    costStatusBarItem.command = 'samurai-agent.showCostDetails';
    context.subscriptions.push(costStatusBarItem);
    // Update status bar with initial cost
    updateCostStatusBar(costStatusBarItem, llmCostStorage);
    costStatusBarItem.show();
    const llmProviderService = new llmProviderService_1.LLMProviderService(globalDataStore, dataStore);
    llmProviderService.registerClient("openai", new openaiChatClient_1.OpenAIChatClient());
    llmProviderService.registerClient("google", new geminiChatClient_1.GeminiChatClient());
    llmProviderService.registerClient("anthropic", new anthropicChatClient_1.AnthropicChatClient());
    // Initialize TreeSitterLoaderService
    const treeSitterLoaderService = new TreeSitterLoaderService_1.TreeSitterLoaderService(context.globalStorageUri);
    // Initialize CodeParserService and ExtractCodeTool
    const codeParserService = new CodeParserService_1.CodeParserService(context.extensionUri.fsPath);
    const extractCodeTool = new extractCodeTool_1.ExtractCodeTool(llmProviderService, codeParserService);
    // Initialize CreateSpecTool
    const createSpecTool = dataStore ? new createSpecTool_1.CreateSpecTool(dataStore) : undefined;
    const projectDetailService = dataStore
        ? new projectDetailService_1.ProjectDetailService(llmProviderService, dataStore, context.extensionUri.fsPath)
        : undefined;
    // Initialize SamuraiAgent
    const samuraiAgent = dataStore && projectDetailService && createSpecTool
        ? new samuraiAgent_1.SamuraiAgent(llmProviderService, dataStore, projectDetailService, extractCodeTool, createSpecTool)
        : undefined;
    const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(context.extensionUri, {
        llmProviderService,
        projectDetailService,
        dataStore,
        globalDataStore,
        treeSitterLoaderService,
        extractCodeTool,
        samuraiAgent,
    });
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider.viewType, agentPanelProvider));
    context.subscriptions.push(vscode.commands.registerCommand("samurai-agent.llm.chat", async (request) => {
        const response = await llmProviderService.chat(request);
        // Track cost if successful
        if (response.type === response_models_1.ResponseType.SUCCESS && response.payload) {
            const llmResponse = response.payload;
            const costRecord = {
                id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                provider: llmResponse.provider,
                model: llmResponse.model,
                promptTokens: llmResponse.usage.promptTokens,
                completionTokens: llmResponse.usage.completionTokens,
                totalTokens: llmResponse.usage.totalTokens,
                cost: llmResponse.cost,
                requestId: llmResponse.requestId,
            };
            await llmCostStorage.saveRecord(costRecord);
            updateCostStatusBar(costStatusBarItem, llmCostStorage);
        }
        return response;
    }));
    if (projectDetailService) {
        context.subscriptions.push(vscode.commands.registerCommand("samurai-agent.projectDetail.ingest", async (args) => {
            const { projectId, rawText, mode } = args;
            return projectDetailService.ingestProjectDetail(projectId, rawText, mode);
        }));
    }
    if (samuraiAgent) {
        context.subscriptions.push(vscode.commands.registerCommand("samurai-agent.execute", async (args) => {
            const { userMessage, session } = args;
            return samuraiAgent.execute(userMessage, session);
        }));
    }
    // Register command to show cost details
    context.subscriptions.push(vscode.commands.registerCommand('samurai-agent.showCostDetails', () => {
        const stats = llmCostStorage.getStatistics();
        const message = `
LLM Cost Tracker

Session Cost: ${(0, llmCostCalculator_1.formatCost)(stats.currentSessionCost)}
Total Cost: ${(0, llmCostCalculator_1.formatCost)(stats.totalCost)}
Total Requests: ${stats.totalRecords}

Click to see details in the Samurai Agent panel.
        `.trim();
        vscode.window.showInformationMessage(message);
    }));
    // Register command to clear cost history
    context.subscriptions.push(vscode.commands.registerCommand('samurai-agent.clearCostHistory', async () => {
        const answer = await vscode.window.showWarningMessage('Are you sure you want to clear all LLM cost history?', 'Yes', 'No');
        if (answer === 'Yes') {
            await llmCostStorage.clearRecords();
            updateCostStatusBar(costStatusBarItem, llmCostStorage);
            vscode.window.showInformationMessage('LLM cost history cleared.');
        }
    }));
}
/**
 * Update the status bar with current cost information
 */
function updateCostStatusBar(statusBarItem, costStorage) {
    const stats = costStorage.getStatistics();
    const sessionCost = (0, llmCostCalculator_1.formatCost)(stats.currentSessionCost);
    const totalCost = (0, llmCostCalculator_1.formatCost)(stats.totalCost);
    statusBarItem.text = `$(graph) LLM: ${sessionCost} | Total: ${totalCost}`;
    statusBarItem.tooltip = `Session Cost: ${sessionCost}\nTotal Cost: ${totalCost}\nTotal Requests: ${stats.totalRecords}\n\nClick for details`;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map