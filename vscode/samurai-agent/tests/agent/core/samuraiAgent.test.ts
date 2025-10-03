import { SamuraiAgent } from '../../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../../../src/agent/memory/projectDetailService';
import { DataStore } from '../../../src/persistence/dataStore';
import { ExtractCodeTool } from '../../../src/agent/tools/extractCodeTool';
import { CreateSpecTool } from '../../../src/agent/tools/createSpecTool';
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
  let mockCreateSpecTool: jest.Mocked<CreateSpecTool>;

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

    mockCreateSpecTool = {
      execute: jest.fn(),
    } as any;

    // Create SamuraiAgent instance
    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool,
      mockCreateSpecTool
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

  describe('detectCodeExtractionKeyword', () => {
    it('should detect exact keyword match (case insensitive)', () => {
      const testCases = [
        'please read the latest code',
        'Please read the latest code',
        'PLEASE READ THE LATEST CODE',
        'Please Read The Latest Code'
      ];

      testCases.forEach(message => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(true);
      });
    });

    it('should detect keyword when embedded in larger message', () => {
      const testCases = [
        'Can you please read the latest code and summarize it?',
        'I need you to please read the latest code for me.',
        'Please read the latest code. Thanks!',
        'Hello, please read the latest code and let me know what you find.'
      ];

      testCases.forEach(message => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(true);
      });
    });

    it('should NOT detect keyword when words are inserted within the phrase', () => {
      const testCases = [
        'please read the new latest code',
        'please read the updated latest code',
        'please read the most recent latest code',
        'please read the very latest code'
      ];

      testCases.forEach(message => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(false);
      });
    });

    it('should NOT detect keyword when it is part of a larger word', () => {
      const testCases = [
        'please read the latest codebook',
        'please read the latest codebase',
        'please read the latest codenames',
        'please read the latest coders'
      ];

      testCases.forEach(message => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(false);
      });
    });

    it('should NOT detect keyword when it is absent from the message', () => {
      const testCases = [
        'please read the code',
        'read the latest code',
        'please read latest code',
        'please read the code latest',
        'hello world',
        'what is the weather like?'
      ];

      testCases.forEach(message => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(false);
      });
    });

    it('should handle edge cases gracefully', () => {
      const testCases = [
        '',
        null as any,
        undefined as any,
        '   ',
        'please read the latest code   ',
        '   please read the latest code'
      ];

      // Only the last two should return true (whitespace trimmed)
      const expectedResults = [false, false, false, false, true, true];

      testCases.forEach((message, index) => {
        const result = (samuraiAgent as any).detectCodeExtractionKeyword(message);
        expect(result).toBe(expectedResults[index]);
      });
    });
  });

  describe('analyzeCodeExtractionNeeds', () => {
    const mockSession: Session = {
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

    beforeEach(() => {
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
    });

    it('should bypass LLM call and return true when keyword is detected', async () => {
      const chatHistory: LLMMessage[] = [
        { role: 'user', content: 'Please read the latest code and summarize it' }
      ];

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        chatHistory,
        'Test project details',
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result).toEqual({
        new_code_context_necessary: true,
        extraction_query: 'Please read the latest code and summarize it',
        reasoning: "Keyword 'Please read the latest code' detected in user message - bypassing LLM analysis"
      });

      // Verify LLM was not called
      expect(mockLLMProviderService.chat).not.toHaveBeenCalled();
    });

    it('should use original user message as extraction_query when keyword detected', async () => {
      const originalMessage = 'Can you please read the latest code and tell me about the main functions?';
      const chatHistory: LLMMessage[] = [
        { role: 'user', content: originalMessage }
      ];

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        chatHistory,
        'Test project details',
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.extraction_query).toBe(originalMessage);
      expect(result.new_code_context_necessary).toBe(true);
    });

    it('should proceed with normal LLM analysis when keyword is not detected', async () => {
      const chatHistory: LLMMessage[] = [
        { role: 'user', content: 'What is the weather like today?' }
      ];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: false,
            extraction_query: null,
            reasoning: 'No code context needed for weather question'
          })
        }
      } as any);

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        chatHistory,
        'Test project details',
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result).toEqual({
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: 'No code context needed for weather question'
      });

      // Verify LLM was called
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ type: 'code_extraction_analysis' })
        })
      );
    });

    it('should handle case variations of the keyword correctly', async () => {
      const testCases = [
        'please read the latest code',
        'Please read the latest code',
        'PLEASE READ THE LATEST CODE',
        'Please Read The Latest Code'
      ];

      for (const testMessage of testCases) {
        const chatHistory: LLMMessage[] = [
          { role: 'user', content: testMessage }
        ];

        const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
          chatHistory,
          'Test project details',
          mockSession,
          UserIntentEnum.PURE_DISCUSSION
        );

        expect(result.new_code_context_necessary).toBe(true);
        expect(result.extraction_query).toBe(testMessage);
        expect(result.reasoning).toContain("Keyword 'Please read the latest code' detected");
      }
    });

    it('should not detect keyword when words are inserted within the phrase', async () => {
      const chatHistory: LLMMessage[] = [
        { role: 'user', content: 'please read the new latest code' }
      ];

      // Mock LLM response since keyword should not be detected
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: false,
            extraction_query: null,
            reasoning: 'No extraction needed'
          })
        }
      } as any);

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        chatHistory,
        'Test project details',
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.new_code_context_necessary).toBe(false);
      expect(mockLLMProviderService.chat).toHaveBeenCalled();
    });

    it('should handle empty chat history gracefully', async () => {
      const chatHistory: LLMMessage[] = [];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: false,
            extraction_query: null,
            reasoning: 'No current message available'
          })
        }
      } as any);

      const result = await (samuraiAgent as any).analyzeCodeExtractionNeeds(
        chatHistory,
        'Test project details',
        mockSession,
        UserIntentEnum.PURE_DISCUSSION
      );

      expect(result.new_code_context_necessary).toBe(false);
      expect(mockLLMProviderService.chat).toHaveBeenCalled();
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

  describe('handleSpecClarification', () => {
    it('should handle spec clarification successfully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'I want to clarify the authentication requirements',
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
          content: JSON.stringify({
            clarification_text: 'I understand you want to clarify authentication requirements. Let me ask some specific questions to help you define this clearly.',
            score: 70
          }),
          role: 'assistant'
        }
      } as any);

      const result = await samuraiAgent.handleSpecClarification(
        userMessage,
        chatHistory,
        projectDetails,
        codeContexts
      );

      expect(result).toEqual({
        clarification_text: 'I understand you want to clarify authentication requirements. Let me ask some specific questions to help you define this clearly.',
        score: 70
      });
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ type: 'spec_clarification' })
        })
      );
    });

    it('should handle LLM errors gracefully', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'I want to clarify the authentication requirements',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        isEdited: false
      };

      const chatHistory: LLMMessage[] = [];
      const projectDetails = 'Test project details';
      const codeContexts: ExtractCodeToolResultPayload[] = [];

      // Mock LLM error
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error',
        error: 'LLM service unavailable'
      } as any);

      const result = await samuraiAgent.handleSpecClarification(
        userMessage,
        chatHistory,
        projectDetails,
        codeContexts
      );

      expect(result).toEqual({
        clarification_text: "I'm here to help clarify your specifications! What would you like to specify?",
        score: 0
      });
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

      // Mock LLM response for intent analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: 'pure_discussion' }
      } as any);

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

      // Mock LLM response for intent analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: 'feature_exploration' }
      } as any);

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

    it('should dispatch to handleSpecClarification for SPEC_CLARIFICATION intent', async () => {
      const userMessage: ChatMessage = {
        id: 'msg1',
        sessionId: 'session1',
        projectId: 'project1',
        type: 'user' as any,
        content: 'I want to clarify the authentication requirements',
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
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          projectId: 'project1',
          connectedCodebasePath: '/test/path'
        },
        codeContextIds: []
      };

      // Mock dependencies
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Project details');
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockResolvedValue(undefined);

      // Mock LLM response for intent analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: 'spec_clarification' }
      } as any);

      // Mock LLM response for code extraction analysis
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: JSON.stringify({ new_code_context_necessary: false, extraction_query: null, reasoning: 'No extraction needed' }) }
      } as any);

      // Mock LLM response for spec clarification
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { 
          content: JSON.stringify({
            clarification_text: 'I understand you want to clarify authentication requirements. Let me ask some specific questions to help you define this clearly.',
            score: 60
          })
        }
      } as any);

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toBe('I understand you want to clarify authentication requirements. Let me ask some specific questions to help you define this clearly.');
      expect(result.metadata.specClarificationData).toEqual({
        clarification_text: 'I understand you want to clarify authentication requirements. Let me ask some specific questions to help you define this clearly.',
        score: 60
      });
      expect(result.metadata.interactiveQuestions).toEqual([{
        type: 'button',
        label: 'Create specs for the tasks we discussed; AI will resolve any ambiguity.',
        messageToSend: 'Create specs for the tasks we discussed'
      }]);
      expect(mockDataStore.updateSession).toHaveBeenCalledWith('session1', {
        messageCount: 2,
        previous_session_intent: UserIntentEnum.SPEC_CLARIFICATION
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

      // Mock LLM response for spec generation
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: { content: JSON.stringify([{ title: 'Test Spec', description: 'Test description', parent_spec_id: null }]) }
      } as any);

      // Mock CreateSpecTool response
      mockCreateSpecTool.execute.mockResolvedValue({
        success: true,
        result: { id: 'spec-1', title: 'Test Spec', spec: 'Test description' },
        executionTime: 100,
        metadata: { specId: 'spec-1' }
      });

      const result = await samuraiAgent.execute(userMessage, session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Perfect! I\'ve generated and created 1 specs');
      expect(mockCreateSpecTool.execute).toHaveBeenCalledWith({
        title: 'Test Spec',
        description: 'Test description',
        parentSpecId: undefined,
        depth: 1
      });
    });
  });

  describe('handleGeneratingSpecs', () => {
    const userMessage: ChatMessage = {
      id: 'msg-1',
      content: 'Create a spec for user authentication',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const chatHistory: LLMMessage[] = [
      { role: 'user', content: 'I need help with authentication' },
      { role: 'assistant', content: 'I can help you with that' }
    ];

    const projectDetails = 'Test project with authentication needs';
    const codeContexts: ExtractCodeToolResultPayload[] = [];

    beforeEach(() => {
      // Mock fs.readFileSync for spec generation prompt
      mockedFs.readFileSync.mockReturnValue('Mock spec generation prompt with {currentUserMessage} and {activeTaskId}');
    });

    it('should successfully generate and create specs', async () => {
      const mockSpecs = [
        { title: 'Implement Login Form', description: 'Create login form component', parent_spec_id: null },
        { title: 'Add Authentication API', description: 'Create authentication endpoints', parent_spec_id: null }
      ];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: JSON.stringify(mockSpecs) }
      } as any);

      // Mock CreateSpecTool responses
      mockCreateSpecTool.execute
        .mockResolvedValueOnce({
          success: true,
          result: { id: 'spec-1', title: 'Implement Login Form', spec: 'Create login form component' },
          executionTime: 100,
          metadata: { specId: 'spec-1' }
        })
        .mockResolvedValueOnce({
          success: true,
          result: { id: 'spec-2', title: 'Add Authentication API', spec: 'Create authentication endpoints' },
          executionTime: 100,
          metadata: { specId: 'spec-2' }
        });

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Perfect! I\'ve generated and created 2 specs');
      expect(result.message).toContain('1. Implement Login Form');
      expect(result.message).toContain('2. Add Authentication API');
      expect(mockCreateSpecTool.execute).toHaveBeenCalledTimes(2);
      expect(result.metadata.createdSpecsCount).toBe(2);
    });

    it('should handle parent-child spec relationships', async () => {
      const mockSpecs = [
        { title: 'User Authentication System', description: 'Main authentication system', parent_spec_id: null },
        { title: 'Login Component', description: 'Login form component', parent_spec_id: 'spec-1' },
        { title: 'Register Component', description: 'Registration form component', parent_spec_id: 'spec-1' }
      ];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: JSON.stringify(mockSpecs) }
      } as any);

      // Mock CreateSpecTool responses
      mockCreateSpecTool.execute
        .mockResolvedValueOnce({
          success: true,
          result: { id: 'spec-1', title: 'User Authentication System', spec: 'Main authentication system' },
          executionTime: 100,
          metadata: { specId: 'spec-1' }
        })
        .mockResolvedValueOnce({
          success: true,
          result: { id: 'spec-2', title: 'Login Component', spec: 'Login form component' },
          executionTime: 100,
          metadata: { specId: 'spec-2' }
        })
        .mockResolvedValueOnce({
          success: true,
          result: { id: 'spec-3', title: 'Register Component', spec: 'Registration form component' },
          executionTime: 100,
          metadata: { specId: 'spec-3' }
        });

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(true);
      expect(mockCreateSpecTool.execute).toHaveBeenCalledTimes(3);
      
      // Check that child specs are created with correct parent IDs
      expect(mockCreateSpecTool.execute).toHaveBeenNthCalledWith(1, {
        title: 'User Authentication System',
        description: 'Main authentication system',
        parentSpecId: undefined,
        depth: 1
      });
      expect(mockCreateSpecTool.execute).toHaveBeenNthCalledWith(2, {
        title: 'Login Component',
        description: 'Login form component',
        parentSpecId: 'spec-1',
        depth: 2
      });
      expect(mockCreateSpecTool.execute).toHaveBeenNthCalledWith(3, {
        title: 'Register Component',
        description: 'Registration form component',
        parentSpecId: 'spec-1',
        depth: 2
      });
    });

    it('should handle LLM response errors', async () => {
      // Mock LLM error response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error',
        error: 'LLM request failed'
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error generating specs');
      expect(result.message).toContain('LLM request failed');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });

    it('should handle CreateSpecTool errors gracefully', async () => {
      const mockSpecs = [
        { title: 'Test Spec', description: 'Test description', parent_spec_id: null }
      ];

      // Mock LLM response
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: JSON.stringify(mockSpecs) }
      } as any);

      // Mock CreateSpecTool error
      mockCreateSpecTool.execute.mockResolvedValue({
        success: false,
        error: 'Failed to save spec',
        executionTime: 100,
        metadata: {}
      });

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('I encountered issues creating the specs');
      expect(result.message).toContain('Failed to save spec');
      expect(result.metadata.errorsCount).toBe(1);
    });

    it('should handle invalid JSON response from LLM', async () => {
      // Mock LLM response with invalid JSON
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: 'Invalid JSON response' }
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error generating specs: Failed to parse JSON response');
      expect(result.message).toContain('LLM output');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });

    it('should handle empty specs array from LLM', async () => {
      // Mock LLM response with empty array
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: JSON.stringify([]) }
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('I encountered issues creating the specs');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });

    it('should handle empty response from LLM', async () => {
      // Mock LLM response with empty content
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: '' }
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error generating specs: LLM returned an empty response');
      expect(result.message).toContain('LLM service timeout or rate limiting');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });

    it('should handle very short response from LLM', async () => {
      // Mock LLM response with very short content
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: 'Error' }
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error generating specs: LLM returned a very short response');
      expect(result.message).toContain('"Error"');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });

    it('should handle non-JSON response from LLM', async () => {
      // Mock LLM response with non-JSON content
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: { content: 'This is not JSON format' }
      } as any);

      const result = await samuraiAgent.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error generating specs: LLM response doesn\'t contain JSON format');
      expect(result.message).toContain('This is not JSON format');
      expect(mockCreateSpecTool.execute).not.toHaveBeenCalled();
    });
  });

  describe('handleSpecClarification', () => {
    const mockUserMessage: ChatMessage = {
      id: 'user-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      type: 'user' as any,
      content: 'I want to build a login feature',
      role: 'user',
      metadata: {},
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockChatHistory: LLMMessage[] = [
      { role: 'user', content: 'Previous message' },
      { role: 'assistant', content: 'Previous response' }
    ];

    beforeEach(() => {
      // Mock the prompt file content
      mockedFs.readFileSync.mockReturnValue(
        'Mock prompt with {projectDetails} and {codeContexts} and {conversationSummary} and {activeTaskHeader} and {noActiveTaskInference}'
      );
    });

    it('should successfully parse JSON response with clarification_text and score', async () => {
      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: JSON.stringify({
            clarification_text: 'Please clarify the authentication method',
            score: 65
          })
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      expect(result).toEqual({
        clarification_text: 'Please clarify the authentication method',
        score: 65
      });
      expect(mockLLMProviderService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { type: 'spec_clarification' }
        })
      );
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: '```json\n{"clarification_text": "What database will you use?", "score": 50}\n```'
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      expect(result.clarification_text).toBe('What database will you use?');
      expect(result.score).toBe(50);
    });

    it('should validate score is within 0-100 range', async () => {
      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: JSON.stringify({
            clarification_text: 'Invalid score test',
            score: 150
          })
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      // Should return fallback response with score 0
      expect(result.score).toBe(0);
      expect(result.clarification_text).toBe("I'm here to help clarify your specifications! What would you like to specify?");
    });

    it('should handle missing required fields in JSON', async () => {
      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: JSON.stringify({
            clarification_text: 'Missing score field'
          })
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      // Should return fallback response
      expect(result.score).toBe(0);
      expect(result.clarification_text).toBe("I'm here to help clarify your specifications! What would you like to specify?");
    });

    it('should handle LLM request failure', async () => {
      mockLLMProviderService.chat.mockResolvedValue({
        type: 'error' as const,
        error: 'LLM service unavailable'
      });

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      // Should return fallback response
      expect(result.score).toBe(0);
      expect(result.clarification_text).toBe("I'm here to help clarify your specifications! What would you like to specify?");
    });

    it('should handle malformed JSON response', async () => {
      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: 'This is not JSON at all'
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      const result = await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        []
      );

      // Should return fallback response
      expect(result.score).toBe(0);
      expect(result.clarification_text).toBe("I'm here to help clarify your specifications! What would you like to specify?");
    });

    it('should correctly format code contexts and conversation summary in prompt', async () => {
      const mockCodeContexts: ExtractCodeToolResultPayload[] = [{
        relevantCodeElements: [{
          path: '/test/file.ts',
          elements: [{ type: 'function', name: 'testFunc', startLine: 1, endLine: 10 }],
          snippet: 'function testFunc() {}'
        }],
        query: 'test query'
      }];

      const mockLLMResponse = {
        type: 'success' as const,
        payload: {
          content: JSON.stringify({
            clarification_text: 'Test response',
            score: 75
          })
        }
      };

      mockLLMProviderService.chat.mockResolvedValue(mockLLMResponse);

      await samuraiAgent.handleSpecClarification(
        mockUserMessage,
        mockChatHistory,
        'Project details',
        mockCodeContexts
      );

      const chatCall = mockLLMProviderService.chat.mock.calls[0][0];
      const systemPrompt = chatCall.messages[0].content;

      // Should include formatted code contexts and conversation summary
      expect(systemPrompt).toContain('Project details');
      expect(chatCall.messages).toHaveLength(mockChatHistory.length + 3); // system + system2 + history + user
    });
  });
});
