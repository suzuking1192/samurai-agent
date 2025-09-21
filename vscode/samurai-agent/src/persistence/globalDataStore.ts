/**
 * Global DataStore for user-wide settings persistence
 * Handles storage and retrieval of GlobalSettings in user-specific config directory
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { GlobalSettings } from '../common/models/settings-models';
import { ApiResponse, ResponseType } from '../common/models/response-models';

export class GlobalDataStore {
    private globalConfigDir: string;
    private globalSettingsFile: string;
    
    constructor() {
        // Determine user-specific config directory based on platform
        const homeDir = os.homedir();
        if (process.platform === 'win32') {
            // Windows: %APPDATA%/samurai-agent/
            this.globalConfigDir = path.join(homeDir, 'AppData', 'Roaming', 'samurai-agent');
        } else {
            // Linux/macOS: ~/.config/samurai-agent/
            this.globalConfigDir = path.join(homeDir, '.config', 'samurai-agent');
        }
        
        this.globalSettingsFile = path.join(this.globalConfigDir, 'global_user_settings.json');
        this.ensureConfigDirectory();
    }
    
    /**
     * Ensures the global config directory exists
     */
    private ensureConfigDirectory(): void {
        if (!fs.existsSync(this.globalConfigDir)) {
            fs.mkdirSync(this.globalConfigDir, { recursive: true });
        }
    }
    
    /**
     * Creates a standardized API response
     */
    private createResponse<T>(
        type: ResponseType, 
        requestId?: string, 
        payload?: T, 
        error?: string
    ): ApiResponse<T> {
        return {
            type,
            requestId,
            payload,
            error,
            timestamp: new Date()
        };
    }
    
    /**
     * Creates a success response
     */
    private createSuccessResponse<T>(requestId?: string, payload?: T): ApiResponse<T> {
        return this.createResponse(ResponseType.SUCCESS, requestId, payload);
    }
    
    /**
     * Creates an error response
     */
    private createErrorResponse<T>(requestId?: string, error?: string): ApiResponse<T> {
        return this.createResponse(ResponseType.ERROR, requestId, undefined as T, error);
    }
    
    /**
     * Loads global settings from the user-specific config directory
     * Ignores theme and autoSave fields if they exist in old format files
     */
    public loadGlobalSettings(requestId?: string): ApiResponse<GlobalSettings> {
        try {
            if (!fs.existsSync(this.globalSettingsFile)) {
                // Return default global settings if file doesn't exist
                const defaultSettings: GlobalSettings = {
                    id: 'global-settings',
                    userId: 'default-user',
                    openaiApiKey: '',
                    openaiModels: ['gpt-4', 'gpt-3.5-turbo'],
                    geminiApiKey: '',
                    geminiModels: ['gemini-pro'],
                    claudeApiKey: '',
                    claudeModels: ['claude-3-opus', 'claude-3-sonnet'],
                    defaultProvider: 'openai' as any,
                    defaultModel: 'gpt-4',
                    defaultMode: 'default' as any,
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
                return this.createSuccessResponse(requestId, defaultSettings);
            }
            
            const data = fs.readFileSync(this.globalSettingsFile, 'utf8');
            const rawSettings = JSON.parse(data);
            
            // Filter out theme and autoSave if they exist (migration from old format)
            const { theme, autoSave, ...cleanSettings } = rawSettings;
            
            // Ensure required fields exist with defaults
            const settings: GlobalSettings = {
                id: cleanSettings.id || 'global-settings',
                userId: cleanSettings.userId || 'default-user',
                openaiApiKey: cleanSettings.openaiApiKey || '',
                openaiModels: cleanSettings.openaiModels || ['gpt-4', 'gpt-3.5-turbo'],
                geminiApiKey: cleanSettings.geminiApiKey || '',
                geminiModels: cleanSettings.geminiModels || ['gemini-pro'],
                claudeApiKey: cleanSettings.claudeApiKey || '',
                claudeModels: cleanSettings.claudeModels || ['claude-3-opus', 'claude-3-sonnet'],
                defaultProvider: cleanSettings.defaultProvider || 'openai',
                defaultModel: cleanSettings.defaultModel || 'gpt-4',
                defaultMode: cleanSettings.defaultMode || 'default',
                fontSize: cleanSettings.fontSize || 14,
                showTokenCounts: cleanSettings.showTokenCounts !== undefined ? cleanSettings.showTokenCounts : true,
                showCostEstimates: cleanSettings.showCostEstimates !== undefined ? cleanSettings.showCostEstimates : true,
                autoSaveInterval: cleanSettings.autoSaveInterval || 30,
                maxHistoryItems: cleanSettings.maxHistoryItems || 100,
                enableNotifications: cleanSettings.enableNotifications !== undefined ? cleanSettings.enableNotifications : true,
                customApiEndpoints: cleanSettings.customApiEndpoints || {},
                proxySettings: cleanSettings.proxySettings,
                metadata: cleanSettings.metadata || {},
                createdAt: cleanSettings.createdAt ? new Date(cleanSettings.createdAt) : new Date(),
                updatedAt: cleanSettings.updatedAt ? new Date(cleanSettings.updatedAt) : new Date()
            };
            
            return this.createSuccessResponse(requestId, settings);
        } catch (error) {
            console.error('Error loading global settings:', error);
            return this.createErrorResponse(requestId, `Failed to load global settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Saves global settings to the user-specific config directory
     */
    public saveGlobalSettings(settings: GlobalSettings, requestId?: string): ApiResponse<GlobalSettings> {
        try {
            if (!settings) {
                return this.createErrorResponse(requestId, 'Global settings data is required');
            }
            
            // Ensure config directory exists
            this.ensureConfigDirectory();
            
            // Update timestamps
            const now = new Date();
            const updatedSettings: GlobalSettings = {
                ...settings,
                updatedAt: now,
                createdAt: settings.createdAt || now
            };
            
            // Write to file
            fs.writeFileSync(this.globalSettingsFile, JSON.stringify(updatedSettings, null, 2));
            
            return this.createSuccessResponse(requestId, updatedSettings);
        } catch (error) {
            console.error('Error saving global settings:', error);
            return this.createErrorResponse(requestId, `Failed to save global settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Gets the path to the global settings file (for debugging/testing)
     */
    public getGlobalSettingsPath(): string {
        return this.globalSettingsFile;
    }
    
    /**
     * Gets the path to the global config directory (for debugging/testing)
     */
    public getGlobalConfigDir(): string {
        return this.globalConfigDir;
    }
}
