/**
 * Integration tests for SamuraiAgent
 * Tests the end-to-end flow of the SamuraiAgent execution
 */

import { SamuraiAgent } from '../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../src/agent/llm/llmProviderService';
import { DataStore } from '../../src/persistence/dataStore';
import { ProjectDetailService } from '../../src/agent/memory/projectDetailService';
import { ExtractCodeTool } from '../../src/agent/tools/extractCodeTool';
import { CreateSpecTool } from '../../src/agent/tools/createSpecTool';
import { ChatMessage, Session, UserIntentEnum, MessageType, SessionStatus } from '../../src/common/models/chat-models';
import { AgentExecutionResult } from '../../src/agent/models/agent-models';
import { ExtractCodeToolResultPayload } from '../../src/common/models/tool-models';

// Mock dependencies
jest.mock('../../src/agent/llm/llmProviderService');
jest.mock('../../src/persistence/dataStore');
jest.mock('../../src/agent/memory/projectDetailService');
jest.mock('../../src/agent/tools/extractCodeTool');
jest.mock('../../src/agent/tools/createSpecTool');

describe('SamuraiAgent Integration Tests', () => {
  let samuraiAgent: SamuraiAgent;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockProjectDetailService: jest.Mocked<ProjectDetailService>;
  let mockExtractCodeTool: jest.Mocked<ExtractCodeTool>;
  let mockCreateSpecTool: jest.Mocked<CreateSpecTool>;

  beforeEach(() => {
    // Create mock instances
    mockLLMProviderService = new LLMProviderService({} as any, {} as any) as jest.Mocked<LLMProviderService>;
    mockDataStore = new DataStore('/test/path') as jest.Mocked<DataStore>;
    mockProjectDetailService = new ProjectDetailService({} as any, {} as any, '') as jest.Mocked<ProjectDetailService>;
    mockExtractCodeTool = new ExtractCodeTool({} as any, {} as any) as jest.Mocked<ExtractCodeTool>;
    mockCreateSpecTool = new CreateSpecTool({} as any) as jest.Mocked<CreateSpecTool>;

    // Create SamuraiAgent instance
    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool,
      mockCreateSpecTool
    );
  });

  describe('End-to-End Spec Generation Flow', () => {
    it('should complete full spec generation workflow', async () => {
      // Setup test data
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'Create a spec for user authentication system',
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

      // Mock chat history
      const chatHistory = [
        {
          role: 'user' as const,
          content: 'I need help with my project'
        },
        {
          role: 'assistant' as const,
          content: 'I can help you with your project. What do you need?'
        }
      ];

      // Mock data store responses
      mockDataStore.loadChatMessagesForSession.mockReturnValue([
        {
          id: 'msg-0',
          sessionId: 'session-1',
          projectId: 'project-1',
          type: MessageType.USER,
          content: 'I need help with my project',
          role: 'user',
          metadata: {},
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: {
          digestedProjectDetailContent: 'A web application with user management features'
        }
      });

      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockReturnValue(session);

      // Mock project detail service
      mockProjectDetailService.getProjectDetails.mockResolvedValue('A web application with user management features');

      // Mock code extraction analysis (no new context needed)
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: false,
            extraction_query: null,
            reasoning: 'No additional code context needed for spec generation'
          })
        },
        timestamp: new Date()
      });

      // Mock spec generation response
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify([
            {
              title: 'User Authentication System',
              description: 'Implement a secure user authentication system with login, registration, and password reset functionality'
            },
            {
              title: 'User Registration',
              description: 'Allow new users to create accounts with email verification'
            },
            {
              title: 'User Login',
              description: 'Enable existing users to log in with email and password'
            }
          ])
        },
        timestamp: new Date()
      });

      // Mock spec creation
      mockCreateSpecTool.execute.mockResolvedValue({
        success: true,
        result: {
          id: 'spec-1',
          title: 'User Authentication System',
          spec: 'Implement a secure user authentication system with login, registration, and password reset functionality',
          status: 'pending',
          priority: 'medium',
          isCompleted: false,
          depth: 1,
          parentSpecId: null,
          hasSubspecs: true,
          tags: [],
          dependencies: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        },
        executionTime: 100,
        metadata: {}
      });

      // Execute the agent
      const result = await samuraiAgent.execute(userMessage, session);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.message).toContain('generated and created');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.userIntent).toBe(UserIntentEnum.SPEC_GENERATION);

      // Verify that the spec creation tool was called
      expect(mockCreateSpecTool.execute).toHaveBeenCalled();
    });

    it('should handle code extraction when needed', async () => {
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'Create a spec for the existing user service',
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

      // Mock data store responses
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: {
          digestedProjectDetailContent: 'A web application with existing user service'
        }
      });
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockDataStore.updateSession.mockReturnValue(session);
      mockDataStore.saveCodeContext.mockResolvedValue('context-1');

      // Mock project detail service
      mockProjectDetailService.getProjectDetails.mockResolvedValue('A web application with existing user service');

      // Mock code extraction analysis (new context needed)
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: true,
            extraction_query: 'Find user service implementation and related authentication code',
            reasoning: 'Need to understand existing user service to create accurate specs'
          })
        },
        timestamp: new Date()
      });

      // Mock code extraction tool
      const mockCodeContext: ExtractCodeToolResultPayload = {
        relevantCodeElements: [
          {
            path: 'src/services/userService.ts',
            elements: [
              {
                name: 'UserService',
                type: 'class',
                lineStart: 1,
                lineEnd: 50,
                filePath: 'src/services/userService.ts',
                signature: 'class UserService'
              }
            ],
            snippet: 'class UserService { ... }'
          }
        ]
      };

      mockExtractCodeTool.execute.mockResolvedValue({
        success: true,
        result: mockCodeContext,
        executionTime: 200,
        metadata: {}
      });

      // Mock spec generation response
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify([
            {
              title: 'User Service Enhancement',
              description: 'Enhance the existing user service with additional features'
            }
          ])
        },
        timestamp: new Date()
      });

      // Mock spec creation
      mockCreateSpecTool.execute.mockResolvedValue({
        success: true,
        result: {
          id: 'spec-1',
          title: 'User Service Enhancement',
          spec: 'Enhance the existing user service with additional features',
          status: 'pending',
          priority: 'medium',
          isCompleted: false,
          depth: 1,
          parentSpecId: null,
          hasSubspecs: false,
          tags: [],
          dependencies: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        },
        executionTime: 100,
        metadata: {}
      });

      // Execute the agent
      const result = await samuraiAgent.execute(userMessage, session);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.metadata.codeExtractionAnalysis.new_code_context_necessary).toBe(true);

      // Verify that code extraction was performed
      expect(mockExtractCodeTool.execute).toHaveBeenCalledWith({
        query: 'Find user service implementation and related authentication code',
        filePathPattern: undefined,
        projectId: 'project-1',
        sessionId: 'session-1',
        connectedCodebasePath: undefined
      });

      // Verify that code context was saved
      expect(mockDataStore.saveCodeContext).toHaveBeenCalledWith(
        mockCodeContext,
        'project-1',
        'session-1'
      );
    });
  });

  describe('SPEC_CLARIFICATION Intent Flow', () => {
    it('should process SPEC_CLARIFICATION intent and return score with interactive button', async () => {
      const userMessage: ChatMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'I want to build a user authentication feature',
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

      // Mock empty chat history
      mockDataStore.loadChatMessagesForSession.mockReturnValue([]);
      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');

      // Mock intent analysis to return SPEC_CLARIFICATION
      mockLLMProviderService.chat
        .mockResolvedValueOnce({
          type: 'success',
          payload: {
            content: 'spec_clarification'
          }
        })
        // Mock code extraction analysis to return no new code needed
        .mockResolvedValueOnce({
          type: 'success',
          payload: {
            content: JSON.stringify({
              new_code_context_necessary: false,
              extraction_query: null,
              reasoning: 'No code extraction needed'
            })
          }
        })
        // Mock spec clarification response
        .mockResolvedValueOnce({
          type: 'success',
          payload: {
            content: JSON.stringify({
              clarification_text: 'Please clarify the following:\n1. What authentication method? (OAuth, JWT, etc.)\n2. Password requirements?\n3. Multi-factor authentication needed?',
              score: 45
            })
          }
        });

      mockDataStore.updateSession.mockResolvedValue(session);

      // Execute the agent
      const result = await samuraiAgent.execute(userMessage, session);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.message).toContain('Please clarify the following');
      expect(result.metadata.userIntent).toBe(UserIntentEnum.SPEC_CLARIFICATION);
      expect(result.metadata.specClarificationData).toEqual({
        clarification_text: expect.any(String),
        score: 45
      });
      expect(result.metadata.interactiveQuestions).toEqual([{
        type: 'button',
        label: 'Create specs for the tasks we discussed; AI will resolve any ambiguity.',
        messageToSend: 'Create specs for the tasks we discussed'
      }]);
    });

    it('should handle button click to trigger SPEC_GENERATION', async () => {
      const buttonClickMessage: ChatMessage = {
        id: 'msg-2',
        sessionId: 'session-1',
        projectId: 'project-1',
        type: MessageType.USER,
        content: 'Create specs now',
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
        messageCount: 2,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'project-1'
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.SPEC_CLARIFICATION,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock chat history with previous clarification
      mockDataStore.loadChatMessagesForSession.mockReturnValue([
        {
          id: 'msg-0',
          sessionId: 'session-1',
          projectId: 'project-1',
          type: MessageType.USER,
          content: 'I want to build a user authentication feature',
          role: 'user',
          metadata: {},
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'msg-1',
          sessionId: 'session-1',
          projectId: 'project-1',
          type: MessageType.ASSISTANT,
          content: 'Please clarify...',
          role: 'assistant',
          metadata: {},
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          specClarificationData: {
            clarification_text: 'Please clarify...',
            score: 45
          }
        }
      ]);

      mockDataStore.loadAllCodeContextForSession.mockResolvedValue([]);
      mockProjectDetailService.getProjectDetails.mockResolvedValue('Test project details');

      // Mock code extraction analysis response (no code extraction needed)
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify({
            new_code_context_necessary: false,
            extraction_query: null,
            reasoning: 'No code extraction needed'
          })
        }
      });

      // Mock spec generation LLM response
      mockLLMProviderService.chat.mockResolvedValueOnce({
        type: 'success',
        payload: {
          content: JSON.stringify([
            {
              title: 'User Authentication',
              description: 'Implement JWT-based authentication'
            }
          ])
        }
      });

      // Mock spec creation
      mockCreateSpecTool.execute.mockResolvedValue({
        success: true,
        result: {
          id: 'spec-1',
          title: 'User Authentication',
          description: 'Implement JWT-based authentication'
        }
      });

      mockDataStore.updateSession.mockResolvedValue(session);

      // Execute the agent (note: keyword "Create specs now" should trigger SPEC_GENERATION)
      const result = await samuraiAgent.execute(buttonClickMessage, session);

      // Verify SPEC_GENERATION was triggered
      expect(result.success).toBe(true);
      expect(result.message).toContain("I've generated and created");
      expect(mockCreateSpecTool.execute).toHaveBeenCalled();
    });
  });
});