/**
 * Integration tests for Beta Testing feature
 */

import { LLMCostStorage, LLMCostRecord } from '../../src/storage/llmCostStorage';
import { LLMProviderService, ChatClient } from '../../src/agent/llm/llmProviderService';
import { GlobalDataStore } from '../../src/persistence/globalDataStore';
import { DataStore } from '../../src/persistence/dataStore';
import { ApiResponse, ResponseType } from '../../src/common/models/response-models';
import { LLMRequest, LLMResponse } from '../../src/common/models/llm-models';
import { calculateLLMCost } from '../../src/common/utils/llmCostCalculator';
import * as vscode from 'vscode';

// Mock VS Code extension context
class MockExtensionContext implements Partial<vscode.ExtensionContext> {
    private storage = new Map<string, any>();
    
    workspaceState = {
        get: (key: string) => this.storage.get(key),
        update: async (key: string, value: any) => {
            this.storage.set(key, value);
        },
        keys: () => Array.from(this.storage.keys())
    } as any;
    
    globalState = this.workspaceState;
    subscriptions = [];
    extensionPath = '';
    extensionUri = {} as any;
    environmentVariableCollection = {} as any;
    storagePath = '';
    globalStoragePath = '';
    logPath = '';
    extensionMode = 3; // ExtensionMode.Test
    
    asAbsolutePath(relativePath: string): string {
        return relativePath;
    }
}

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
    public callCount = 0;
    public lastRequest: LLMRequest | undefined;

    async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse>> {
        this.callCount++;
        this.lastRequest = request;
        
        const promptTokens = 10000;
        const completionTokens = 5000;
        
        const costCalc = calculateLLMCost({
            provider: request.provider,
            model: request.model,
            promptTokens,
            completionTokens
        });
        
        const timestamp = new Date();
        return {
            type: ResponseType.SUCCESS,
            payload: {
                id: 'response-id',
                requestId: request.id,
                provider: request.provider,
                model: request.model,
                content: 'mock-response',
                usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
                cost: costCalc.totalCost,
                processingTime: 0,
                metadata: {},
                createdAt: timestamp,
                updatedAt: timestamp
            },
            timestamp
        };
    }
}

