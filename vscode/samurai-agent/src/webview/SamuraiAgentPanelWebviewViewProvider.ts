import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { DataStore } from "../persistence/dataStore";
import { GlobalDataStore } from "../persistence/globalDataStore";
import { LLM_MODELS } from "../common/constants/llm-models";
import { LLMProviderService } from "../agent/llm/llmProviderService";
import { ProjectDetailService } from "../agent/memory/projectDetailService";
import { TreeSitterLoaderService } from "../agent/code_parser/TreeSitterLoaderService";
import { ExtractCodeTool } from "../agent/tools/extractCodeTool";
import { SamuraiAgent } from "../agent/core/samuraiAgent";
import { ChatMessage, MessageType } from "../common/models/chat-models";

// Resolve each asset to whichever folder actually has that file
const assetUri = (
  webview: vscode.Webview,
  extUri: vscode.Uri,
  filename: string,
): vscode.Uri => {
  const out = vscode.Uri.joinPath(extUri, "out", "webview", filename);
  const src = vscode.Uri.joinPath(extUri, "src", "webview", filename);
  return fs.existsSync(out.fsPath)
    ? webview.asWebviewUri(out)
    : webview.asWebviewUri(src);
};

export interface SamuraiAgentPanelDependencies {
  llmProviderService: LLMProviderService;
  projectDetailService?: ProjectDetailService;
  dataStore?: DataStore;
  globalDataStore: GlobalDataStore;
  treeSitterLoaderService?: TreeSitterLoaderService;
  extractCodeTool?: ExtractCodeTool;
  samuraiAgent?: SamuraiAgent;
}

