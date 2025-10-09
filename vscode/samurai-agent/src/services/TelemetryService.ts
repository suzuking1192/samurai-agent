/**
 * TelemetryService - Handles PostHog analytics tracking for Samurai Agent
 * 
 * This service provides anonymized usage analytics while respecting user privacy
 * and consent preferences. All tracking is conditional on the user's telemetry setting.
 */

import * as vscode from 'vscode';
import { PostHog } from 'posthog-node';
import { GlobalDataStore } from '../persistence/globalDataStore';
import { ErrorModel } from '../common/models/error-models';

export class TelemetryService {
    private posthog: PostHog | null = null;
    private globalDataStore: GlobalDataStore;
    private distinctId: string | null = null;

    constructor(
        private context: vscode.ExtensionContext,
        globalDataStore: GlobalDataStore
    ) {
        this.globalDataStore = globalDataStore;
        this.initializePostHog();
        this.initializeDistinctId();
    }

    /**
     * Initialize PostHog client with API key and host from environment variables
     */
    private initializePostHog(): void {
        try {
            const apiKey = process.env.POSTHOG_API_KEY;
            const host = process.env.POSTHOG_HOST;

            console.log('TelemetryService: Initializing PostHog...', {
                hasApiKey: !!apiKey,
                apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
                apiKeyLength: apiKey ? apiKey.length : 0,
                apiKeySource: apiKey ? 'HARDCODED in webpack' : 'UNDEFINED',
                host: host || 'https://us.i.posthog.com',
                nodeEnv: process.env.NODE_ENV
            });

            if (!apiKey) {
                console.warn('TelemetryService: PostHog API key not found, telemetry disabled');
                return;
            }

            this.posthog = new PostHog(apiKey, {
                host: host || 'https://us.i.posthog.com',
                flushAt: 1, // Send events immediately
                flushInterval: 1000, // 1 second
                disableGeoip: true, // Disable IP geolocation for privacy
            });

            console.log('TelemetryService: PostHog client initialized successfully');
        } catch (error) {
            console.error('TelemetryService: Failed to initialize PostHog:', error);
            this.posthog = null;
        }
    }

    /**
     * Initialize or retrieve the anonymized distinct ID for this user
     */
    private async initializeDistinctId(): Promise<void> {
        try {
            const settingsResponse = this.globalDataStore.loadGlobalSettings();
            if (settingsResponse.type === 'success' && settingsResponse.payload) {
                this.distinctId = settingsResponse.payload.userId;
                console.log('TelemetryService: Using existing distinct ID');
            } else {
                // This should not happen as GlobalDataStore generates a UUID if missing
                console.warn('TelemetryService: Failed to load global settings for distinct ID');
            }
        } catch (error) {
            console.error('TelemetryService: Error initializing distinct ID:', error);
        }
    }

    /**
     * Track a chat message interaction
     * @param messageType - Type of message: 'user_message' or 'agent_response'
     */
    public async trackChatMessage(messageType: 'user_message' | 'agent_response'): Promise<void> {
        try {
            // Check if telemetry is enabled
            const config = vscode.workspace.getConfiguration('samurai-agent');
            const isTelemetryEnabled = config.get<boolean>('enableTelemetry', true);

            console.log('TelemetryService: trackChatMessage called', {
                messageType,
                isTelemetryEnabled,
                hasPostHog: !!this.posthog,
                hasDistinctId: !!this.distinctId
            });

            if (!isTelemetryEnabled) {
                console.log('TelemetryService: Telemetry disabled by user setting');
                return;
            }

            if (!this.posthog || !this.distinctId) {
                console.log('TelemetryService: PostHog not initialized or distinct ID missing', {
                    posthog: !!this.posthog,
                    distinctId: this.distinctId
                });
                return;
            }

            // Send the event
            const eventData = {
                distinctId: this.distinctId,
                event: 'chat_interaction',
                properties: {
                    chatMessageType: messageType,
                    eventTimestamp: new Date().toISOString(),
                    extensionVersion: this.context.extension.packageJSON.version,
                    vscodeVersion: vscode.version
                }
            };

            console.log('TelemetryService: Sending event to PostHog', eventData);
            this.posthog.capture(eventData);

            console.log(`TelemetryService: Tracked ${messageType} event`);
        } catch (error) {
            // Fail silently to avoid impacting core functionality
            console.error('TelemetryService: Error tracking chat message:', error);
        }
    }

