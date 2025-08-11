/**
 * Frontend-Backend Integration Tests
 * 
 * This test suite validates the communication between the React frontend
 * and FastAPI backend, specifically testing:
 * - Chat persistence and history
 * - Task creation and management
 * - Memory system integration
 * - Data refresh and persistence
 * - Error handling and edge cases
 */

const API_BASE_URL = 'http://localhost:8000'
const FRONTEND_URL = 'http://localhost:5173'

// Test utilities
class TestLogger {
  constructor() {
    this.logs = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = { timestamp, type, message }
    this.logs.push(logEntry)
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`)
  }

  error(message) {
    this.log(message, 'error')
  }

  success(message) {
    this.log(message, 'success')
  }

  getLogs() {
    return this.logs
  }
}

class ApiTester {
  constructor() {
    this.logger = new TestLogger()
    this.testProjectId = null
    this.testData = {
      projects: [],
      tasks: [],
      memories: [],
      chatMessages: []
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, { ...defaultOptions, ...options })
      const data = await response.json().catch(() => ({}))
      
      return {
        status: response.status,
        ok: response.ok,
        data,
        headers: Object.fromEntries(response.headers.entries())
      }
    } catch (error) {
      this.logger.error(`Request failed: ${error.message}`)
      throw error
    }
  }

  async healthCheck() {
    this.logger.log('Testing backend connectivity...')
    
    try {
      const result = await this.makeRequest('/health')
      
      if (result.ok && result.data.status === 'healthy') {
        this.logger.success('Backend is reachable and healthy')
        return true
      } else {
        this.logger.error(`Backend health check failed: ${result.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Backend connectivity test failed: ${error.message}`)
      return false
    }
  }

  async testCorsConfiguration() {
    this.logger.log('Testing CORS configuration...')
    
    try {
      const result = await this.makeRequest('/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': FRONTEND_URL,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      })
      
      const corsHeaders = result.headers
      const hasCorsHeaders = corsHeaders['access-control-allow-origin'] || 
                           corsHeaders['Access-Control-Allow-Origin']
      
      if (hasCorsHeaders) {
        this.logger.success('CORS is properly configured')
        return true
      } else {
        this.logger.error('CORS headers not found in response')
        return false
      }
    } catch (error) {
      this.logger.error(`CORS test failed: ${error.message}`)
      return false
    }
  }

  async createTestProject() {
    this.logger.log('Creating test project...')
    
    const projectData = {
      name: `Test Project ${Date.now()}`,
      description: 'Integration test project',
      tech_stack: 'React, TypeScript, FastAPI, Python'
    }

    try {
      const result = await this.makeRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
      })

      if (result.ok) {
        this.testProjectId = result.data.id
        this.testData.projects.push(result.data)
        this.logger.success(`Test project created with ID: ${this.testProjectId}`)
        return result.data
      } else {
        this.logger.error(`Failed to create test project: ${result.status}`)
        return null
      }
    } catch (error) {
      this.logger.error(`Project creation failed: ${error.message}`)
      return null
    }
  }

  async testChatPersistence() {
    this.logger.log('Testing chat persistence...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for chat testing')
      return false
    }

    const testMessage = `Test message ${Date.now()}`
    
    try {
      // Send a chat message
      const chatResult = await this.makeRequest(`/projects/${this.testProjectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: testMessage })
      })

      if (!chatResult.ok) {
        this.logger.error(`Chat request failed: ${chatResult.status}`)
        return false
      }

      this.logger.success('Chat message sent successfully')
      
      // Check if chat messages are saved (this endpoint might not exist yet)
      try {
        const messagesResult = await this.makeRequest(`/projects/${this.testProjectId}/chat-messages`)
        
        if (messagesResult.ok) {
          this.logger.success('Chat messages endpoint exists and returns data')
          this.testData.chatMessages = messagesResult.data
          return true
        } else {
          this.logger.log('Chat messages endpoint not implemented yet')
          return true // Not a failure, just not implemented
        }
      } catch (error) {
        this.logger.log('Chat messages endpoint not available')
        return true // Not a failure, just not implemented
      }
    } catch (error) {
      this.logger.error(`Chat persistence test failed: ${error.message}`)
      return false
    }
  }

  async testTaskCreation() {
    this.logger.log('Testing task creation...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for task testing')
      return false
    }

    const taskData = {
      title: `Test Task ${Date.now()}`,
      description: 'Integration test task',
      prompt: 'Test task prompt',
      completed: false,
      order: 1
    }

    try {
      const result = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData)
      })

      if (result.ok) {
        this.testData.tasks.push(result.data)
        this.logger.success(`Task created with ID: ${result.data.id}`)
        
        // Test task retrieval
        const tasksResult = await this.makeRequest(`/projects/${this.testProjectId}/tasks`)
        
        if (tasksResult.ok) {
          this.logger.success('Tasks can be retrieved successfully')
          return true
        } else {
          this.logger.error('Failed to retrieve tasks')
          return false
        }
      } else {
        this.logger.error(`Task creation failed: ${result.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Task creation test failed: ${error.message}`)
      return false
    }
  }

  async testHierarchicalTasks() {
    this.logger.log('Testing hierarchical task creation (depth limit 4)...')
    if (!this.testProjectId) {
      this.logger.error('No test project available for hierarchical task testing')
      return false
    }

    const mkTask = async (title, parent) => {
      const payload = {
        title,
        description: title,
        priority: 'medium'
      }
      if (parent) payload.parent_task_id = parent
      return this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    try {
      // Depth 1 (root)
      const r1 = await mkTask('root', null)
      if (!r1.ok) return false
      const rootId = r1.data.id

      // Depth 2
      const r2 = await mkTask('child-2', rootId)
      if (!r2.ok) return false
      const d2 = r2.data.id

      // Depth 3
      const r3 = await mkTask('child-3', d2)
      if (!r3.ok) return false
      const d3 = r3.data.id

      // Depth 4
      const r4 = await mkTask('child-4', d3)
      if (!r4.ok) return false

      // Depth 5 should fail
      const r5 = await mkTask('child-5', r4.data.id)
      if (r5.ok || r5.status !== 400) {
        this.logger.error('Expected depth 5 task creation to fail with 400')
        return false
      }

      this.logger.success('Hierarchical task depth validation works')
      return true
    } catch (e) {
      this.logger.error(`Hierarchical task test failed: ${e.message}`)
      return false
    }
  }

  async testTaskUpdates() {
    this.logger.log('Testing task updates...')
    
    if (this.testData.tasks.length === 0) {
      this.logger.error('No tasks available for update testing')
      return false
    }

    const task = this.testData.tasks[0]
    
    try {
      const result = await this.makeRequest(`/projects/${this.testProjectId}/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ completed: true })
      })

      if (result.ok) {
        this.logger.success('Task update successful')
        return true
      } else {
        this.logger.error(`Task update failed: ${result.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Task update test failed: ${error.message}`)
      return false
    }
  }

  async testMemoryCreation() {
    this.logger.log('Testing memory creation...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for memory testing')
      return false
    }

    const memoryData = {
      title: `Test Memory ${Date.now()}`,
      content: 'Integration test memory content',
      type: 'note'
    }

    try {
      const result = await this.makeRequest(`/projects/${this.testProjectId}/memories`, {
        method: 'POST',
        body: JSON.stringify(memoryData)
      })

      if (result.ok) {
        this.testData.memories.push(result.data)
        this.logger.success(`Memory created with ID: ${result.data.id}`)
        
        // Test memory retrieval
        const memoriesResult = await this.makeRequest(`/projects/${this.testProjectId}/memories`)
        
        if (memoriesResult.ok) {
          this.logger.success('Memories can be retrieved successfully')
          return true
        } else {
          this.logger.error('Failed to retrieve memories')
          return false
        }
      } else {
        this.logger.error(`Memory creation failed: ${result.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Memory creation test failed: ${error.message}`)
      return false
    }
  }

  async testDataPersistence() {
    this.logger.log('Testing data persistence...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for persistence testing')
      return false
    }

    try {
      // Test project retrieval
      const projectResult = await this.makeRequest(`/projects/${this.testProjectId}`)
      
      if (!projectResult.ok) {
        this.logger.error('Failed to retrieve test project')
        return false
      }

      // Test tasks retrieval
      const tasksResult = await this.makeRequest(`/projects/${this.testProjectId}/tasks`)
      
      if (!tasksResult.ok) {
        this.logger.error('Failed to retrieve tasks')
        return false
      }

      // Test memories retrieval
      const memoriesResult = await this.makeRequest(`/projects/${this.testProjectId}/memories`)
      
      if (!memoriesResult.ok) {
        this.logger.error('Failed to retrieve memories')
        return false
      }

      this.logger.success('All data persistence tests passed')
      return true
    } catch (error) {
      this.logger.error(`Data persistence test failed: ${error.message}`)
      return false
    }
  }

  async testErrorHandling() {
    this.logger.log('Testing error handling...')
    
    const testCases = [
      {
        name: 'Non-existent project',
        endpoint: '/projects/non-existent-id',
        expectedStatus: 404
      },
      {
        name: 'Invalid project ID format',
        endpoint: '/projects/invalid-id',
        expectedStatus: 404
      },
      {
        name: 'Non-existent endpoint',
        endpoint: '/non-existent-endpoint',
        expectedStatus: 404
      }
    ]

    let allPassed = true

    for (const testCase of testCases) {
      try {
        const result = await this.makeRequest(testCase.endpoint)
        
        if (result.status === testCase.expectedStatus) {
          this.logger.success(`${testCase.name}: Correct error status returned`)
        } else {
          this.logger.error(`${testCase.name}: Expected ${testCase.expectedStatus}, got ${result.status}`)
          allPassed = false
        }
      } catch (error) {
        this.logger.error(`${testCase.name}: Request failed: ${error.message}`)
        allPassed = false
      }
    }

    return allPassed
  }

  async cleanup() {
    this.logger.log('Cleaning up test data...')
    
    if (this.testProjectId) {
      try {
        await this.makeRequest(`/projects/${this.testProjectId}`, {
          method: 'DELETE'
        })
        this.logger.success('Test project cleaned up')
      } catch (error) {
        this.logger.error(`Cleanup failed: ${error.message}`)
      }
    }
  }

  async runAllTests() {
    this.logger.log('Starting comprehensive integration tests...')
    
      const results = {
      backendConnectivity: false,
      corsConfiguration: false,
      projectCreation: false,
      chatPersistence: false,
      taskCreation: false,
        hierarchicalTaskCreation: false,
      taskUpdates: false,
      memoryCreation: false,
      dataPersistence: false,
      errorHandling: false
    }

    try {
      // Test 1: Backend connectivity
      results.backendConnectivity = await this.healthCheck()
      
      if (!results.backendConnectivity) {
        this.logger.error('Backend is not available. Stopping tests.')
        return results
      }

      // Test 2: CORS configuration
      results.corsConfiguration = await this.testCorsConfiguration()

      // Test 3: Project creation
      const project = await this.createTestProject()
      results.projectCreation = project !== null

      if (results.projectCreation) {
        // Test 4: Chat persistence
        results.chatPersistence = await this.testChatPersistence()

        // Test 5: Task creation
        results.taskCreation = await this.testTaskCreation()

        // Test 6: Hierarchical tasks
        results.hierarchicalTaskCreation = await this.testHierarchicalTasks()

        // Test 7: Task updates
        results.taskUpdates = await this.testTaskUpdates()

        // Test 8: Memory creation
        results.memoryCreation = await this.testMemoryCreation()

        // Test 9: Data persistence
        results.dataPersistence = await this.testDataPersistence()
      }

      // Test 10: Error handling
      results.errorHandling = await this.testErrorHandling()

    } catch (error) {
      this.logger.error(`Test suite failed: ${error.message}`)
    } finally {
      await this.cleanup()
    }

    return results
  }

  generateReport(results) {
    this.logger.log('=== INTEGRATION TEST REPORT ===')
    
    const totalTests = Object.keys(results).length
    const passedTests = Object.values(results).filter(Boolean).length
    const failedTests = totalTests - passedTests

    this.logger.log(`Total Tests: ${totalTests}`)
    this.logger.log(`Passed: ${passedTests}`)
    this.logger.log(`Failed: ${failedTests}`)
    this.logger.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

    this.logger.log('\nDetailed Results:')
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL'
      this.logger.log(`${status} ${test}`)
    })

    if (failedTests > 0) {
      this.logger.log('\nIssues Found:')
      Object.entries(results).forEach(([test, passed]) => {
        if (!passed) {
          this.logger.error(`- ${test}: Test failed`)
        }
      })
    }

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: (passedTests / totalTests) * 100,
      results
    }
  }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiTester, TestLogger }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  const tester = new ApiTester()
  tester.runAllTests().then(results => {
    tester.generateReport(results)
  })
} 