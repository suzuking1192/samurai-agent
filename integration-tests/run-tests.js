#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * This script runs both backend and frontend integration tests
 * and provides a comprehensive report of all issues found.
 */

const { ApiTester } = require('./test-integration.js')
const { FrontendTester } = require('./test-frontend-integration.js')

class TestRunner {
  constructor() {
    this.logger = new TestLogger()
    this.results = {
      backend: null,
      frontend: null,
      summary: null
    }
  }

  async runBackendTests() {
    this.logger.log('=== RUNNING BACKEND INTEGRATION TESTS ===')
    const backendTester = new ApiTester()
    const results = await backendTester.runAllTests()
    backendTester.generateReport(results)
    return results
  }

  async runFrontendTests() {
    this.logger.log('=== RUNNING FRONTEND INTEGRATION TESTS ===')
    const frontendTester = new FrontendTester()
    const results = await frontendTester.runAllTests()
    frontendTester.generateReport(results)
    return results
  }

  generateComprehensiveReport() {
    this.logger.log('\n=== COMPREHENSIVE INTEGRATION TEST REPORT ===')
    
    const backendResults = this.results.backend
    const frontendResults = this.results.frontend
    
    if (!backendResults || !frontendResults) {
      this.logger.error('Test results not available')
      return
    }

    const totalBackendTests = Object.keys(backendResults).length
    const passedBackendTests = Object.values(backendResults).filter(Boolean).length
    const failedBackendTests = totalBackendTests - passedBackendTests

    const totalFrontendTests = Object.keys(frontendResults).length
    const passedFrontendTests = Object.values(frontendResults).filter(Boolean).length
    const failedFrontendTests = totalFrontendTests - passedFrontendTests

    const totalTests = totalBackendTests + totalFrontendTests
    const totalPassed = passedBackendTests + passedFrontendTests
    const totalFailed = failedBackendTests + failedFrontendTests

    this.logger.log(`\nOVERALL SUMMARY:`)
    this.logger.log(`Total Tests: ${totalTests}`)
    this.logger.log(`Passed: ${totalPassed}`)
    this.logger.log(`Failed: ${totalFailed}`)
    this.logger.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`)

    this.logger.log(`\nBACKEND TESTS:`)
    this.logger.log(`Passed: ${passedBackendTests}/${totalBackendTests}`)
    this.logger.log(`Failed: ${failedBackendTests}/${totalBackendTests}`)

    this.logger.log(`\nFRONTEND TESTS:`)
    this.logger.log(`Passed: ${passedFrontendTests}/${totalFrontendTests}`)
    this.logger.log(`Failed: ${failedFrontendTests}/${totalFrontendTests}`)

    // Identify specific issues
    this.identifyIssues(backendResults, frontendResults)

    return {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      successRate: (totalPassed / totalTests) * 100,
      backend: {
        total: totalBackendTests,
        passed: passedBackendTests,
        failed: failedBackendTests
      },
      frontend: {
        total: totalFrontendTests,
        passed: passedFrontendTests,
        failed: failedFrontendTests
      }
    }
  }

  identifyIssues(backendResults, frontendResults) {
    this.logger.log('\n=== ISSUE ANALYSIS ===')

    const issues = []

    // Backend issues
    Object.entries(backendResults).forEach(([test, passed]) => {
      if (!passed) {
        issues.push({
          type: 'backend',
          test,
          description: this.getIssueDescription(test, 'backend')
        })
      }
    })

    // Frontend issues
    Object.entries(frontendResults).forEach(([test, passed]) => {
      if (!passed) {
        issues.push({
          type: 'frontend',
          test,
          description: this.getIssueDescription(test, 'frontend')
        })
      }
    })

    if (issues.length === 0) {
      this.logger.success('No issues found! All tests passed.')
      return
    }

    this.logger.log(`\nFound ${issues.length} issues:`)
    
    issues.forEach((issue, index) => {
      this.logger.error(`${index + 1}. [${issue.type.toUpperCase()}] ${issue.test}: ${issue.description}`)
    })

    // Group issues by category
    this.groupIssuesByCategory(issues)
  }

  getIssueDescription(test, type) {
    const descriptions = {
      backend: {
        backendConnectivity: 'Backend server is not reachable or not running',
        corsConfiguration: 'CORS is not properly configured for frontend requests',
        projectCreation: 'Unable to create new projects',
        chatPersistence: 'Chat messages are not being saved or retrieved',
        taskCreation: 'Tasks are not being created properly',
        taskUpdates: 'Task status updates are not working',
        memoryCreation: 'Memories are not being created properly',
        dataPersistence: 'Data is not persisting across requests',
        errorHandling: 'Error handling is not working correctly'
      },
      frontend: {
        frontendConnectivity: 'Frontend server is not reachable or not running',
        apiServiceFunctions: 'API service functions are not working correctly',
        chatComponentIntegration: 'Chat component cannot communicate with backend',
        taskComponentIntegration: 'Task component cannot communicate with backend',
        memoryComponentIntegration: 'Memory component cannot communicate with backend',
        dataPersistence: 'Data is not persisting across browser sessions',
        errorHandling: 'Frontend error handling is not working correctly',
        apiEndpointCompatibility: 'Frontend expects endpoints that do not exist in backend'
      }
    }

    return descriptions[type][test] || 'Unknown issue'
  }

  groupIssuesByCategory(issues) {
    this.logger.log('\n=== ISSUES BY CATEGORY ===')

    const categories = {
      'Connectivity Issues': issues.filter(i => 
        i.test.includes('Connectivity') || i.test.includes('Connectivity')
      ),
      'API Endpoint Issues': issues.filter(i => 
        i.test.includes('Endpoint') || i.test.includes('apiService')
      ),
      'Data Persistence Issues': issues.filter(i => 
        i.test.includes('Persistence') || i.test.includes('Creation')
      ),
      'Component Integration Issues': issues.filter(i => 
        i.test.includes('Component') || i.test.includes('Integration')
      ),
      'Error Handling Issues': issues.filter(i => 
        i.test.includes('Error') || i.test.includes('Handling')
      )
    }

    Object.entries(categories).forEach(([category, categoryIssues]) => {
      if (categoryIssues.length > 0) {
        this.logger.log(`\n${category} (${categoryIssues.length}):`)
        categoryIssues.forEach(issue => {
          this.logger.error(`  - ${issue.test}: ${issue.description}`)
        })
      }
    })
  }

  async runAllTests() {
    this.logger.log('Starting comprehensive integration test suite...')
    this.logger.log('Make sure both backend (localhost:8000) and frontend (localhost:5173) are running')
    
    try {
      // Run backend tests first
      this.results.backend = await this.runBackendTests()
      
      // Run frontend tests
      this.results.frontend = await this.runFrontendTests()
      
      // Generate comprehensive report
      this.results.summary = this.generateComprehensiveReport()
      
      return this.results
    } catch (error) {
      this.logger.error(`Test runner failed: ${error.message}`)
      throw error
    }
  }
}

// TestLogger class (if not already defined)
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

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner()
  runner.runAllTests().then(results => {
    console.log('\n=== TEST RUN COMPLETED ===')
    process.exit(results.summary.failed > 0 ? 1 : 0)
  }).catch(error => {
    console.error('Test runner failed:', error)
    process.exit(1)
  })
}

module.exports = { TestRunner, TestLogger } 