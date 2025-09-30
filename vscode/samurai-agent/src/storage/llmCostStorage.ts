/**
 * LLM Cost Storage
 * 
 * Manages persistence of LLM cost records using VS Code's workspace state.
 * Stores cost data specific to the current workspace for cross-session tracking.
 */

import * as vscode from 'vscode';

export interface LLMCostRecord {
    id: string;
    timestamp: string; // ISO 8601 format
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    sessionId?: string;
    requestId?: string;
}

interface StoredCostData {
    records: LLMCostRecord[];
    totalCost: number;
    lastUpdated: string;
}

const STORAGE_KEY = 'samuraiAgent.llmCostRecords';
const MAX_RECORDS = 1000; // Prevent memento bloat by limiting stored records

export class LLMCostStorage {
    private context: vscode.ExtensionContext;
    private sessionCosts: Map<string, number> = new Map();
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    /**
     * Save a new LLM cost record
     * @param record - Cost record to save
     */
    async saveRecord(record: LLMCostRecord): Promise<void> {
        try {
            const currentData = this.loadStoredData();
            
            // Add new record
            currentData.records.push(record);
            
            // Update total cost
            currentData.totalCost += record.cost;
            currentData.lastUpdated = new Date().toISOString();
            
            // Trim old records if exceeding max
            if (currentData.records.length > MAX_RECORDS) {
                const removedRecords = currentData.records.splice(0, currentData.records.length - MAX_RECORDS);
                const removedCost = removedRecords.reduce((sum, r) => sum + r.cost, 0);
                currentData.totalCost -= removedCost;
            }
            
            // Update session cost tracking
            if (record.sessionId) {
                const currentSessionCost = this.sessionCosts.get(record.sessionId) || 0;
                this.sessionCosts.set(record.sessionId, currentSessionCost + record.cost);
            }
            
            // Save to workspace state
            await this.context.workspaceState.update(STORAGE_KEY, currentData);
        } catch (error) {
            console.error('[LLM Cost Storage] Failed to save record:', error);
            throw error;
        }
    }
    
    /**
     * Get all stored cost records
     * @returns Array of cost records
     */
    getRecords(): LLMCostRecord[] {
        const data = this.loadStoredData();
        return data.records;
    }
    
    /**
     * Get records for a specific session
     * @param sessionId - Session ID to filter by
     * @returns Array of cost records for the session
     */
    getRecordsBySession(sessionId: string): LLMCostRecord[] {
        const data = this.loadStoredData();
        return data.records.filter(r => r.sessionId === sessionId);
    }
    
    /**
     * Get total cost across all sessions
     * @returns Total cost in USD
     */
    getTotalCost(): number {
        const data = this.loadStoredData();
        return data.totalCost;
    }
    
    /**
     * Get cost for a specific session
     * @param sessionId - Session ID
     * @returns Session cost in USD
     */
    getSessionCost(sessionId: string): number {
        // Use in-memory cache if available
        if (this.sessionCosts.has(sessionId)) {
            return this.sessionCosts.get(sessionId)!;
        }
        
        // Calculate from stored records
        const sessionRecords = this.getRecordsBySession(sessionId);
        const sessionCost = sessionRecords.reduce((sum, record) => sum + record.cost, 0);
        
        // Cache for future use
        this.sessionCosts.set(sessionId, sessionCost);
        
        return sessionCost;
    }
    
    /**
     * Get cost for the current VS Code session (since extension activation)
     * @returns Current session cost in USD
     */
    getCurrentSessionCost(): number {
        // Get all records from today's session
        const now = new Date();
        const sessionStart = this.getSessionStartTime();
        
        const data = this.loadStoredData();
        const sessionRecords = data.records.filter(r => {
            const recordTime = new Date(r.timestamp);
            return recordTime >= sessionStart;
        });
        
        return sessionRecords.reduce((sum, record) => sum + record.cost, 0);
    }
    
    /**
     * Clear all stored cost records
     */
    async clearRecords(): Promise<void> {
        try {
            await this.context.workspaceState.update(STORAGE_KEY, undefined);
            this.sessionCosts.clear();
        } catch (error) {
            console.error('[LLM Cost Storage] Failed to clear records:', error);
            throw error;
        }
    }
    
    /**
     * Get statistics about stored costs
     */
    getStatistics(): {
        totalRecords: number;
        totalCost: number;
        currentSessionCost: number;
        oldestRecord?: string;
        newestRecord?: string;
    } {
        const data = this.loadStoredData();
        const currentSessionCost = this.getCurrentSessionCost();
        
        return {
            totalRecords: data.records.length,
            totalCost: data.totalCost,
            currentSessionCost,
            oldestRecord: data.records.length > 0 ? data.records[0].timestamp : undefined,
            newestRecord: data.records.length > 0 ? data.records[data.records.length - 1].timestamp : undefined,
        };
    }
    
    /**
     * Load stored data from workspace state
     * @private
     */
    private loadStoredData(): StoredCostData {
        const stored = this.context.workspaceState.get<StoredCostData>(STORAGE_KEY);
        
        if (!stored) {
            return {
                records: [],
                totalCost: 0,
                lastUpdated: new Date().toISOString(),
            };
        }
        
        return stored;
    }
    
    /**
     * Get the start time of the current VS Code session
     * @private
     */
    private getSessionStartTime(): Date {
        // For simplicity, consider session start as extension activation
        // This could be enhanced to use actual VS Code session tracking
        return new Date(Date.now() - (24 * 60 * 60 * 1000)); // Last 24 hours as fallback
    }
}
