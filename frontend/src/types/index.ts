// Enums
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum MemoryType {
  CONTEXT = 'context',
  DECISION = 'decision',
  NOTE = 'note'
}

// Core interfaces
export interface Project {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  created_at: string
  updated_at: string
}

export interface Memory {
  id: string
  project_id: string
  content: string
  type: MemoryType
  created_at: string
}

export interface ChatMessage {
  id: string
  project_id: string
  message: string
  response: string
  created_at: string
}

// Request/Response interfaces
export interface ChatRequest {
  project_id: string
  message: string
}

export interface ChatResponse {
  response: string
  tasks: Task[]
  memories: Memory[]
}

export interface ProjectCreate {
  name: string
  description: string
}

export interface TaskCreate {
  title: string
  description: string
  priority: TaskPriority
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
}

export interface MemoryCreate {
  content: string
  type: MemoryType
}

// API response interfaces
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Component prop interfaces
export interface ProjectSelectorProps {
  selectedProject: Project | null
  onProjectSelect: (project: Project) => void
}

export interface ChatProps {
  projectId?: string
}

export interface TaskPanelProps {
  projectId?: string
}

export interface MemoryPanelProps {
  projectId?: string
}

// Error types
export interface ApiError {
  message: string
  status: number
  details?: string
}

// Loading states
export interface LoadingState {
  isLoading: boolean
  error: string | null
} 