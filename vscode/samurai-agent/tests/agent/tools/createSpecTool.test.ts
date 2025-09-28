import { CreateSpecTool, CreateSpecParameters } from '../../../src/agent/tools/createSpecTool';
import { DataStore } from '../../../src/persistence/dataStore';
import { Spec, SpecStatus, SpecPriority } from '../../../src/common/models/spec-models';

describe('CreateSpecTool', () => {
  let createSpecTool: CreateSpecTool;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    mockDataStore = {
      handleWebviewMessage: jest.fn(),
    } as any;

    createSpecTool = new CreateSpecTool(mockDataStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const definition = createSpecTool.definition;

      expect(definition.name).toBe('create_spec');
      expect(definition.description).toBe('Create a new spec in the Samurai Agent spec list.');
      expect(definition.category).toBe('spec_management');
      expect(definition.enabled).toBe(true);
      expect(definition.required).toEqual(['title']);
      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.required).toEqual(['title']);
    });

    it('should have correct parameter schema', () => {
      const definition = createSpecTool.definition;
      const properties = definition.parameters.properties;

      expect(properties.title).toEqual({
        type: 'string',
        description: 'Title of the spec to create.',
      });

      expect(properties.description).toEqual({
        type: 'string',
        description: 'Detailed description/spec for the spec.',
      });

      expect(properties.parentSpecId).toEqual({
        type: 'string',
        description: 'Optional identifier of the parent spec.',
      });

      expect(properties.depth).toEqual({
        type: 'number',
        description: 'Depth level for nested specs.',
      });
    });
  });

  describe('execute', () => {
    it('should successfully create a spec with minimal parameters', async () => {
      const params: CreateSpecParameters = {
        title: 'Test Spec',
      };

      const mockSpec: Spec = {
        id: 'spec-1',
        title: 'Test Spec',
        spec: '',
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

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: mockSpec,
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(expect.objectContaining({
        title: 'Test Spec',
        spec: '',
        status: SpecStatus.PENDING,
        priority: SpecPriority.MEDIUM,
        isCompleted: false,
        depth: 1,
        parentSpecId: null,
      }));
      expect(result.metadata.specId).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);

      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          title: 'Test Spec',
          spec: '',
          status: SpecStatus.PENDING,
          priority: SpecPriority.MEDIUM,
          isCompleted: false,
          depth: 1,
          parentSpecId: null,
        }),
      });
    });

    it('should successfully create a spec with all parameters', async () => {
      const params: CreateSpecParameters = {
        title: 'Complex Spec',
        description: 'This is a detailed spec description',
        parentSpecId: 'parent-spec-1',
        depth: 2,
      };

      const mockSpec: Spec = {
        id: 'spec-2',
        title: 'Complex Spec',
        spec: 'This is a detailed spec description',
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
        updatedAt: new Date(),
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: mockSpec,
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(expect.objectContaining({
        title: 'Complex Spec',
        spec: 'This is a detailed spec description',
        depth: 2,
        parentSpecId: 'parent-spec-1',
      }));
      expect(result.metadata.specId).toBeDefined();

      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          title: 'Complex Spec',
          spec: 'This is a detailed spec description',
          depth: 2,
          parentSpecId: 'parent-spec-1',
        }),
      });
    });

    it('should handle dataStore errors', async () => {
      const params: CreateSpecParameters = {
        title: 'Test Spec',
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'error',
        error: 'Failed to save spec',
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save spec');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle exceptions during execution', async () => {
      const params: CreateSpecParameters = {
        title: 'Test Spec',
      };

      mockDataStore.handleWebviewMessage.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await createSpecTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should trim whitespace from title and description', async () => {
      const params: CreateSpecParameters = {
        title: '  Test Spec  ',
        description: '  Description with spaces  ',
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: { id: 'spec-1' },
      });

      await createSpecTool.execute(params);

      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          title: 'Test Spec',
          spec: 'Description with spaces',
        }),
      });
    });

    it('should set correct depth based on parentSpecId when depth not provided', async () => {
      const params: CreateSpecParameters = {
        title: 'Child Spec',
        parentSpecId: 'parent-1',
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: { id: 'spec-1' },
      });

      await createSpecTool.execute(params);

      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          depth: 2,
          parentSpecId: 'parent-1',
        }),
      });
    });

    it('should use provided depth when specified', async () => {
      const params: CreateSpecParameters = {
        title: 'Deep Spec',
        depth: 3,
      };

      mockDataStore.handleWebviewMessage.mockReturnValue({
        type: 'success',
        payload: { id: 'spec-1' },
      });

      await createSpecTool.execute(params);

      expect(mockDataStore.handleWebviewMessage).toHaveBeenCalledWith({
        command: 'saveSpec',
        payload: expect.objectContaining({
          depth: 3,
        }),
      });
    });
  });
});
