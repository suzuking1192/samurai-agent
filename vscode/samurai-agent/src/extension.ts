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

import * as vscode from "vscode";
import { SamuraiAgentPanelWebviewViewProvider } from "./webview/SamuraiAgentPanelWebviewViewProvider";
import { GlobalDataStore } from "./persistence/globalDataStore";
import { DataStore } from "./persistence/dataStore";
import { LLMProviderService } from "./agent/llm/llmProviderService";
import { OpenAIChatClient } from "./agent/llm/openaiChatClient";
import { GeminiChatClient } from "./agent/llm/geminiChatClient";
import { AnthropicChatClient } from "./agent/llm/anthropicChatClient";
import { ProjectDetailService } from "./agent/memory/projectDetailService";
import { TreeSitterLoaderService } from "./agent/code_parser/TreeSitterLoaderService";
import { ExtractCodeTool } from "./agent/tools/extractCodeTool";
import { CodeParserService } from "./agent/code_parser/CodeParserService";

/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
export function activate(context: vscode.ExtensionContext) {
  const globalDataStore = new GlobalDataStore();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const dataStore = workspaceRoot ? new DataStore(workspaceRoot) : undefined;

  const llmProviderService = new LLMProviderService(globalDataStore, dataStore);

  llmProviderService.registerClient("openai", new OpenAIChatClient());
  llmProviderService.registerClient("google", new GeminiChatClient());
  llmProviderService.registerClient("anthropic", new AnthropicChatClient());
  
  // Initialize TreeSitterLoaderService
  const treeSitterLoaderService = new TreeSitterLoaderService(context.globalStorageUri);
  
  // Initialize CodeParserService and ExtractCodeTool
  const codeParserService = new CodeParserService();
  const extractCodeTool = new ExtractCodeTool(llmProviderService, codeParserService);
  
  const projectDetailService = dataStore
    ? new ProjectDetailService(
        llmProviderService,
        dataStore,
        context.extensionUri.fsPath,
      )
    : undefined;

  const agentPanelProvider = new SamuraiAgentPanelWebviewViewProvider(
    context.extensionUri,
    {
      llmProviderService,
      projectDetailService,
      dataStore,
      globalDataStore,
      treeSitterLoaderService,
      extractCodeTool,
    },
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SamuraiAgentPanelWebviewViewProvider.viewType,
      agentPanelProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "samurai-agent.llm.chat",
      async (request) => {
        return llmProviderService.chat(request);
      },
    ),
  );

  if (projectDetailService) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "samurai-agent.projectDetail.ingest",
        async (args) => {
          const { projectId, rawText, mode } = args;
          return projectDetailService.ingestProjectDetail(
            projectId,
            rawText,
            mode,
          );
        },
      ),
    );
  }
}

export function deactivate() {}