    /**
     * Track extension activation
     */
    public async trackExtensionActivation(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('samurai-agent');
            const isTelemetryEnabled = config.get<boolean>('enableTelemetry', true);

            if (!isTelemetryEnabled || !this.posthog || !this.distinctId) {
                return;
            }

            this.posthog.capture({
                distinctId: this.distinctId,
                event: 'extension_activated',
                properties: {
                    eventTimestamp: new Date().toISOString(),
                    extensionVersion: this.context.extension.packageJSON.version,
                    vscodeVersion: vscode.version
                }
            });

            console.log('TelemetryService: Tracked extension activation');
        } catch (error) {
            console.error('TelemetryService: Error tracking extension activation:', error);
        }
    }

    /**
     * Track telemetry setting changes
     */
    public async trackTelemetrySettingChange(enabled: boolean): Promise<void> {
        try {
            if (!this.posthog || !this.distinctId) {
                return;
            }

            this.posthog.capture({
                distinctId: this.distinctId,
                event: 'telemetry_setting_changed',
                properties: {
                    telemetryEnabled: enabled,
                    eventTimestamp: new Date().toISOString(),
                    extensionVersion: this.context.extension.packageJSON.version
                }
            });

            console.log(`TelemetryService: Tracked telemetry setting change: ${enabled}`);
        } catch (error) {
            console.error('TelemetryService: Error tracking telemetry setting change:', error);
        }
    }

    /**
     * Track LLM API key status changes
     * @param provider - LLM provider identifier (e.g., 'openai', 'gemini', 'claude', 'anthropic')
     * @param changeType - Type of change: 'added', 'updated', or 'removed'
     * @param hadKeyPreviously - Whether an API key was present before the change
     * @param hasKeyNow - Whether an API key is present after the change
     */
    public trackLLMKeyStatusChange(
        provider: 'openai' | 'gemini' | 'claude' | 'anthropic' | string,
        changeType: 'added' | 'updated' | 'removed',
        hadKeyPreviously: boolean,
        hasKeyNow: boolean
    ): void {
        try {
            // Check if telemetry is enabled
            const config = vscode.workspace.getConfiguration('samurai-agent');
            const isTelemetryEnabled = config.get<boolean>('enableTelemetry', true);

            if (!isTelemetryEnabled) {
                console.log('TelemetryService: Telemetry disabled, not tracking LLM key status change');
                return;
            }

            if (!this.posthog || !this.distinctId) {
                console.log('TelemetryService: PostHog not initialized or distinct ID missing, not tracking LLM key status change');
                return;
            }

            // Send the event
            this.posthog.capture({
                distinctId: this.distinctId,
                event: 'llm_key_status_changed',
                properties: {
                    provider,
                    changeType,
                    hadKeyPreviously,
                    hasKeyNow,
                    eventTimestamp: new Date().toISOString(),
                    extensionVersion: this.context.extension.packageJSON.version
                }
            });

            console.log(`TelemetryService: Tracked LLM key status change for ${provider}: ${changeType}`);
        } catch (error) {
            // Fail silently to avoid impacting core functionality
            console.error('TelemetryService: Error tracking LLM key status change:', error);
        }
    }

    /**
     * Capture critical errors to PostHog for monitoring and debugging
     * @param error - The error to capture (ErrorModel or Error instance)
     * @param properties - Optional additional context properties
     */
    public captureError(error: ErrorModel | Error, properties?: Record<string, any>): void {
        try {
            // Check if PostHog is initialized
            if (!this.posthog) {
                console.warn('TelemetryService: PostHog not initialized, cannot capture error');
                return;
            }

            // Check if telemetry is enabled
            const config = vscode.workspace.getConfiguration('samurai-agent');
            const isTelemetryEnabled = config.get<boolean>('enableTelemetry', true);

            if (!isTelemetryEnabled) {
                console.log('TelemetryService: Telemetry disabled, not capturing error');
                return;
            }

            // Extract standard properties
            const additionalProperties: Record<string, any> = {
                extensionVersion: this.context.extension.packageJSON.version,
                vscodeVersion: vscode.version,
                ...properties
            };

            // Extract ErrorModel properties if applicable
            if (this.isErrorModel(error)) {
                additionalProperties.severity = error.severity;
                additionalProperties.code = error.code;
                additionalProperties.category = error.category;
                additionalProperties.context = error.context;
                additionalProperties.userId = error.userId;
                additionalProperties.sessionId = error.sessionId;
                additionalProperties.requestId = error.requestId;
            }

            // Call PostHog capture with $exception event
            this.posthog.capture({
                distinctId: this.distinctId || 'anonymous',
                event: '$exception',
                properties: {
                    $exception_message: error.message,
                    $exception_type: this.isErrorModel(error) ? 'ErrorModel' : error.name,
                    $exception_stack: this.isErrorModel(error) ? error.stack : error.stack,
                    ...additionalProperties
                }
            });

            console.log('TelemetryService: Captured error to PostHog', {
                errorType: this.isErrorModel(error) ? 'ErrorModel' : 'Error',
                errorMessage: error.message,
                additionalProperties
            });
        } catch (captureError) {
            // Fail silently to avoid impacting core functionality
            console.error('TelemetryService: Error capturing error to PostHog:', captureError);
        }
    }

    /**
     * Type guard to check if an object is an ErrorModel
     */
    private isErrorModel(error: ErrorModel | Error): error is ErrorModel {
        return 'severity' in error && 'code' in error && 'category' in error;
    }

    /**
     * Clean up resources
     */
    public async dispose(): Promise<void> {
        try {
            if (this.posthog) {
                await this.posthog.shutdown();
                console.log('TelemetryService: PostHog client shutdown');
            }
        } catch (error) {
            console.error('TelemetryService: Error during disposal:', error);
        }
    }
}
