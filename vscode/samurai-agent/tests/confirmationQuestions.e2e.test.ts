/**
 * End-to-End tests for Confirmation Questions feature
 * 
 * Tests the complete flow from LLM response to webview rendering and user interaction
 */

import * as vscode from 'vscode';
import { SamuraiAgent } from '../src/agent/core/samuraiAgent';
import { LLMProviderService } from '../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../src/agent/memory/projectDetailService';
import { DataStore } from '../src/persistence/dataStore';
import { GlobalDataStore } from '../src/persistence/globalDataStore';
import { ExtractCodeTool } from '../src/agent/tools/extractCodeTool';
import { CreateSpecTool } from '../src/agent/tools/createSpecTool';
import { ChatMessage, MessageType, SessionStatus } from '../src/common/models/chat-models';
import { ConfirmationQuestionService } from '../src/extension/services/confirmationQuestionService';

describe('Confirmation Questions E2E Tests', () => {
    let samuraiAgent: SamuraiAgent;
    let llmProviderService: LLMProviderService;
    let projectDetailService: ProjectDetailService;
    let dataStore: DataStore;
    let globalDataStore: GlobalDataStore;
    let extractCodeTool: ExtractCodeTool;
    let createSpecTool: CreateSpecTool;

    beforeEach(() => {
        // Setup test dependencies
        globalDataStore = new GlobalDataStore();
        llmProviderService = new LLMProviderService(globalDataStore);
        dataStore = new DataStore('/tmp/test-workspace'); // Provide a test workspace path
        projectDetailService = new ProjectDetailService(llmProviderService, dataStore);
        
        // Create mock tools
        extractCodeTool = {
            execute: jest.fn().mockResolvedValue({
                success: true,
                files: [],
                metadata: {}
            })
        } as any;

        createSpecTool = {
            execute: jest.fn().mockResolvedValue({
                success: true,
                specId: 'test-spec-id',
                message: 'Spec created successfully'
            })
        } as any;

        samuraiAgent = new SamuraiAgent(
            llmProviderService,
            dataStore,
            projectDetailService,
            extractCodeTool,
            createSpecTool
        );
    });

    describe('Backend Processing', () => {
        it('should detect confirmation questions in LLM responses', () => {
            const llmResponse = 'Is it correct that you want to add user authentication?';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(llmResponse);
            
            expect(questions).toHaveLength(1);
            expect(questions[0].originalQuestionText).toBe('Is it correct that you want to add user authentication?');
        });

        it('should preserve markdown in detected questions', () => {
            const llmResponse = 'Is it correct that you want to use **React** with `TypeScript`?';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(llmResponse);
            
            expect(questions).toHaveLength(1);
            expect(questions[0].originalQuestionText).toContain('**React**');
            expect(questions[0].originalQuestionText).toContain('`TypeScript`');
        });

        it('should handle multiple confirmation questions in one response', () => {
            const llmResponse = `
                Based on your requirements:
                Is it correct that you want to implement authentication?
                Could you please confirm that you need a REST API?
                Are you sure that you want to use PostgreSQL?
            `;
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(llmResponse);
            
            expect(questions).toHaveLength(3);
        });
    });

    describe('Agent Integration', () => {
        it('should detect confirmation questions from agent response', () => {
            const agentResponse = 'Is it correct that you want to implement user login?';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(agentResponse);
            
            expect(questions).toHaveLength(1);
            expect(questions[0].originalQuestionText).toBe('Is it correct that you want to implement user login?');
        });

        it('should return empty array when agent response has no confirmation questions', () => {
            const agentResponse = 'Here is a regular response without any confirmation questions.';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(agentResponse);
            
            expect(questions).toHaveLength(0);
        });
    });

    describe('Message Format', () => {
        it('should properly format Yes response text', () => {
            const questionText = 'Is it correct that you want to add authentication?';
            const expectedResponse = `I would like to answer "YES" to ${questionText}`;
            
            expect(expectedResponse).toContain('I would like to answer "YES"');
            expect(expectedResponse).toContain(questionText);
        });

        it('should properly format No response text', () => {
            const questionText = 'Are you sure that you want to delete the database?';
            const expectedResponse = `I would like to answer "NO" to ${questionText}`;
            
            expect(expectedResponse).toContain('I would like to answer "NO"');
            expect(expectedResponse).toContain(questionText);
        });

        it('should properly format AI recommendation response text', () => {
            const questionText = 'Could you please confirm that the API should use REST?';
            const expectedResponse = `I would like an AI recommendation for: ${questionText}`;
            
            expect(expectedResponse).toContain('I would like an AI recommendation for:');
            expect(expectedResponse).toContain(questionText);
        });

        it('should preserve markdown in response text', () => {
            const questionText = 'Is it correct that you want to use **React** with `TypeScript`?';
            const expectedResponse = `I would like to answer "YES" to ${questionText}`;
            
            expect(expectedResponse).toContain('**React**');
            expect(expectedResponse).toContain('`TypeScript`');
        });
    });

    describe('Edge Cases', () => {
        it('should handle questions with special characters', () => {
            const llmResponse = 'Is it correct that the regex should be /[a-zA-Z0-9]+/?';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(llmResponse);
            
            expect(questions).toHaveLength(1);
            expect(questions[0].originalQuestionText).toContain('/[a-zA-Z0-9]+/');
        });

        it('should handle very long responses with multiple questions', () => {
            const longResponse = `
                ${Array(10).fill('Some context text. ').join('')}
                Is it correct that you want feature A?
                ${Array(10).fill('More context text. ').join('')}
                Could you please confirm that you need feature B?
                ${Array(10).fill('Additional context. ').join('')}
                Are you sure that you want to proceed with feature C?
            `;
            
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(longResponse);
            
            expect(questions).toHaveLength(3);
        });

        it('should handle questions at the start and end of response', () => {
            const response = 'Is it correct that you want this? Here is some text in between. Are you sure that you want to continue?';
            const questions = ConfirmationQuestionService.detectAndExtractQuestions(response);
            
            expect(questions).toHaveLength(2);
            expect(questions[0].originalQuestionText).toBe('Is it correct that you want this?');
            expect(questions[1].originalQuestionText).toBe('Are you sure that you want to continue?');
        });
    });

    describe('Data Persistence', () => {
        it('should persist confirmation questions with chat messages', () => {
            const chatMessage: ChatMessage = {
                id: 'test-msg-id',
                sessionId: 'test-session-id',
                projectId: 'test-project-id',
                type: MessageType.ASSISTANT,
                content: 'Is it correct that you want authentication?',
                role: 'assistant',
                metadata: {},
                isEdited: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                interactiveConfirmationQuestions: [{
                    originalQuestionText: 'Is it correct that you want authentication?'
                }]
            };

            expect(chatMessage.interactiveConfirmationQuestions).toBeDefined();
            expect(chatMessage.interactiveConfirmationQuestions).toHaveLength(1);
        });
    });
});
