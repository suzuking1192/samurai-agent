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

export async function completeTask(projectId: string, taskId: string): Promise<Task> {
  return apiRequest<Task>(`/projects/${projectId}/tasks/${taskId}/complete`, {
    method: 'POST'
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

// Project Detail (long-form spec) API
export async function getProjectDetail(projectId: string): Promise<{ content: string }> {
  return apiRequest<{ content: string }>(`/projects/${projectId}/project-detail`)
}

export async function ingestProjectDetail(projectId: string, rawText: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/projects/${projectId}/project-detail/ingest`, {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText })
  })
}

export async function saveProjectDetail(projectId: string, content: string): Promise<{ status: string; chars: number }> {
  return apiRequest<{ status: string; chars: number }>(`/projects/${projectId}/project-detail/save`, {
    method: 'POST',
    body: JSON.stringify({ content })
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
  onComplete?: (response: string, intent_type?: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  // Use the new simplified streaming endpoint
  const url = `${API_BASE_URL}/projects/${request.project_id}/chat-stream`
  
  try {
    console.log('🚀 Starting streaming chat request:', url)
    const startTime = Date.now()
    
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
      throw new Error('No response body available for streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let progressCount = 0
    let lastProgressTime = startTime
    
    console.log('✅ Streaming connection established, waiting for progress updates...')
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('📤 Streaming completed')
        break
      }
      
      // Decode the chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue
        
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const currentTime = Date.now()
            const timeSinceStart = currentTime - startTime
            const timeSinceLastProgress = currentTime - lastProgressTime
            
            console.log(`📤 [${timeSinceStart}ms] Received streaming data:`, data.type, data)
            
            if (data.type === 'progress' && onProgress) {
              progressCount++
              console.log(`🎯 [${timeSinceStart}ms] Progress #${progressCount}: ${data.progress.step} - ${data.progress.message}`)
              console.log(`⏱️ Time since last progress: ${timeSinceLastProgress}ms`)
              
              // Add timing info to the progress data
              const progressWithTiming = {
                ...data.progress,
                frontendReceivedAt: new Date().toISOString(),
                timeSinceStart: timeSinceStart,
                timeSinceLastProgress: timeSinceLastProgress,
                progressNumber: progressCount
              }
              
              onProgress(progressWithTiming)
              lastProgressTime = currentTime
              
            } else if (data.type === 'complete' && onComplete) {
              const totalTime = currentTime - startTime
              console.log(`✅ [${timeSinceStart}ms] Streaming completed successfully after ${totalTime}ms`)
              console.log(`📊 Total progress updates received: ${progressCount}`)
              console.log(`🎯 Intent type: ${data.intent_type || 'unknown'}`)
              onComplete(data.response, data.intent_type)
              return
            } else if (data.type === 'error' && onError) {
              console.error(`❌ [${timeSinceStart}ms] Streaming error received:`, data.error)
              onError(data.error)
              return
            } else if (data.type === 'heartbeat') {
              console.log(`💓 [${timeSinceStart}ms] Heartbeat received`)
            }
          } catch (e) {
            console.error('❌ Error parsing streaming data:', e, 'Raw line:', line)
          }
        }
      }
    }
    
    // If we reach here without a complete response, it's an error
    if (onError) {
      onError('Streaming connection closed unexpectedly')
    }
    
  } catch (error) {
    console.error('❌ Error in streaming chat:', error)
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
  return apiRequest<ChatMessage[]>(`/projects/${projectId}/session-messages/${sessionId}`)
}

export async function getCurrentSession(projectId: string): Promise<Session> {
  return apiRequest<Session>(`/projects/${projectId}/current-session`)
}

export async function getConversationHistory(projectId: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/projects/${projectId}/conversation-history`)
}

// Session end with memory consolidation
export interface MemoryConsolidationResult {
  status: string
  total_insights_processed: number
  total_insights_skipped: number
  categories_affected: Array<{
    category: string
    memories_updated: number
    memories_created: number
    insights_processed: number
    is_new_category?: boolean
  }>
  new_categories_created: string[]
  total_memories_affected: number
}

export interface SessionEndDetailedResponse {
  status: string
  memory_consolidation: MemoryConsolidationResult
  new_session_id: string
  insights_found: number
  session_relevance: number
}

export interface SessionEndImmediateResponse {
  status: string
  new_session_id: string
}

export async function endSessionWithConsolidation(
  projectId: string, 
  sessionId: string
): Promise<SessionEndImmediateResponse | SessionEndDetailedResponse> {
  return apiRequest<SessionEndImmediateResponse | SessionEndDetailedResponse>(`/api/projects/${projectId}/sessions/end`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  })
}

// Task Context API functions
export interface TaskContextResponse {
  success: boolean
  task_context?: Task
  session_id: string
}

export async function setTaskContext(projectId: string, sessionId: string, taskId: string): Promise<TaskContextResponse> {
  return apiRequest<TaskContextResponse>(`/projects/${projectId}/sessions/${sessionId}/set-task-context`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: taskId,
      session_id: sessionId
    })
  })
}

export async function clearTaskContext(projectId: string, sessionId: string): Promise<{ message: string; session_id: string }> {
  return apiRequest<{ message: string; session_id: string }>(`/projects/${projectId}/sessions/${sessionId}/task-context`, {
    method: 'DELETE'
  })
}

export async function getTaskContext(projectId: string, sessionId: string): Promise<{
  session_id: string
  task_context?: Task
  has_context: boolean
}> {
  return apiRequest<{
    session_id: string
    task_context?: Task
    has_context: boolean
  }>(`/projects/${projectId}/sessions/${sessionId}/task-context`)
}

// Removed: /api/suggestions/should-breakdown endpoint and related API

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

// ---------------------------
// User suggestion banner APIs
// ---------------------------

export async function getSuggestionStatus(): Promise<{ should_show: boolean }> {
  return apiRequest<{ should_show: boolean }>(`/api/user/suggestion-status`)
}

export async function dismissSuggestion(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/api/user/suggestion-dismiss`, {
    method: 'POST'
  })
}