/**
 * Unit tests for CreateSpecTool
 */

import { CreateSpecTool, CreateSpecParameters } from '../../src/agent/tools/createSpecTool';
import { DataStore } from '../../src/persistence/dataStore';
import { Spec, SpecStatus, SpecPriority } from '../../src/common/models/spec-models';
import { ToolExecutionResult } from '../../src/common/models/tool-models';

// Mock DataStore
jest.mock('../../src/persistence/dataStore');

describe('CreateSpecTool', () => {
  let createSpecTool: CreateSpecTool;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    mockDataStore = new DataStore('/test/path') as jest.Mocked<DataStore>;
    createSpecTool = new CreateSpecTool(mockDataStore);
  });

  describe('execute', () => {
    it('should create a spec successfully', async () => {
      const params: CreateSpecParameters = {
        title: 'Test Spec',
        description: 'This is a test specification',
        depth: 1
      };

      const mockSpec: Spec = {
        id: 'spec-1',
        title: 'Test Spec',
        spec: 'This is a test specification',
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
        updatedAt: new Date()
      };

      // Mock successful save
      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: mockSpec,
        timestamp: new Date()
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockSpec);
      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          title: 'Test Spec',
          spec: 'This is a test specification',
          depth: 1
        })
      });
    });

    it('should create a spec with parent spec ID', async () => {
      const params: CreateSpecParameters = {
        title: 'Child Spec',
        description: 'This is a child specification',
        parentSpecId: 'parent-spec-1',
        depth: 2
      };

      const mockSpec: Spec = {
        id: 'spec-2',
        title: 'Child Spec',
        spec: 'This is a child specification',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 2,
        parentSpecId: 'parent-spec-1',
        hasSubspecs: false,
        tags: [],
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: mockSpec,
        timestamp: new Date()
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockSpec);
      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          title: 'Child Spec',
          spec: 'This is a child specification',
          parentSpecId: 'parent-spec-1',
          depth: 2
        })
      });
    });

    it('should handle save errors', async () => {
      const params: CreateSpecParameters = {
        title: 'Test Spec',
        description: 'This is a test specification'
      };

      // Mock save error
      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'error',
        error: 'Failed to save spec',
        timestamp: new Date()
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save spec');
    });

    it('should handle missing title', async () => {
      const params: CreateSpecParameters = {
        title: '',
        description: 'This spec has no title'
      };

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title is required');
    });
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = createSpecTool.definition;

      expect(definition.name).toBe('create_spec');
      expect(definition.description).toContain('Create a new spec');
      expect(definition.category).toBe('spec_management');
      expect(definition.enabled).toBe(true);
      expect(definition.required).toContain('title');
      expect(definition.parameters.properties).toHaveProperty('title');
      expect(definition.parameters.properties).toHaveProperty('description');
      expect(definition.parameters.properties).toHaveProperty('parentSpecId');
      expect(definition.parameters.properties).toHaveProperty('depth');
    });
  });
});