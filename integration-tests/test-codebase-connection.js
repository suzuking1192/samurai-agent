/**
 * Integration Test: Codebase Connection API
 * 
 * This test verifies that the codebase connection API endpoint works correctly.
 */

const axios = require('axios');
const path = require('path');

// Configuration
const BACKEND_URL = 'http://localhost:8000';

class CodebaseConnectionTester {
    constructor() {
        this.testResults = [];
        this.testProjectId = null;
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async waitForBackend() {
        this.log('Waiting for backend to be available...');
        
        for (let i = 0; i < 30; i++) {
            try {
                const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 2000 });
                if (response.status === 200) {
                    this.log('Backend is available');
                    return true;
                }
            } catch (error) {
                // Ignore errors and continue waiting
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Backend is not available');
    }

    async testBackendHealth() {
        this.log('Testing backend health check...');
        
        try {
            const response = await axios.get(`${BACKEND_URL}/health`);
            
            if (response.status === 200 && response.data.status === 'healthy') {
                this.log('Backend health check passed', 'success');
                this.testResults.push({ test: 'Backend Health', status: 'PASS' });
                return true;
            } else {
                throw new Error('Invalid health response');
            }
        } catch (error) {
            this.log(`Backend health check failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Backend Health', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testProjectCreation() {
        this.log('Testing project creation...');
        
        try {
            const projectData = {
                name: 'Codebase Connection Test Project',
                description: 'Test project for codebase connection API integration',
                tech_stack: 'React + FastAPI + PostgreSQL'
            };

            const response = await axios.post(`${BACKEND_URL}/projects`, projectData);
            
            if (response.status === 200 && response.data.id) {
                this.testProjectId = response.data.id;
                this.log(`Project created successfully: ${this.testProjectId}`, 'success');
                this.testResults.push({ test: 'Project Creation', status: 'PASS', projectId: this.testProjectId });
                return true;
            } else {
                throw new Error('Invalid project creation response');
            }
        } catch (error) {
            this.log(`Project creation failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Project Creation', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testCodebaseConnectionSuccess() {
        this.log('Testing successful codebase connection...');
        
        try {
            const codebaseData = {
                path: path.resolve(__dirname, '..'), // Use the integration-tests directory as test path
                project_id: this.testProjectId
            };

            const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
            
            if (response.status === 200 && response.data.success) {
                this.log('Codebase connection successful', 'success');
                this.testResults.push({ 
                    test: 'Codebase Connection Success', 
                    status: 'PASS', 
                    path: codebaseData.path 
                });
                return true;
            } else {
                throw new Error('Invalid codebase connection response');
            }
        } catch (error) {
            this.log(`Codebase connection failed: ${error.message}`, 'error');
            this.testResults.push({ 
                test: 'Codebase Connection Success', 
                status: 'FAIL', 
                error: error.message 
            });
            return false;
        }
    }

    async testCodebaseConnectionMissingPath() {
        this.log('Testing codebase connection with missing path...');
        
        try {
            const codebaseData = {
                project_id: this.testProjectId
                // Missing path field
            };

            const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
            
            // Should return validation error
            if (response.status === 422) {
                this.log('Missing path validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Missing Path', status: 'PASS' });
                return true;
            } else {
                throw new Error('Expected validation error but got different response');
            }
        } catch (error) {
            if (error.response && error.response.status === 422) {
                this.log('Missing path validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Missing Path', status: 'PASS' });
                return true;
            } else {
                this.log(`Missing path test failed: ${error.message}`, 'error');
                this.testResults.push({ 
                    test: 'Codebase Connection Missing Path', 
                    status: 'FAIL', 
                    error: error.message 
                });
                return false;
            }
        }
    }

    async testCodebaseConnectionInvalidPath() {
        this.log('Testing codebase connection with invalid path format...');
        
        try {
            const codebaseData = {
                path: 'invalid/path/format', // Invalid path format
                project_id: this.testProjectId
            };

            const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
            
            // Should return 400 error for invalid path format
            if (response.status === 400) {
                this.log('Invalid path format validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Invalid Path', status: 'PASS' });
                return true;
            } else {
                throw new Error('Expected 400 error but got different response');
            }
        } catch (error) {
            if (error.response && error.response.status === 400) {
                this.log('Invalid path format validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Invalid Path', status: 'PASS' });
                return true;
            } else {
                this.log(`Invalid path test failed: ${error.message}`, 'error');
                this.testResults.push({ 
                    test: 'Codebase Connection Invalid Path', 
                    status: 'FAIL', 
                    error: error.message 
                });
                return false;
            }
        }
    }

    async testCodebaseConnectionNonexistentProject() {
        this.log('Testing codebase connection with non-existent project...');
        
        try {
            const codebaseData = {
                path: '/some/path',
                project_id: 'nonexistent-project-id'
            };

            const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
            
            // Should return 404 error for non-existent project
            if (response.status === 404) {
                this.log('Non-existent project validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Nonexistent Project', status: 'PASS' });
                return true;
            } else {
                throw new Error('Expected 404 error but got different response');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                this.log('Non-existent project validation working correctly', 'success');
                this.testResults.push({ test: 'Codebase Connection Nonexistent Project', status: 'PASS' });
                return true;
            } else {
                this.log(`Non-existent project test failed: ${error.message}`, 'error');
                this.testResults.push({ 
                    test: 'Codebase Connection Nonexistent Project', 
                    status: 'FAIL', 
                    error: error.message 
                });
                return false;
            }
        }
    }

    async cleanup() {
        this.log('Cleaning up test data...');
        
        if (this.testProjectId) {
            try {
                await axios.delete(`${BACKEND_URL}/projects/${this.testProjectId}`);
                this.log('Test project deleted successfully', 'success');
            } catch (error) {
                this.log(`Failed to delete test project: ${error.message}`, 'warning');
            }
        }
    }

    async runAllTests() {
        this.log('Starting Codebase Connection API Integration Tests', 'info');
        
        try {
            // Wait for backend
            await this.waitForBackend();
            
            // Run tests
            await this.testBackendHealth();
            await this.testProjectCreation();
            await this.testCodebaseConnectionSuccess();
            await this.testCodebaseConnectionMissingPath();
            await this.testCodebaseConnectionInvalidPath();
            await this.testCodebaseConnectionNonexistentProject();
            
            // Cleanup
            await this.cleanup();
            
            // Print results
            this.printResults();
            
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            await this.cleanup();
            process.exit(1);
        }
    }

    printResults() {
        this.log('\n=== Test Results ===', 'info');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            this.log(`${status} ${result.test}: ${result.status}`, result.status === 'PASS' ? 'success' : 'error');
            if (result.error) {
                this.log(`   Error: ${result.error}`, 'error');
            }
        });
        
        this.log(`\nSummary: ${passed} passed, ${failed} failed`, failed > 0 ? 'error' : 'success');
        
        if (failed > 0) {
            process.exit(1);
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new CodebaseConnectionTester();
    tester.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = CodebaseConnectionTester;
