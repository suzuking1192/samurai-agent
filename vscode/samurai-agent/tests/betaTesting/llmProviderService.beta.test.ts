/**
 * Unit tests for Beta Testing features in LLMProviderService
 */

import { LLMProviderService, ChatClient } from '../../src/agent/llm/llmProviderService';
import { GlobalDataStore } from '../../src/persistence/globalDataStore';
import { DataStore } from '../../src/persistence/dataStore';
import { ApiResponse, ResponseType } from '../../src/common/models/response-models';
import { LLMRequest, LLMResponse } from '../../src/common/models/llm-models';
import { BETA_GEMINI_API_KEY } from '../../src/common/constants/llm-constants';

class MockGlobalDataStore extends GlobalDataStore {
    constructor(private readonly settings: any) {
        super();
    }

    public loadGlobalSettings(): ApiResponse {
        return {
            type: ResponseType.SUCCESS,
            payload: this.settings,
            timestamp: new Date()
        } as ApiResponse;
    }
}

class MockDataStore extends DataStore {
    constructor(private readonly projectSettings: any) {
        super('');
    }

    public readProjectSettings(): ApiResponse {
        return {
            type: ResponseType.SUCCESS,
            payload: this.projectSettings,
            timestamp: new Date()
        } as ApiResponse;
    }
}

class MockChatClient implements ChatClient {
    public lastRequest: LLMRequest | undefined;

    async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse>> {
        this.lastRequest = request;
        const timestamp = new Date();
        return {
            type: ResponseType.SUCCESS,
            payload: {
                id: 'response-id',
                requestId: request.id,
                provider: request.provider,
                model: request.model,
                content: 'mock-response',
                usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
                cost: 0.15,
                processingTime: 0,
                metadata: {},
                createdAt: timestamp,
                updatedAt: timestamp
            },
            timestamp
        };
    }
}

class MockLLMCostStorage {
    private betaMonthlyCost = 0;
    
    public setMonthlyCost(cost: number): void {
        this.betaMonthlyCost = cost;
    }
    
    public getMonthlyCostForBetaUsers(): number {
        return this.betaMonthlyCost;
    }
}

describe('LLMProviderService - Beta Testing Features', () => {
    const VALID_BETA_CODE = 'BETA-SA-2025-7K9M';
    
    const baseGlobalSettings = {
        id: 'global-settings',
        userId: 'test-user',
        openaiApiKey: '',
        geminiApiKey: 'user-gemini-key',
        claudeApiKey: '',
        betaCode: '',
        defaultProvider: 'google',
        defaultModel: 'gemini-2.5-flash',
        defaultMode: 'default',
        fontSize: 14,
        showTokenCounts: true,
        showCostEstimates: true,
        autoSaveInterval: 30,
        maxHistoryItems: 100,
        enableNotifications: true,
        customApiEndpoints: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const baseProjectSettings = {
        id: 'project-settings',
        projectId: 'project-id',
        projectName: 'Test Project',
        rawProjectDetailContent: '',
        digestedProjectDetailContent: '',
        defaultModel: 'gemini-2.5-flash',
        defaultMode: 'default',
        customPrompts: {},
        projectSpecificConfig: {},
        theme: 'auto',
        autoSave: true,
        primaryLLMModel: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    describe('Beta API Key Resolution', () => {
        it('should use BETA_GEMINI_API_KEY for beta testing model', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            expect(mockClient.lastRequest?.metadata?.apiKey).toBe(BETA_GEMINI_API_KEY);
        });
    });
    
    describe('Beta Code Validation', () => {
        it('should reject request when beta code is invalid', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: 'INVALID-CODE'
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            const response = await service.chat(request);
            
            expect(response.type).toBe(ResponseType.ERROR);
            expect(response.error).toContain('Beta Testing requires a valid beta code');
        });
        
        it('should reject request when beta code is not set', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: ''
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            const response = await service.chat(request);
            
            expect(response.type).toBe(ResponseType.ERROR);
            expect(response.error).toContain('Beta Testing requires a valid beta code');
        });
        
        it('should accept request when beta code is valid', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            const response = await service.chat(request);
            
            expect(response.type).toBe(ResponseType.SUCCESS);
        });
    });
    
    describe('Monthly Limit Enforcement', () => {
        it('should fallback to user gemini key when $3 limit reached', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE,
                geminiApiKey: 'user-gemini-key'
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            mockCostStorage.setMonthlyCost(3.00); // Limit reached
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            // Should have switched to gemini-2.5-flash with user's key
            expect(mockClient.lastRequest?.model).toBe('gemini-2.5-flash');
            expect(mockClient.lastRequest?.metadata?.apiKey).toBe('user-gemini-key');
        });
        
        it('should fallback to free tier when limit reached and user has no gemini key', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE,
                geminiApiKey: '' // No user key
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            mockCostStorage.setMonthlyCost(3.50); // Over limit
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            // Should have switched to free tier
            expect(mockClient.lastRequest?.model).toBe('gemini-2.5-flash-free-tier');
        });
        
        it('should allow usage when under $3 limit', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            mockCostStorage.setMonthlyCost(2.50); // Under limit
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            // Should keep beta model
            expect(mockClient.lastRequest?.model).toBe('gemini-2.5-flash-beta');
            expect(mockClient.lastRequest?.metadata?.apiKey).toBe(BETA_GEMINI_API_KEY);
        });
        
        it('should handle edge case at exactly $3.00 limit', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE,
                geminiApiKey: 'user-gemini-key'
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            mockCostStorage.setMonthlyCost(3.00); // Exactly at limit
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            // Should fallback when at or over limit
            expect(mockClient.lastRequest?.model).toBe('gemini-2.5-flash');
        });
    });
    
    describe('Non-Beta Models', () => {
        it('should not affect non-beta models', async () => {
            const settings = {
                ...baseGlobalSettings,
                betaCode: VALID_BETA_CODE
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(baseProjectSettings);
            const mockCostStorage = new MockLLMCostStorage();
            mockCostStorage.setMonthlyCost(3.50); // Over limit
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                mockCostStorage
            );
            service.registerClient('google', mockClient);
            
            const request: LLMRequest = {
                id: 'test-request',
                provider: 'google',
                model: 'gemini-2.5-flash', // Regular model, not beta
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            await service.chat(request);
            
            // Should not affect regular models
            expect(mockClient.lastRequest?.model).toBe('gemini-2.5-flash');
            expect(mockClient.lastRequest?.metadata?.apiKey).toBe('user-gemini-key');
        });
    });
});

