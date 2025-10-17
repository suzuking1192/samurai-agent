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

// Load environment variables from .env file for development
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the extension root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

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
import { TelemetryService } from "./services/TelemetryService";
import { RecentFilesTracker } from "./services/RecentFilesTracker";
import { VALID_BETA_CODE } from "./common/constants/llm-constants";

/**
 * Helper function to validate beta code
 */
function isBetaCodeValid(code: string | undefined): boolean {
    return code?.trim() === VALID_BETA_CODE;
}

/**
 * Extension activation function - main backend entry point
 * Registers all commands, webview providers, and initializes the agent system
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('[Samurai Agent] 🚀 Extension activation starting...');
  
  try {
    const globalDataStore = new GlobalDataStore();
    console.log('[Samurai Agent] ✓ GlobalDataStore initialized');
    
    const telemetryService = new TelemetryService(context, globalDataStore);
    console.log('[Samurai Agent] ✓ TelemetryService initialized');
    
    // Set telemetry service on GlobalDataStore to enable LLM key change tracking
    // This must be done after TelemetryService is initialized to avoid circular dependency
    globalDataStore.setTelemetryService(telemetryService);
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log('[Samurai Agent] Workspace root:', workspaceRoot || 'No workspace folder open');
    
    const dataStore = workspaceRoot ? new DataStore(workspaceRoot, telemetryService) : undefined;
    console.log('[Samurai Agent] ✓ DataStore initialized:', dataStore ? 'available' : 'not available (no workspace)');

    // Initialize LLM Cost Storage
    const llmCostStorage = new LLMCostStorage(context);
    console.log('[Samurai Agent] ✓ LLMCostStorage initialized');
    
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

    // Track extension activation
    telemetryService.trackExtensionActivation();
    console.log('[Samurai Agent] ✓ Extension activation tracked');

    // Initialize RecentFilesTracker (hybrid approach: open tabs + event tracking, workspace-aware)
    const recentFilesTracker = RecentFilesTracker.getInstance();
    recentFilesTracker.initialize();
    context.subscriptions.push({
      dispose: () => recentFilesTracker.dispose()
    });
    console.log('[Samurai Agent] ✓ RecentFilesTracker initialized');

    const llmProviderService = new LLMProviderService(globalDataStore, dataStore, undefined, llmCostStorage);
    console.log('[Samurai Agent] ✓ LLMProviderService initialized');

    llmProviderService.registerClient("openai", new OpenAIChatClient());
    llmProviderService.registerClient("google", new GeminiChatClient());
    llmProviderService.registerClient("anthropic", new AnthropicChatClient());
    console.log('[Samurai Agent] ✓ LLM clients registered');
    
    // Initialize TreeSitterLoaderService
    const treeSitterLoaderService = new TreeSitterLoaderService(context.globalStorageUri);
    console.log('[Samurai Agent] ✓ TreeSitterLoaderService initialized');
    
    // Initialize CodeParserService and ExtractCodeTool
    const codeParserService = new CodeParserService(context.extensionUri.fsPath);
    const extractCodeTool = new ExtractCodeTool(llmProviderService, codeParserService, telemetryService);
    console.log('[Samurai Agent] ✓ CodeParserService and ExtractCodeTool initialized');
    
    // Initialize CreateSpecTool
    const createSpecTool = dataStore ? new CreateSpecTool(dataStore) : undefined;
    console.log('[Samurai Agent] ✓ CreateSpecTool initialized:', createSpecTool ? 'available' : 'not available');
    
    const projectDetailService = dataStore
      ? new ProjectDetailService(
          llmProviderService,
          dataStore,
          context.extensionUri.fsPath,
        )
      : undefined;
    console.log('[Samurai Agent] ✓ ProjectDetailService initialized:', projectDetailService ? 'available' : 'not available');

    // Initialize SamuraiAgent
    const samuraiAgent = dataStore && projectDetailService && createSpecTool
      ? new SamuraiAgent(
          llmProviderService,
          dataStore,
          projectDetailService,
          extractCodeTool,
          createSpecTool,
          telemetryService
        )
      : undefined;
    console.log('[Samurai Agent] ✓ SamuraiAgent initialized:', samuraiAgent ? 'available' : 'not available');

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
        llmCostStorage,
      },
    );
    console.log('[Samurai Agent] ✓ SamuraiAgentPanelWebviewViewProvider created');

    // Register the webview view provider with explicit options
    const disposable = vscode.window.registerWebviewViewProvider(
      SamuraiAgentPanelWebviewViewProvider.viewType,
      agentPanelProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
    
    context.subscriptions.push(disposable);
    
    console.log('[Samurai Agent] ✅ Webview provider registered successfully!');
    console.log('[Samurai Agent]    - ViewType:', SamuraiAgentPanelWebviewViewProvider.viewType);
    console.log('[Samurai Agent]    - Provider instance:', agentPanelProvider.constructor.name);
    console.log('[Samurai Agent]    - Disposable created:', !!disposable);
    console.log('[Samurai Agent]    - Registration options: retainContextWhenHidden=true');
    console.log('[Samurai Agent] 💡 To open the webview, click the Samurai Agent icon in the Activity Bar (left sidebar)');

    // Register a command to open the panel programmatically (as a workaround)
    context.subscriptions.push(
      vscode.commands.registerCommand('samurai-agent.openPanel', async () => {
        console.log('[Samurai Agent] 📱 Command: samurai-agent.openPanel invoked');
        console.log('[Samurai Agent] Attempting to focus view:', SamuraiAgentPanelWebviewViewProvider.viewType);
        try {
          await vscode.commands.executeCommand(`${SamuraiAgentPanelWebviewViewProvider.viewType}.focus`);
          console.log('[Samurai Agent] ✓ View focus command executed');
        } catch (error) {
          console.error('[Samurai Agent] ❌ Failed to focus view:', error);
          vscode.window.showErrorMessage(`Failed to open Samurai Agent panel: ${error}`);
        }
      })
    );
    console.log('[Samurai Agent] ✓ Command "samurai-agent.openPanel" registered');

    // Try to verify the view exists after a short delay
    setTimeout(async () => {
      console.log('[Samurai Agent] 🔍 Verifying view registration...');
      try {
        // Try to execute the view's focus command
        const commands = await vscode.commands.getCommands(true);
        const viewCommands = commands.filter(cmd => cmd.includes('samurai-agent'));
        console.log('[Samurai Agent] Available Samurai Agent commands:', viewCommands);
        
        // Check if our view's focus command exists
        const focusCommand = `${SamuraiAgentPanelWebviewViewProvider.viewType}.focus`;
        if (commands.includes(focusCommand)) {
          console.log('[Samurai Agent] ✓ View focus command exists:', focusCommand);
        } else {
          console.error('[Samurai Agent] ❌ View focus command NOT found:', focusCommand);
          console.error('[Samurai Agent] This suggests the view was not properly registered with VS Code');
        }
      } catch (error) {
        console.error('[Samurai Agent] Error verifying view registration:', error);
      }
    }, 1000);

    // Note: samurai-agent.llm.chat command removed - all chat now uses samurai-agent.execute for consistency

    if (projectDetailService) {
      context.subscriptions.push(
      vscode.commands.registerCommand(
        "samurai-agent.projectDetail.ingest",
        async (args) => {
          const { projectId, rawText, mode } = args;
          const result = await projectDetailService.ingestProjectDetail(
            projectId,
            rawText,
            mode,
          );
          
          // Track cost if LLM was used
          if (result.llmResponse && result.llmResponse.cost !== undefined && result.llmResponse.cost > 0) {
            const currentGlobalSettings = globalDataStore.loadGlobalSettings().payload;
            const costRecord: LLMCostRecord = {
              id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              provider: result.llmResponse.provider,
              model: result.llmResponse.model,
              promptTokens: result.llmResponse.usage.promptTokens,
              completionTokens: result.llmResponse.usage.completionTokens,
              totalTokens: result.llmResponse.usage.totalTokens,
              cost: result.llmResponse.cost,
              requestId: result.llmResponse.requestId,
              isBetaUserActive: isBetaCodeValid(currentGlobalSettings?.betaCode),
            };
            
            console.log('[COST DEBUG] projectDetail.ingest - Saving cost record:', costRecord);
            await llmCostStorage.saveRecord(costRecord);
            updateCostStatusBar(costStatusBarItem, llmCostStorage);
            console.log('[COST DEBUG] projectDetail.ingest - Cost record saved and status bar updated');
          }
          
          // Return the final text for backward compatibility
          return result.finalText;
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
          const result = await samuraiAgent.execute(userMessage, session);
          
          // Track cost if available
          if (result.success && result.metadata?.cost !== undefined && result.metadata.cost > 0) {
            // The cost in metadata is the total for this execution (may include multiple LLM calls)
            // We need to extract individual LLM call information if available
            // For now, we'll create a single record for the entire execution
            const currentGlobalSettings = globalDataStore.loadGlobalSettings().payload;
            const costRecord: LLMCostRecord = {
              id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              provider: 'agent-execution', // Placeholder, actual provider may vary
              model: session.metadata?.model || 'unknown',
              promptTokens: 0, // Agent doesn't expose individual token counts
              completionTokens: 0,
              totalTokens: 0,
              cost: result.metadata.cost,
              requestId: `agent-${Date.now()}`,
              isBetaUserActive: isBetaCodeValid(currentGlobalSettings?.betaCode),
            };
            
            console.log('[COST DEBUG] samurai-agent.execute - Saving cost record:', costRecord);
            await llmCostStorage.saveRecord(costRecord);
            updateCostStatusBar(costStatusBarItem, llmCostStorage);
            console.log('[COST DEBUG] samurai-agent.execute - Cost record saved and status bar updated');
          }
          
          return result;
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

    // Register command to get monthly cost from local storage
    context.subscriptions.push(
    vscode.commands.registerCommand(
      'samurai-agent.getBackendMonthlyCost',
      () => {
        try {
          // Get monthly cost from local LLM cost storage
          const stats = llmCostStorage.getStatistics();
          return {
            total_cost: stats.currentMonthCost,
            call_count: stats.totalRecords, // This represents total calls, not just monthly
            month: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
          };
        } catch (error) {
          console.error('Error getting monthly cost from storage:', error);
          return null;
        }
      }
    )
    );

    // Register command to get monthly cost for beta users
    context.subscriptions.push(
    vscode.commands.registerCommand(
      'samurai-agent.getMonthlyCostForBetaUsers',
      () => {
        return llmCostStorage.getMonthlyCostForBetaUsers();
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

    // Note: samurai-agent.ui.sendAssistantMessageToChat is now handled as a webview message
    // in SamuraiAgentPanelWebviewViewProvider.handleSendAssistantMessageToChat()

    // Listen for telemetry setting changes
    context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('samurai-agent.enableTelemetry')) {
        const config = vscode.workspace.getConfiguration('samurai-agent');
        const isEnabled = config.get<boolean>('enableTelemetry', true);
        telemetryService.trackTelemetrySettingChange(isEnabled);
      }
    })
    );

    // Clean up telemetry service on deactivation
    context.subscriptions.push({
      dispose: () => telemetryService.dispose()
    });
    
    console.log('[Samurai Agent] 🎉 Extension activation completed successfully!');
    
  } catch (error) {
    console.error('[Samurai Agent] ❌ FATAL: Extension activation failed:', error);
    vscode.window.showErrorMessage(
      `Samurai Agent failed to activate: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
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
