/**
 * Unit tests for ConfirmationQuestionService
 */

import { ConfirmationQuestionService } from '../src/extension/services/confirmationQuestionService';

describe('ConfirmationQuestionService', () => {
    describe('detectAndExtractQuestions', () => {
        it('should detect a single confirmation question with "Is it correct that"', () => {
            const content = 'Is it correct that you want to add authentication?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to add authentication?');
        });

        it('should detect a single confirmation question with "Could you please confirm that"', () => {
            const content = 'Could you please confirm that the API endpoint is /api/users?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Could you please confirm that the API endpoint is /api/users?');
        });

        it('should detect a single confirmation question with "Are you sure that"', () => {
            const content = 'Are you sure that you want to delete the database?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Are you sure that you want to delete the database?');
        });

        it('should detect a single confirmation question with "Do you confirm that"', () => {
            const content = 'Do you confirm that the deployment is ready?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Do you confirm that the deployment is ready?');
        });

        it('should detect multiple confirmation questions in one response', () => {
            const content = `
                Based on your input, I have a few questions:
                Is it correct that you want to use React for the frontend?
                Could you please confirm that you need authentication?
                Are you sure that you want to use PostgreSQL?
            `;
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(3);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to use React for the frontend?');
            expect(result[1].originalQuestionText).toBe('Could you please confirm that you need authentication?');
            expect(result[2].originalQuestionText).toBe('Are you sure that you want to use PostgreSQL?');
        });

        it('should preserve markdown formatting in questions', () => {
            const content = 'Is it correct that you want to use **bold text** and *italic text*?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to use **bold text** and *italic text*?');
        });

        it('should preserve inline code in questions', () => {
            const content = 'Is it correct that the function should be named `getUserData()`?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that the function should be named `getUserData()`?');
        });

        it('should handle questions with links', () => {
            const content = 'Is it correct that you want to use the library [React](https://reactjs.org)?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to use the library [React](https://reactjs.org)?');
        });

        it('should return empty array when no confirmation questions are present', () => {
            const content = 'This is a regular response without any confirmation questions.';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(0);
        });

        it('should ignore keywords not followed by a question mark', () => {
            const content = 'Is it correct that you want this feature. Here is more text.';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(0);
        });

        it('should be case-insensitive when detecting keywords', () => {
            const content = 'is it correct that this should work? IS IT CORRECT THAT this should also work?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(2);
            expect(result[0].originalQuestionText).toBe('is it correct that this should work?');
            expect(result[1].originalQuestionText).toBe('IS IT CORRECT THAT this should also work?');
        });

        it('should handle empty input gracefully', () => {
            const result = ConfirmationQuestionService.detectAndExtractQuestions('');
            expect(result).toHaveLength(0);
        });

        it('should handle null input gracefully', () => {
            const result = ConfirmationQuestionService.detectAndExtractQuestions(null as any);
            expect(result).toHaveLength(0);
        });

        it('should handle undefined input gracefully', () => {
            const result = ConfirmationQuestionService.detectAndExtractQuestions(undefined as any);
            expect(result).toHaveLength(0);
        });

        it('should handle questions with special characters', () => {
            const content = 'Is it correct that the regex should be /[a-zA-Z0-9]+/?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that the regex should be /[a-zA-Z0-9]+/?');
        });

        it('should skip overly long questions (potential false positives)', () => {
            const longText = 'a'.repeat(600);
            const content = `Is it correct that ${longText}?`;
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            // Should be skipped due to length > 500
            expect(result).toHaveLength(0);
        });

        it('should detect questions in mixed content', () => {
            const content = `
                Here is some context about your request.
                
                Is it correct that you want to implement user authentication?
                
                This would require the following steps:
                1. Create user model
                2. Add authentication middleware
                
                Are you sure that you want to proceed with this approach?
            `;
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(2);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to implement user authentication?');
            expect(result[1].originalQuestionText).toBe('Are you sure that you want to proceed with this approach?');
        });

        it('should handle questions with line breaks within the question text', () => {
            const content = 'Is it correct that you want to\nadd this feature?';
            const result = ConfirmationQuestionService.detectAndExtractQuestions(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].originalQuestionText).toBe('Is it correct that you want to\nadd this feature?');
        });
    });

    describe('hasConfirmationQuestions', () => {
        it('should return true when confirmation questions are present', () => {
            const content = 'Is it correct that you want this feature?';
            const result = ConfirmationQuestionService.hasConfirmationQuestions(content);
            
            expect(result).toBe(true);
        });

        it('should return false when no confirmation questions are present', () => {
            const content = 'This is just a regular message.';
            const result = ConfirmationQuestionService.hasConfirmationQuestions(content);
            
            expect(result).toBe(false);
        });

        it('should return false for empty string', () => {
            const result = ConfirmationQuestionService.hasConfirmationQuestions('');
            expect(result).toBe(false);
        });

        it('should return true for multiple confirmation questions', () => {
            const content = 'Is it correct that A? Could you please confirm that B?';
            const result = ConfirmationQuestionService.hasConfirmationQuestions(content);
            
            expect(result).toBe(true);
        });
    });
});
