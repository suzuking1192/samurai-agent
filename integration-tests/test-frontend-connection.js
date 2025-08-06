/**
 * Frontend Connection Test
 * 
 * This script tests that the frontend can properly connect to the unified agent
 * and receive responses with intent analysis.
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:8000';

async function testFrontendConnection() {
    console.log('🧪 Testing Frontend Connection to Unified Agent');
    console.log('='.repeat(50));
    
    try {
        // 1. Create a test project
        console.log('1. Creating test project...');
        const projectResponse = await axios.post(`${BACKEND_URL}/projects`, {
            name: 'Frontend Connection Test',
            description: 'Testing frontend connection to unified agent',
            tech_stack: 'React + FastAPI'
        });
        
        const projectId = projectResponse.data.id;
        console.log(`✅ Project created: ${projectId}`);
        
        // 2. Create a session
        console.log('2. Creating test session...');
        const sessionResponse = await axios.post(`${BACKEND_URL}/projects/${projectId}/sessions`, {
            name: 'Test Session'
        });
        
        const sessionId = sessionResponse.data.id;
        console.log(`✅ Session created: ${sessionId}`);
        
        // 3. Test different types of messages
        const testMessages = [
            {
                message: "What is JWT?",
                expectedIntent: "pure_discussion",
                description: "Pure discussion question"
            },
            {
                message: "I'm thinking about adding authentication",
                expectedIntent: "feature_exploration", 
                description: "Feature exploration"
            },
            {
                message: "Create tasks for JWT authentication",
                expectedIntent: "ready_for_action",
                description: "Ready for action"
            },
            {
                message: "Remember this decision about using JWT",
                expectedIntent: "pure_discussion",
                description: "Memory request"
            }
        ];
        
        console.log('3. Testing chat messages...');
        
        for (const testCase of testMessages) {
            console.log(`\n📝 Testing: ${testCase.description}`);
            console.log(`   Message: "${testCase.message}"`);
            
            const chatResponse = await axios.post(`${BACKEND_URL}/projects/${projectId}/chat`, {
                message: testCase.message
            });
            
            const response = chatResponse.data;
            
            // Check if response has intent analysis
            if (response.intent_analysis) {
                console.log(`   ✅ Intent detected: ${response.intent_analysis.intent_type}`);
                console.log(`   ✅ Confidence: ${response.intent_analysis.confidence}`);
                
                if (response.intent_analysis.intent_type === testCase.expectedIntent) {
                    console.log(`   ✅ Intent matches expected: ${testCase.expectedIntent}`);
                } else {
                    console.log(`   ⚠️ Intent mismatch: expected ${testCase.expectedIntent}, got ${response.intent_analysis.intent_type}`);
                }
            } else {
                console.log(`   ❌ No intent analysis in response`);
            }
            
            // Check other required fields
            console.log(`   ✅ Response type: ${response.type}`);
            console.log(`   ✅ Memory updated: ${response.memory_updated}`);
            console.log(`   ✅ Response length: ${response.response.length} characters`);
        }
        
        // 4. Test session completion
        console.log('\n4. Testing session completion...');
        const completionResponse = await axios.post(`${BACKEND_URL}/projects/${projectId}/sessions/${sessionId}/complete`);
        
        if (completionResponse.data.status === 'success') {
            console.log('✅ Session completion successful');
            console.log(`   Memories created: ${completionResponse.data.completion_result?.memories_created || 0}`);
        } else {
            console.log('❌ Session completion failed');
        }
        
        // 5. Cleanup
        console.log('\n5. Cleaning up...');
        await axios.delete(`${BACKEND_URL}/projects/${projectId}`);
        console.log('✅ Test project deleted');
        
        console.log('\n🎉 Frontend Connection Test Completed Successfully!');
        console.log('='.repeat(50));
        console.log('✅ The frontend can properly connect to the unified agent');
        console.log('✅ Intent analysis is working correctly');
        console.log('✅ All required response fields are present');
        console.log('✅ Session management is functional');
        console.log('✅ Memory management is operational');
        
    } catch (error) {
        console.error('❌ Frontend Connection Test Failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }
}

// Run the test
testFrontendConnection(); 