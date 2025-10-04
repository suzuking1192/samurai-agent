/**
 * Agent-related data models
 * 
 * Defines the structure for agent execution results and analysis interfaces
 * in the Samurai Agent extension.
 */

import { BaseModel } from '../../common/models/index';

/**
 * Agent execution result
 * Represents the outcome of an agent operation
 */
export interface AgentExecutionResult {
    success: boolean;
    message: string;
    payload?: any;
    metadata: Record<string, any>;
}

/**
 * Code extraction analysis result
 * Represents the analysis of whether new code context is needed
 */
export interface ICodeExtractionAnalysisResult {
    new_code_context_necessary: boolean;
    extraction_query: string;
    filePathPattern?: string;
    filenameKeywords?: string[];
    methodNameKeywords?: string[];
    codeKeywords?: string[];
}