describe('Beta Testing - Integration Tests', () => {
    const VALID_BETA_CODE = 'BETA-SA-2025-7K9M';
    const BETA_MONTHLY_LIMIT = 3.00;
    
    let mockContext: MockExtensionContext;
    let llmCostStorage: LLMCostStorage;
    
    beforeEach(() => {
        mockContext = new MockExtensionContext();
        llmCostStorage = new LLMCostStorage(mockContext as any);
    });
    
    describe('Complete Beta User Journey', () => {
        it('should track beta usage and enforce limit correctly', async () => {
            const settings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: '',
                betaCode: VALID_BETA_CODE,
                defaultProvider: 'google',
                defaultModel: 'gemini-2.5-flash-beta',
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const projectSettings = {
                id: 'project-settings',
                projectId: 'project-id',
                projectName: 'Test Project',
                rawProjectDetailContent: '',
                digestedProjectDetailContent: '',
                defaultModel: 'gemini-2.5-flash-beta',
                primaryLLMModel: 'gemini-2.5-flash-beta',
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settings);
            const mockDataStore = new MockDataStore(projectSettings);
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                llmCostStorage
            );
            service.registerClient('google', mockClient);
            
            // Simulate multiple requests until limit is reached
            const requests: LLMRequest[] = [];
            let totalCost = 0;
            
            // Make requests until we approach the $3 limit
            while (totalCost < BETA_MONTHLY_LIMIT - 0.5) {
                const request: LLMRequest = {
                    id: `request-${requests.length}`,
                    provider: 'google',
                    model: 'gemini-2.5-flash-beta',
                    messages: [{ role: 'user', content: 'test message' }],
                    temperature: 0.7,
                    maxTokens: 1000,
                    metadata: {}
                };
                
                const response = await service.chat(request);
                expect(response.type).toBe(ResponseType.SUCCESS);
                
                const payload = response.payload as LLMResponse;
                expect(payload.model).toBe('gemini-2.5-flash-beta');
                
                // Record the cost
                const costRecord: LLMCostRecord = {
                    id: `cost-${requests.length}`,
                    timestamp: new Date().toISOString(),
                    provider: payload.provider,
                    model: payload.model,
                    promptTokens: payload.usage.promptTokens,
                    completionTokens: payload.usage.completionTokens,
                    totalTokens: payload.usage.totalTokens,
                    cost: payload.cost,
                    isBetaUserActive: true
                };
                
                await llmCostStorage.saveRecord(costRecord);
                totalCost += payload.cost;
                requests.push(request);
                
                // Safety check to prevent infinite loop
                if (requests.length > 1000) {
                    break;
                }
            }
            
            expect(requests.length).toBeGreaterThan(0);
            expect(totalCost).toBeLessThan(BETA_MONTHLY_LIMIT);
            
            const betaCost = llmCostStorage.getMonthlyCostForBetaUsers();
            expect(betaCost).toBeCloseTo(totalCost, 2);
            
            // Now make one more request that should trigger fallback
            const finalRequest: LLMRequest = {
                id: 'final-request',
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                messages: [{ role: 'user', content: 'final test' }],
                temperature: 0.7,
                maxTokens: 1000,
                metadata: {}
            };
            
            // Create a new service instance that checks the current cost
            const serviceWithLimit = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                llmCostStorage
            );
            serviceWithLimit.registerClient('google', mockClient);
            
            // Simulate reaching the limit
            await llmCostStorage.saveRecord({
                id: 'cost-limit',
                timestamp: new Date().toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 10000,
                completionTokens: 5000,
                totalTokens: 15000,
                cost: 1.0,
                isBetaUserActive: true
            });
            
            const finalResponse = await serviceWithLimit.chat(finalRequest);
            expect(finalResponse.type).toBe(ResponseType.SUCCESS);
            
            const finalPayload = finalResponse.payload as LLMResponse;
            // Should have fallen back to free tier
            expect(finalPayload.model).toBe('gemini-2.5-flash-free-tier');
        });
        
        it('should separate beta and non-beta cost tracking', async () => {
            const now = new Date();
            
            // Record beta user usage
            const betaRecord: LLMCostRecord = {
                id: 'beta-1',
                timestamp: now.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 10000,
                completionTokens: 5000,
                totalTokens: 15000,
                cost: 1.50,
                isBetaUserActive: true
            };
            
            await llmCostStorage.saveRecord(betaRecord);
            
            // Record non-beta user usage (user with their own API key)
            const nonBetaRecord: LLMCostRecord = {
                id: 'non-beta-1',
                timestamp: now.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 20000,
                completionTokens: 10000,
                totalTokens: 30000,
                cost: 3.00,
                isBetaUserActive: false
            };
            
            await llmCostStorage.saveRecord(nonBetaRecord);
            
            // Beta cost should only include beta records
            const betaCost = llmCostStorage.getMonthlyCostForBetaUsers();
            expect(betaCost).toBe(1.50);
            
            // Total cost should include all records
            const totalCost = llmCostStorage.getCurrentMonthCost();
            expect(totalCost).toBe(4.50);
        });
    });
    
    describe('Beta Code Validation Scenarios', () => {
        it('should handle whitespace in beta code', async () => {
            const settingsWithWhitespace = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: '',
                betaCode: '  BETA-SA-2025-7K9M  ', // With whitespace
                defaultProvider: 'google',
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const projectSettings = {
                id: 'project-settings',
                projectId: 'project-id',
                primaryLLMModel: 'gemini-2.5-flash-beta',
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settingsWithWhitespace);
            const mockDataStore = new MockDataStore(projectSettings);
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                llmCostStorage
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
            
            // Should accept code after trimming whitespace
            expect(response.type).toBe(ResponseType.SUCCESS);
        });
        
        it('should reject case-sensitive incorrect codes', async () => {
            const settingsWithWrongCase = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: '',
                betaCode: 'beta-sa-2025-7k9m', // Lowercase
                defaultProvider: 'google',
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const projectSettings = {
                id: 'project-settings',
                projectId: 'project-id',
                primaryLLMModel: 'gemini-2.5-flash-beta',
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const mockGlobalDataStore = new MockGlobalDataStore(settingsWithWrongCase);
            const mockDataStore = new MockDataStore(projectSettings);
            const mockClient = new MockChatClient();
            
            const service = new LLMProviderService(
                mockGlobalDataStore,
                mockDataStore,
                undefined,
                llmCostStorage
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
            
            // Should reject due to case mismatch
            expect(response.type).toBe(ResponseType.ERROR);
        });
    });
    
    describe('Monthly Reset Simulation', () => {
        it('should only count current month costs', async () => {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            
            // Add last month's usage (should not count)
            const lastMonthRecord: LLMCostRecord = {
                id: 'last-month',
                timestamp: lastMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 100000,
                completionTokens: 50000,
                totalTokens: 150000,
                cost: 2.50,
                isBetaUserActive: true
            };
            
            await llmCostStorage.saveRecord(lastMonthRecord);
            
            // Add this month's usage
            const thisMonthRecord: LLMCostRecord = {
                id: 'this-month',
                timestamp: now.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 10000,
                completionTokens: 5000,
                totalTokens: 15000,
                cost: 0.50,
                isBetaUserActive: true
            };
            
            await llmCostStorage.saveRecord(thisMonthRecord);
            
            const betaCost = llmCostStorage.getMonthlyCostForBetaUsers();
            
            // Should only count this month's cost
            expect(betaCost).toBe(0.50);
        });
    });
});

