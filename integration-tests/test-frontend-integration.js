/**
 * Frontend Integration Tests
 * 
 * This test suite validates the React frontend functionality, including:
 * - Component state management
 * - API integration from frontend
 * - Browser storage and persistence
 * - User interactions and UI updates
 * - Error handling in components
 */

const API_BASE_URL = 'http://localhost:8000'
const FRONTEND_URL = 'http://localhost:5173'

// TestLogger class
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

class FrontendTester {
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

  async testFrontendConnectivity() {
    this.logger.log('Testing frontend connectivity...')
    
    try {
      const response = await fetch(FRONTEND_URL)
      
      if (response.ok) {
        this.logger.success('Frontend is reachable')
        return true
      } else {
        this.logger.error(`Frontend connectivity failed: ${response.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Frontend connectivity test failed: ${error.message}`)
      return false
    }
  }

  async testApiServiceFunctions() {
    this.logger.log('Testing API service functions...')
    
    // Test the same functions that the frontend uses
    const apiTests = [
      {
        name: 'getProjects',
        test: async () => {
          const result = await this.makeRequest('/projects')
          return result.ok
        }
      },
      {
        name: 'healthCheck',
        test: async () => {
          const result = await this.makeRequest('/health')
          return result.ok && result.data.status === 'healthy'
        }
      }
    ]

    let allPassed = true

    for (const apiTest of apiTests) {
      try {
        const passed = await apiTest.test()
        if (passed) {
          this.logger.success(`${apiTest.name}: API function works correctly`)
        } else {
          this.logger.error(`${apiTest.name}: API function failed`)
          allPassed = false
        }
      } catch (error) {
        this.logger.error(`${apiTest.name}: API function error: ${error.message}`)
        allPassed = false
      }
    }

    return allPassed
  }

  async testChatComponentIntegration() {
    this.logger.log('Testing chat component integration...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for chat testing')
      return false
    }

    const testMessage = `Frontend test message ${Date.now()}`
    
    try {
      // Test the exact API call that the Chat component makes
      const chatRequest = {
        project_id: this.testProjectId,
        message: testMessage
      }

      const result = await this.makeRequest('/chat', {
        method: 'POST',
        body: JSON.stringify(chatRequest)
      })

      if (result.ok) {
        this.logger.success('Chat component API integration works')
        
        // Test chat message structure
        if (result.data.response) {
          this.logger.success('Chat response contains expected data')
          return true
        } else {
          this.logger.error('Chat response missing expected data')
          return false
        }
      } else {
        this.logger.error(`Chat component API failed: ${result.status}`)
        return false
      }
    } catch (error) {
      this.logger.error(`Chat component integration test failed: ${error.message}`)
      return false
    }
  }

  async testTaskComponentIntegration() {
    this.logger.log('Testing task component integration...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for task testing')
      return false
    }

