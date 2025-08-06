/**
 * Integration Test: Unified Samurai Agent Frontend Integration
 * 
 * This test verifies that the frontend chat functionality properly connects
 * to the new unified samurai agent and that all features work correctly.
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';
const TEST_TIMEOUT = 30000; // 30 seconds

class IntegrationTester {
    constructor() {
        this.backendProcess = null;
        this.frontendProcess = null;
        this.testResults = [];
        this.testProjectId = null;
        this.testSessionId = null;
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async startBackend() {
        return new Promise((resolve, reject) => {
            this.log('Starting backend server...');
            
            this.backendProcess = spawn('python', ['main.py'], {
                cwd: path.join(__dirname, '../backend'),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            this.backendProcess.stdout.on('data', (data) => {
                output += data.toString();
                if (output.includes('Uvicorn running on') || output.includes('Application startup complete')) {
                    this.log('Backend server started successfully');
                    resolve();
                }
            });

            this.backendProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            this.backendProcess.on('error', (error) => {
                this.log(`Backend startup error: ${error.message}`, 'error');
                reject(error);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!output.includes('Uvicorn running on')) {
                    this.log('Backend startup timeout', 'error');
                    reject(new Error('Backend startup timeout'));
                }
            }, 10000);
        });
    }

    async startFrontend() {
        return new Promise((resolve, reject) => {
            this.log('Starting frontend development server...');
            
            this.frontendProcess = spawn('npm', ['run', 'dev'], {
                cwd: path.join(__dirname, '../frontend'),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';

            this.frontendProcess.stdout.on('data', (data) => {
                output += data.toString();
                if (output.includes('Local:') && output.includes('5173')) {
                    this.log('Frontend server started successfully');
                    resolve();
                }
            });

            this.frontendProcess.stderr.on('data', (data) => {
                // Ignore stderr for frontend as it often contains warnings
            });

            this.frontendProcess.on('error', (error) => {
                this.log(`Frontend startup error: ${error.message}`, 'error');
                reject(error);
            });

            // Timeout after 15 seconds
            setTimeout(() => {
                if (!output.includes('Local:')) {
                    this.log('Frontend startup timeout', 'error');
                    reject(new Error('Frontend startup timeout'));
                }
            }, 15000);
        });
    }

    async waitForService(url, serviceName) {
        this.log(`Waiting for ${serviceName} to be ready...`);
        
        for (let i = 0; i < 30; i++) {
            try {
                const response = await axios.get(url, { timeout: 2000 });
                if (response.status === 200) {
                    this.log(`${serviceName} is ready`);
                    return true;
                }
            } catch (error) {
                // Ignore errors and continue waiting
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error(`${serviceName} failed to start`);
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
                name: 'Unified Agent Test Project',
                description: 'Test project for unified samurai agent integration',
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

    async testSessionCreation() {
        this.log('Testing session creation...');
        
        try {
            const sessionData = {
                name: 'Test Session'
            };

            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/sessions`, sessionData);
            
            if (response.status === 200 && response.data.id) {
                this.testSessionId = response.data.id;
                this.log(`Session created successfully: ${this.testSessionId}`, 'success');
                this.testResults.push({ test: 'Session Creation', status: 'PASS', sessionId: this.testSessionId });
                return true;
            } else {
                throw new Error('Invalid session creation response');
            }
        } catch (error) {
            this.log(`Session creation failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Session Creation', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testUnifiedAgentChat(message, expectedIntent = null) {
        this.log(`Testing unified agent chat: "${message}"`);
        
        try {
            const chatData = {
                message: message
            };

            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/chat`, chatData);
            
            if (response.status === 200 && response.data.response) {
                this.log(`Chat response received: ${response.data.response.substring(0, 100)}...`, 'success');
                
                // Check if response contains unified agent indicators
                const responseText = response.data.response.toLowerCase();
                const isUnifiedAgent = response.data.intent_analysis && 
                                     response.data.intent_analysis.intent_type;
                
                if (isUnifiedAgent) {
                    this.log(`Unified agent intent detected: ${response.data.intent_analysis.intent_type}`, 'success');
                    
                    if (expectedIntent && response.data.intent_analysis.intent_type !== expectedIntent) {
                        this.log(`Intent mismatch: expected ${expectedIntent}, got ${response.data.intent_analysis.intent_type}`, 'warning');
                    }
                    
                    this.testResults.push({ 
                        test: 'Unified Agent Chat', 
                        status: 'PASS', 
                        message: message,
                        intent: response.data.intent_analysis.intent_type,
                        responseLength: response.data.response.length
                    });
                    return true;
                } else {
                    throw new Error('Response does not contain unified agent intent analysis');
                }
            } else {
                throw new Error('Invalid chat response');
            }
        } catch (error) {
            this.log(`Chat test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Unified Agent Chat', status: 'FAIL', error: error.message, message: message });
            return false;
        }
    }

    async testIntentAnalysis() {
        this.log('Testing intent analysis with different message types...');
        
        const testCases = [
            { message: "What is JWT?", expectedIntent: "pure_discussion" },
            { message: "I'm thinking about adding authentication", expectedIntent: "feature_exploration" },
            { message: "Create tasks for JWT authentication", expectedIntent: "ready_for_action" },
            { message: "Mark the login task as completed", expectedIntent: "direct_action" },
            { message: "Remember this decision about using JWT", expectedIntent: "pure_discussion" }
        ];

        let passedTests = 0;
        
        for (const testCase of testCases) {
            const success = await this.testUnifiedAgentChat(testCase.message, testCase.expectedIntent);
            if (success) passedTests++;
        }

        this.log(`Intent analysis tests: ${passedTests}/${testCases.length} passed`, passedTests === testCases.length ? 'success' : 'warning');
        this.testResults.push({ 
            test: 'Intent Analysis', 
            status: passedTests === testCases.length ? 'PASS' : 'PARTIAL', 
            passed: passedTests, 
            total: testCases.length 
        });
    }

    async testMemoryManagement() {
        this.log('Testing memory management...');
        
        try {
            // Test explicit memory request
            const memoryMessage = "Remember this decision: We will use JWT for authentication";
            const success = await this.testUnifiedAgentChat(memoryMessage);
            
            if (success) {
                this.log('Memory management test passed', 'success');
                this.testResults.push({ test: 'Memory Management', status: 'PASS' });
                return true;
            } else {
                throw new Error('Memory management test failed');
            }
        } catch (error) {
            this.log(`Memory management test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Memory Management', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testSessionCompletion() {
        this.log('Testing session completion...');
        
        try {
            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/sessions/${this.testSessionId}/complete`);
            
            if (response.status === 200 && response.data.status === 'success') {
                this.log('Session completion test passed', 'success');
                this.testResults.push({ 
                    test: 'Session Completion', 
                    status: 'PASS', 
                    memoriesCreated: response.data.completion_result?.memories_created || 0
                });
                return true;
            } else {
                throw new Error('Invalid session completion response');
            }
        } catch (error) {
            this.log(`Session completion test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Session Completion', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testFrontendConnection() {
        this.log('Testing frontend connection...');
        
        try {
            const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
            
            if (response.status === 200) {
                this.log('Frontend is accessible', 'success');
                this.testResults.push({ test: 'Frontend Connection', status: 'PASS' });
                return true;
            } else {
                throw new Error('Frontend not accessible');
            }
        } catch (error) {
            this.log(`Frontend connection test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Frontend Connection', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testFrontendChatAPI() {
        this.log('Testing frontend chat API integration...');
        
        try {
            // Test the chat API endpoint that frontend would use
            const chatData = {
                message: "Test message from frontend integration test"
            };

            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/chat`, chatData);
            
            if (response.status === 200 && response.data.response) {
                this.log('Frontend chat API integration test passed', 'success');
                this.testResults.push({ 
                    test: 'Frontend Chat API', 
                    status: 'PASS', 
                    responseType: response.data.type,
                    hasIntentAnalysis: !!response.data.intent_analysis
                });
                return true;
            } else {
                throw new Error('Invalid frontend chat API response');
            }
        } catch (error) {
            this.log(`Frontend chat API test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Frontend Chat API', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testProgressStreaming() {
        this.log('Testing progress streaming...');
        
        try {
            const chatData = {
                message: "Create tasks for user authentication with JWT"
            };

            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/chat-with-progress`, chatData, {
                responseType: 'stream',
                timeout: 30000
            });
            
            if (response.status === 200) {
                this.log('Progress streaming test passed', 'success');
                this.testResults.push({ test: 'Progress Streaming', status: 'PASS' });
                return true;
            } else {
                throw new Error('Progress streaming failed');
            }
        } catch (error) {
            this.log(`Progress streaming test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Progress Streaming', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async cleanup() {
        this.log('Cleaning up test data...');
        
        try {
            if (this.testProjectId) {
                await axios.delete(`${BACKEND_URL}/projects/${this.testProjectId}`);
                this.log('Test project deleted', 'success');
            }
        } catch (error) {
            this.log(`Cleanup error: ${error.message}`, 'warning');
        }
    }

    async stopServers() {
        this.log('Stopping servers...');
        
        if (this.backendProcess) {
            this.backendProcess.kill('SIGTERM');
            this.log('Backend server stopped');
        }
        
        if (this.frontendProcess) {
            this.frontendProcess.kill('SIGTERM');
            this.log('Frontend server stopped');
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 INTEGRATION TEST RESULTS');
        console.log('='.repeat(60));
        
        let passedTests = 0;
        let totalTests = this.testResults.length;
        
        for (const result of this.testResults) {
            const status = result.status === 'PASS' ? '✅ PASS' : result.status === 'PARTIAL' ? '⚠️ PARTIAL' : '❌ FAIL';
            console.log(`${status} - ${result.test}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            
            if (result.intent) {
                console.log(`   Intent: ${result.intent}`);
            }
            
            if (result.passed !== undefined) {
                console.log(`   Results: ${result.passed}/${result.total}`);
            }
            
            if (result.status === 'PASS') {
                passedTests++;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`📊 SUMMARY: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All integration tests passed! Unified Samurai Agent is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please check the logs above.');
        }
        console.log('='.repeat(60) + '\n');
    }

    async runAllTests() {
        this.log('🚀 Starting Unified Samurai Agent Integration Tests');
        this.log('='.repeat(60));
        
        try {
            // Start servers
            await this.startBackend();
            await this.waitForService(`${BACKEND_URL}/health`, 'Backend');
            
            await this.startFrontend();
            await this.waitForService(FRONTEND_URL, 'Frontend');
            
            // Run tests
            await this.testBackendHealth();
            await this.testProjectCreation();
            await this.testSessionCreation();
            await this.testIntentAnalysis();
            await this.testMemoryManagement();
            await this.testSessionCompletion();
            await this.testFrontendConnection();
            await this.testFrontendChatAPI();
            await this.testProgressStreaming();
            
            // Cleanup
            await this.cleanup();
            
        } catch (error) {
            this.log(`Integration test failed: ${error.message}`, 'error');
        } finally {
            await this.stopServers();
            this.printResults();
        }
    }
}

// Run the integration test
async function main() {
    const tester = new IntegrationTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = IntegrationTester; 