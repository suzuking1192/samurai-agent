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
        this.log('Testing successful codebase connection with full relative path...');
        
        try {
            // Test with full relative path as the new frontend would send
            const codebaseData = {
                path: 'integration-tests/test-codebase-connection.js', // Full relative path from frontend
                project_id: this.testProjectId
            };

            const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
            
            if (response.status === 200 && response.data.success) {
                this.log('Codebase connection successful', 'success');
                this.log(`Resolved codebase path: ${response.data.codebase_path}`, 'info');
                this.testResults.push({ 
                    test: 'Codebase Connection Success', 
                    status: 'PASS', 
                    path: codebaseData.path,
                    resolved_path: response.data.codebase_path
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

    async testCodebaseConnectionFullRelativePath() {
        this.log('Testing codebase connection with various full relative path formats...');
        
        try {
            // Test different full relative path formats that the frontend might send
            const testCases = [
                'my-project/src/components/MyComponent.tsx',
                'my-project/README.md',
                'my-project/package.json',
                'my-project/src/index.js',
                'my-project/docs/README.md'
            ];

            let allPassed = true;
            for (const testPath of testCases) {
                const codebaseData = {
                    path: testPath,
                    project_id: this.testProjectId
                };

                try {
                    const response = await axios.post(`${BACKEND_URL}/api/codebase/connect`, codebaseData);
                    
                    if (response.status === 200 && response.data.success) {
                        this.log(`✅ Full relative path test passed: ${testPath} -> ${response.data.codebase_path}`, 'success');
                    } else {
                        this.log(`❌ Full relative path test failed: ${testPath}`, 'error');
                        allPassed = false;
                    }
                } catch (error) {
                    this.log(`❌ Full relative path test failed: ${testPath} - ${error.message}`, 'error');
                    allPassed = false;
                }
            }

            if (allPassed) {
                this.log('All full relative path tests passed', 'success');
                this.testResults.push({ test: 'Codebase Connection Full Relative Path', status: 'PASS' });
                return true;
            } else {
                this.log('Some full relative path tests failed', 'error');
                this.testResults.push({ test: 'Codebase Connection Full Relative Path', status: 'FAIL' });
                return false;
            }
        } catch (error) {
            this.log(`Full relative path test failed: ${error.message}`, 'error');
            this.testResults.push({ 
                test: 'Codebase Connection Full Relative Path', 
                status: 'FAIL', 
                error: error.message 
            });
            return false;
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
            await this.testCodebaseConnectionFullRelativePath();
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
