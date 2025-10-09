/**
 * Global DataStore for user-wide settings persistence
 * Handles storage and retrieval of GlobalSettings in user-specific config directory
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { GlobalSettings } from '../common/models/settings-models';
import { ApiResponse, ResponseType } from '../common/models/response-models';
import { TelemetryService } from '../services/TelemetryService';

export class GlobalDataStore {
    private globalConfigDir: string;
    private globalSettingsFile: string;
    private telemetryService?: TelemetryService;
    
    constructor() {
        // Determine user-specific config directory based on platform
        const homeDir = os.homedir();
        if (process.platform === 'win32') {
            // Windows: %APPDATA%/samurai-agent/
            this.globalConfigDir = path.join(homeDir, 'AppData', 'Roaming', 'samurai-agent');
        } else {
            const configHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            this.globalConfigDir = path.join(configHome, 'samurai-agent');
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
     * Reads global settings from the user-specific config directory
     * Alias for loadGlobalSettings for consistency with requirements
     */
    public readGlobalSettings(requestId?: string): ApiResponse<GlobalSettings> {
        return this.loadGlobalSettings(requestId);
    }

    /**
     * Loads global settings from the user-specific config directory
     * Ignores theme, autoSave, and model arrays if they exist in old format files
     */
    public loadGlobalSettings(requestId?: string): ApiResponse<GlobalSettings> {
        try {
            if (!fs.existsSync(this.globalSettingsFile)) {
                // Return default global settings if file doesn't exist
                const defaultSettings: GlobalSettings = {
                    id: 'global-settings',
                    userId: randomUUID(), // Generate anonymized user ID
                    openaiApiKey: '',
                    geminiApiKey: '',
                    claudeApiKey: '',
                    defaultProvider: 'openai' as any,
                    defaultModel: 'gpt-4o',
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
            
            // Filter out theme, autoSave, and model arrays if they exist (migration from old format)
            const { theme, autoSave, openaiModels, geminiModels, claudeModels, ...cleanSettings } = rawSettings;
            
            // Ensure required fields exist with defaults
            const settings: GlobalSettings = {
                id: cleanSettings.id || 'global-settings',
                userId: cleanSettings.userId || randomUUID(), // Generate anonymized user ID if missing
                openaiApiKey: cleanSettings.openaiApiKey || '',
                geminiApiKey: cleanSettings.geminiApiKey || '',
                claudeApiKey: cleanSettings.claudeApiKey || '',
                defaultProvider: cleanSettings.defaultProvider || 'openai',
                defaultModel: cleanSettings.defaultModel || 'gpt-4o',
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
            
            // Load old settings to detect API key changes
            let oldSettings: GlobalSettings | null = null;
            try {
                const loadResponse = this.loadGlobalSettings();
                if (loadResponse.type === 'success' && loadResponse.payload) {
                    oldSettings = loadResponse.payload;
                }
            } catch (error) {
                // If loading fails, treat as first save (no old settings)
                console.log('GlobalDataStore: Could not load old settings for comparison:', error);
            }
            
            // Update timestamps
            const now = new Date();
            const updatedSettings: GlobalSettings = {
                ...settings,
                updatedAt: now,
                createdAt: settings.createdAt || now
            };
            
            // Detect and track LLM API key changes before saving
            this.detectAndTrackLLMKeyChanges(oldSettings, updatedSettings);
            
            // Write to file
            fs.writeFileSync(this.globalSettingsFile, JSON.stringify(updatedSettings, null, 2));
            
            return this.createSuccessResponse(requestId, updatedSettings);
        } catch (error) {
            console.error('Error saving global settings:', error);
            return this.createErrorResponse(requestId, `Failed to save global settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Sets the telemetry service for tracking API key changes
     * This must be called after both GlobalDataStore and TelemetryService are initialized
     * to avoid circular dependency issues
     */
    public setTelemetryService(telemetryService: TelemetryService): void {
        this.telemetryService = telemetryService;
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

    /**
     * Detects changes in LLM API keys and tracks them via telemetry
     * @param oldSettings - Previous global settings (null if first save)
     * @param newSettings - New global settings being saved
     */
    private detectAndTrackLLMKeyChanges(
        oldSettings: GlobalSettings | null,
        newSettings: GlobalSettings
    ): void {
        if (!this.telemetryService) {
            return;
        }

        // Define the LLM provider key mappings (property name -> provider identifier)
        const providerKeyMappings: Array<{ key: keyof GlobalSettings; provider: string }> = [
            { key: 'openaiApiKey', provider: 'openai' },
            { key: 'geminiApiKey', provider: 'gemini' },
            { key: 'claudeApiKey', provider: 'claude' }
        ];

        try {
            for (const { key, provider } of providerKeyMappings) {
                const oldKey = oldSettings?.[key] as string | undefined;
                const newKey = newSettings[key] as string | undefined;

                const changeDetails = this.detectKeyChange(oldKey, newKey);
                
                if (changeDetails) {
                    console.log(`GlobalDataStore: Tracking ${provider} API key change: ${changeDetails.changeType}`);
                    this.telemetryService.trackLLMKeyStatusChange(
                        provider,
                        changeDetails.changeType,
                        changeDetails.hadKeyPreviously,
                        changeDetails.hasKeyNow
                    );
                }
            }
        } catch (error) {
            // Errors during telemetry should not prevent settings from being saved
            console.error('GlobalDataStore: Error detecting/tracking LLM key changes:', error);
        }
    }

    /**
     * Detects if an API key has changed and determines the change type
     * @param oldKey - Previous API key value
     * @param newKey - New API key value
     * @returns Change details if a change was detected, null otherwise
     */
    private detectKeyChange(
        oldKey: string | undefined,
        newKey: string | undefined
    ): { changeType: 'added' | 'updated' | 'removed'; hadKeyPreviously: boolean; hasKeyNow: boolean } | null {
        // An API key is considered 'empty' if it's null, undefined, or empty string
        // A string with only whitespace is considered 'present'
        const hadKeyPreviously = oldKey !== null && oldKey !== undefined && oldKey !== '';
        const hasKeyNow = newKey !== null && newKey !== undefined && newKey !== '';

        // No change if both states are the same (both empty or both present with same value)
        if (!hadKeyPreviously && !hasKeyNow) {
            return null; // Both empty, no change
        }

        // Determine change type
        if (!hadKeyPreviously && hasKeyNow) {
            return { changeType: 'added', hadKeyPreviously: false, hasKeyNow: true };
        } else if (hadKeyPreviously && !hasKeyNow) {
            return { changeType: 'removed', hadKeyPreviously: true, hasKeyNow: false };
        } else if (hadKeyPreviously && hasKeyNow && oldKey !== newKey) {
            return { changeType: 'updated', hadKeyPreviously: true, hasKeyNow: true };
        }

        return null; // No change detected
    }
}
