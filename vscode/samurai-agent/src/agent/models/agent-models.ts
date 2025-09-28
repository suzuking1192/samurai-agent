/**
 * Agent-related data models
 * 
 * Defines the structure for agent execution results and agent-specific interfaces
 * in the Samurai Agent extension.
 */

/**
 * Standard return interface for agent execution results
 */
export interface AgentExecutionResult {
    success: boolean;
    message: string;
    payload?: any;
    metadata: Record<string, any>;
}
