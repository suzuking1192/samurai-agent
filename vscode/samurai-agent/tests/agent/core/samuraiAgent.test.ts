import { SamuraiAgent } from '../../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../../../src/agent/memory/projectDetailService';
import { DataStore } from '../../../src/persistence/dataStore';
import { ExtractCodeTool } from '../../../src/agent/tools/extractCodeTool';
import { ChatMessage, Session, UserIntentEnum } from '../../../src/common/models/chat-models';
import { ExtractCodeToolResultPayload } from '../../../src/common/models/tool-models';
import { LLMMessage } from '../../../src/common/models/llm-models';
import * as fs from 'fs';
import * as path from 'path';

// Mock the fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SamuraiAgent', () => {
  let samuraiAgent: SamuraiAgent;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockProjectDetailService: jest.Mocked<ProjectDetailService>;
  let mockExtractCodeTool: jest.Mocked<ExtractCodeTool>;

  beforeEach(() => {
    // Create mocks
    mockLLMProviderService = {
      chat: jest.fn(),
    } as any;

    mockDataStore = {
      loadChatMessagesForSession: jest.fn(),
      loadAllCodeContextForSession: jest.fn(),
      updateSession: jest.fn(),
      saveCodeContext: jest.fn(),
    } as any;

    mockProjectDetailService = {
      getProjectDetails: jest.fn(),
    } as any;

    mockExtractCodeTool = {
      execute: jest.fn(),
    } as any;

    // Create SamuraiAgent instance
    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool
    );

    // Mock fs.readFileSync for prompt loading
    mockedFs.readFileSync.mockReturnValue('Mock prompt content with {projectDetails} and {codeContexts} and {conversationSummary} and {activeTaskHeader} and {noActiveTaskInference}');
    mockedFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('_loadAndFormatSystemPrompt', () => {
    it('should load and format a system prompt with variables', async () => {
      const variables = {
        projectDetails: 'Test project details',
        codeContexts: 'Test code context',
        conversationSummary: 'Test conversation summary',
        activeTaskHeader: 'Test active task header',
        noActiveTaskInference: 'Test no active task inference'
      };

      const result = await (samuraiAgent as any)._loadAndFormatSystemPrompt(
        'pureDiscussion/system_prompt.md',
        variables
      );

      expect(mockedFs.readFileSync).toHaveBeenCalled();
      expect(result).toContain('Test project details');
      expect(result).toContain('Test code context');
      expect(result).toContain('Test conversation summary');
      expect(result).toContain('Test active task header');
      expect(result).toContain('Test no active task inference');
    });

    it('should throw error when prompt file is not found', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await expect(
        (samuraiAgent as any)._loadAndFormatSystemPrompt(
          'nonexistent/prompt.md',
          { projectDetails: '', codeContexts: '', conversationSummary: '' }
        )
      ).rejects.toThrow('Failed to load prompt file');
    });
  });

  describe('_formatCodeContextsForPrompt', () => {
    it('should format code contexts correctly', () => {
      const codeContexts: ExtractCodeToolResultPayload[] = [
        {
          id: 'context1',
          query: 'test query',
          relevantCodeElements: [
            {
              path: 'src/test.ts',
              elements: [
                { type: 'function', name: 'testFunction' },
                { type: 'class', name: 'TestClass' }
              ],
              snippet: 'function testFunction() {\n  return "test";\n}'
            }
          ],
          metadata: {}
        }
      ];

      const result = (samuraiAgent as any)._formatCodeContextsForPrompt(codeContexts);

      expect(result).toContain('// File: src/test.ts');
      expect(result).toContain('// [function]: testFunction');
      expect(result).toContain('// [class]: TestClass');
      expect(result).toContain('function testFunction() {');
    });

    it('should handle empty code contexts', () => {
      const result = (samuraiAgent as any)._formatCodeContextsForPrompt([]);
      expect(result).toBe('No code context available.');
    });

    it('should handle null/undefined code contexts', () => {
      const result = (samuraiAgent as any)._formatCodeContextsForPrompt(null as any);
      expect(result).toBe('No code context available.');
    });
  });

  describe('handlePureDiscussion', () => {
    it('should handle pure discussion successfully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'Hello, how are you?',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const chatHistory: LLMMessage[] = [
        { role: 'user', content: 'Previous message' }
      ];

      const projectDetails = 'Test project details';
      const codeContexts: ExtractCodeToolResultPayload[] = [];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'Hello! I am doing well, thank you for asking.',
          role: 'assistant'
        }
      } as any);

      const result = await samuraiAgent.handlePureDiscussion(
        userMessage,
        chatHistory,
        projectDetails,
        codeContexts
      );

      expect(result).toBe('Hello! I am doing well, thank you for asking.');
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Previous message' }),
            expect.objectContaining({ role: 'user', content: 'Hello, how are you?' })
          ])
        })
      );
    });

    it('should handle LLM errors gracefully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'Hello',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      // Mock LLM error
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error',
        error: 'LLM service unavailable'
      } as any);

      const result = await samuraiAgent.handlePureDiscussion(
        userMessage,
        [],
        'project details',
        []
      );

      expect(result).toBe("I'm here to help with your project! What would you like to discuss?");
    });
  });

  describe('handleFeatureExploration', () => {
    it('should handle feature exploration successfully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'I want to add a new feature',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const chatHistory: LLMMessage[] = [];
      const projectDetails = 'Test project details';
      const codeContexts: ExtractCodeToolResultPayload[] = [];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'That sounds interesting! Tell me more about what you have in mind.',
          role: 'assistant'
        }
      } as any);

      const result = await samuraiAgent.handleFeatureExploration(
        userMessage,
        chatHistory,
        projectDetails,
        codeContexts
      );

      expect(result).toBe('That sounds interesting! Tell me more about what you have in mind.');
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ type: 'feature_exploration' })
        })
      );
    });
  });

  describe('execute', () => {
    it('should dispatch to handlePureDiscussion for PURE_DISCUSSION intent', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'Hello, how are you?',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const session: Session = {
        id: 'session1',
        title: 'Test Session',
        status: 'active' as any,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: { projectId: 'project1' },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock dependencies
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockResolvedValue(undefined);

      // Mock LLM response for code extraction analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: JSON.stringify({ new_code_context_necessary: false, extraction_query: null, reasoning: 'No extraction needed' }) }
      } as any);

      // Mock LLM response for pure discussion
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: 'Hello! How can I help you today?' }
      } as any);

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello! How can I help you today?');
      expect(mockDataStore.updateSession).toHaveBeenCalledWith('session1', {
        messageCount: 2,
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION
      });
    });

    it('should dispatch to handleFeatureExploration for FEATURE_EXPLORATION intent', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'I want to explore a new feature',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const session: Session = {
        id: 'session1',
        title: 'Test Session',
        status: 'active' as any,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: { projectId: 'project1' },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock dependencies
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockResolvedValue(undefined);

      // Mock LLM response for code extraction analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: JSON.stringify({ new_code_context_necessary: false, extraction_query: null, reasoning: 'No extraction needed' }) }
      } as any);

      // Mock LLM response for feature exploration
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: 'That sounds interesting! Tell me more about your feature idea.' }
      } as any);

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toBe('That sounds interesting! Tell me more about your feature idea.');
      expect(mockDataStore.updateSession).toHaveBeenCalledWith('session1', {
        messageCount: 2,
        previous_session_intent: UserIntentEnum.FEATURE_EXPLORATION
      });
    });

    it('should handle unimplemented intents gracefully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'Create a spec',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const session: Session = {
        id: 'session1',
        title: 'Test Session',
        status: 'active' as any,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: { projectId: 'project1' },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock dependencies
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockResolvedValue(undefined);

      // Mock LLM response for code extraction analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: JSON.stringify({ new_code_context_necessary: false, extraction_query: null, reasoning: 'No extraction needed' }) }
      } as any);

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Spec generation is not yet implemented. Please use pure discussion or feature exploration for now.');
    });
  });
});
