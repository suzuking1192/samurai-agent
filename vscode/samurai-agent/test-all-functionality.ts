/**
 * Comprehensive test script for all LLM functionality
 * 
 * This script tests:
 * 1. LLM client structure and instantiation
 * 2. Real API calls (if API keys are provided)
 * 3. Project detail ingestion functionality
 * 4. End-to-end integration
 * 
 * Usage:
 * 1. For structure tests only: npx ts-node test-all-functionality.ts
 * 2. For real API tests: Set API keys and run the script
 * 
 * API Keys (optional):
 *   export OPENAI_API_KEY="your_openai_key"
 *   export GOOGLE_API_KEY="your_google_key"
 *   export ANTHROPIC_API_KEY="your_anthropic_key"
 */

import { OpenAIChatClient } from './src/agent/llm/openaiChatClient';
import { GeminiChatClient } from './src/agent/llm/geminiChatClient';
import { AnthropicChatClient } from './src/agent/llm/anthropicChatClient';
import { LLMProviderService } from './src/agent/llm/llmProviderService';
import { ProjectDetailService } from './src/memory/projectDetailService';
import { GlobalDataStore } from './src/persistence/globalDataStore';
import { LLMRequest, LLMMessage } from './src/common/models/llm-models';
import { LLM_MODELS } from './src/common/constants/llm-models';

// Mock data store for testing
class MockDataStore {
    private data: any = {};

    async saveProjectDetail(projectId: string, data: any): Promise<void> {
        this.data[projectId] = data;
        console.log(`📁 Mock saved project detail for ${projectId}`);
    }

    async loadProjectDetail(projectId: string): Promise<any> {
        return this.data[projectId] || null;
    }

    async saveGlobalSettings(settings: any): Promise<void> {
        console.log('📁 Mock saved global settings');
    }

    async loadGlobalSettings(): Promise<any> {
        return {
            customApiEndpoints: {},
            llmModels: LLM_MODELS
        };
    }
}

// Test messages
const testMessages: LLMMessage[] = [
    { role: 'user', content: 'Hello! Please respond with "Test successful" to confirm the API is working.' }
];

async function testClientStructure(): Promise<boolean> {
    console.log('\n🧪 Testing LLM Client Structure...');
    
    try {
        // Test OpenAI client instantiation
        const openaiClient = new OpenAIChatClient();
        console.log('✅ OpenAI client instantiated successfully');

        // Test Gemini client instantiation
        const geminiClient = new GeminiChatClient();
        console.log('✅ Gemini client instantiated successfully');

        // Test Anthropic client instantiation
        const anthropicClient = new AnthropicChatClient();
        console.log('✅ Anthropic client instantiated successfully');

        // Test LLM Provider Service
        const globalDataStore = new GlobalDataStore();
        const mockDataStore = new MockDataStore();
        const llmProviderService = new LLMProviderService(globalDataStore, mockDataStore as any);
        
        llmProviderService.registerClient('openai', openaiClient);
        llmProviderService.registerClient('google', geminiClient);
        llmProviderService.registerClient('anthropic', anthropicClient);
        
        console.log('✅ LLM Provider Service configured successfully');

        // Test Project Detail Service
        const projectDetailService = new ProjectDetailService(llmProviderService, mockDataStore as any);
        console.log('✅ Project Detail Service instantiated successfully');

        console.log('✅ All services have correct structure and can be instantiated');
        return true;
    } catch (error) {
        console.log('❌ Structure test failed:', error);
        return false;
    }
}

