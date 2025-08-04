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
  MemoryCreate,
  Session
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
  
  console.log('API Request:', { url, method: options.method || 'GET', body: options.body })
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const response = await fetch(url, { ...defaultOptions, ...options })
  
  console.log('API Response:', { status: response.status, ok: response.ok })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('API Error:', errorData)
    throw new ApiError(
      errorData.detail || `HTTP error! status: ${response.status}`,
      response.status,
      errorData.details
    )
  }

  const data = await response.json()
  console.log('API Success:', data)
  return data
}

// Project API functions
export async function getProjects(): Promise<Project[]> {
  return apiRequest<Project[]>('/projects')
}

export async function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`)
}

export async function createProject(project: ProjectCreate): Promise<Project> {
  console.log('API: Creating project with data:', project)
  try {
    const result = await apiRequest<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    })
    console.log('API: Project created successfully:', result)
    return result
  } catch (error) {
    console.error('API: Error creating project:', error)
    throw error
  }
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

// Streaming chat with progress updates
export async function sendChatMessageWithProgress(
  request: ChatRequest,
  onProgress?: (progress: any) => void,
  onComplete?: (response: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  const url = `${API_BASE_URL}/projects/${request.project_id}/chat-with-progress`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: request.message }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        errorData.detail || `HTTP error! status: ${response.status}`,
        response.status,
        errorData.details
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === 'progress' && onProgress) {
              onProgress(data.progress)
            } else if (data.type === 'complete' && onComplete) {
              onComplete(data.response)
            } else if (data.type === 'error' && onError) {
              onError(data.error)
            }
          } catch (e) {
            console.error('Error parsing progress data:', e)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in streaming chat:', error)
    if (onError) {
      onError(error instanceof Error ? error.message : 'Unknown error')
    }
    throw error
  }
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

// Session management API functions
export async function getSessions(projectId: string): Promise<{sessions: Session[], total: number}> {
  return apiRequest<{sessions: Session[], total: number}>(`/projects/${projectId}/sessions`)
}

export async function createSession(projectId: string, name?: string): Promise<Session> {
  return apiRequest<Session>(`/projects/${projectId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function getSessionMessages(projectId: string, sessionId: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/projects/${projectId}/sessions/${sessionId}/messages`)
}

export async function getCurrentSession(projectId: string): Promise<Session> {
  return apiRequest<Session>(`/projects/${projectId}/current-session`)
}

export const getSemanticHierarchy = async (
  projectId: string, 
  clusteringType: string = 'content', 
  depth: number = 2
): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/semantic-hierarchy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        clustering_type: clusteringType,
        depth: depth
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching semantic hierarchy:', error)
    throw error
  }
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health')
}

// Export the ApiError class for use in components
export { ApiError } 