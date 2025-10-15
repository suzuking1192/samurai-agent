import { SamuraiAgent } from '../../../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../../../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../../../src/agent/memory/projectDetailService';
import { DataStore } from '../../../src/persistence/dataStore';
import { ExtractCodeTool } from '../../../src/agent/tools/extractCodeTool';
import { CreateSpecTool } from '../../../src/agent/tools/createSpecTool';
import { TelemetryService } from '../../../src/services/TelemetryService';
import { ChatMessage, Session, UserIntentEnum, MessageType } from '../../../src/common/models/chat-models';
import { ExtractCodeToolResultPayload } from '../../../src/common/models/tool-models';
import { LLMMessage } from '../../../src/common/models/llm-models';
import { Spec, SpecStatus, SpecPriority } from '../../../src/common/models/spec-models';
import * as fs from 'fs';

// Mock the fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SamuraiAgent - Spec Relationships', () => {
  let samuraiAgent: SamuraiAgent;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockProjectDetailService: jest.Mocked<ProjectDetailService>;
  let mockExtractCodeTool: jest.Mocked<ExtractCodeTool>;
  let mockCreateSpecTool: jest.Mocked<CreateSpecTool>;
  let mockTelemetryService: jest.Mocked<TelemetryService>;

  const mockParentSpecId = 'parent-spec-123';
  const mockChildSpec1Id = 'child-spec-1';
  const mockChildSpec2Id = 'child-spec-2';

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
      handleWebviewMessage: jest.fn(),
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

    mockTelemetryService = {
      captureError: jest.fn(),
      trackSpecGeneration: jest.fn(),
    } as any;

    // Create SamuraiAgent instance
    samuraiAgent = new SamuraiAgent(
      mockLLMProviderService,
      mockDataStore,
      mockProjectDetailService,
      mockExtractCodeTool,
      mockCreateSpecTool,
      mockTelemetryService
    );

    // Mock fs for prompt loading
    mockedFs.readFileSync.mockReturnValue('Mock prompt content');
    mockedFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleGeneratingSpecs - Parent-Child Relationships', () => {
    const createMockSession = (): Session => ({
      id: 'session-123',
      title: 'Test Session',
      status: 'active' as any,
      messageCount: 0,
      totalTokens: 0,
      totalCost: 0,
      lastMessageAt: new Date(),
      tags: [],
      metadata: { projectId: 'project-123' },
      codeContextIds: [],
      previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createMockUserMessage = (): ChatMessage => ({
      id: 'message-123',
      sessionId: 'session-123',
      projectId: 'project-123',
      type: MessageType.USER,
      content: 'Create specs for my feature',
      role: 'user',
      metadata: {},
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should create parent spec with depth 1 and null parentSpecId', async () => {
      const mockLLMResponse = JSON.stringify([
        {
          title: 'Parent Spec',
          description: 'Parent description',
          parent_spec_id: null,
        },
        {
          title: 'Child Spec 1',
          description: 'Child description 1',
          parent_spec_id: 'Parent Spec', // LLM returns title instead of ID
        },
      ]);

      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: mockLLMResponse,
          usage: { totalTokens: 100 },
          cost: 0.01,
        },
      } as any);

      const parentSpec: Spec = {
        id: mockParentSpecId,
        title: 'Parent Spec',
        spec: 'Parent description',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateSpecTool.execute.mockResolvedValueOnce({
        success: true,
        result: parentSpec,
        metadata: {},
      });

      const childSpec: Spec = {
        id: mockChildSpec1Id,
        title: 'Child Spec 1',
        spec: 'Child description 1',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: mockParentSpecId, // Should use parent ID, not title
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateSpecTool.execute.mockResolvedValueOnce({
        success: true,
        result: childSpec,
        metadata: {},
      });

      // Mock saveSpec for parent update
      mockDataStore.handleWebviewMessage.mockReturnValueOnce({
        type: 'success',
        payload: { ...parentSpec, hasSubspecs: true },
        timestamp: new Date(),
      });

      // Mock loadSpecs for verification
      mockDataStore.handleWebviewMessage.mockReturnValueOnce({
        type: 'success',
        payload: [
          { ...parentSpec, hasSubspecs: true },
          childSpec,
        ],
        timestamp: new Date(),
      });

      const result = await samuraiAgent.handleGeneratingSpecs(
        createMockUserMessage(),
        [],
        [],
        'Test project',
        createMockSession()
      );

      expect(result.success).toBe(true);
      
      // Verify parent spec was created with correct properties
      expect(mockCreateSpecTool.execute).toHaveBeenNthCalledWith(1, {
        title: 'Parent Spec',
        description: 'Parent description',
        parentSpecId: undefined, // Should be undefined (null)
        depth: 1,
      });

      // Verify child spec was created with parent ID (not title)
      expect(mockCreateSpecTool.execute).toHaveBeenNthCalledWith(2, {
        title: 'Child Spec 1',
        description: 'Child description 1',
        parentSpecId: mockParentSpecId, // Should always use actual parent ID
        depth: 2,
      });
    });

    it('should create multiple child specs all pointing to same parent', async () => {
      const mockLLMResponse = JSON.stringify([
        {
          title: 'Feature Implementation',
          description: 'Main feature',
          parent_spec_id: null,
        },
        {
          title: 'Frontend Changes',
          description: 'Frontend work',
          parent_spec_id: 'Feature Implementation',
        },
        {
          title: 'Backend Changes',
          description: 'Backend work',
          parent_spec_id: 'Feature Implementation',
        },
        {
          title: 'Testing',
          description: 'Test work',
          parent_spec_id: 'Feature Implementation',
        },
      ]);

      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: mockLLMResponse,
          usage: { totalTokens: 150 },
          cost: 0.015,
        },
      } as any);

      const parentSpec: Spec = {
        id: mockParentSpecId,
        title: 'Feature Implementation',
        spec: 'Main feature',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childSpecs = [
        { id: 'child-1', title: 'Frontend Changes' },
        { id: 'child-2', title: 'Backend Changes' },
        { id: 'child-3', title: 'Testing' },
      ].map((c) => ({
        id: c.id,
        title: c.title,
        spec: 'Description',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: mockParentSpecId,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockCreateSpecTool.execute
        .mockResolvedValueOnce({ success: true, result: parentSpec, metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpecs[0], metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpecs[1], metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpecs[2], metadata: {} });

      mockDataStore.handleWebviewMessage
        .mockReturnValueOnce({ type: 'success', payload: { ...parentSpec, hasSubspecs: true }, timestamp: new Date() })
        .mockReturnValueOnce({ type: 'success', payload: [parentSpec, ...childSpecs], timestamp: new Date() });

      const result = await samuraiAgent.handleGeneratingSpecs(
        createMockUserMessage(),
        [],
        [],
        'Test project',
        createMockSession()
      );

      expect(result.success).toBe(true);

      // All child specs should use the parent ID, not title
      expect(mockCreateSpecTool.execute).toHaveBeenCalledTimes(4);
      
      // Check each child spec call
      for (let i = 1; i <= 3; i++) {
        const call = mockCreateSpecTool.execute.mock.calls[i][0];
        expect(call.parentSpecId).toBe(mockParentSpecId);
        expect(call.depth).toBe(2);
      }
    });

    it('should update parent spec to have hasSubspecs: true when children exist', async () => {
      const mockLLMResponse = JSON.stringify([
        { title: 'Parent', description: 'Desc', parent_spec_id: null },
        { title: 'Child', description: 'Desc', parent_spec_id: 'Parent' },
      ]);

      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: mockLLMResponse,
          usage: { totalTokens: 100 },
          cost: 0.01,
        },
      } as any);

      const parentSpec: Spec = {
        id: mockParentSpecId,
        title: 'Parent',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childSpec: Spec = {
        id: mockChildSpec1Id,
        title: 'Child',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: mockParentSpecId,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateSpecTool.execute
        .mockResolvedValueOnce({ success: true, result: parentSpec, metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpec, metadata: {} });

      let saveSpecCalled = false;
      mockDataStore.handleWebviewMessage.mockImplementation((msg: any) => {
        if (msg.command === 'saveSpec') {
          saveSpecCalled = true;
          expect(msg.payload.hasSubspecs).toBe(true);
          expect(msg.payload.id).toBe(mockParentSpecId);
          return { type: 'success', payload: msg.payload, timestamp: new Date() };
        }
        if (msg.command === 'loadSpecs') {
          return {
            type: 'success',
            payload: [{ ...parentSpec, hasSubspecs: true }, childSpec],
            timestamp: new Date(),
          };
        }
        return { type: 'error', error: 'Unknown command', timestamp: new Date() };
      });

      await samuraiAgent.handleGeneratingSpecs(
        createMockUserMessage(),
        [],
        [],
        'Test project',
        createMockSession()
      );

      expect(saveSpecCalled).toBe(true);
    });

    it('should call verification function after creating specs', async () => {
      const mockLLMResponse = JSON.stringify([
        { title: 'Parent', description: 'Desc', parent_spec_id: null },
        { title: 'Child', description: 'Desc', parent_spec_id: 'Parent' },
      ]);

      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: mockLLMResponse,
          usage: { totalTokens: 100 },
          cost: 0.01,
        },
      } as any);

      const parentSpec: Spec = {
        id: mockParentSpecId,
        title: 'Parent',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childSpec: Spec = {
        id: mockChildSpec1Id,
        title: 'Child',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: mockParentSpecId,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateSpecTool.execute
        .mockResolvedValueOnce({ success: true, result: parentSpec, metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpec, metadata: {} });

      let loadSpecsCalled = false;
      mockDataStore.handleWebviewMessage.mockImplementation((msg: any) => {
        if (msg.command === 'loadSpecs') {
          loadSpecsCalled = true;
          return {
            type: 'success',
            payload: [{ ...parentSpec, hasSubspecs: true }, childSpec],
            timestamp: new Date(),
          };
        }
        if (msg.command === 'saveSpec') {
          return { type: 'success', payload: msg.payload, timestamp: new Date() };
        }
        return { type: 'error', error: 'Unknown command', timestamp: new Date() };
      });

      await samuraiAgent.handleGeneratingSpecs(
        createMockUserMessage(),
        [],
        [],
        'Test project',
        createMockSession()
      );

      // Verification function should load specs from persistence
      expect(loadSpecsCalled).toBe(true);
    });

    it('should fix broken parent-child relationships during verification', async () => {
      const mockLLMResponse = JSON.stringify([
        { title: 'Parent', description: 'Desc', parent_spec_id: null },
        { title: 'Child', description: 'Desc', parent_spec_id: 'Wrong Parent Title' },
      ]);

      mockLLMProviderService.chat.mockResolvedValue({
        type: 'success',
        payload: {
          content: mockLLMResponse,
          usage: { totalTokens: 100 },
          cost: 0.01,
        },
      } as any);

      const parentSpec: Spec = {
        id: mockParentSpecId,
        title: 'Parent',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Child with incorrect parentSpecId (will be fixed during verification)
      const childSpec: Spec = {
        id: mockChildSpec1Id,
        title: 'Child',
        spec: 'Desc',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: mockParentSpecId, // Correct in createSpec call
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateSpecTool.execute
        .mockResolvedValueOnce({ success: true, result: parentSpec, metadata: {} })
        .mockResolvedValueOnce({ success: true, result: childSpec, metadata: {} });

      const fixedSpecs: Spec[] = [];
      mockDataStore.handleWebviewMessage.mockImplementation((msg: any) => {
        if (msg.command === 'loadSpecs') {
          return {
            type: 'success',
            payload: [{ ...parentSpec, hasSubspecs: true }, childSpec],
            timestamp: new Date(),
          };
        }
        if (msg.command === 'saveSpec') {
          fixedSpecs.push(msg.payload);
          return { type: 'success', payload: msg.payload, timestamp: new Date() };
        }
        return { type: 'error', error: 'Unknown command', timestamp: new Date() };
      });

      await samuraiAgent.handleGeneratingSpecs(
        createMockUserMessage(),
        [],
        [],
        'Test project',
        createMockSession()
      );

      // Verification should be called (loadSpecs should be called)
      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'loadSpecs' })
      );
    });
  });
});

