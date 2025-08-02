/**
 * Debug Utilities for Frontend-Backend Integration
 * 
 * This module provides debugging tools to help identify specific issues
 * with the integration between the React frontend and FastAPI backend.
 */

const API_BASE_URL = 'http://localhost:8000'
const FRONTEND_URL = 'http://localhost:5173'

class DebugLogger {
  constructor() {
    this.logs = []
    this.startTime = Date.now()
  }

  log(message, type = 'debug', data = null) {
    const timestamp = new Date().toISOString()
    const elapsed = Date.now() - this.startTime
    const logEntry = { timestamp, type, message, data, elapsed }
    this.logs.push(logEntry)
    
    const prefix = `[${timestamp}] [${type.toUpperCase()}] [${elapsed}ms]`
    console.log(`${prefix} ${message}`)
    
    if (data) {
      console.log(`${prefix} Data:`, data)
    }
  }

  error(message, data = null) {
    this.log(message, 'error', data)
  }

  warn(message, data = null) {
    this.log(message, 'warn', data)
  }

  success(message, data = null) {
    this.log(message, 'success', data)
  }

  getLogs() {
    return this.logs
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2)
  }
}

class NetworkMonitor {
  constructor() {
    this.logger = new DebugLogger()
    this.requests = []
  }

  async monitorRequest(endpoint, options = {}) {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.logger.log(`Starting request ${requestId} to ${endpoint}`, 'network')
    
    const requestData = {
      id: requestId,
      endpoint,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      startTime,
      status: null,
      responseTime: null,
      success: false,
      error: null,
      responseData: null
    }

    try {
      const url = `${API_BASE_URL}${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      let responseData
      try {
        responseData = await response.json()
      } catch (e) {
        responseData = null
      }

      requestData.status = response.status
      requestData.responseTime = responseTime
      requestData.success = response.ok
      requestData.responseData = responseData

      this.logger.log(
        `Request ${requestId} completed: ${response.status} (${responseTime}ms)`,
        response.ok ? 'success' : 'error',
        { endpoint, status: response.status, responseTime }
      )

      if (!response.ok) {
        this.logger.error(`Request ${requestId} failed`, {
          status: response.status,
          statusText: response.statusText,
          responseData
        })
      }

    } catch (error) {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      requestData.responseTime = responseTime
      requestData.error = error.message

      this.logger.error(`Request ${requestId} failed with error`, {
        error: error.message,
        responseTime
      })
    }

    this.requests.push(requestData)
    return requestData
  }

  getRequestSummary() {
    const total = this.requests.length
    const successful = this.requests.filter(r => r.success).length
    const failed = total - successful
    const avgResponseTime = this.requests.reduce((sum, r) => sum + (r.responseTime || 0), 0) / total

    return {
      total,
      successful,
      failed,
      successRate: (successful / total) * 100,
      avgResponseTime: Math.round(avgResponseTime)
    }
  }

  getFailedRequests() {
    return this.requests.filter(r => !r.success)
  }

  getSlowRequests(threshold = 1000) {
    return this.requests.filter(r => r.responseTime > threshold)
  }
}

class DataValidator {
  constructor() {
    this.logger = new DebugLogger()
  }

  validateProjectData(project) {
    const requiredFields = ['id', 'name', 'description', 'tech_stack', 'created_at']
    const missingFields = requiredFields.filter(field => !project[field])
    
    if (missingFields.length > 0) {
      this.logger.error('Project data validation failed', {
        missingFields,
        project
      })
      return false
    }

    this.logger.success('Project data validation passed')
    return true
  }

  validateTaskData(task) {
    const requiredFields = ['id', 'title', 'description', 'completed', 'created_at']
    const missingFields = requiredFields.filter(field => !(field in task))
    
    if (missingFields.length > 0) {
      this.logger.error('Task data validation failed', {
        missingFields,
        task
      })
      return false
    }

    this.logger.success('Task data validation passed')
    return true
  }

  validateMemoryData(memory) {
    const requiredFields = ['id', 'title', 'content', 'type', 'created_at']
    const missingFields = requiredFields.filter(field => !memory[field])
    
    if (missingFields.length > 0) {
      this.logger.error('Memory data validation failed', {
        missingFields,
        memory
      })
      return false
    }

    this.logger.success('Memory data validation passed')
    return true
  }

  validateChatMessageData(message) {
    const requiredFields = ['id', 'role', 'content', 'timestamp']
    const missingFields = requiredFields.filter(field => !message[field])
    
    if (missingFields.length > 0) {
      this.logger.error('Chat message data validation failed', {
        missingFields,
        message
      })
      return false
    }

    this.logger.success('Chat message data validation passed')
    return true
  }

  compareDataStructures(frontendData, backendData, dataType) {
    this.logger.log(`Comparing ${dataType} data structures`)
    
    const frontendKeys = Object.keys(frontendData)
    const backendKeys = Object.keys(backendData)
    
    const missingInBackend = frontendKeys.filter(key => !backendKeys.includes(key))
    const missingInFrontend = backendKeys.filter(key => !frontendKeys.includes(key))
    
    if (missingInBackend.length > 0) {
      this.logger.warn(`${dataType} fields missing in backend`, missingInBackend)
    }
    
    if (missingInFrontend.length > 0) {
      this.logger.warn(`${dataType} fields missing in frontend`, missingInFrontend)
    }
    
    if (missingInBackend.length === 0 && missingInFrontend.length === 0) {
      this.logger.success(`${dataType} data structures match`)
      return true
    }
    
    return false
  }
}

class StateInspector {
  constructor() {
    this.logger = new DebugLogger()
  }

  async inspectBackendState() {
    this.logger.log('Inspecting backend state...')
    
    const state = {
      projects: [],
      tasks: [],
      memories: [],
      chatMessages: []
    }

    try {
      // Get all projects
      const projectsResponse = await fetch(`${API_BASE_URL}/projects`)
      if (projectsResponse.ok) {
        state.projects = await projectsResponse.json()
        this.logger.log(`Found ${state.projects.length} projects`)
      }

      // For each project, get tasks, memories, and chat messages
      for (const project of state.projects) {
        // Get tasks
        const tasksResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks`)
        if (tasksResponse.ok) {
          const tasks = await tasksResponse.json()
          state.tasks.push(...tasks)
        }

        // Get memories
        const memoriesResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories`)
        if (memoriesResponse.ok) {
          const memories = await memoriesResponse.json()
          state.memories.push(...memories)
        }

        // Try to get chat messages (if endpoint exists)
        try {
          const chatResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/chat-messages`)
          if (chatResponse.ok) {
            const messages = await chatResponse.json()
            state.chatMessages.push(...messages)
          }
        } catch (error) {
          this.logger.warn(`Chat messages endpoint not available for project ${project.id}`)
        }
      }

      this.logger.success('Backend state inspection completed', {
        projects: state.projects.length,
        tasks: state.tasks.length,
        memories: state.memories.length,
        chatMessages: state.chatMessages.length
      })

      return state
    } catch (error) {
      this.logger.error('Backend state inspection failed', error)
      return null
    }
  }

  async inspectFrontendState() {
    this.logger.log('Inspecting frontend state...')
    
    try {
      const response = await fetch(FRONTEND_URL)
      if (!response.ok) {
        this.logger.error('Frontend is not accessible')
        return null
      }

      // Note: In a real browser environment, we could inspect React state
      // For now, we'll just check if the frontend is reachable
      this.logger.success('Frontend is accessible')
      return { accessible: true }
    } catch (error) {
      this.logger.error('Frontend state inspection failed', error)
      return null
    }
  }
}

