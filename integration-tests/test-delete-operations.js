#!/usr/bin/env node

const fetch = require('node-fetch')

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

class DeleteOperationsTester {
  constructor() {
    this.logger = new TestLogger()
    this.testResults = []
  }

  async testProjectDeletion() {
    this.logger.log('Testing project deletion...')
    
    try {
      // 1. Create a test project
      const projectData = {
        name: 'Test Project for Deletion',
        description: 'This project will be deleted',
        tech_stack: 'React, Node.js'
      }
      
      const createResponse = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create project: ${createResponse.status}`)
      }
      
      const project = await createResponse.json()
      this.logger.success(`Created test project: ${project.id}`)
      
      // 2. Add some data to the project (tasks, memories, chat)
      const taskData = {
        title: 'Test Task',
        description: 'This task will be deleted with the project',
        status: 'pending',
        priority: 'medium'
      }
      
      const taskResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })
      
      if (taskResponse.ok) {
        this.logger.success('Added test task to project')
      }
      
      const memoryData = {
        content: 'Test memory content',
        type: 'note'
      }
      
      const memoryResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryData)
      })
      
      if (memoryResponse.ok) {
        this.logger.success('Added test memory to project')
      }
      
      // 3. Delete the project
      const deleteResponse = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'DELETE'
      })
      
      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete project: ${deleteResponse.status}`)
      }
      
      this.logger.success('Project deleted successfully')
      
      // 4. Verify project is deleted
      const verifyResponse = await fetch(`${API_BASE_URL}/projects/${project.id}`)
      if (verifyResponse.status !== 404) {
        throw new Error('Project still exists after deletion')
      }
      
      this.logger.success('Project deletion verified - project no longer exists')
      
