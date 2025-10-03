/**
 * Unit tests for SamuraiAgent
 */

import { SamuraiAgent } from '../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../src/agent/llm/llmProviderService';
import { DataStore } from '../../src/persistence/dataStore';
import { ProjectDetailService } from '../../src/agent/memory/projectDetailService';
import { ExtractCodeTool } from '../../src/agent/tools/extractCodeTool';
import { CreateSpecTool } from '../../src/agent/tools/createSpecTool';
import { TelemetryService } from '../../src/services/TelemetryService';
import { ChatMessage, Session, UserIntentEnum, MessageType, SessionStatus } from '../../src/common/models/chat-models';
import { AgentExecutionResult } from '../../src/agent/models/agent-models';

// Mock dependencies
jest.mock('../../src/agent/llm/llmProviderService');
jest.mock('../../src/persistence/dataStore');
jest.mock('../../src/agent/memory/projectDetailService');
jest.mock('../../src/agent/tools/extractCodeTool');
jest.mock('../../src/agent/tools/createSpecTool');
jest.mock('../../src/services/TelemetryService');

describe('SamuraiAgent', () => {
  let samuraiAgent: SamuraiAgent;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockProjectDetailService: jest.Mocked<ProjectDetailService>;
  let mockExtractCodeTool: jest.Mocked<ExtractCodeTool>;
  let mockCreateSpecTool: jest.Mocked<CreateSpecTool>;
  let mockTelemetryService: jest.Mocked<TelemetryService>;

  beforeEach(() => {
    // Create mock instances
    mockLLMProviderService = new LLMProviderService({} as any, {} as any) as jest.Mocked<LLMProviderService>;
    mockDataStore = new DataStore('/test/path') as jest.Mocked<DataStore>;
    mockProjectDetailService = new ProjectDetailService({} as any, {} as any, '') as jest.Mocked<ProjectDetailService>;
    mockExtractCodeTool = new ExtractCodeTool({} as any, {} as any, {} as any) as jest.Mocked<ExtractCodeTool>;
    mockCreateSpecTool = new CreateSpecTool({} as any) as jest.Mocked<CreateSpecTool>;
    mockTelemetryService = new TelemetryService({} as any, {} as any) as jest.Mocked<TelemetryService>;

    // Create SamuraiAgent instance
    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool,
      mockCreateSpecTool,
      mockTelemetryService
    );
  });

  describe('analyzeUserIntent', () => {
    it('should return SPEC_GENERATION for keyword matches', async () => {
      const userMessage: ChatMessage = {
      id: 'msg-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      type: MessageType.USER,
        content: 'Please create a spec for user authentication',
      role: 'user',
      metadata: {},
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
      const chatHistory = [];
      const projectDetails = 'Test project';

      const result = await samuraiAgent.analyzeUserIntent(chatHistory, userMessage, projectDetails);
      
      expect(result).toBe(UserIntentEnum.SPEC_GENERATION);
    });

    it('should return SPEC_GENERATION for "create specs" keyword', async () => {
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'I need to create specs for the new features',
        role: 'user',
        metadata: {},
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const chatHistory = [];
      const projectDetails = 'Test project';

      const result = await samuraiAgent.analyzeUserIntent(chatHistory, userMessage, projectDetails);
      
      expect(result).toBe(UserIntentEnum.SPEC_GENERATION);
    });

    it('should fallback to PURE_DISCUSSION when LLM analysis fails', async () => {
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'What is the weather like today?',
        role: 'user',
          metadata: {},
        isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
      };
      const chatHistory = [];
      const projectDetails = 'Test project';

      // Mock LLM service to throw an error
      mockLLMProviderService.chat.mockRejectedValue(new Error('LLM service unavailable'));

      const result = await samuraiAgent.analyzeUserIntent(chatHistory, userMessage, projectDetails);

      expect(result).toBe(UserIntentEnum.PURE_DISCUSSION);
    });
  });

  describe('execute', () => {
    it('should return success result for valid execution', async () => {
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'Hello, how can you help me?',
        role: 'user',
        metadata: {},
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const session: Session = {
      id: 'session-1',
      title: 'Test Session',
      status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
      lastMessageAt: new Date(),
      tags: [],
        metadata: {
          projectId: 'project-1'
        },
        codeContextIds: [],
      previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
      createdAt: new Date(),
      updatedAt: new Date()
    };

      // Mock data store methods
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: {
          digestedProjectDetailContent: 'Test project details'
        }
      });
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockReturnValue(session);

      // Mock project detail service
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle errors gracefully and capture them via telemetry', async () => {
      const userMessage: ChatMessage = {
      id: 'msg-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      type: MessageType.USER,
      content: 'Test message',
      role: 'user',
      metadata: {},
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

      const session: Session = {
        id: 'session-1',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'project-1'
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock data store to throw an error
      const testError = new Error('Database error');
      mockDataStore.loadChatMessagesForSession.mockImplementation(() => {
        throw testError;
      });

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database error');
      
      // Verify that captureError was called with the correct parameters
      expect(mockTelemetryService.captureError).toHaveBeenCalledWith(
        testError,
        { service: 'SamuraiAgent', function: 'execute' }
      );
    });
  });
});