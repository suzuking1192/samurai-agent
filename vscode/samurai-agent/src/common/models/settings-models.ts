/**
 * Settings-related data models
 * 
 * Defines the structure for project settings, global settings, and configuration
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * LLM Provider types
 */
export enum LLMProvider {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google',
    AZURE = 'azure'
}

/**
 * Chat modes available in the application
 */
export enum ChatMode {
    DEEP_BUG_ANALYSIS = 'deep_bug_analysis',
    SPEC_PLANNING = 'spec_planning'
}

/**
 * Project settings model
 * Specific to a project/workspace
 */
export interface IProjectSettings extends BaseModel {
    projectId: string;
    projectName: string;
    /** Raw, unprocessed project detail content authored by the user */
    rawProjectDetailContent: string;
    /** Digested/summarized project detail content produced by the agent */
    digestedProjectDetailContent: string;
    /** @deprecated Legacy field preserved for backward compatibility */
    projectDetailText?: string;
    /** @deprecated Legacy field preserved for backward compatibility */
    digestedMemory?: string;
    defaultModel: string;
    defaultMode: ChatMode;
    customPrompts: Record<string, string>;
    projectSpecificConfig: {
        codeAnalysisEnabled: boolean;
        autoSpecGeneration: boolean;
        memoryRetentionDays: number;
        maxTokensPerRequest: number;
        [key: string]: any;
    };
    // UI preferences - moved from GlobalSettings
    theme: 'light' | 'dark' | 'auto';
    autoSave: boolean;
    // Primary LLM model selection for this project
    primaryLLMModel: string | null;
    currentSessionId?: string | null;
    metadata: Record<string, any>;
}

// Backwards compatibility alias while we migrate to the new interface name
export type ProjectSettings = IProjectSettings;

/**
 * Global settings model
 * User-wide settings that apply across all projects
 */
export interface GlobalSettings extends BaseModel {
    userId: string;
    // LLM Provider API Keys (models are now defined in constants)
    openaiApiKey: string;
    geminiApiKey: string;
    claudeApiKey: string;
    
    // Default preferences
    defaultProvider: LLMProvider;
    defaultModel: string;
    defaultMode: ChatMode;
    
    // UI preferences (removed theme and autoSave - moved to ProjectSettings)
    fontSize: number;
    showTokenCounts: boolean;
    showCostEstimates: boolean;
    
    // Behavior settings (removed autoSave - moved to ProjectSettings)
    autoSaveInterval: number; // seconds
    maxHistoryItems: number;
    enableNotifications: boolean;
    
    // Advanced settings
    customApiEndpoints: Record<string, string>;
    proxySettings?: {
        enabled: boolean;
        host: string;
        port: number;
        username?: string;
        password?: string;
    };
    
    metadata: Record<string, any>;
}

/**
 * Provider settings model
 * Configuration for a specific LLM provider
 */
export interface ProviderSettings {
    provider: LLMProvider;
    apiKey: string;
    models: string[];
    baseUrl?: string;
    timeout: number;
    maxRetries: number;
    customHeaders: Record<string, string>;
    metadata: Record<string, any>;
}

/**
 * Settings update request models
 */
export interface UpdateProjectSettingsRequest {
    projectId: string;
    projectName?: string;
    rawProjectDetailContent?: string;
    digestedProjectDetailContent?: string;
    defaultModel?: string;
    defaultMode?: ChatMode;
    customPrompts?: Record<string, string>;
    projectSpecificConfig?: Record<string, any>;
    // UI preferences - moved from GlobalSettings
    theme?: 'light' | 'dark' | 'auto';
    autoSave?: boolean;
    // Primary LLM model selection for this project
    primaryLLMModel?: string | null;
    metadata?: Record<string, any>;
}

export interface UpdateGlobalSettingsRequest {
    // LLM Provider API Keys (models are now defined in constants)
    openaiApiKey?: string;
    geminiApiKey?: string;
    claudeApiKey?: string;
    
    // Default preferences
    defaultProvider?: LLMProvider;
    defaultModel?: string;
    defaultMode?: ChatMode;
    
    // UI preferences (removed theme - moved to ProjectSettings)
    fontSize?: number;
    showTokenCounts?: boolean;
    showCostEstimates?: boolean;
    
    // Behavior settings (removed autoSave - moved to ProjectSettings)
    autoSaveInterval?: number;
    maxHistoryItems?: number;
    enableNotifications?: boolean;
    
    // Advanced settings
    customApiEndpoints?: Record<string, string>;
    proxySettings?: {
        enabled: boolean;
        host: string;
        port: number;
        username?: string;
        password?: string;
    };
    
    metadata?: Record<string, any>;
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Settings export/import models
 */
export interface SettingsExport {
    version: string;
    exportedAt: Date;
    globalSettings: GlobalSettings;
    projectSettings: ProjectSettings[];
}

export interface SettingsImport {
    version: string;
    globalSettings?: Partial<GlobalSettings>;
    projectSettings?: Partial<ProjectSettings>[];
}
