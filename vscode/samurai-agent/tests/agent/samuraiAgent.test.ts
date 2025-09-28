import { SamuraiAgent } from '../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../../src/agent/memory/projectDetailService';
import { DataStore } from '../../src/persistence/dataStore';
import { ChatMessage, Session, UserIntentEnum, MessageType, SessionStatus } from '../../src/common/models/chat-models';
import { LLMMessage } from '../../src/common/models/llm-models';
import { ExtractCodeToolResultPayload } from '../../src/common/models/tool-models';
import { ExtractCodeTool } from '../../src/agent/tools/extractCodeTool';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SamuraiAgent', () => {
  let samuraiAgent: SamuraiAgent;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockProjectDetailService: jest.Mocked<ProjectDetailService>;
  let mockExtractCodeTool: jest.Mocked<ExtractCodeTool>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs for prompt file reading
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('Mock prompt content with {projectDetails} and {currentUserMessage} placeholders');

    mockLLMProviderService = {
      chat: jest.fn(),
    } as any;

    mockDataStore = {
      loadChatMessagesForSession: jest.fn(),
      loadAllCodeContextForSession: jest.fn(),
      saveCodeContext: jest.fn(),
      updateSession: jest.fn(),
    } as any;

    mockProjectDetailService = {
      getProjectDetails: jest.fn(),
    } as any;

    mockExtractCodeTool = {
      execute: jest.fn(),
    } as any;

    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool
    );
  });

  describe('analyzeUserIntent', () => {
    const mockChatHistory: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    const mockUserMessage: ChatMessage = {
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

    const mockProjectDetails = 'Test project details';

    it('should return SPEC_GENERATION for "create a spec" keyword', async () => {
      const messageWithSpec = { ...mockUserMessage, content: 'Please create a spec for user authentication' };
      
      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithSpec, mockProjectDetails);
      
      expect(result).toBe(UserIntentEnum.SPEC_GENERATION);
    });

    it('should return SPEC_GENERATION for "create specs" keyword', async () => {
      const messageWithSpecs = { ...mockUserMessage, content: 'I need to create specs for the new feature' };
      
      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithSpecs, mockProjectDetails);
      
      expect(result).toBe(UserIntentEnum.SPEC_GENERATION);
    });

    it('should be case-insensitive for keyword matching', async () => {
      const messageWithSpec = { ...mockUserMessage, content: 'CREATE A SPEC for the API' };
      
      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithSpec, mockProjectDetails);
      
      expect(result).toBe(UserIntentEnum.SPEC_GENERATION);
    });

    it('should call LLM when no keyword match is found', async () => {
      const messageWithoutSpec = { ...mockUserMessage, content: 'How does authentication work?' };
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'pure_discussion',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithoutSpec, mockProjectDetails);
      
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            ...mockChatHistory,
            expect.objectContaining({ role: 'user', content: messageWithoutSpec.content })
          ])
        })
      );
      expect(result).toBe(UserIntentEnum.PURE_DISCUSSION);
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      const messageWithoutSpec = { ...mockUserMessage, content: 'How does authentication work?' };
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'invalid_intent',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithoutSpec, mockProjectDetails);
      
      // Should default to PURE_DISCUSSION on parsing error
      expect(result).toBe(UserIntentEnum.PURE_DISCUSSION);
    });

    it('should handle LLM service errors gracefully', async () => {
      const messageWithoutSpec = { ...mockUserMessage, content: 'How does authentication work?' };
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error',
        error: 'LLM service unavailable'
      });

      const result = await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithoutSpec, mockProjectDetails);
      
      // Should default to PURE_DISCUSSION on LLM error
      expect(result).toBe(UserIntentEnum.PURE_DISCUSSION);
    });

    it('should read prompt from file and replace placeholders', async () => {
      const messageWithoutSpec = { ...mockUserMessage, content: 'How does authentication work?' };
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'pure_discussion',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      await samuraiAgent.analyzeUserIntent(mockChatHistory, messageWithoutSpec, 'Test project details');
      
      // Verify that the prompt file was read
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('intentAnalysis.md'),
        'utf-8'
      );
      
      // Verify that the LLM was called with the processed prompt
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Test project details')
            })
          ])
        })
      );
    });
  });

  describe('execute', () => {
    const mockSession: Session = {
      id: 'session-1',
      title: 'Test Session',
      status: SessionStatus.ACTIVE,
      messageCount: 1,
      totalTokens: 100,
      totalCost: 0.01,
      lastMessageAt: new Date(),
      tags: [],
      metadata: { projectId: 'project-1' },
      codeContextIds: ['context-1', 'context-2'],
      previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockUserMessage: ChatMessage = {
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

    const mockChatMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'Hello',
        role: 'user',
        metadata: {},
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const mockCodeContexts: ExtractCodeToolResultPayload[] = [
      {
        relevance_score: 0.9,
        context: 'Test context',
        file_path: 'test.ts',
        relevantCodeElements: []
      }
    ];

    it('should load all context and analyze intent successfully', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      expect(mockDataStore.loadChatMessagesForSession).toHaveBeenCalledWith('session-1');
      expect(mockProjectDetailService.getProjectDetails).toHaveBeenCalledWith('project-1');
      expect(mockDataStore.loadAllCodeContextForSession).toHaveBeenCalledWith('session-1', 'project-1');
      
      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({
        chatHistoryLength: 1,
        projectDetailsLength: 20,
        codeContextsCount: 2 // Original session has 2 context IDs
      });
    });

    it('should handle missing project details gracefully', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue(undefined);
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      expect(result.success).toBe(true);
      expect(result.metadata.projectDetailsLength).toBe(0);
    });

    it('should handle empty code context IDs', async () => {
      const sessionWithoutContext = { ...mockSession, codeContextIds: [] };
      
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');

      const result = await samuraiAgent.execute(mockUserMessage, sessionWithoutContext);

      expect(mockDataStore.loadAllCodeContextForSession).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.metadata.codeContextsCount).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockDataStore.loadChatMessagesForSession.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error processing message');
      expect(result.metadata.error).toContain('Database error');
    });

    it('should include code extraction analysis in result metadata', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);

      // Mock the LLM response for code extraction analysis
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": true, "extraction_query": "Find authentication code", "reasoning": "Need to understand auth implementation"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      expect(result.success).toBe(true);
      expect(result.metadata.codeExtractionAnalysis).toBeDefined();
      expect(result.metadata.codeExtractionAnalysis.new_code_context_necessary).toBe(true);
      expect(result.metadata.codeExtractionAnalysis.extraction_query).toBe("Find authentication code");
      expect(result.metadata.codeExtractionAnalysis.reasoning).toBe("Need to understand auth implementation");
    });

    it('should execute code extraction when necessary and save context', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);

      // Mock the LLM response for code extraction analysis indicating extraction is needed
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": true, "extraction_query": "Find authentication code", "reasoning": "Need to understand auth implementation"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Mock successful code extraction
      const mockExtractionResult = {
        success: true,
        result: {
          relevantCodeElements: [
            {
              path: 'auth.ts',
              elements: [
                { type: 'function', name: 'authenticateUser', lineStart: 10, lineEnd: 25, signature: 'authenticateUser(token: string): boolean' }
              ],
              snippet: 'export function authenticateUser(token: string): boolean { ... }'
            }
          ],
          analysis: {
            relevance_score: 0.9,
            context: 'Authentication function',
            file_path: 'auth.ts'
          },
          files: [
            { path: 'auth.ts', snippet: 'export function authenticateUser(token: string): boolean { ... }' }
          ]
        } as ExtractCodeToolResultPayload,
        executionTime: 500,
        metadata: {}
      };

      mockExtractCodeTool.execute.mockResolvedValue(mockExtractionResult);
      mockDataStore.saveCodeContext.mockResolvedValue('new-context-id');
      mockDataStore.updateSession.mockReturnValue({
        ...mockSession,
        codeContextIds: ['new-context-id'],
        updatedAt: new Date()
      });

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      // Verify code extraction was called with correct parameters
      expect(mockExtractCodeTool.execute).toHaveBeenCalledWith({
        query: "Find authentication code",
        filePathPattern: undefined,
        projectId: 'project-1',
        sessionId: 'session-1',
        connectedCodebasePath: undefined
      });

      // Verify code context was saved
      expect(mockDataStore.saveCodeContext).toHaveBeenCalledWith(
        mockExtractionResult.result,
        'project-1',
        'session-1'
      );

      // Verify session was updated with new context ID
      expect(mockDataStore.updateSession).toHaveBeenCalledWith('session-1', {
        codeContextIds: ['new-context-id']
      });

      expect(result.success).toBe(true);
      expect(result.metadata.codeContextsCount).toBe(1);
    });

    it('should not execute code extraction when not necessary', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);

      // Mock the LLM response for code extraction analysis indicating extraction is NOT needed
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": false, "extraction_query": null, "reasoning": "Existing context is sufficient"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await samuraiAgent.execute(mockUserMessage, mockSession);

      // Verify code extraction was NOT called
      expect(mockExtractCodeTool.execute).not.toHaveBeenCalled();
      expect(mockDataStore.saveCodeContext).not.toHaveBeenCalled();
      expect(mockDataStore.updateSession).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.metadata.codeContextsCount).toBe(1); // Loaded code contexts count (not session count)
    });

    it('should handle code extraction failures gracefully', async () => {
      mockDataStore.loadChatMessagesForSession.mockReturnValue(mockChatMessages);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);

      // Create a copy of the session to avoid modifying the original
      const sessionCopy = { ...mockSession, codeContextIds: [] };

      // Mock the LLM response for code extraction analysis indicating extraction is needed
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": true, "extraction_query": "Find authentication code", "reasoning": "Need to understand auth implementation"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Mock failed code extraction
      mockExtractCodeTool.execute.mockResolvedValue({
        success: false,
        error: 'Code extraction failed',
        executionTime: 500,
        metadata: {}
      });

      const result = await samuraiAgent.execute(mockUserMessage, sessionCopy);

      // Verify code extraction was called
      expect(mockExtractCodeTool.execute).toHaveBeenCalled();

      // Verify no context was saved or session updated
      expect(mockDataStore.saveCodeContext).not.toHaveBeenCalled();
      expect(mockDataStore.updateSession).not.toHaveBeenCalled();

      expect(result.success).toBe(true); // Overall execution should still succeed
      expect(result.metadata.codeContextsCount).toBe(0); // No existing context and extraction failed
    });
  });

  describe('analyzeCodeExtractionNeeds', () => {
    const mockChatHistory: LLMMessage[] = [
      { role: 'user', content: 'How does authentication work?' },
      { role: 'assistant', content: 'Authentication typically involves...' }
    ];

    const mockProjectDetails = 'Test project with authentication system';
    const mockSession: Session = {
      id: 'session-1',
      title: 'Test Session',
      status: SessionStatus.ACTIVE,
      messageCount: 2,
      totalTokens: 200,
      totalCost: 0.02,
      lastMessageAt: new Date(),
      tags: [],
      metadata: { projectId: 'project-1' },
      codeContextIds: ['context-1'],
      previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockCodeContexts: ExtractCodeToolResultPayload[] = [
      {
        relevance_score: 0.9,
        context: 'Authentication context',
        file_path: 'auth.ts',
        relevantCodeElements: [
          {
            path: 'auth.ts',
            elements: [
              { type: 'function', name: 'authenticateUser', lineStart: 10, lineEnd: 25, signature: 'authenticateUser(token: string): boolean' },
              { type: 'class', name: 'AuthService', lineStart: 1, lineEnd: 50, signature: 'class AuthService' }
            ],
            snippet: 'export class AuthService {\n  authenticateUser(token: string): boolean {\n    // implementation\n  }\n}'
          }
        ]
      }
    ];

    beforeEach(() => {
      // Mock fs for prompt file reading
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(`
        You are Samurai Engine's code context necessity expert.
        CONVERSATION CONTEXT: {conversationSummary}
        PROJECT CONTEXT: {projectDetails}
        USER INTENT: {userIntent}
        CURRENT USER MESSAGE: {currentUserMessage}
        EXISTING CODE CONTEXT: {existingCodeContext}
        Return JSON with new_code_context_necessary, extraction_query, and reasoning.
      `);
    });

    it('should analyze code extraction needs with existing context', async () => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": false, "extraction_query": null, "reasoning": "Existing context covers authentication implementation"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Access the private method through type assertion
      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result).toEqual({
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: "Existing context covers authentication implementation"
      });

      expect(mockDataStore.loadAllCodeContextForSession).toHaveBeenCalledWith('session-1', 'project-1');
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Test project with authentication system')
            })
          ])
        })
      );
    });

    it('should analyze code extraction needs without existing context', async () => {
      const sessionWithoutContext = { ...mockSession, codeContextIds: [] };
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": true, "extraction_query": "Find authentication implementation including login, token validation, and user management", "reasoning": "No existing context available for authentication questions"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        sessionWithoutContext,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result).toEqual({
        new_code_context_necessary: true,
        extraction_query: "Find authentication implementation including login, token validation, and user management",
        reasoning: "No existing context available for authentication questions"
      });

      expect(mockDataStore.loadAllCodeContextForSession).not.toHaveBeenCalled();
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: 'Invalid JSON response',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.new_code_context_necessary).toBe(false);
      expect(result.extraction_query).toBe(null);
      expect(result.reasoning).toContain('Error in code extraction analysis');
    });

    it('should handle LLM service errors gracefully', async () => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error',
        error: 'LLM service unavailable'
      });

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.new_code_context_necessary).toBe(false);
      expect(result.extraction_query).toBe(null);
      expect(result.reasoning).toContain('Error in code extraction analysis');
    });

    it('should handle data store errors gracefully', async () => {
      mockDataStore.loadAllCodeContextForSession.mockRejectedValue(new Error('Database connection failed'));

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.new_code_context_necessary).toBe(false);
      expect(result.extraction_query).toBe(null);
      expect(result.reasoning).toContain('Error in code extraction analysis');
    });

    it('should format existing code context correctly', async () => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue(mockCodeContexts);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": false, "extraction_query": null, "reasoning": "Context is sufficient"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      // Verify that the LLM was called with properly formatted context
      const llmCall = mockLLMProviderService.chat.mock.calls[0][0];
      const promptContent = llmCall.messages[0].content;
      
      expect(promptContent).toContain('## auth.ts');
      expect(promptContent).toContain('* function: authenticateUser');
      expect(promptContent).toContain('* class: AuthService');
      expect(promptContent).toContain('export class AuthService');
    });

    it('should build conversation summary from chat history', async () => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: '{"new_code_context_necessary": true, "extraction_query": "Find code", "reasoning": "Need context"}',
          requestId: 'test-request',
          provider: 'test',
          model: 'test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          cost: 0.01,
          processingTime: 100,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        mockChatHistory,
        mockProjectDetails,
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      // Verify that the LLM was called with conversation summary
      const llmCall = mockLLMProviderService.chat.mock.calls[0][0];
      const promptContent = llmCall.messages[0].content;
      
      expect(promptContent).toContain('User: How does authentication work?');
      expect(promptContent).toContain('Assistant: Authentication typically involves...');
    });
  });
});