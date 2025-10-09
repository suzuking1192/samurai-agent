/**
 * Unit tests for DataStore telemetry integration
 */

import { DataStore } from '../../src/persistence/dataStore';
import { TelemetryService } from '../../src/services/TelemetryService';
import { MessageType } from '../../src/common/models/chat-models';
import { GlobalSettings } from '../../src/common/models/settings-models';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock TelemetryService
const mockTelemetryService = {
  trackChatMessage: jest.fn(),
  trackLLMKeyStatusChange: jest.fn(),
} as jest.Mocked<TelemetryService>;

describe('DataStore Telemetry Integration', () => {
  let dataStore: DataStore;
  const mockWorkspaceRoot = '/test/workspace';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock file system operations
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    
    // Create DataStore with mocked TelemetryService
    dataStore = new DataStore(mockWorkspaceRoot, mockTelemetryService);
  });

  describe('saveChatMessageInternal', () => {
    it('should track user message when saving user message', () => {
      const request = {
        sessionId: 'test-session',
        projectId: 'test-project',
        type: MessageType.USER,
        content: 'Hello',
        role: 'user',
      };

      // Mock the internal methods to avoid file system operations
      jest.spyOn(dataStore as any, 'loadSessionInternal').mockReturnValue({
        id: 'test-session',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      jest.spyOn(dataStore as any, 'readStoredChatMessages').mockReturnValue([]);
      jest.spyOn(dataStore as any, 'writeStoredChatMessages').mockImplementation(() => {});
      jest.spyOn(dataStore as any, 'updateSessionInternal').mockReturnValue({});

      // Call the method
      dataStore['saveChatMessageInternal'](request);

      // Verify telemetry was called
      expect(mockTelemetryService.trackChatMessage).toHaveBeenCalledWith('user_message');
    });

    it('should track agent response when saving agent message', () => {
      const request = {
        sessionId: 'test-session',
        projectId: 'test-project',
        type: MessageType.ASSISTANT,
        content: 'Hello there!',
        role: 'assistant',
      };

      // Mock the internal methods to avoid file system operations
      jest.spyOn(dataStore as any, 'loadSessionInternal').mockReturnValue({
        id: 'test-session',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      jest.spyOn(dataStore as any, 'readStoredChatMessages').mockReturnValue([]);
      jest.spyOn(dataStore as any, 'writeStoredChatMessages').mockImplementation(() => {});
      jest.spyOn(dataStore as any, 'updateSessionInternal').mockReturnValue({});

      // Call the method
      dataStore['saveChatMessageInternal'](request);

      // Verify telemetry was called
      expect(mockTelemetryService.trackChatMessage).toHaveBeenCalledWith('agent_response');
    });

    it('should not track telemetry when TelemetryService is not provided', () => {
      // Create DataStore without TelemetryService
      const dataStoreWithoutTelemetry = new DataStore(mockWorkspaceRoot);

      const request = {
        sessionId: 'test-session',
        projectId: 'test-project',
        type: MessageType.USER,
        content: 'Hello',
        role: 'user',
      };

      // Mock the internal methods to avoid file system operations
      jest.spyOn(dataStoreWithoutTelemetry as any, 'loadSessionInternal').mockReturnValue({
        id: 'test-session',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      jest.spyOn(dataStoreWithoutTelemetry as any, 'readStoredChatMessages').mockReturnValue([]);
      jest.spyOn(dataStoreWithoutTelemetry as any, 'writeStoredChatMessages').mockImplementation(() => {});
      jest.spyOn(dataStoreWithoutTelemetry as any, 'updateSessionInternal').mockReturnValue({});

      // Call the method
      dataStoreWithoutTelemetry['saveChatMessageInternal'](request);

      // Verify telemetry was not called
      expect(mockTelemetryService.trackChatMessage).not.toHaveBeenCalled();
    });

    it('should handle telemetry errors gracefully', () => {
      // Mock telemetry service to throw error
      mockTelemetryService.trackChatMessage.mockImplementation(() => {
        throw new Error('Telemetry error');
      });

      const request = {
        sessionId: 'test-session',
        projectId: 'test-project',
        type: MessageType.USER,
        content: 'Hello',
        role: 'user',
      };

      // Mock the internal methods to avoid file system operations
      jest.spyOn(dataStore as any, 'loadSessionInternal').mockReturnValue({
        id: 'test-session',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      jest.spyOn(dataStore as any, 'readStoredChatMessages').mockReturnValue([]);
      jest.spyOn(dataStore as any, 'writeStoredChatMessages').mockImplementation(() => {});
      jest.spyOn(dataStore as any, 'updateSessionInternal').mockReturnValue({});

      // Call the method - should not throw error
      expect(() => {
        dataStore['saveChatMessageInternal'](request);
      }).not.toThrow();

      // Verify telemetry was attempted
      expect(mockTelemetryService.trackChatMessage).toHaveBeenCalledWith('user_message');
    });
  });

  describe('LLM API Key Change Detection', () => {
    const createMockSettings = (overrides?: Partial<GlobalSettings>): GlobalSettings => ({
      id: 'global-settings',
      userId: 'test-user',
      openaiApiKey: '',
      geminiApiKey: '',
      claudeApiKey: '',
      defaultProvider: 'openai' as any,
      defaultModel: 'gpt-4',
      defaultMode: 'default' as any,
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
      ...overrides,
    });

    beforeEach(() => {
      // Mock file system operations
      jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(null);
      jest.spyOn(dataStore as any, 'writeSingleJsonFile').mockImplementation(() => {});
    });

    describe('handleSaveGlobalSettings', () => {
      it('should track when OpenAI API key is added', () => {
        const oldSettings = createMockSettings({ openaiApiKey: '' });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should track when Gemini API key is added', () => {
        const oldSettings = createMockSettings({ geminiApiKey: '' });
        const newSettings = createMockSettings({ geminiApiKey: 'gemini-key-123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'gemini',
          'added',
          false,
          true
        );
      });

      it('should track when Claude API key is added', () => {
        const oldSettings = createMockSettings({ claudeApiKey: '' });
        const newSettings = createMockSettings({ claudeApiKey: 'claude-key-456' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'claude',
          'added',
          false,
          true
        );
      });

      it('should track when API key is updated', () => {
        const oldSettings = createMockSettings({ openaiApiKey: 'old-key-123' });
        const newSettings = createMockSettings({ openaiApiKey: 'new-key-456' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'updated',
          true,
          true
        );
      });

      it('should track when API key is removed', () => {
        const oldSettings = createMockSettings({ openaiApiKey: 'sk-test123' });
        const newSettings = createMockSettings({ openaiApiKey: '' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'removed',
          true,
          false
        );
      });

      it('should not track when API key has not changed', () => {
        const oldSettings = createMockSettings({ openaiApiKey: 'sk-test123' });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).not.toHaveBeenCalled();
      });

      it('should treat null as empty key', () => {
        const oldSettings = createMockSettings({ openaiApiKey: null as any });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should treat undefined as empty key', () => {
        const oldSettings = createMockSettings({ openaiApiKey: undefined as any });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should treat empty string as empty key', () => {
        const oldSettings = createMockSettings({ openaiApiKey: '' });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should treat whitespace-only string as present key', () => {
        const oldSettings = createMockSettings({ openaiApiKey: '' });
        const newSettings = createMockSettings({ openaiApiKey: '   ' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should track multiple key changes in single save', () => {
        const oldSettings = createMockSettings({
          openaiApiKey: '',
          geminiApiKey: 'old-gemini',
          claudeApiKey: 'claude-key',
        });
        const newSettings = createMockSettings({
          openaiApiKey: 'new-openai',
          geminiApiKey: 'new-gemini',
          claudeApiKey: '',
        });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledTimes(3);
        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'gemini',
          'updated',
          true,
          true
        );
        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'claude',
          'removed',
          true,
          false
        );
      });

      it('should track when no old settings exist (first save)', () => {
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(null);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
          'openai',
          'added',
          false,
          true
        );
      });

      it('should not track when telemetry service is not provided', () => {
        const dataStoreWithoutTelemetry = new DataStore(mockWorkspaceRoot);
        const oldSettings = createMockSettings({ openaiApiKey: '' });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStoreWithoutTelemetry as any, 'readSingleJsonFile').mockReturnValue(oldSettings);
        jest.spyOn(dataStoreWithoutTelemetry as any, 'writeSingleJsonFile').mockImplementation(() => {});

        dataStoreWithoutTelemetry.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).not.toHaveBeenCalled();
      });

      it('should handle telemetry errors gracefully and still save settings', () => {
        const oldSettings = createMockSettings({ openaiApiKey: '' });
        const newSettings = createMockSettings({ openaiApiKey: 'sk-test123' });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);
        const writeSpy = jest.spyOn(dataStore as any, 'writeSingleJsonFile').mockImplementation(() => {});

        mockTelemetryService.trackLLMKeyStatusChange.mockImplementation(() => {
          throw new Error('Telemetry error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        // Settings should still be saved despite telemetry error
        expect(writeSpy).toHaveBeenCalled();
        expect(result.type).toBe('success');
        expect(consoleSpy).toHaveBeenCalledWith(
          'DataStore: Error detecting/tracking LLM key changes:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('should not change settings when only other fields are updated', () => {
        const oldSettings = createMockSettings({
          openaiApiKey: 'sk-test123',
          fontSize: 12,
        });
        const newSettings = createMockSettings({
          openaiApiKey: 'sk-test123',
          fontSize: 14,
        });

        jest.spyOn(dataStore as any, 'readSingleJsonFile').mockReturnValue(oldSettings);

        dataStore.handleWebviewMessage({
          command: 'saveGlobalSettings',
          requestId: 'test-request',
          payload: newSettings,
        });

        expect(mockTelemetryService.trackLLMKeyStatusChange).not.toHaveBeenCalled();
      });
    });
  });
});

