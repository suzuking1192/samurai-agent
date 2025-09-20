/**
 * Agent configuration models
 * 
 * Defines the structure for agent configuration and status management
 * in the Samurai Agent extension.
 */

import { BaseModel, AgentStatus } from './index';

/**
 * Agent configuration interface
 * Extends the base configuration with additional properties
 */
export interface AgentConfig extends BaseModel {
    name: string;
    version: string;
    status: AgentStatus;
    settings: Record<string, any>;
    capabilities: string[];
    lastHeartbeat: Date;
    metadata: Record<string, any>;
}

/**
 * Agent status update request
 */
export interface UpdateAgentStatusRequest {
    status: AgentStatus;
    metadata?: Record<string, any>;
}

/**
 * Agent capability registration
 */
export interface AgentCapability {
    name: string;
    version: string;
    description: string;
    parameters: Record<string, any>;
    enabled: boolean;
}
