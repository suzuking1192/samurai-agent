import { ProjectDetailService } from '../../src/agent/memory/projectDetailService';
import { LLMProviderService } from '../../src/agent/llm/llmProviderService';
import { DataStore } from '../../src/persistence/dataStore';
import { IProjectSettings } from '../../src/common/models/settings-models';

describe('ProjectDetailService', () => {
  let projectDetailService: ProjectDetailService;
  let mockLLMProviderService: jest.Mocked<LLMProviderService>;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    mockLLMProviderService = {
      chat: jest.fn(),
    } as any;

    mockDataStore = {
      readProjectSettings: jest.fn(),
      saveProjectSettings: jest.fn(),
    } as any;

    projectDetailService = new ProjectDetailService(
      mockLLMProviderService,
      mockDataStore,
      '/test/extension/root'
    );
  });

  describe('getProjectDetails', () => {
    it('should return digested project detail content when available', async () => {
      const mockSettings: IProjectSettings = {
        digestedProjectDetailContent: 'Test digested content',
        rawProjectDetailContent: 'Test raw content',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: mockSettings
      });

      const result = await projectDetailService.getProjectDetails('project-1');

      expect(mockDataStore.readProjectSettings).toHaveBeenCalled();
      expect(result).toBe('Test digested content');
    });

    it('should return undefined when no project details are available', async () => {
      const mockSettings: IProjectSettings = {
        digestedProjectDetailContent: '',
        rawProjectDetailContent: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: mockSettings
      });

      const result = await projectDetailService.getProjectDetails('project-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when project settings are not found', async () => {
      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'error',
        error: 'Settings not found'
      });

      const result = await projectDetailService.getProjectDetails('project-1');

      expect(result).toBeUndefined();
    });

    it('should handle errors gracefully and return undefined', async () => {
      mockDataStore.readProjectSettings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await projectDetailService.getProjectDetails('project-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when settings payload is null', async () => {
      mockDataStore.readProjectSettings.mockReturnValue({
        type: 'success',
        payload: null
      });

      const result = await projectDetailService.getProjectDetails('project-1');

      expect(result).toBeUndefined();
    });
  });
});
