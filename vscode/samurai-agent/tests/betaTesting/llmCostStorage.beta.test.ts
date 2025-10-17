/**
 * Unit tests for Beta Testing features in LLMCostStorage
 */

import { LLMCostStorage, LLMCostRecord } from '../../src/storage/llmCostStorage';
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

describe('LLMCostStorage - Beta Testing Features', () => {
    let storage: LLMCostStorage;
    let mockContext: MockExtensionContext;
    
    beforeEach(() => {
        mockContext = new MockExtensionContext();
        storage = new LLMCostStorage(mockContext as any);
    });
    
    describe('getMonthlyCostForBetaUsers', () => {
        it('should return 0 when no records exist', () => {
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(0);
        });
        
        it('should return 0 when no beta user records exist', async () => {
            const record: LLMCostRecord = {
                id: 'cost-1',
                timestamp: new Date().toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50,
                isBetaUserActive: false
            };
            
            await storage.saveRecord(record);
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(0);
        });
        
        it('should calculate cost for current month beta users only', async () => {
            const now = new Date();
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            
            // Beta user record from this month
            const betaRecord1: LLMCostRecord = {
                id: 'cost-1',
                timestamp: thisMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50,
                isBetaUserActive: true
            };
            
            // Beta user record from last month (should not be counted)
            const betaRecord2: LLMCostRecord = {
                id: 'cost-2',
                timestamp: lastMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 2000,
                completionTokens: 1000,
                totalTokens: 3000,
                cost: 1.00,
                isBetaUserActive: true
            };
            
            // Non-beta user record from this month (should not be counted)
            const nonBetaRecord: LLMCostRecord = {
                id: 'cost-3',
                timestamp: thisMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.30,
                isBetaUserActive: false
            };
            
            await storage.saveRecord(betaRecord1);
            await storage.saveRecord(betaRecord2);
            await storage.saveRecord(nonBetaRecord);
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(0.50); // Only betaRecord1 should be counted
        });
        
        it('should sum multiple beta records from current month', async () => {
            const now = new Date();
            
            const records: LLMCostRecord[] = [
                {
                    id: 'cost-1',
                    timestamp: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
                    provider: 'google',
                    model: 'gemini-2.5-flash-beta',
                    promptTokens: 1000,
                    completionTokens: 500,
                    totalTokens: 1500,
                    cost: 0.50,
                    isBetaUserActive: true
                },
                {
                    id: 'cost-2',
                    timestamp: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
                    provider: 'google',
                    model: 'gemini-2.5-flash-beta',
                    promptTokens: 2000,
                    completionTokens: 1000,
                    totalTokens: 3000,
                    cost: 1.25,
                    isBetaUserActive: true
                },
                {
                    id: 'cost-3',
                    timestamp: new Date(now.getFullYear(), now.getMonth(), 20).toISOString(),
                    provider: 'google',
                    model: 'gemini-2.5-flash-beta',
                    promptTokens: 1500,
                    completionTokens: 750,
                    totalTokens: 2250,
                    cost: 0.75,
                    isBetaUserActive: true
                }
            ];
            
            for (const record of records) {
                await storage.saveRecord(record);
            }
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(2.50); // 0.50 + 1.25 + 0.75
        });
        
        it('should handle edge case at month boundary', async () => {
            const now = new Date();
            const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            
            const lastMonthRecord: LLMCostRecord = {
                id: 'cost-1',
                timestamp: lastDayOfLastMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 1.00,
                isBetaUserActive: true
            };
            
            const thisMonthRecord: LLMCostRecord = {
                id: 'cost-2',
                timestamp: firstDayOfThisMonth.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50,
                isBetaUserActive: true
            };
            
            await storage.saveRecord(lastMonthRecord);
            await storage.saveRecord(thisMonthRecord);
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(0.50); // Only thisMonthRecord should be counted
        });
        
        it('should not count records with undefined isBetaUserActive', async () => {
            const now = new Date();
            
            const record: LLMCostRecord = {
                id: 'cost-1',
                timestamp: now.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50
                // isBetaUserActive is undefined
            };
            
            await storage.saveRecord(record);
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBe(0);
        });
        
        it('should handle very small decimal costs accurately', async () => {
            const now = new Date();
            
            const records: LLMCostRecord[] = Array.from({ length: 100 }, (_, i) => ({
                id: `cost-${i}`,
                timestamp: now.toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                cost: 0.01,
                isBetaUserActive: true
            }));
            
            for (const record of records) {
                await storage.saveRecord(record);
            }
            
            const cost = storage.getMonthlyCostForBetaUsers();
            expect(cost).toBeCloseTo(1.00, 2); // 100 * 0.01 = 1.00
        });
    });
    
    describe('isBetaUserActive field persistence', () => {
        it('should persist isBetaUserActive flag correctly', async () => {
            const record: LLMCostRecord = {
                id: 'cost-1',
                timestamp: new Date().toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash-beta',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50,
                isBetaUserActive: true
            };
            
            await storage.saveRecord(record);
            
            const records = storage.getRecords();
            expect(records).toHaveLength(1);
            expect(records[0].isBetaUserActive).toBe(true);
        });
        
        it('should persist false value for isBetaUserActive', async () => {
            const record: LLMCostRecord = {
                id: 'cost-1',
                timestamp: new Date().toISOString(),
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1000,
                completionTokens: 500,
                totalTokens: 1500,
                cost: 0.50,
                isBetaUserActive: false
            };
            
            await storage.saveRecord(record);
            
            const records = storage.getRecords();
            expect(records).toHaveLength(1);
            expect(records[0].isBetaUserActive).toBe(false);
        });
    });
});

