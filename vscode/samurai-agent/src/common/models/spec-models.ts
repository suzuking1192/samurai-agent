/**
 * Spec-related data models
 * 
 * Defines the structure for specs, subspecs, and spec-related operations
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Spec status enumeration
 */
export enum SpecStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

/**
 * Spec priority levels
 */
export enum SpecPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * Main Spec model
 * Represents a spec with all its properties and relationships
 */
export interface Spec extends BaseModel {
    title: string;
    spec: string; // Corresponds to backend 'description'
    status: SpecStatus;
    priority: SpecPriority;
    isCompleted: boolean;
    depth: number;
    parentSpecId: string | null;
    hasSubspecs: boolean;
    tags: string[];
    estimatedHours?: number;
    actualHours?: number;
    dueDate?: Date;
    assignedTo?: string;
    dependencies: string[]; // Array of spec IDs this spec depends on
    metadata: Record<string, any>;
}

/**
 * Spec creation request model
 */
export interface CreateSpecRequest {
    title: string;
    spec: string;
    parentSpecId?: string | null;
    priority?: SpecPriority;
    tags?: string[];
    estimatedHours?: number;
    dueDate?: Date;
    assignedTo?: string;
    dependencies?: string[];
    metadata?: Record<string, any>;
}

/**
 * Spec update request model
 */
export interface UpdateSpecRequest {
    id: string;
    title?: string;
    spec?: string;
    status?: SpecStatus;
    priority?: SpecPriority;
    isCompleted?: boolean;
    tags?: string[];
    estimatedHours?: number;
    actualHours?: number;
    dueDate?: Date;
    assignedTo?: string;
    dependencies?: string[];
    metadata?: Record<string, any>;
}

/**
 * Spec filter options for queries
 */
export interface SpecFilter {
    status?: SpecStatus[];
    priority?: SpecPriority[];
    parentSpecId?: string | null;
    isCompleted?: boolean;
    tags?: string[];
    assignedTo?: string;
    dueDateRange?: {
        start: Date;
        end: Date;
    };
    search?: string; // Text search in title and spec
}

/**
 * Spec query result with pagination
 */
export interface SpecQueryResult {
    specs: Spec[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// Legacy aliases for backward compatibility during transition
export type Task = Spec;
export type TaskStatus = SpecStatus;
export type TaskPriority = SpecPriority;
export type CreateTaskRequest = CreateSpecRequest;
export type UpdateTaskRequest = UpdateSpecRequest;
export type TaskFilter = SpecFilter;
export type TaskQueryResult = SpecQueryResult;