class IssueDetector {
  constructor() {
    this.logger = new DebugLogger()
    this.networkMonitor = new NetworkMonitor()
    this.dataValidator = new DataValidator()
    this.stateInspector = new StateInspector()
  }

  async detectChatPersistenceIssues() {
    this.logger.log('Detecting chat persistence issues...')
    
    const issues = []

    // Test 1: Check if chat messages are being saved
    const testMessage = `Debug test message ${Date.now()}`
    
    // Create a test project
    const projectResponse = await this.networkMonitor.monitorRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Debug Test Project',
        description: 'Project for debugging chat persistence',
        tech_stack: 'Debug Stack'
      })
    })

    if (!projectResponse.success) {
      issues.push('Cannot create test project for chat testing')
      return issues
    }

    const projectId = projectResponse.responseData.id

    // Test 2: Send a chat message
    const chatResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: testMessage })
    })

    if (!chatResponse.success) {
      issues.push('Chat endpoint is not working')
      return issues
    }

    // Test 3: Try to retrieve chat messages
    const messagesResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/chat-messages`)
    
    if (!messagesResponse.success) {
      issues.push('Chat messages endpoint does not exist or is not working')
    } else if (messagesResponse.responseData.length === 0) {
      issues.push('Chat messages are not being saved')
    }

    // Cleanup
    await this.networkMonitor.monitorRequest(`/projects/${projectId}`, {
      method: 'DELETE'
    })

    return issues
  }

  async detectTaskIntegrationIssues() {
    this.logger.log('Detecting task integration issues...')
    
    const issues = []

    // Create a test project
    const projectResponse = await this.networkMonitor.monitorRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Debug Test Project',
        description: 'Project for debugging task integration',
        tech_stack: 'Debug Stack'
      })
    })

    if (!projectResponse.success) {
      issues.push('Cannot create test project for task testing')
      return issues
    }

    const projectId = projectResponse.responseData.id

    // Test task creation
    const taskData = {
      title: 'Debug Test Task',
      description: 'Task for debugging',
      prompt: 'Debug prompt',
      completed: false,
      order: 1
    }

    const createResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData)
    })

    if (!createResponse.success) {
      issues.push('Task creation is not working')
    } else {
      // Validate task data
      if (!this.dataValidator.validateTaskData(createResponse.responseData)) {
        issues.push('Task data structure is invalid')
      }
    }

    // Test task retrieval
    const getResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/tasks`)
    
    if (!getResponse.success) {
      issues.push('Task retrieval is not working')
    }

    // Cleanup
    await this.networkMonitor.monitorRequest(`/projects/${projectId}`, {
      method: 'DELETE'
    })

    return issues
  }

  async detectMemoryIntegrationIssues() {
    this.logger.log('Detecting memory integration issues...')
    
    const issues = []

    // Create a test project
    const projectResponse = await this.networkMonitor.monitorRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Debug Test Project',
        description: 'Project for debugging memory integration',
        tech_stack: 'Debug Stack'
      })
    })

    if (!projectResponse.success) {
      issues.push('Cannot create test project for memory testing')
      return issues
    }

    const projectId = projectResponse.responseData.id

    // Test memory creation
    const memoryData = {
      title: 'Debug Test Memory',
      content: 'Memory content for debugging',
      type: 'note'
    }

    const createResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/memories`, {
      method: 'POST',
      body: JSON.stringify(memoryData)
    })

    if (!createResponse.success) {
      issues.push('Memory creation is not working')
    } else {
      // Validate memory data
      if (!this.dataValidator.validateMemoryData(createResponse.responseData)) {
        issues.push('Memory data structure is invalid')
      }
    }

    // Test memory retrieval
    const getResponse = await this.networkMonitor.monitorRequest(`/projects/${projectId}/memories`)
    
    if (!getResponse.success) {
      issues.push('Memory retrieval is not working')
    }

    // Cleanup
    await this.networkMonitor.monitorRequest(`/projects/${projectId}`, {
      method: 'DELETE'
    })

    return issues
  }

  async detectApiEndpointMismatches() {
    this.logger.log('Detecting API endpoint mismatches...')
    
    const issues = []

    // Check endpoints that frontend expects vs what backend provides
    const expectedEndpoints = [
      '/projects',
      '/projects/{id}',
      '/projects/{id}/tasks',
      '/projects/{id}/memories',
      '/projects/{id}/chat-messages',
      '/chat',
      '/health'
    ]

    for (const endpoint of expectedEndpoints) {
      const testEndpoint = endpoint.replace('{id}', 'test-id')
      const response = await this.networkMonitor.monitorRequest(testEndpoint)
      
      if (response.status === 404) {
        issues.push(`Endpoint ${endpoint} does not exist`)
      }
    }

    return issues
  }

  async runFullDiagnostic() {
    this.logger.log('Running full diagnostic...')
    
    const diagnostic = {
      chatIssues: [],
      taskIssues: [],
      memoryIssues: [],
      endpointIssues: [],
      networkSummary: null,
      backendState: null
    }

    // Run all diagnostics
    diagnostic.chatIssues = await this.detectChatPersistenceIssues()
    diagnostic.taskIssues = await this.detectTaskIntegrationIssues()
    diagnostic.memoryIssues = await this.detectMemoryIntegrationIssues()
    diagnostic.endpointIssues = await this.detectApiEndpointMismatches()
    
    // Get network summary
    diagnostic.networkSummary = this.networkMonitor.getRequestSummary()
    
    // Get backend state
    diagnostic.backendState = await this.stateInspector.inspectBackendState()

    // Generate report
    this.generateDiagnosticReport(diagnostic)

    return diagnostic
  }

  generateDiagnosticReport(diagnostic) {
    this.logger.log('=== DIAGNOSTIC REPORT ===')
    
    const totalIssues = diagnostic.chatIssues.length + 
                       diagnostic.taskIssues.length + 
                       diagnostic.memoryIssues.length + 
                       diagnostic.endpointIssues.length

    this.logger.log(`Total Issues Found: ${totalIssues}`)
    
    if (diagnostic.chatIssues.length > 0) {
      this.logger.log('\nChat Persistence Issues:')
      diagnostic.chatIssues.forEach(issue => this.logger.error(`- ${issue}`))
    }

    if (diagnostic.taskIssues.length > 0) {
      this.logger.log('\nTask Integration Issues:')
      diagnostic.taskIssues.forEach(issue => this.logger.error(`- ${issue}`))
    }

    if (diagnostic.memoryIssues.length > 0) {
      this.logger.log('\nMemory Integration Issues:')
      diagnostic.memoryIssues.forEach(issue => this.logger.error(`- ${issue}`))
    }

    if (diagnostic.endpointIssues.length > 0) {
      this.logger.log('\nAPI Endpoint Issues:')
      diagnostic.endpointIssues.forEach(issue => this.logger.error(`- ${issue}`))
    }

    this.logger.log('\nNetwork Summary:', diagnostic.networkSummary)
    
    if (diagnostic.backendState) {
      this.logger.log('\nBackend State:', {
        projects: diagnostic.backendState.projects.length,
        tasks: diagnostic.backendState.tasks.length,
        memories: diagnostic.backendState.memories.length,
        chatMessages: diagnostic.backendState.chatMessages.length
      })
    }
  }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DebugLogger,
    NetworkMonitor,
    DataValidator,
    StateInspector,
    IssueDetector
  }
}

// Run diagnostic if this file is executed directly
if (typeof window === 'undefined') {
  const detector = new IssueDetector()
  detector.runFullDiagnostic().then(diagnostic => {
    console.log('\n=== DIAGNOSTIC COMPLETED ===')
  })
} 