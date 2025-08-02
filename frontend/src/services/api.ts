import {
  Project,
  Task,
  Memory,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ProjectCreate,
  TaskCreate,
  TaskUpdate,
  MemoryCreate
} from '../types'

const API_BASE_URL = 'http://localhost:8000'

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const response = await fetch(url, { ...defaultOptions, ...options })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(
      errorData.detail || `HTTP error! status: ${response.status}`,
      response.status,
      errorData.details
    )
  }

  return response.json()
}

// Project API functions
export async function getProjects(): Promise<Project[]> {
  return apiRequest<Project[]>('/projects')
}

export async function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`)
}

export async function createProject(project: ProjectCreate): Promise<Project> {
  return apiRequest<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}`, {
    method: 'DELETE',
  })
}

// Task API functions
export async function getTasks(projectId: string): Promise<Task[]> {
  return apiRequest<Task[]>(`/projects/${projectId}/tasks`)
}

export async function createTask(projectId: string, task: TaskCreate): Promise<Task> {
  return apiRequest<Task>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export async function updateTask(projectId: string, taskId: string, updates: TaskUpdate): Promise<Task> {
  return apiRequest<Task>(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

// Memory API functions
export async function getMemories(projectId: string): Promise<Memory[]> {
  return apiRequest<Memory[]>(`/projects/${projectId}/memories`)
}

export async function createMemory(projectId: string, memory: MemoryCreate): Promise<Memory> {
  return apiRequest<Memory>(`/projects/${projectId}/memories`, {
    method: 'POST',
    body: JSON.stringify(memory),
  })
}

export async function deleteMemory(projectId: string, memoryId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/memories/${memoryId}`, {
    method: 'DELETE',
  })
}

// Chat API functions
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return apiRequest<ChatResponse>(`/projects/${request.project_id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message: request.message }),
  })
}

// Chat message history (if implemented in backend)
export async function getChatMessages(projectId: string): Promise<ChatMessage[]> {
  // This endpoint might not exist yet, but we'll include it for future use
  try {
    return apiRequest<ChatMessage[]>(`/projects/${projectId}/chat-messages`)
  } catch (error) {
    // If the endpoint doesn't exist, return empty array
    console.warn('Chat messages endpoint not implemented yet')
    return []
  }
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health')
}

// Export the ApiError class for use in components
export { ApiError } 