      return { success: true, message: 'Project deletion test passed' }
      
    } catch (error) {
      this.logger.error(`Project deletion test failed: ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  async testTaskDeletion() {
    this.logger.log('Testing task deletion...')
    
    try {
      // 1. Create a test project
      const projectData = {
        name: 'Test Project for Task Deletion',
        description: 'This project will be used to test task deletion',
        tech_stack: 'React, Node.js'
      }
      
      const createResponse = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create project: ${createResponse.status}`)
      }
      
      const project = await createResponse.json()
      this.logger.success(`Created test project: ${project.id}`)
      
      // 2. Create a test task
      const taskData = {
        title: 'Test Task for Deletion',
        description: 'This task will be deleted',
        status: 'pending',
        priority: 'medium'
      }
      
      const taskResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })
      
      if (!taskResponse.ok) {
        throw new Error(`Failed to create task: ${taskResponse.status}`)
      }
      
      const task = await taskResponse.json()
      this.logger.success(`Created test task: ${task.id}`)
      
      // 3. Verify task exists
      const tasksResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks`)
      if (!tasksResponse.ok) {
        throw new Error(`Failed to get tasks: ${tasksResponse.status}`)
      }
      
      const tasks = await tasksResponse.json()
      const taskExists = tasks.some(t => t.id === task.id)
      if (!taskExists) {
        throw new Error('Task not found after creation')
      }
      
      this.logger.success('Task exists after creation')
      
      // 4. Delete the task
      const deleteResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks/${task.id}`, {
        method: 'DELETE'
      })
      
      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete task: ${deleteResponse.status}`)
      }
      
      this.logger.success('Task deleted successfully')
      
      // 5. Verify task is deleted
      const verifyResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/tasks`)
      if (!verifyResponse.ok) {
        throw new Error(`Failed to get tasks for verification: ${verifyResponse.status}`)
      }
      
      const tasksAfterDelete = await verifyResponse.json()
      const taskStillExists = tasksAfterDelete.some(t => t.id === task.id)
      if (taskStillExists) {
        throw new Error('Task still exists after deletion')
      }
      
      this.logger.success('Task deletion verified - task no longer exists')
      
      // 6. Clean up project
      await fetch(`${API_BASE_URL}/projects/${project.id}`, { method: 'DELETE' })
      
      return { success: true, message: 'Task deletion test passed' }
      
    } catch (error) {
      this.logger.error(`Task deletion test failed: ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  async testMemoryDeletion() {
    this.logger.log('Testing memory deletion...')
    
    try {
      // 1. Create a test project
      const projectData = {
        name: 'Test Project for Memory Deletion',
        description: 'This project will be used to test memory deletion',
        tech_stack: 'React, Node.js'
      }
      
      const createResponse = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create project: ${createResponse.status}`)
      }
      
      const project = await createResponse.json()
      this.logger.success(`Created test project: ${project.id}`)
      
      // 2. Create a test memory
      const memoryData = {
        content: 'Test memory content for deletion',
        type: 'note'
      }
      
      const memoryResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryData)
      })
      
      if (!memoryResponse.ok) {
        throw new Error(`Failed to create memory: ${memoryResponse.status}`)
      }
      
      const memory = await memoryResponse.json()
      this.logger.success(`Created test memory: ${memory.id}`)
      
      // 3. Verify memory exists
      const memoriesResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories`)
      if (!memoriesResponse.ok) {
        throw new Error(`Failed to get memories: ${memoriesResponse.status}`)
      }
      
      const memories = await memoriesResponse.json()
      const memoryExists = memories.some(m => m.id === memory.id)
      if (!memoryExists) {
        throw new Error('Memory not found after creation')
      }
      
      this.logger.success('Memory exists after creation')
      
      // 4. Delete the memory
      const deleteResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories/${memory.id}`, {
        method: 'DELETE'
      })
      
      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete memory: ${deleteResponse.status}`)
      }
      
      this.logger.success('Memory deleted successfully')
      
      // 5. Verify memory is deleted
      const verifyResponse = await fetch(`${API_BASE_URL}/projects/${project.id}/memories`)
      if (!verifyResponse.ok) {
        throw new Error(`Failed to get memories for verification: ${verifyResponse.status}`)
      }
      
      const memoriesAfterDelete = await verifyResponse.json()
      const memoryStillExists = memoriesAfterDelete.some(m => m.id === memory.id)
      if (memoryStillExists) {
        throw new Error('Memory still exists after deletion')
      }
      
      this.logger.success('Memory deletion verified - memory no longer exists')
      
      // 6. Clean up project
      await fetch(`${API_BASE_URL}/projects/${project.id}`, { method: 'DELETE' })
      
      return { success: true, message: 'Memory deletion test passed' }
      
    } catch (error) {
      this.logger.error(`Memory deletion test failed: ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  async testDeleteNonExistentItems() {
    this.logger.log('Testing deletion of non-existent items...')
    
    try {
      const fakeId = 'non-existent-id-12345'
      
      // Test deleting non-existent project
      const projectResponse = await fetch(`${API_BASE_URL}/projects/${fakeId}`, {
        method: 'DELETE'
      })
      
      if (projectResponse.status !== 404) {
        throw new Error(`Expected 404 for non-existent project, got ${projectResponse.status}`)
      }
      
      this.logger.success('Non-existent project deletion returns 404')
      
      // Test deleting non-existent task
      const taskResponse = await fetch(`${API_BASE_URL}/projects/${fakeId}/tasks/${fakeId}`, {
        method: 'DELETE'
      })
      
      if (taskResponse.status !== 404) {
        throw new Error(`Expected 404 for non-existent task, got ${taskResponse.status}`)
      }
      
      this.logger.success('Non-existent task deletion returns 404')
      
      // Test deleting non-existent memory
      const memoryResponse = await fetch(`${API_BASE_URL}/projects/${fakeId}/memories/${fakeId}`, {
        method: 'DELETE'
      })
      
      if (memoryResponse.status !== 404) {
        throw new Error(`Expected 404 for non-existent memory, got ${memoryResponse.status}`)
      }
      
      this.logger.success('Non-existent memory deletion returns 404')
      
      return { success: true, message: 'Non-existent item deletion test passed' }
      
    } catch (error) {
      this.logger.error(`Non-existent item deletion test failed: ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  async runAllTests() {
    this.logger.log('Starting comprehensive delete operations tests...')
    this.logger.log('Make sure both backend (localhost:8000) and frontend (localhost:5173) are running')
    
    const tests = [
      { name: 'Project Deletion', test: () => this.testProjectDeletion() },
      { name: 'Task Deletion', test: () => this.testTaskDeletion() },
      { name: 'Memory Deletion', test: () => this.testMemoryDeletion() },
      { name: 'Non-existent Items', test: () => this.testDeleteNonExistentItems() }
    ]
    
    for (const test of tests) {
      this.logger.log(`\n=== Running ${test.name} Test ===`)
      const result = await test.test()
      this.testResults.push({ name: test.name, ...result })
    }
    
    this.generateReport()
  }

  generateReport() {
    this.logger.log('\n=== DELETE OPERATIONS TEST REPORT ===')
    
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.success).length
    const failedTests = totalTests - passedTests
    const successRate = ((passedTests / totalTests) * 100).toFixed(1)
    
    this.logger.log(`Total Tests: ${totalTests}`)
    this.logger.log(`Passed: ${passedTests}`)
    this.logger.log(`Failed: ${failedTests}`)
    this.logger.log(`Success Rate: ${successRate}%`)
    
    this.logger.log('\nDetailed Results:')
    this.testResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL'
      this.logger.log(`${status} ${result.name}`)
    })
    
    if (failedTests > 0) {
      this.logger.log('\nFailed Tests:')
      this.testResults
        .filter(r => !r.success)
        .forEach(result => {
          this.logger.error(`- ${result.name}: ${result.message}`)
        })
    }
    
    this.logger.log('\n=== TEST RUN COMPLETED ===')
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new DeleteOperationsTester()
  tester.runAllTests().catch(error => {
    console.error('Test execution failed:', error)
    process.exit(1)
  })
}

module.exports = { DeleteOperationsTester } 