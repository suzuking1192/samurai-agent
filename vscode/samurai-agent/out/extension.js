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
const CodeParserService_1 = require("./agent/code_parser/CodeParserService");
/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
function activate(context) {
    const globalDataStore = new globalDataStore_1.GlobalDataStore();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const dataStore = workspaceRoot ? new dataStore_1.DataStore(workspaceRoot) : undefined;
    const llmProviderService = new llmProviderService_1.LLMProviderService(globalDataStore, dataStore);
    llmProviderService.registerClient("openai", new openaiChatClient_1.OpenAIChatClient());
    llmProviderService.registerClient("google", new geminiChatClient_1.GeminiChatClient());
    llmProviderService.registerClient("anthropic", new anthropicChatClient_1.AnthropicChatClient());
    // Initialize TreeSitterLoaderService
    const treeSitterLoaderService = new TreeSitterLoaderService_1.TreeSitterLoaderService(context.globalStorageUri);
    // Initialize CodeParserService and ExtractCodeTool
    const codeParserService = new CodeParserService_1.CodeParserService();
    const extractCodeTool = new extractCodeTool_1.ExtractCodeTool(llmProviderService, codeParserService);
    const projectDetailService = dataStore
        ? new projectDetailService_1.ProjectDetailService(llmProviderService, dataStore, context.extensionUri.fsPath)
        : undefined;
    const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider(context.extensionUri, {
        llmProviderService,
        projectDetailService,
        dataStore,
        globalDataStore,
        treeSitterLoaderService,
        extractCodeTool,
    });
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SamuraiAgentPanelWebviewViewProvider_1.SamuraiAgentPanelWebviewViewProvider.viewType, agentPanelProvider));
    context.subscriptions.push(vscode.commands.registerCommand("samurai-agent.llm.chat", async (request) => {
        return llmProviderService.chat(request);
    }));
    if (projectDetailService) {
        context.subscriptions.push(vscode.commands.registerCommand("samurai-agent.projectDetail.ingest", async (args) => {
            const { projectId, rawText, mode } = args;
            return projectDetailService.ingestProjectDetail(projectId, rawText, mode);
        }));
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map