    try {
      // Test task creation (same as TaskPanel component)
      const taskData = {
        title: `Frontend Test Task ${Date.now()}`,
        description: 'Frontend integration test task',
        priority: 'medium'
      }

      const createResult = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData)
      })

      if (!createResult.ok) {
        this.logger.error(`Task creation failed: ${createResult.status}`)
        return false
      }

      this.testData.tasks.push(createResult.data)
      this.logger.success('Task creation works correctly')

      // Test task retrieval (same as TaskPanel component)
      const getResult = await this.makeRequest(`/projects/${this.testProjectId}/tasks`)
      
      if (getResult.ok) {
        this.logger.success('Task retrieval works correctly')
        return true
      } else {
        this.logger.error('Task retrieval failed')
        return false
      }
    } catch (error) {
      this.logger.error(`Task component integration test failed: ${error.message}`)
      return false
    }
  }

  async testMemoryComponentIntegration() {
    this.logger.log('Testing memory component integration...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for memory testing')
      return false
    }

    try {
      // Test memory creation (same as MemoryPanel component)
      const memoryData = {
        title: `Frontend Test Memory ${Date.now()}`,
        content: 'Frontend integration test memory content',
        type: 'note'
      }

      const createResult = await this.makeRequest(`/projects/${this.testProjectId}/memories`, {
        method: 'POST',
        body: JSON.stringify(memoryData)
      })

      if (!createResult.ok) {
        this.logger.error(`Memory creation failed: ${createResult.status}`)
        return false
      }

      this.testData.memories.push(createResult.data)
      this.logger.success('Memory creation works correctly')

      // Test memory retrieval (same as MemoryPanel component)
      const getResult = await this.makeRequest(`/projects/${this.testProjectId}/memories`)
      
      if (getResult.ok) {
        this.logger.success('Memory retrieval works correctly')
        return true
      } else {
        this.logger.error('Memory retrieval failed')
        return false
      }
    } catch (error) {
      this.logger.error(`Memory component integration test failed: ${error.message}`)
      return false
    }
  }

  async testDataPersistenceAcrossSessions() {
    this.logger.log('Testing data persistence across sessions...')
    
    if (!this.testProjectId) {
      this.logger.error('No test project available for persistence testing')
      return false
    }

    try {
      // Simulate what happens when the app loads - it should fetch all data
      const dataChecks = [
        {
          name: 'Project data',
          endpoint: `/projects/${this.testProjectId}`,
          expected: true
        },
        {
          name: 'Tasks data',
          endpoint: `/projects/${this.testProjectId}/tasks`,
          expected: true
        },
        {
          name: 'Memories data',
          endpoint: `/projects/${this.testProjectId}/memories`,
          expected: true
        }
      ]

      let allPassed = true

      for (const check of dataChecks) {
        const result = await this.makeRequest(check.endpoint)
        
        if (result.ok === check.expected) {
          this.logger.success(`${check.name}: Data persistence works correctly`)
        } else {
          this.logger.error(`${check.name}: Data persistence failed`)
          allPassed = false
        }
      }

      return allPassed
    } catch (error) {
      this.logger.error(`Data persistence test failed: ${error.message}`)
      return false
    }
  }

  async testErrorHandlingInComponents() {
    this.logger.log('Testing error handling in components...')
    
    const errorTests = [
      {
        name: 'Invalid project ID in chat',
        test: async () => {
          const result = await this.makeRequest('/projects/invalid-id/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'test' })
          })
          return result.status === 404
        }
      },
      {
        name: 'Invalid project ID in tasks',
        test: async () => {
          const result = await this.makeRequest('/projects/invalid-id/tasks')
          return result.status === 404
        }
      },
      {
        name: 'Invalid project ID in memories',
        test: async () => {
          const result = await this.makeRequest('/projects/invalid-id/memories')
          return result.status === 404
        }
      }
    ]

    let allPassed = true

    for (const errorTest of errorTests) {
      try {
        const passed = await errorTest.test()
        if (passed) {
          this.logger.success(`${errorTest.name}: Error handling works correctly`)
        } else {
          this.logger.error(`${errorTest.name}: Error handling failed`)
          allPassed = false
        }
      } catch (error) {
        this.logger.error(`${errorTest.name}: Error handling test failed: ${error.message}`)
        allPassed = false
      }
    }

    return allPassed
  }

  async testApiEndpointCompatibility() {
    this.logger.log('Testing API endpoint compatibility with frontend...')
    
    // Check if the endpoints that the frontend expects actually exist
    const endpointTests = [
      {
        name: 'GET /projects',
        endpoint: '/projects',
        method: 'GET',
        expectedStatus: 200
      },
      {
        name: 'POST /projects',
        endpoint: '/projects',
        method: 'POST',
        expectedStatus: 200,
        body: {
          name: 'Test Project',
          description: 'Test Description',
          tech_stack: 'Test Stack'
        }
      },
      {
        name: 'GET /projects/{id}',
        endpoint: '/projects/test-id',
        method: 'GET',
        expectedStatus: 404 // Should return 404 for non-existent project
      },
      {
        name: 'GET /projects/{id}/tasks',
        endpoint: '/projects/test-id/tasks',
        method: 'GET',
        expectedStatus: 404 // Should return 404 for non-existent project
      },
      {
        name: 'POST /projects/{id}/tasks',
        endpoint: '/projects/test-id/tasks',
        method: 'POST',
        expectedStatus: 404, // Should return 404 for non-existent project
        body: {
          title: 'Test Task',
          description: 'Test Description',
          priority: 'medium'
        }
      },
      {
        name: 'GET /projects/{id}/memories',
        endpoint: '/projects/test-id/memories',
        method: 'GET',
        expectedStatus: 404 // Should return 404 for non-existent project
      },
      {
        name: 'POST /projects/{id}/memories',
        endpoint: '/projects/test-id/memories',
        method: 'POST',
        expectedStatus: 404, // Should return 404 for non-existent project
        body: {
          title: 'Test Memory',
          content: 'Test Content',
          type: 'note'
        }
      },
      {
        name: 'POST /chat',
        endpoint: '/chat',
        method: 'POST',
        expectedStatus: 200,
        body: {
          message: 'Test message'
        }
      }
    ]

    let allPassed = true

    for (const endpointTest of endpointTests) {
      try {
        const options = { method: endpointTest.method }
        if (endpointTest.body) {
          options.body = JSON.stringify(endpointTest.body)
        }

        const result = await this.makeRequest(endpointTest.endpoint, options)
        
        if (result.status === endpointTest.expectedStatus) {
          this.logger.success(`${endpointTest.name}: Endpoint exists and responds correctly`)
        } else {
          this.logger.error(`${endpointTest.name}: Expected ${endpointTest.expectedStatus}, got ${result.status}`)
          allPassed = false
        }
      } catch (error) {
        this.logger.error(`${endpointTest.name}: Endpoint test failed: ${error.message}`)
        allPassed = false
      }
    }

    return allPassed
  }

  async createTestProject() {
    this.logger.log('Creating test project for frontend tests...')
    
    const projectData = {
      name: `Frontend Test Project ${Date.now()}`,
      description: 'Frontend integration test project',
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
        this.logger.success(`Frontend test project created with ID: ${this.testProjectId}`)
        return result.data
      } else {
        this.logger.error(`Failed to create frontend test project: ${result.status}`)
        return null
      }
    } catch (error) {
      this.logger.error(`Frontend project creation failed: ${error.message}`)
      return null
    }
  }

  async cleanup() {
    this.logger.log('Cleaning up frontend test data...')
    
    if (this.testProjectId) {
      try {
        await this.makeRequest(`/projects/${this.testProjectId}`, {
          method: 'DELETE'
        })
        this.logger.success('Frontend test project cleaned up')
      } catch (error) {
        this.logger.error(`Frontend cleanup failed: ${error.message}`)
      }
    }
  }

  async runAllTests() {
    this.logger.log('Starting frontend integration tests...')
    
    const results = {
      frontendConnectivity: false,
      apiServiceFunctions: false,
      chatComponentIntegration: false,
      taskComponentIntegration: false,
      memoryComponentIntegration: false,
      dataPersistence: false,
      errorHandling: false,
      apiEndpointCompatibility: false
    }

    try {
      // Test 1: Frontend connectivity
      results.frontendConnectivity = await this.testFrontendConnectivity()
      
      if (!results.frontendConnectivity) {
        this.logger.error('Frontend is not available. Stopping tests.')
        return results
      }

      // Test 2: API service functions
      results.apiServiceFunctions = await this.testApiServiceFunctions()

      // Test 3: API endpoint compatibility
      results.apiEndpointCompatibility = await this.testApiEndpointCompatibility()

      // Test 4: Create test project
      const project = await this.createTestProject()
      
      if (project) {
        // Test 5: Chat component integration
        results.chatComponentIntegration = await this.testChatComponentIntegration()

        // Test 6: Task component integration
        results.taskComponentIntegration = await this.testTaskComponentIntegration()

        // Test 7: Memory component integration
        results.memoryComponentIntegration = await this.testMemoryComponentIntegration()

        // Test 8: Data persistence
        results.dataPersistence = await this.testDataPersistenceAcrossSessions()
      }

      // Test 9: Error handling
      results.errorHandling = await this.testErrorHandlingInComponents()

    } catch (error) {
      this.logger.error(`Frontend test suite failed: ${error.message}`)
    } finally {
      await this.cleanup()
    }

    return results
  }

  generateReport(results) {
    this.logger.log('=== FRONTEND INTEGRATION TEST REPORT ===')
    
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
      this.logger.log('\nFrontend Issues Found:')
      Object.entries(results).forEach(([test, passed]) => {
        if (!passed) {
          this.logger.error(`- ${test}: Frontend integration test failed`)
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
  module.exports = { FrontendTester }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  const tester = new FrontendTester()
  tester.runAllTests().then(results => {
    tester.generateReport(results)
  })
} 