export class SamuraiAgentPanelWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "samurai-agent.agentPanel";
  private dataStore: DataStore | undefined;
  private globalDataStore: GlobalDataStore;
  private llmProviderService: LLMProviderService;
  private projectDetailService: ProjectDetailService | undefined;
  private treeSitterLoaderService: TreeSitterLoaderService | undefined;
  private extractCodeTool: ExtractCodeTool | undefined;
  private samuraiAgent: SamuraiAgent | undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    dependencies: SamuraiAgentPanelDependencies,
  ) {
    this.llmProviderService = dependencies.llmProviderService;
    this.projectDetailService = dependencies.projectDetailService;
    this.dataStore = dependencies.dataStore;
    this.globalDataStore = dependencies.globalDataStore;
    this.treeSitterLoaderService = dependencies.treeSitterLoaderService;
    this.extractCodeTool = dependencies.extractCodeTool;
    this.samuraiAgent = dependencies.samuraiAgent;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log("Webview Provider: resolveWebviewView called");
    console.log("Webview Provider: webviewView visible:", webviewView.visible);

    // Allow both src and out roots for maximum compatibility
    const srcRoot = vscode.Uri.joinPath(this._extensionUri, "src", "webview");
    const outRoot = vscode.Uri.joinPath(this._extensionUri, "out", "webview");

    console.log("Webview Provider: Allowing both roots:", {
      src: srcRoot.toString(),
      out: outRoot.toString(),
    });

    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [srcRoot, outRoot], // include BOTH
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    console.log("Webview Provider: HTML set for webview");

    // Send initial settings to webview after a short delay to ensure it's loaded
    setTimeout(() => {
      this.sendInitialSettingsToWebview(webviewView.webview);
    }, 100);

    // Send a test message to verify communication
    setTimeout(() => {
      console.log("Webview Provider: Sending test message to webview");
      webviewView.webview.postMessage({
        type: "test",
        message: "Hello from webview provider!",
      });
    }, 200);

    // Set up message listener
    webviewView.webview.onDidReceiveMessage((message) =>
      this.handleWebviewMessage(webviewView.webview, message),
    );

    // Add debugging for script loading
    console.log("Webview Provider: Setting up webview with options:", {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [srcRoot.toString(), outRoot.toString()],
    });
  }

  /**
   * Handles messages from the webview
   */
  private handleWebviewMessage(webview: vscode.Webview, message: any) {
    const { command } = message;

    try {
      // LLM chat handling - route through SamuraiAgent if available
      if (command === "samurai-agent.llm.chat") {
        if (this.samuraiAgent && message.payload) {
          // Extract user message from the LLM request
          const llmRequest = message.payload;
          const userMessage = llmRequest.messages?.find((msg: any) => msg.role === 'user');
          
          if (userMessage && this.dataStore) {
            // Get current session
            const projectSettings = this.dataStore.readProjectSettings();
            const currentSessionId = projectSettings?.payload?.currentSessionId;
            
            if (currentSessionId) {
              // Load session
              const sessionResponse = this.dataStore.handleWebviewMessage({
                command: 'loadSession',
                payload: { sessionId: currentSessionId }
              });
              
              if (sessionResponse.type === 'success' && sessionResponse.payload) {
                // Create ChatMessage object
                const chatMessage: ChatMessage = {
                  id: `msg-${Date.now()}`,
                  sessionId: currentSessionId,
                  projectId: sessionResponse.payload.metadata?.projectId || 'default',
                  type: MessageType.USER,
                  content: userMessage.content,
                  role: 'user',
                  metadata: {},
                  isEdited: false,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                // Execute through SamuraiAgent
                this.samuraiAgent.execute(
                  chatMessage,
                  sessionResponse.payload,
                  (update) => {
                    try {
                      webview.postMessage({
                        type: "agentProgress",
                        payload: update,
                        timestamp: new Date(),
                      });
                    } catch (error) {
                      console.error("Failed to send progress update", error);
                    }
                  }
                )
                  .then((result: any) => {
                    // Create assistant message from result
                    const assistantMessage: ChatMessage = {
                      id: `assistant-${Date.now()}`,
                      sessionId: currentSessionId,
                      projectId: sessionResponse.payload.metadata?.projectId || 'default',
                      type: MessageType.ASSISTANT,
                      content: result.message || 'No response',
                      role: 'assistant',
                      metadata: result.metadata || {},
                      isEdited: false,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      // Extract specClarificationData and interactiveQuestions from result metadata
                      specClarificationData: result.metadata?.specClarificationData,
                      interactiveQuestions: result.metadata?.interactiveQuestions
                    };
                    
                    // Save assistant message
                    if (this.dataStore) {
                      this.dataStore.handleWebviewMessage({
                        command: 'saveChatMessage',
                        payload: assistantMessage
                      });
                    }
                    
                    // Return response in LLM format for compatibility
                    console.log('Sending response to webview:', {
                      requestId: message.requestId,
                      content: result.message || 'No response'
                    });
                    webview.postMessage({
                      type: "success",
                      requestId: message.requestId,
                      payload: {
                        content: result.message || 'No response',
                        metadata: {
                          ...(result.metadata || {}),
                          samuraiAgentResponse: true,
                        },
                      },
                      timestamp: new Date(),
                    });
                  })
                  .catch((error: any) => {
                    webview.postMessage({
                      type: "error",
                      requestId: message.requestId,
                      error: error instanceof Error ? error.message : "SamuraiAgent execution failed",
                      timestamp: new Date(),
                    });
                  });
                return;
              }
            }
          }
        }
        
        // Fallback to direct LLM chat if SamuraiAgent is not available
        const commandPromise = vscode.commands.executeCommand(
          "samurai-agent.llm.chat",
          message.payload,
        );
        if (commandPromise && typeof commandPromise.then === "function") {
          commandPromise.then(
            (result: unknown) => {
              webview.postMessage({
                type: "success",
                requestId: message.requestId,
                payload: result,
                timestamp: new Date(),
              });
            },
            (error: unknown) => {
              webview.postMessage({
                type: "error",
                requestId: message.requestId,
                error:
                  error instanceof Error ? error.message : "LLM chat failed",
                timestamp: new Date(),
              });
            },
          );
        }
        return;
      }

      if (command === "projectDetail.ingest") {
        console.log("Webview Provider: Received projectDetail.ingest command", {
          hasSamuraiAgent: !!this.samuraiAgent,
          payload: message.payload,
          requestId: message.requestId,
        });
        const commandPromise = vscode.commands.executeCommand(
          "samurai-agent.projectDetail.ingest",
          message.payload,
        );
        if (commandPromise && typeof commandPromise.then === "function") {
          commandPromise.then(
            (result: unknown) => {
              console.log(
                "Webview Provider: projectDetail.ingest success",
                message.requestId,
              );
              webview.postMessage({
                type: "success",
                requestId: message.requestId,
                payload: { finalText: result },
                timestamp: new Date(),
              });
            },
            (error: unknown) => {
              console.error(
                "Webview Provider: projectDetail.ingest error",
                error,
              );
              webview.postMessage({
                type: "error",
                requestId: message.requestId,
                error:
                  error instanceof Error
                    ? error.message
                    : "Project detail ingestion failed",
                timestamp: new Date(),
              });
            },
          );
        }
        return;
      }

      // Route global settings commands to GlobalDataStore
      if (
        command === "loadGlobalSettings" ||
        command === "saveGlobalSettings"
      ) {
        if (!this.globalDataStore) {
          console.error("GlobalDataStore not initialized");
          webview.postMessage({
            type: "error",
            requestId: message.requestId,
            error: "GlobalDataStore not initialized",
            timestamp: new Date(),
          });
          return;
        }

        let response;
        if (command === "loadGlobalSettings") {
          response = this.globalDataStore.loadGlobalSettings(message.requestId);
        } else {
          response = this.globalDataStore.saveGlobalSettings(
            message.payload,
            message.requestId,
          );

          console.log("Webview Provider: Save response:", response.type);

          // If save was successful, notify all tabs that global settings have been updated
          if (response.type === "success") {
            console.log(
              "Webview Provider: Sending globalSettingsUpdated notification",
            );
            webview.postMessage({
              type: "globalSettingsUpdated",
              payload: message.payload,
              timestamp: new Date(),
            });
          }
        }
        webview.postMessage(response);
        return;
      }

      // Route namespaced persistence commands to DataStore
      if (command?.startsWith("samurai-agent.persistence.")) {
        if (!this.dataStore) {
          console.error("DataStore not initialized");
          webview.postMessage({
            type: "error",
            requestId: message.requestId,
            error: "DataStore not initialized",
            timestamp: new Date(),
          });
          return;
        }

        const mappedMessage = {
          ...message,
          command: command.replace("samurai-agent.persistence.", ""),
        };
        const response = this.dataStore.handleWebviewMessage(mappedMessage);
        webview.postMessage(response);
        return;
      }

      // Route all other commands to DataStore (project-specific)
      if (!this.dataStore) {
        console.error("DataStore not initialized");
        webview.postMessage({
          type: "error",
          requestId: message.requestId,
          error: "DataStore not initialized",
          timestamp: new Date(),
        });
        return;
      }

      const response = this.dataStore.handleWebviewMessage(message);
      webview.postMessage(response);
    } catch (error) {
      console.error("Error handling webview message:", error);
      webview.postMessage({
        type: "error",
        requestId: message.requestId,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      });
    }
  }

  private async handleLLMChat(webview: vscode.Webview, message: any) {
    const { requestId, payload } = message;
    try {
      const response = await this.llmProviderService.chat(payload);
      webview.postMessage({
        type: "success",
        requestId,
        payload: response,
        timestamp: new Date(),
      });
    } catch (error) {
      webview.postMessage({
        type: "error",
        requestId,
        error: error instanceof Error ? error.message : "LLM chat failed",
        timestamp: new Date(),
      });
    }
  }

  private async handleProjectDetailIngest(
    webview: vscode.Webview,
    message: any,
  ) {
    const { requestId, payload } = message;
    try {
      const finalText = await this.projectDetailService?.ingestProjectDetail(
        payload.projectId,
        payload.rawText,
        payload.mode,
      );

      webview.postMessage({
        type: "success",
        requestId,
        payload: { finalText },
        timestamp: new Date(),
      });
    } catch (error) {
      webview.postMessage({
        type: "error",
        requestId,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Generate a nonce for CSP
    const nonce =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    // Resolve each asset to whichever folder actually has that file
    const agentPanelCssPath = assetUri(
      webview,
      this._extensionUri,
      "agentPanel.css",
    );
    const agentPanelJsPath = assetUri(
      webview,
      this._extensionUri,
      "agentPanel.js",
    );
    const chatCssPath = assetUri(webview, this._extensionUri, "chat.css");
    const chatJsPath = assetUri(webview, this._extensionUri, "chat.js");
    const specCssPath = assetUri(webview, this._extensionUri, "spec.css");
    const specJsPath = assetUri(webview, this._extensionUri, "spec.js");
    const settingsCssPath = assetUri(
      webview,
      this._extensionUri,
      "settings.css",
    );
    const settingsJsPath = assetUri(webview, this._extensionUri, "settings.js");
    const webviewApiJsPath = assetUri(
      webview,
      this._extensionUri,
      "webviewApi.js",
    );
    const testJsPath = assetUri(webview, this._extensionUri, "test.js");

    console.log("Webview Provider: Asset paths:", {
      // CSS paths
      agentPanelCssPath: agentPanelCssPath.toString(),
      chatCssPath: chatCssPath.toString(),
      specCssPath: specCssPath.toString(),
      settingsCssPath: settingsCssPath.toString(),
      // JS paths
      webviewApiJsPath: webviewApiJsPath.toString(),
      agentPanelJsPath: agentPanelJsPath.toString(),
      chatJsPath: chatJsPath.toString(),
      specJsPath: specJsPath.toString(),
      settingsJsPath: settingsJsPath.toString(),
      testJsPath: testJsPath.toString(),
    });

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                img-src ${webview.cspSource} https: data:;
                style-src ${webview.cspSource} 'unsafe-inline';
                font-src ${webview.cspSource};
                connect-src ${webview.cspSource} https:;
                script-src 'nonce-${nonce}' ${webview.cspSource};
            ">
            <title>Samurai Agent Panel</title>
            <link href="${agentPanelCssPath}" rel="stylesheet">
            <link href="${chatCssPath}" rel="stylesheet">
            <link href="${specCssPath}" rel="stylesheet">
            <link href="${settingsCssPath}" rel="stylesheet">
        </head>
        <body>
            <div class="agent-panel-container">
                <!-- Tab Header -->
                <div class="tab-header">
                    <div class="tab" id="chat-tab" data-tab="chat">
                        <span>Chat</span>
                    </div>
                    <div class="tab" id="spec-tab" data-tab="spec">
                        <span>Spec</span>
                    </div>
                    <div class="tab" id="setting-tab" data-tab="setting">
                        <span>Setting</span>
                    </div>
                </div>
                
                <!-- Content Areas -->
                <div class="content-area">
                    <!-- Chat Content -->
                    <div class="tab-content" id="chat-content">
                        <!-- Chat Header with API Cost and Start New Conversation Button -->
                        <div class="chat-header">
                            <div class="api-cost-display" id="api-cost-display">
                                API Cost: $0.00 this month
                            </div>
                            <button class="start-new-conversation-btn" id="start-new-conversation-btn">
                                Start New Conversation
                            </button>
                        </div>
                        
                        <div class="chat-container">
                            <div class="chat-messages" id="chatMessages">
                                <!-- Messages will appear here -->
                            </div>
                            <div class="chat-input-container">
                                <input type="text" id="chatInput" placeholder="Type your message here..." />
                                
                                <!-- LLM Model and Mode Dropdowns -->
                                <div class="chat-controls">
                                    <div class="dropdown-container">
                                        <label for="llm-model-select">LLM Model:</label>
                                        <select id="llm-model-select" class="dropdown">
                                            <!-- Options will be populated dynamically based on configured API keys -->
                                        </select>
                                    </div>
                                    <div class="dropdown-container">
                                        <label for="mode-select">Mode:</label>
                                        <select id="mode-select" class="dropdown">
                                            <option value="default">Default Mode</option>
                                            <option value="developer">Developer Mode</option>
                                            <option value="creative">Creative Mode</option>
                                            <option value="analytical">Analytical Mode</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Spec Content -->
                    <div class="tab-content" id="spec-content" style="display: none;">
                        <!-- Spec content will be dynamically rendered by spec.js -->
                    </div>
                    
                    <!-- Setting Content -->
                    <div class="tab-content" id="setting-content" style="display: none;">
                        <!-- Settings content will be dynamically rendered by settings.js -->
                    </div>
                </div>
            </div>
            <script nonce="${nonce}">
                console.log('Webview: JavaScript is working!');
                console.log('Webview: About to load external scripts...');
                
                // Test if we can access the DOM
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('Webview: DOM is ready!');
                    console.log('Webview: All scripts should be loaded now');
                });
                
                // Listen for messages from the webview provider
                window.addEventListener('message', function(event) {
                    console.log('Webview: Received message:', event.data);
                    if (event.data.type === 'test') {
                        console.log('Webview: Test message received:', event.data.message);
                    }
                });
                
                // Comprehensive debugging for common issues
                console.log('Webview: Environment check:');
                console.log('- User agent:', navigator.userAgent);
                console.log('- Document ready state:', document.readyState);
                console.log('- Window location:', window.location.href);
                
                // Check for CSP violations
                window.addEventListener('error', function(event) {
                    if (event.message && event.message.includes('CSP')) {
                        console.error('Webview: CSP Error detected:', event.message);
                    }
                });
                
            </script>
            <script nonce="${nonce}" src="${testJsPath}"></script>
            <script nonce="${nonce}" src="${webviewApiJsPath}"></script>
            <script nonce="${nonce}" src="${agentPanelJsPath}"></script>
            <script nonce="${nonce}" src="${chatJsPath}"></script>
            <script nonce="${nonce}" src="${specJsPath}"></script>
            <script nonce="${nonce}" src="${settingsJsPath}"></script>
            
            <!-- Script loading debugging - runs after external scripts are parsed -->
            <script nonce="${nonce}">
                // Debug script loading after all scripts are parsed
                setTimeout(() => {
                    console.log('Webview: Checking script status...');
                    document.querySelectorAll('script[src]').forEach((script, index) => {
                        console.log('Webview: Script present:', script.getAttribute('src'));
                        // Note: load/error listeners may miss already-fired events
                        script.addEventListener('load', function() {
                            console.log('Webview: Script loaded successfully:', script.src);
                        });
                        script.addEventListener('error', function() {
                            console.error('Webview: Failed to load script:', script.src);
                        });
                    });
                    
                    // Check if key functions are available (indicates successful loading)
                    setTimeout(() => {
                        console.log('Webview: Checking for loaded functions...');
                        if (typeof window.WebviewApi !== 'undefined') {
                            console.log('Webview: ✅ WebviewApi is available');
                            console.log('Webview: WebviewApi methods:', Object.keys(window.WebviewApi));
                        } else {
                            console.log('Webview: ❌ WebviewApi is not available');
                            console.log('Webview: Available globals:', Object.keys(window).filter(k => k.startsWith('Webview') || k.startsWith('post')));
                        }
                        
                        // Check if other expected globals exist
                        if (typeof window.postCommand !== 'undefined') {
                            console.log('Webview: ✅ postCommand is available');
                        } else {
                            console.log('Webview: ❌ postCommand is not available');
                        }
                    }, 100);
                }, 0);
            </script>
        </body>
        </html>`;
  }

  /**
   * Sends initial settings to the webview, including determining the initial primaryLLMModel
   */
  private async sendInitialSettingsToWebview(webview: vscode.Webview) {
    try {
      // Load global settings to check API keys
      const globalSettingsResponse = this.globalDataStore?.loadGlobalSettings();
      const globalSettings = globalSettingsResponse?.payload;

      // Load project settings
      const projectSettingsResponse = this.dataStore?.readProjectSettings();
      const projectSettings = projectSettingsResponse?.payload;

      if (globalSettings && projectSettings) {
        // Determine initial primaryLLMModel if it's null
        let initialPrimaryLLMModel = projectSettings.primaryLLMModel;

        if (
          initialPrimaryLLMModel &&
          !this.isModelAvailable(initialPrimaryLLMModel, globalSettings)
        ) {
          initialPrimaryLLMModel = null;
        }

        if (!initialPrimaryLLMModel) {
          // Find the first available model based on API keys
          const availableModels = this.getAvailableModels(globalSettings);
          if (availableModels.length > 0) {
            initialPrimaryLLMModel = availableModels[0].id;

            // Update project settings with the initial model
            const updatedProjectSettings = {
              ...projectSettings,
              primaryLLMModel: initialPrimaryLLMModel,
            };

            // Save the updated project settings
            this.dataStore?.saveProjectSettings(updatedProjectSettings);
          }
        }

        // Get available models
        const availableModels = this.getAvailableModels(globalSettings);

        // Send settings to webview
        webview.postMessage({
          type: "initialSettings",
          payload: {
            globalSettings,
            projectSettings: {
              ...projectSettings,
              primaryLLMModel: initialPrimaryLLMModel,
            },
            availableModels,
            llmModels: LLM_MODELS,
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error("Error sending initial settings to webview:", error);
    }
  }

  /**
   * Gets available models based on configured API keys
   */
  private getAvailableModels(globalSettings: any) {
    const availableModels = [];

    // Check OpenAI models
    if (globalSettings.openaiApiKey && globalSettings.openaiApiKey.trim()) {
      availableModels.push(...LLM_MODELS.openai);
    }

    // Check Google models
    if (globalSettings.geminiApiKey && globalSettings.geminiApiKey.trim()) {
      availableModels.push(...LLM_MODELS.google);
    }

    // Check Anthropic models
    if (globalSettings.claudeApiKey && globalSettings.claudeApiKey.trim()) {
      availableModels.push(...LLM_MODELS.anthropic);
    }

    // Sort alphabetically by provider, then by model name
    return availableModels.sort((a, b) => {
      const providerA = a.provider;
      const providerB = b.provider;
      if (providerA !== providerB) {
        return providerA.localeCompare(providerB);
      }
      return a.name.localeCompare(b.name);
    });
  }

  private isModelAvailable(modelId: string, globalSettings: any): boolean {
    const availableModels = this.getAvailableModels(globalSettings);
    return availableModels.some((model) => model.id === modelId);
  }
}
