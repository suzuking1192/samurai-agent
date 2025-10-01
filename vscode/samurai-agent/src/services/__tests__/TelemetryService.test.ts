/**
 * Unit tests for TelemetryService
 */

import * as vscode from 'vscode';
import { TelemetryService } from '../TelemetryService';
import { GlobalDataStore } from '../../persistence/globalDataStore';

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
          vscodeVersion: expect.any(String),
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
          vscodeVersion: expect.any(String),
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
          vscodeVersion: expect.any(String),
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
