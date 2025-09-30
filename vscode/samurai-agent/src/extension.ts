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
import { CreateSpecTool } from "./agent/tools/createSpecTool";
import { CodeParserService } from "./agent/code_parser/CodeParserService";
import { SamuraiAgent } from "./agent/core/samuraiAgent";
import { LLMCostStorage, LLMCostRecord } from "./storage/llmCostStorage";
import { formatCost } from "./common/utils/llmCostCalculator";
import { LLMResponse } from "./common/models/llm-models";
import { ResponseType } from "./common/models/response-models";

/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
export function activate(context: vscode.ExtensionContext) {
  const globalDataStore = new GlobalDataStore();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const dataStore = workspaceRoot ? new DataStore(workspaceRoot) : undefined;

  // Initialize LLM Cost Storage
  const llmCostStorage = new LLMCostStorage(context);
  
  // Create status bar item for cost display
  const costStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  costStatusBarItem.command = 'samurai-agent.showCostDetails';
  context.subscriptions.push(costStatusBarItem);
  
  // Update status bar with initial cost
  updateCostStatusBar(costStatusBarItem, llmCostStorage);
  costStatusBarItem.show();

  const llmProviderService = new LLMProviderService(globalDataStore, dataStore);

  llmProviderService.registerClient("openai", new OpenAIChatClient());
  llmProviderService.registerClient("google", new GeminiChatClient());
  llmProviderService.registerClient("anthropic", new AnthropicChatClient());
  
  // Initialize TreeSitterLoaderService
  const treeSitterLoaderService = new TreeSitterLoaderService(context.globalStorageUri);
  
  // Initialize CodeParserService and ExtractCodeTool
  const codeParserService = new CodeParserService(context.extensionUri.fsPath);
  const extractCodeTool = new ExtractCodeTool(llmProviderService, codeParserService);
  
  // Initialize CreateSpecTool
  const createSpecTool = dataStore ? new CreateSpecTool(dataStore) : undefined;
  
  const projectDetailService = dataStore
    ? new ProjectDetailService(
        llmProviderService,
        dataStore,
        context.extensionUri.fsPath,
      )
    : undefined;

  // Initialize SamuraiAgent
  const samuraiAgent = dataStore && projectDetailService && createSpecTool
    ? new SamuraiAgent(
        llmProviderService,
        dataStore,
        projectDetailService,
        extractCodeTool,
        createSpecTool
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
      samuraiAgent,
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
        console.log('[COST DEBUG] LLM chat command called with request:', {
          provider: request.provider,
          model: request.model,
          hasMessages: !!request.messages?.length
        });
        
        const response = await llmProviderService.chat(request);
        
        console.log('[COST DEBUG] LLM response received:', {
          responseType: response.type,
          hasPayload: !!response.payload,
          payloadType: response.payload ? typeof response.payload : 'none'
        });
        
        // Track cost if successful
        if (response.type === ResponseType.SUCCESS && response.payload) {
          const llmResponse = response.payload as LLMResponse;
          
          console.log('[COST DEBUG] LLM Response details:', {
            provider: llmResponse.provider,
            model: llmResponse.model,
            usage: llmResponse.usage,
            cost: llmResponse.cost,
            hasCost: llmResponse.cost !== undefined,
            costType: typeof llmResponse.cost
          });
          
          const costRecord: LLMCostRecord = {
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
          
          console.log('[COST DEBUG] Saving cost record:', costRecord);
          await llmCostStorage.saveRecord(costRecord);
          updateCostStatusBar(costStatusBarItem, llmCostStorage);
          console.log('[COST DEBUG] Cost record saved and status bar updated');
        } else {
          console.log('[COST DEBUG] Not tracking cost - response type:', response.type);
        }
        
        return response;
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

  if (samuraiAgent) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "samurai-agent.execute",
        async (args) => {
          const { userMessage, session } = args;
          return samuraiAgent.execute(userMessage, session);
        },
      ),
    );
  }

  // Register command to show cost details
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'samurai-agent.showCostDetails',
      () => {
        const stats = llmCostStorage.getStatistics();
        const message = `
LLM Cost Tracker

This Month: ${formatCost(stats.currentMonthCost)}
Session (24h): ${formatCost(stats.currentSessionCost)}
Total (All Time): ${formatCost(stats.totalCost)}
Total Requests: ${stats.totalRecords}

Click to see details in the Samurai Agent panel.
        `.trim();
        
        vscode.window.showInformationMessage(message);
      }
    )
  );

  // Register command to get cost statistics
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'samurai-agent.getCostStatistics',
      () => {
        return llmCostStorage.getStatistics();
      }
    )
  );

  // Register command to clear cost history
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'samurai-agent.clearCostHistory',
      async () => {
        const answer = await vscode.window.showWarningMessage(
          'Are you sure you want to clear all LLM cost history?',
          'Yes',
          'No'
        );
        
        if (answer === 'Yes') {
          await llmCostStorage.clearRecords();
          updateCostStatusBar(costStatusBarItem, llmCostStorage);
          vscode.window.showInformationMessage('LLM cost history cleared.');
        }
      }
    )
  );
}

/**
 * Update the status bar with current cost information
 */
function updateCostStatusBar(
  statusBarItem: vscode.StatusBarItem,
  costStorage: LLMCostStorage
): void {
  const stats = costStorage.getStatistics();
  const sessionCost = formatCost(stats.currentSessionCost);
  const totalCost = formatCost(stats.totalCost);
  
  statusBarItem.text = `$(graph) LLM: ${sessionCost} | Total: ${totalCost}`;
  statusBarItem.tooltip = `Session Cost: ${sessionCost}\nTotal Cost: ${totalCost}\nTotal Requests: ${stats.totalRecords}\n\nClick for details`;
}

export function deactivate() {}
