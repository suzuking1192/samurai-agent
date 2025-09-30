/**
 * Tests for ProjectDetailService cost tracking
 */

import { ProjectDetailService } from '../src/agent/memory/projectDetailService';
import { LLMProviderService } from '../src/agent/llm/llmProviderService';
import { DataStore } from '../src/persistence/dataStore';
import { GlobalDataStore } from '../src/persistence/globalDataStore';

describe('ProjectDetailService Cost Tracking', () => {
    let projectDetailService: ProjectDetailService;
    let llmProviderService: LLMProviderService;
    let dataStore: DataStore;
    let globalDataStore: GlobalDataStore;

    beforeEach(() => {
        globalDataStore = new GlobalDataStore();
        llmProviderService = new LLMProviderService(globalDataStore);
        dataStore = new DataStore('/tmp/test-workspace');
        projectDetailService = new ProjectDetailService(
            llmProviderService,
            dataStore
        );
        
        // Mock the private readPrompt method to avoid file system dependencies
        jest.spyOn(projectDetailService as any, 'readPrompt').mockReturnValue('Mock prompt content');
    });

    it('should return cost information along with finalText', async () => {
        // Mock LLM response with cost
        jest.spyOn(llmProviderService, 'chat').mockResolvedValue({
            type: 'success',
            payload: {
                requestId: 'test-request-id',
                content: 'Digested project detail content',
                provider: 'google',
                model: 'gemini-2.5-flash',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
                cost: 0.00123,
                metadata: {
                    costBreakdown: {
                        promptCost: 0.001,
                        completionCost: 0.00023,
                    }
                }
            }
        } as any);

        // Mock dataStore methods
        jest.spyOn(dataStore, 'readProjectSettings').mockReturnValue({
            type: 'success',
            payload: {
                projectId: 'test-project',
                projectName: 'Test Project',
                primaryLLMModel: 'gemini-2.5-flash',
                createdAt: new Date(),
                updatedAt: new Date(),
                isEdited: false,
            }
        } as any);

        jest.spyOn(dataStore, 'saveProjectSettings').mockReturnValue({
            type: 'success',
            payload: {}
        } as any);

        const result = await projectDetailService.ingestProjectDetail(
            'test-project',
            'Test raw content',
            'synthesis'
        );

        // Verify the result structure
        expect(result).toBeDefined();
        expect(result.finalText).toBe('Digested project detail content');
        expect(result.llmResponse).toBeDefined();
        expect(result.llmResponse.cost).toBe(0.00123);
        expect(result.llmResponse.provider).toBe('google');
        expect(result.llmResponse.model).toBe('gemini-2.5-flash');
        expect(result.llmResponse.usage).toEqual({
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
        });
    });

    it('should return zero cost when input is empty', async () => {
        const result = await projectDetailService.ingestProjectDetail(
            'test-project',
            '',
            'synthesis'
        );

        expect(result).toBeDefined();
        expect(result.finalText).toBe('');
        expect(result.llmResponse).toBeDefined();
        expect(result.llmResponse.cost).toBe(0);
        expect(result.llmResponse.provider).toBe('none');
        expect(result.llmResponse.model).toBe('none');
        expect(result.llmResponse.usage).toEqual({
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        });
    });

    it('should preserve cost metadata in the response', async () => {
        // Mock LLM response with detailed cost breakdown
        jest.spyOn(llmProviderService, 'chat').mockResolvedValue({
            type: 'success',
            payload: {
                requestId: 'test-request-id-2',
                content: 'Merged project detail content',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                usage: {
                    promptTokens: 500,
                    completionTokens: 250,
                    totalTokens: 750,
                },
                cost: 0.00567,
                metadata: {
                    costBreakdown: {
                        promptCost: 0.003,
                        completionCost: 0.00267,
                        pricing: {
                            promptPrice: 0.000006,
                            completionPrice: 0.0000107,
                        }
                    }
                }
            }
        } as any);

        // Mock dataStore methods
        jest.spyOn(dataStore, 'readProjectSettings').mockReturnValue({
            type: 'success',
            payload: {
                projectId: 'test-project',
                projectName: 'Test Project',
                primaryLLMModel: 'claude-3-5-sonnet-20241022',
                digestedProjectDetailContent: 'Existing content',
                createdAt: new Date(),
                updatedAt: new Date(),
                isEdited: false,
            }
        } as any);

        jest.spyOn(dataStore, 'saveProjectSettings').mockReturnValue({
            type: 'success',
            payload: {}
        } as any);

        const result = await projectDetailService.ingestProjectDetail(
            'test-project',
            'New insights',
            'merge'
        );

        // Verify cost metadata is preserved
        expect(result.llmResponse.metadata).toBeDefined();
        expect(result.llmResponse.metadata.costBreakdown).toBeDefined();
        expect(result.llmResponse.metadata.costBreakdown.promptCost).toBe(0.003);
        expect(result.llmResponse.metadata.costBreakdown.completionCost).toBe(0.00267);
    });
});
