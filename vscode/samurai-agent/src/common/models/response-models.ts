/**
 * Response-related data models
 * 
 * Defines the structure for API responses, error handling, and communication
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Response types for webview communication
 */
export enum ResponseType {
    SUCCESS = 'success',
    ERROR = 'error',
    LOADING = 'loading',
    PROGRESS = 'progress'
}

/**
 * Standard API response model
 */
export interface ApiResponse<T = any> {
    type: ResponseType;
    requestId?: string;
    payload?: T;
    error?: string;
    message?: string;
    timestamp: Date;
}

/**
 * Success response model
 */
export interface SuccessResponse<T = any> extends ApiResponse<T> {
    type: ResponseType.SUCCESS;
    payload: T;
}

/**
 * Error response model
 */
export interface ErrorResponse extends ApiResponse {
    type: ResponseType.ERROR;
    error: string;
    code?: string;
    details?: Record<string, any>;
}

/**
 * Loading response model
 */
export interface LoadingResponse extends ApiResponse {
    type: ResponseType.LOADING;
    message: string;
}

/**
 * Progress response model
 */
export interface ProgressResponse extends ApiResponse {
    type: ResponseType.PROGRESS;
    progress: {
        current: number;
        total: number;
        percentage: number;
        message: string;
    };
}

/**
 * Paginated response model
 */
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        hasMore: boolean;
    };
}
