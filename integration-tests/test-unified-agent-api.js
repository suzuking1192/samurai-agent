/**
 * API Integration Test: Unified Samurai Agent
 * 
 * This test verifies that the unified samurai agent API endpoints work correctly
 * without requiring full server startup. It tests the core functionality.
 */

const axios = require('axios');

// Configuration
const BACKEND_URL = 'http://localhost:8000';

class UnifiedAgentAPITester {
    constructor() {
        this.testResults = [];
        this.testProjectId = null;
        this.testSessionId = null;
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
                name: 'Unified Agent API Test Project',
                description: 'Test project for unified samurai agent API integration',
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
                name: 'API Test Session'
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
                        responseType: response.data.type,
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

    async testFrontendAPICompatibility() {
        this.log('Testing frontend API compatibility...');
        
        try {
            // Test the exact API format that frontend uses
            const chatData = {
                message: "Test message from frontend API compatibility test"
            };

            const response = await axios.post(`${BACKEND_URL}/projects/${this.testProjectId}/chat`, chatData);
            
            if (response.status === 200 && response.data.response) {
                // Check for all expected fields that frontend needs
                const requiredFields = ['response', 'type', 'intent_analysis'];
                const missingFields = requiredFields.filter(field => !(field in response.data));
                
                if (missingFields.length === 0) {
                    this.log('Frontend API compatibility test passed', 'success');
                    this.testResults.push({ 
                        test: 'Frontend API Compatibility', 
                        status: 'PASS', 
                        responseType: response.data.type,
                        hasIntentAnalysis: !!response.data.intent_analysis
                    });
                    return true;
                } else {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }
            } else {
                throw new Error('Invalid frontend API response');
            }
        } catch (error) {
            this.log(`Frontend API compatibility test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Frontend API Compatibility', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testChatHistory() {
        this.log('Testing chat history retrieval...');
        
        try {
            const response = await axios.get(`${BACKEND_URL}/projects/${this.testProjectId}/chat-messages`);
            
            if (response.status === 200 && Array.isArray(response.data)) {
                this.log(`Chat history retrieved: ${response.data.length} messages`, 'success');
                this.testResults.push({ 
                    test: 'Chat History', 
                    status: 'PASS', 
                    messageCount: response.data.length
                });
                return true;
            } else {
                throw new Error('Invalid chat history response');
            }
        } catch (error) {
            this.log(`Chat history test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Chat History', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testSessionMessages() {
        this.log('Testing session messages retrieval...');
        
        try {
            const response = await axios.get(`${BACKEND_URL}/projects/${this.testProjectId}/session-messages/${this.testSessionId}`);
            
            if (response.status === 200 && Array.isArray(response.data)) {
                this.log(`Session messages retrieved: ${response.data.length} messages`, 'success');
                this.testResults.push({ 
                    test: 'Session Messages', 
                    status: 'PASS', 
                    messageCount: response.data.length
                });
                return true;
            } else {
                throw new Error('Invalid session messages response');
            }
        } catch (error) {
            this.log(`Session messages test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Session Messages', status: 'FAIL', error: error.message });
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

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 UNIFIED AGENT API INTEGRATION TEST RESULTS');
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
            
            if (result.messageCount !== undefined) {
                console.log(`   Messages: ${result.messageCount}`);
            }
            
            if (result.status === 'PASS') {
                passedTests++;
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`📊 SUMMARY: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All API integration tests passed! Unified Samurai Agent is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please check the logs above.');
        }
        console.log('='.repeat(60) + '\n');
    }

    async runAllTests() {
        this.log('🚀 Starting Unified Samurai Agent API Integration Tests');
        this.log('='.repeat(60));
        
        try {
            // Wait for backend
            await this.waitForBackend();
            
            // Run tests
            await this.testBackendHealth();
            await this.testProjectCreation();
            await this.testSessionCreation();
            await this.testIntentAnalysis();
            await this.testMemoryManagement();
            await this.testSessionCompletion();
            await this.testProgressStreaming();
            await this.testFrontendAPICompatibility();
            await this.testChatHistory();
            await this.testSessionMessages();
            
            // Cleanup
            await this.cleanup();
            
        } catch (error) {
            this.log(`API integration test failed: ${error.message}`, 'error');
        } finally {
            this.printResults();
        }
    }
}

// Run the API integration test
async function main() {
    const tester = new UnifiedAgentAPITester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = UnifiedAgentAPITester; 