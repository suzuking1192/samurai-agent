/**
 * Unit tests for DataStore telemetry integration
 */

import { DataStore } from '../dataStore';
import { TelemetryService } from '../../services/TelemetryService';
import { MessageType } from '../../common/models/chat-models';

// Mock TelemetryService
const mockTelemetryService = {
  trackChatMessage: jest.fn(),
} as jest.Mocked<TelemetryService>;

describe('DataStore Telemetry Integration', () => {
  let dataStore: DataStore;
  const mockWorkspaceRoot = '/test/workspace';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
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
});
