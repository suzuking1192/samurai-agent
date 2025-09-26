/**
 * Integration tests for webview routing in SamuraiAgentPanelWebviewViewProvider
 * Validates that commands are correctly routed to GlobalDataStore vs DataStore
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { SamuraiAgentPanelWebviewViewProvider } from "../src/webview/SamuraiAgentPanelWebviewViewProvider";
import { GlobalDataStore } from "../src/persistence/globalDataStore";
import { DataStore } from "../src/persistence/dataStore";
import { LLMProviderService } from "../src/agent/llm/llmProviderService";
import { ProjectDetailService } from "../src/agent/memory/projectDetailService";

describe("Webview Routing Integration", () => {
  let provider: SamuraiAgentPanelWebviewViewProvider;
  let testWorkspaceRoot: string;
  let mockWebview: any;

  beforeEach(() => {
    // Create a temporary test workspace
    testWorkspaceRoot = path.join(
      os.tmpdir(),
      "samurai-agent-test-routing",
      Date.now().toString(),
    );
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    // Mock VS Code workspace
    const mockWorkspaceFolder = {
      uri: { fsPath: testWorkspaceRoot },
      name: "test-workspace",
      index: 0,
    };

    // Mock VS Code API
    const mockVscode = {
      workspace: {
        workspaceFolders: [mockWorkspaceFolder],
      },
      Uri: {
        joinPath: (...parts: string[]) => parts.join("/"),
      },
    };

    // Replace the global vscode module temporarily
    (global as any).vscode = mockVscode;

    // Create provider with mock extension URI
    const mockExtensionUri = { fsPath: "/mock/extension/path" };
    const globalDataStore = new GlobalDataStore();
    const dataStore = new DataStore(testWorkspaceRoot);
    const llmProviderService = new LLMProviderService(globalDataStore);
    const projectDetailService = new ProjectDetailService(
      llmProviderService,
      dataStore,
    );
    provider = new SamuraiAgentPanelWebviewViewProvider(
      mockExtensionUri as any,
      {
        llmProviderService,
        projectDetailService,
        dataStore,
        globalDataStore,
      },
    );

    // Mock webview
    mockWebview = {
      postMessage: (message: any) => {
        // Store messages for verification
        if (!mockWebview.messages) {
          mockWebview.messages = [];
        }
        mockWebview.messages.push(message);
      },
      messages: [],
    };
  });

  afterEach(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }

    // Restore original vscode module
    delete (global as any).vscode;
  });

  describe("Global Settings Routing", () => {
    it("should route loadGlobalSettings to GlobalDataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      // Simulate the message handler
      const message = {
        command: "loadGlobalSettings",
        requestId: "test-global-load",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      expect(mockWebview.messages).toHaveLength(1);
      const response = mockWebview.messages[0];

      expect(response.type).toBe("success");
      expect(response.requestId).toBe("test-global-load");
      expect(response.payload).toBeDefined();

      const settings = response.payload;
      expect(settings.id).toBe("global-settings");
      expect(settings.userId).toBe("default-user");
      expect(settings).toHaveProperty("openaiApiKey");
      expect(settings).toHaveProperty("geminiApiKey");
      expect(settings).toHaveProperty("claudeApiKey");
      expect(settings).not.toHaveProperty("theme");
      expect(settings).not.toHaveProperty("autoSave");
    });

    it("should route saveGlobalSettings to GlobalDataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const testGlobalSettings = {
        id: "global-settings",
        userId: "test-user",
        openaiApiKey: "sk-test-routing-key",
        openaiModels: ["gpt-4"],
        geminiApiKey: "",
        geminiModels: ["gemini-pro"],
        claudeApiKey: "",
        claudeModels: ["claude-3-opus"],
        defaultProvider: "openai",
        defaultModel: "gpt-4",
        defaultMode: "default",
        fontSize: 14,
        showTokenCounts: true,
        showCostEstimates: true,
        autoSaveInterval: 30,
        maxHistoryItems: 100,
        enableNotifications: true,
        customApiEndpoints: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = {
        command: "saveGlobalSettings",
        requestId: "test-global-save",
        payload: testGlobalSettings,
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from GlobalDataStore
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-global-save");
      assert(response.payload);

      // Verify the saved settings match
      const savedSettings = response.payload;
      assert.strictEqual(savedSettings.openaiApiKey, "sk-test-routing-key");
      assert.strictEqual(savedSettings.userId, "test-user");
    });
  });

  describe("Project Settings Routing", () => {
    it("should route loadProjectSettings to DataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const message = {
        command: "loadProjectSettings",
        requestId: "test-project-load",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from DataStore
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-project-load");
      assert(response.payload);

      // Verify it contains project settings structure with theme and autoSave
      const settings = response.payload;
      assert.strictEqual(settings.id, "project-settings");
      assert.strictEqual(settings.projectName, "Untitled Project");
      assert.strictEqual(settings.theme, "auto"); // Default value
      assert.strictEqual(settings.autoSave, true); // Default value
      assert(settings.hasOwnProperty("projectDetailText"));
      assert(settings.hasOwnProperty("digestedMemory"));
    });

    it("should route saveProjectSettings to DataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const testProjectSettings = {
        id: "project-settings",
        projectName: "Routing Test Project",
        projectPath: testWorkspaceRoot,
        projectDetailText: "Testing project settings routing",
        digestedMemory: "Routing test memory",
        llmProvider: "claude",
        defaultModel: "claude-3-opus",
        defaultMode: "developer",
        theme: "dark",
        autoSave: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      const message = {
        command: "saveProjectSettings",
        requestId: "test-project-save",
        payload: testProjectSettings,
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from DataStore
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-project-save");
      assert(response.payload);

      // Verify the saved settings match, including theme and autoSave
      const savedSettings = response.payload;
      assert.strictEqual(savedSettings.projectName, "Routing Test Project");
      assert.strictEqual(savedSettings.theme, "dark");
      assert.strictEqual(savedSettings.autoSave, false);
      assert.strictEqual(savedSettings.llmProvider, "claude");
    });
  });

  describe("Other Commands Routing", () => {
    it("should route task commands to DataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const message = {
        command: "loadTasks",
        requestId: "test-tasks-load",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from DataStore (empty array for new workspace)
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-tasks-load");
      assert(Array.isArray(response.payload));
    });

    it("should route memory commands to DataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const message = {
        command: "loadMemories",
        requestId: "test-memories-load",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from DataStore (empty array for new workspace)
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-memories-load");
      assert(Array.isArray(response.payload));
    });

    it("should route session commands to DataStore", () => {
      // Reset messages
      mockWebview.messages = [];

      const message = {
        command: "loadSessions",
        requestId: "test-sessions-load",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      // Should be a successful response from DataStore (empty array for new workspace)
      assert.strictEqual(response.type, "success");
      assert.strictEqual(response.requestId, "test-sessions-load");
      assert(Array.isArray(response.payload));
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown commands gracefully", () => {
      // Reset messages
      mockWebview.messages = [];

      const message = {
        command: "unknownCommand",
        requestId: "test-unknown",
      };

      // Access the private method for testing
      (provider as any).handleWebviewMessage(mockWebview, message);

      // Verify error message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      assert.strictEqual(response.type, "error");
      assert.strictEqual(response.requestId, "test-unknown");
      assert(response.error);
      assert(response.error.includes("Unknown command"));
    });

    it("should handle missing DataStore gracefully", () => {
      // Reset messages
      mockWebview.messages = [];

      // Create provider without workspace (no DataStore initialization)
      const mockExtensionUri = { fsPath: "/mock/extension/path" };
      const providerWithoutWorkspace = new SamuraiAgentPanelWebviewViewProvider(
        mockExtensionUri as any,
      );

      const message = {
        command: "loadProjectSettings",
        requestId: "test-no-workspace",
      };

      // Access the private method for testing
      (providerWithoutWorkspace as any).handleWebviewMessage(
        mockWebview,
        message,
      );

      // Verify error message was sent back
      assert.strictEqual(mockWebview.messages.length, 1);
      const response = mockWebview.messages[0];

      assert.strictEqual(response.type, "error");
      assert.strictEqual(response.requestId, "test-no-workspace");
      assert(response.error);
      assert(response.error.includes("DataStore not initialized"));
    });
  });

  describe("End-to-End Routing Validation", () => {
    it("should correctly separate global and project settings persistence", () => {
      // Test global settings flow
      mockWebview.messages = [];

      // Save global settings (should go to GlobalDataStore)
      const globalSettings = {
        id: "global-settings",
        userId: "e2e-user",
        openaiApiKey: "sk-e2e-global-key",
        openaiModels: ["gpt-4"],
        geminiApiKey: "",
        geminiModels: ["gemini-pro"],
        claudeApiKey: "",
        claudeModels: ["claude-3-opus"],
        defaultProvider: "openai",
        defaultModel: "gpt-4",
        defaultMode: "default",
        fontSize: 14,
        showTokenCounts: true,
        showCostEstimates: true,
        autoSaveInterval: 30,
        maxHistoryItems: 100,
        enableNotifications: true,
        customApiEndpoints: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (provider as any).handleWebviewMessage(mockWebview, {
        command: "saveGlobalSettings",
        requestId: "e2e-global-save",
        payload: globalSettings,
      });

      // Test project settings flow
      const projectSettings = {
        id: "project-settings",
        projectName: "E2E Project",
        projectPath: testWorkspaceRoot,
        projectDetailText: "E2E routing test",
        digestedMemory: "E2E memory",
        llmProvider: "claude",
        defaultModel: "claude-3-sonnet",
        defaultMode: "analytical",
        theme: "light",
        autoSave: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      (provider as any).handleWebviewMessage(mockWebview, {
        command: "saveProjectSettings",
        requestId: "e2e-project-save",
        payload: projectSettings,
      });

      // Verify both messages were processed
      assert.strictEqual(mockWebview.messages.length, 2);

      // Verify global settings response
      const globalResponse = mockWebview.messages[0];
      assert.strictEqual(globalResponse.type, "success");
      assert.strictEqual(globalResponse.requestId, "e2e-global-save");
      assert.strictEqual(
        globalResponse.payload.openaiApiKey,
        "sk-e2e-global-key",
      );
      assert(!globalResponse.payload.hasOwnProperty("theme"));
      assert(!globalResponse.payload.hasOwn("autoSave"));

      // Verify project settings response
      const projectResponse = mockWebview.messages[1];
      assert.strictEqual(projectResponse.type, "success");
      assert.strictEqual(projectResponse.requestId, "e2e-project-save");
      assert.strictEqual(projectResponse.payload.projectName, "E2E Project");
      assert.strictEqual(projectResponse.payload.theme, "light");
      assert.strictEqual(projectResponse.payload.autoSave, true);
    });
  });
});
