/**
 * Unit tests for TelemetryService
 */

import * as vscode from 'vscode';
import { TelemetryService } from '../../src/services/TelemetryService';
import { GlobalDataStore } from '../../src/persistence/globalDataStore';
import { ErrorModel, ErrorSeverity, ErrorCategory } from '../../src/common/models/error-models';

// Mock PostHog
jest.mock('posthog-node', () => {
  return {
    PostHog: jest.fn().mockImplementation(() => ({
      capture: jest.fn(),
      shutdown: jest.fn(),
    })),
  };
});

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
  },
  ExtensionContext: jest.fn(),
}));

describe('TelemetryService', () => {
  let mockContext: vscode.ExtensionContext;
  let mockGlobalDataStore: jest.Mocked<GlobalDataStore>;
  let telemetryService: TelemetryService;

  beforeEach(() => {
    // Mock extension context
    mockContext = {
      extension: {
        packageJSON: {
          version: '1.0.0',
        },
      },
    } as any;

    // Mock global data store
    mockGlobalDataStore = {
      loadGlobalSettings: jest.fn().mockReturnValue({
        type: 'success',
        payload: {
          userId: 'test-user-id',
        },
      }),
    } as any;

    // Mock VS Code configuration
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(true),
    });

    // Set environment variables
    process.env.POSTHOG_API_KEY = 'test-api-key';
    process.env.POSTHOG_HOST = 'https://test.posthog.com';

    telemetryService = new TelemetryService(mockContext, mockGlobalDataStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackChatMessage', () => {
    it('should track user message when telemetry is enabled', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'user_message',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });

    it('should track agent response when telemetry is enabled', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('agent_response');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'agent_response',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });

    it('should not track when telemetry is disabled', async () => {
      // Mock telemetry disabled
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(false),
      });

      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message');

      expect(mockInstance.capture).not.toHaveBeenCalled();
    });

    it('should not track when PostHog is not initialized', async () => {
      // Mock PostHog not initialized
      (telemetryService as any).posthog = null;

      await telemetryService.trackChatMessage('user_message');

      // Should not throw error
      expect(true).toBe(true);
    });

    it('should include llmModelUsed property when model ID is provided', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message', 'gpt-4');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'user_message',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          llmModelUsed: 'gpt-4',
        },
      });
    });

    it('should include llmModelUsed property for agent response when model ID is provided', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('agent_response', 'claude-3-sonnet');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'agent_response',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          llmModelUsed: 'claude-3-sonnet',
        },
      });
    });

    it('should not include llmModelUsed property when model ID is undefined', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message', undefined);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'user_message',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });

    it('should not include llmModelUsed property when model ID is empty string', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message', '');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'user_message',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });

    it('should not include llmModelUsed property when model ID is whitespace only', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackChatMessage('user_message', '   ');

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'chat_interaction',
        properties: {
          chatMessageType: 'user_message',
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });
  });

  describe('trackExtensionActivation', () => {
    it('should track extension activation when telemetry is enabled', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackExtensionActivation();

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'extension_activated',
        properties: {
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
        },
      });
    });
  });

  describe('trackTelemetrySettingChange', () => {
    it('should track telemetry setting change', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.trackTelemetrySettingChange(false);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'telemetry_setting_changed',
        properties: {
          telemetryEnabled: false,
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
        },
      });
    });
  });

  describe('captureError', () => {
    let mockPostHog: any;
    let mockInstance: any;

    beforeEach(() => {
      mockPostHog = require('posthog-node').PostHog;
      mockInstance = new mockPostHog();
      (telemetryService as any).posthog = mockInstance;
    });

    it('should capture Error instance with standard properties', () => {
      const error = new Error('Test error message');
      const properties = { service: 'TestService', function: 'testFunction' };

      telemetryService.captureError(error, properties);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: '$exception',
        properties: {
          $exception_message: 'Test error message',
          $exception_type: 'Error',
          $exception_stack: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          service: 'TestService',
          function: 'testFunction'
        }
      });
    });

    it('should capture ErrorModel instance with all properties', () => {
      const errorModel: ErrorModel = {
        id: 'error-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        code: 'TEST_ERROR',
        message: 'Test error message',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        context: { key: 'value' },
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'request-789',
        resolved: false
      };
      const properties = { service: 'TestService', function: 'testFunction' };

      telemetryService.captureError(errorModel, properties);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: '$exception',
        properties: {
          $exception_message: 'Test error message',
          $exception_type: 'ErrorModel',
          $exception_stack: undefined,
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          service: 'TestService',
          function: 'testFunction',
          severity: ErrorSeverity.HIGH,
          code: 'TEST_ERROR',
          category: ErrorCategory.SYSTEM,
          context: { key: 'value' },
          userId: 'user-123',
          sessionId: 'session-456',
          requestId: 'request-789'
        }
      });
    });

    it('should capture Error without additional properties', () => {
      const error = new Error('Test error message');

      telemetryService.captureError(error);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: '$exception',
        properties: {
          $exception_message: 'Test error message',
          $exception_type: 'Error',
          $exception_stack: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined
        }
      });
    });

    it('should not capture when PostHog is not initialized', () => {
      (telemetryService as any).posthog = null;
      const error = new Error('Test error message');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      telemetryService.captureError(error);

      expect(mockInstance.capture).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: PostHog not initialized, cannot capture error'
      );

      consoleSpy.mockRestore();
    });

    it('should not capture when telemetry is disabled', () => {
      // Mock telemetry disabled
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(false),
      });

      const error = new Error('Test error message');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      telemetryService.captureError(error);

      expect(mockInstance.capture).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: Telemetry disabled, not capturing error'
      );

      consoleSpy.mockRestore();
    });

    it('should handle captureException errors gracefully', () => {
      const error = new Error('Test error message');
      const captureError = new Error('PostHog capture failed');
      
      mockInstance.capture.mockImplementation(() => {
        throw captureError;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      expect(() => telemetryService.captureError(error)).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: Error capturing error to PostHog:',
        captureError
      );

      consoleSpy.mockRestore();
    });

    it('should merge provided properties with standard properties', () => {
      const error = new Error('Test error message');
      const properties = { 
        service: 'TestService', 
        function: 'testFunction',
        customProperty: 'customValue'
      };

      telemetryService.captureError(error, properties);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: '$exception',
        properties: {
          $exception_message: 'Test error message',
          $exception_type: 'Error',
          $exception_stack: expect.any(String),
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          service: 'TestService',
          function: 'testFunction',
          customProperty: 'customValue'
        }
      });
    });

    it('should handle ErrorModel with missing optional properties', () => {
      const errorModel: ErrorModel = {
        id: 'error-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        code: 'TEST_ERROR',
        message: 'Test error message',
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        context: {},
        resolved: false
        // userId, sessionId, requestId are undefined
      };

      telemetryService.captureError(errorModel);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: '$exception',
        properties: {
          $exception_message: 'Test error message',
          $exception_type: 'ErrorModel',
          $exception_stack: undefined,
          extensionVersion: '1.0.0',
          vscodeVersion: undefined,
          severity: ErrorSeverity.LOW,
          code: 'TEST_ERROR',
          category: ErrorCategory.USER,
          context: {},
          userId: undefined,
          sessionId: undefined,
          requestId: undefined
        }
      });
    });
  });

  describe('trackLLMKeyStatusChange', () => {
    let mockPostHog: any;
    let mockInstance: any;

    beforeEach(() => {
      mockPostHog = require('posthog-node').PostHog;
      mockInstance = new mockPostHog();
      (telemetryService as any).posthog = mockInstance;
      (telemetryService as any).distinctId = 'test-user-id';
    });

    it('should track when an LLM API key is added', () => {
      telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'llm_key_status_changed',
        properties: {
          provider: 'openai',
          changeType: 'added',
          hadKeyPreviously: false,
          hasKeyNow: true,
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
        },
      });
    });

    it('should track when an LLM API key is updated', () => {
      telemetryService.trackLLMKeyStatusChange('gemini', 'updated', true, true);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'llm_key_status_changed',
        properties: {
          provider: 'gemini',
          changeType: 'updated',
          hadKeyPreviously: true,
          hasKeyNow: true,
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
        },
      });
    });

    it('should track when an LLM API key is removed', () => {
      telemetryService.trackLLMKeyStatusChange('claude', 'removed', true, false);

      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'llm_key_status_changed',
        properties: {
          provider: 'claude',
          changeType: 'removed',
          hadKeyPreviously: true,
          hasKeyNow: false,
          eventTimestamp: expect.any(String),
          extensionVersion: '1.0.0',
        },
      });
    });

    it('should track for all supported providers', () => {
      const providers: Array<'openai' | 'gemini' | 'claude' | 'anthropic'> = ['openai', 'gemini', 'claude', 'anthropic'];

      providers.forEach(provider => {
        mockInstance.capture.mockClear();
        telemetryService.trackLLMKeyStatusChange(provider, 'added', false, true);

        expect(mockInstance.capture).toHaveBeenCalledWith({
          distinctId: 'test-user-id',
          event: 'llm_key_status_changed',
          properties: {
            provider,
            changeType: 'added',
            hadKeyPreviously: false,
            hasKeyNow: true,
            eventTimestamp: expect.any(String),
            extensionVersion: '1.0.0',
          },
        });
      });
    });

    it('should not track when PostHog is not initialized', () => {
      (telemetryService as any).posthog = null;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);

      expect(mockInstance.capture).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: PostHog not initialized or distinct ID missing, not tracking LLM key status change'
      );

      consoleSpy.mockRestore();
    });

    it('should not track when distinct ID is missing', () => {
      (telemetryService as any).distinctId = null;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);

      expect(mockInstance.capture).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: PostHog not initialized or distinct ID missing, not tracking LLM key status change'
      );

      consoleSpy.mockRestore();
    });

    it('should not track when telemetry is disabled', () => {
      // Mock telemetry disabled
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(false),
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);

      expect(mockInstance.capture).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: Telemetry disabled, not tracking LLM key status change'
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully without throwing', () => {
      const captureError = new Error('PostHog capture failed');
      mockInstance.capture.mockImplementation(() => {
        throw captureError;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      expect(() => {
        telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'TelemetryService: Error tracking LLM key status change:',
        captureError
      );

      consoleSpy.mockRestore();
    });

    it('should never include actual API key values in event properties', () => {
      telemetryService.trackLLMKeyStatusChange('openai', 'added', false, true);

      const captureCall = mockInstance.capture.mock.calls[0][0];
      const properties = captureCall.properties;

      // Verify that no property contains anything that looks like an API key
      Object.values(properties).forEach(value => {
        if (typeof value === 'string') {
          // API keys are typically long alphanumeric strings
          // This is a basic check to ensure we're not accidentally logging keys
          expect(value).not.toMatch(/^sk-[a-zA-Z0-9]{32,}$/); // OpenAI format
          expect(value).not.toMatch(/^[a-zA-Z0-9_-]{32,}$/); // Generic long key format
        }
      });

      // Explicitly verify the properties we do send
      expect(properties).toEqual({
        provider: 'openai',
        changeType: 'added',
        hadKeyPreviously: false,
        hasKeyNow: true,
        eventTimestamp: expect.any(String),
        extensionVersion: '1.0.0',
      });
    });
  });

  describe('dispose', () => {
    it('should shutdown PostHog client', async () => {
      const mockPostHog = require('posthog-node').PostHog;
      const mockInstance = new mockPostHog();
      
      // Mock the PostHog instance
      (telemetryService as any).posthog = mockInstance;

      await telemetryService.dispose();

      expect(mockInstance.shutdown).toHaveBeenCalled();
    });
  });
});
