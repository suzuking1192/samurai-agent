/**
 * Task-related data models
 * 
 * Defines the structure for tasks, subtasks, and task-related operations
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Task status enumeration
 */
export enum TaskStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

/**
 * Task priority levels
 */
export enum TaskPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * Main Task model
 * Represents a task with all its properties and relationships
 */
export interface Task extends BaseModel {
    title: string;
    spec: string; // Corresponds to backend 'description'
    status: TaskStatus;
    priority: TaskPriority;
    isCompleted: boolean;
    depth: number;
    parentTaskId: string | null;
    hasSubtasks: boolean;
    tags: string[];
    estimatedHours?: number;
    actualHours?: number;
    dueDate?: Date;
    assignedTo?: string;
    dependencies: string[]; // Array of task IDs this task depends on
    metadata: Record<string, any>;
}

/**
 * Task creation request model
 */
export interface CreateTaskRequest {
    title: string;
    spec: string;
    parentTaskId?: string | null;
    priority?: TaskPriority;
    tags?: string[];
    estimatedHours?: number;
    dueDate?: Date;
    assignedTo?: string;
    dependencies?: string[];
    metadata?: Record<string, any>;
}

/**
 * Task update request model
 */
export interface UpdateTaskRequest {
    id: string;
    title?: string;
    spec?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
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
 * Task filter options for queries
 */
export interface TaskFilter {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    parentTaskId?: string | null;
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
 * Task query result with pagination
 */
export interface TaskQueryResult {
    tasks: Task[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