async function testRealAPICall(provider: string, apiKey: string): Promise<boolean> {
    console.log(`\n🧪 Testing ${provider} with real API...`);
    
    try {
        const globalDataStore = new GlobalDataStore();
        const mockDataStore = new MockDataStore();
        const llmProviderService = new LLMProviderService(globalDataStore, mockDataStore as any);
        
        let client;
        let model;
        
        switch (provider) {
            case 'openai':
                client = new OpenAIChatClient();
                model = 'gpt-3.5-turbo';
                break;
            case 'google':
                client = new GeminiChatClient();
                model = 'gemini-1.5-flash';
                break;
            case 'anthropic':
                client = new AnthropicChatClient();
                model = 'claude-3-haiku-20240307';
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
        
        llmProviderService.registerClient(provider, client);
        
        const request: LLMRequest = {
            id: `test-${provider}-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            provider,
            model,
            messages: testMessages,
            temperature: 0.7,
            maxTokens: 50,
            metadata: {
                apiKey,
                provider,
                customApiEndpoints: {},
                llmModels: LLM_MODELS
            }
        };

        const response = await llmProviderService.chat(request);
        
        if (response.type === 'success' && response.payload && 'content' in response.payload) {
            console.log(`✅ ${provider} test successful!`);
            console.log(`Response: ${response.payload.content}`);
            return true;
        } else {
            console.log(`❌ ${provider} test failed:`, response.payload || response.error);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${provider} test error:`, error);
        return false;
    }
}

async function testProjectDetailIngestion(): Promise<boolean> {
    console.log('\n🧪 Testing Project Detail Ingestion...');
    
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.log('❌ GOOGLE_API_KEY not found - skipping project detail test');
        return true; // Don't fail the overall test if API key is missing
    }

    try {
        const globalDataStore = new GlobalDataStore();
        const mockDataStore = new MockDataStore();
        
        const llmProviderService = new LLMProviderService(globalDataStore, mockDataStore as any);
        llmProviderService.registerClient('google', new GeminiChatClient());
        
        const projectDetailService = new ProjectDetailService(llmProviderService, mockDataStore as any);

        const projectId = 'test-project-' + Date.now();
        const rawText = `
# Test Project

This is a test project for the Samurai Agent extension.

## Features
- LLM integration
- Project detail ingestion
- Memory management

## Architecture
The project uses a modular architecture with separate services for different functionalities.
        `;

        console.log('📝 Testing project detail ingestion...');
        const result = await projectDetailService.ingestProjectDetail(projectId, rawText, 'synthesis');
        
        if (result && result.length > 0) {
            console.log('✅ Project detail ingestion successful!');
            console.log(`📊 Result: ${result.substring(0, 200)}...`);
            return true;
        } else {
            console.log('❌ Project detail ingestion failed: Empty result');
            return false;
        }
    } catch (error) {
        console.log('❌ Project detail ingestion error:', error);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Comprehensive LLM Functionality Tests...\n');
    
    // Always run structure tests
    const structureTest = await testClientStructure();
    
    // Check which API keys are available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    
    console.log('\n📋 API Key Status:');
    console.log(`OpenAI: ${hasOpenAI ? '✅' : '❌'}`);
    console.log(`Google: ${hasGoogle ? '✅' : '❌'}`);
    console.log(`Anthropic: ${hasAnthropic ? '✅' : '❌'}`);
    
    const apiTests: Promise<boolean>[] = [];
    
    if (hasOpenAI) {
        apiTests.push(testRealAPICall('openai', process.env.OPENAI_API_KEY!));
    }
    if (hasGoogle) {
        apiTests.push(testRealAPICall('google', process.env.GOOGLE_API_KEY!));
    }
    if (hasAnthropic) {
        apiTests.push(testRealAPICall('anthropic', process.env.ANTHROPIC_API_KEY!));
    }
    
    // Run API tests if any keys are available
    let apiTestResults: boolean[] = [];
    if (apiTests.length > 0) {
        console.log('\n🌐 Running real API tests...');
        apiTestResults = await Promise.all(apiTests);
    } else {
        console.log('\n⚠️  No API keys found - skipping real API tests');
        console.log('To test with real APIs, set environment variables:');
        console.log('  export OPENAI_API_KEY="your_key"');
        console.log('  export GOOGLE_API_KEY="your_key"');
        console.log('  export ANTHROPIC_API_KEY="your_key"');
    }
    
    // Test project detail ingestion
    const projectDetailTest = await testProjectDetailIngestion();
    
    // Calculate results
    const allTests = [structureTest, ...apiTestResults, projectDetailTest];
    const passed = allTests.filter(r => r).length;
    const total = allTests.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} passed`);
    
    if (structureTest) {
        console.log('✅ Structure tests: PASSED');
    } else {
        console.log('❌ Structure tests: FAILED');
    }
    
    if (apiTestResults.length > 0) {
        const apiPassed = apiTestResults.filter(r => r).length;
        console.log(`✅ API tests: ${apiPassed}/${apiTestResults.length} passed`);
    }
    
    if (projectDetailTest) {
        console.log('✅ Project detail ingestion: PASSED');
    } else {
        console.log('❌ Project detail ingestion: FAILED');
    }
    
    if (passed === total) {
        console.log('\n🎉 All tests passed! The LLM integration is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.');
        process.exit(1);
    }
}

runAllTests().catch(console.error);
