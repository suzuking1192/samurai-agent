/**
 * Confirmation Question Service
 * 
 * Detects and extracts confirmation questions from LLM responses.
 * Supports specific confirmation keywords and preserves markdown formatting.
 */

export interface ConfirmationQuestion {
    originalQuestionText: string;
}

export class ConfirmationQuestionService {
    /**
     * Keywords that indicate a confirmation question (case-insensitive)
     */
    private static readonly CONFIRMATION_KEYWORDS = [
        'Is it correct that',
        'Could you please confirm that',
        'Are you sure that',
        'Do you confirm that'
    ];

    /**
     * Detects and extracts confirmation questions from LLM response content
     * 
     * @param llmResponseContent - The raw text content from the LLM response
     * @returns Array of detected confirmation questions with preserved markdown
     */
    public static detectAndExtractQuestions(llmResponseContent: string): ConfirmationQuestion[] {
        if (!llmResponseContent || typeof llmResponseContent !== 'string') {
            console.warn('ConfirmationQuestionService: Invalid input content');
            return [];
        }

        const questions: ConfirmationQuestion[] = [];

        try {
            // Process each keyword
            for (const keyword of this.CONFIRMATION_KEYWORDS) {
                const keywordQuestions = this.extractQuestionsForKeyword(
                    llmResponseContent,
                    keyword
                );
                questions.push(...keywordQuestions);
            }

            console.log(
                `ConfirmationQuestionService: Detected ${questions.length} confirmation question(s)`
            );
            
            return questions;
        } catch (error) {
            console.warn('ConfirmationQuestionService: Error during question detection', error);
            return [];
        }
    }

    /**
     * Extracts questions for a specific keyword from the content
     * 
     * @param content - The content to search
     * @param keyword - The keyword to search for
     * @returns Array of questions found for this keyword
     */
    private static extractQuestionsForKeyword(
        content: string,
        keyword: string
    ): ConfirmationQuestion[] {
        const questions: ConfirmationQuestion[] = [];
        
        // Create case-insensitive regex to find keyword
        const keywordRegex = new RegExp(keyword, 'gi');
        let match: RegExpExecArray | null;

        while ((match = keywordRegex.exec(content)) !== null) {
            const keywordStartIndex = match.index;
            
            // Find the next '?' after the keyword
            const questionMarkIndex = content.indexOf('?', keywordStartIndex);
            
            if (questionMarkIndex === -1) {
                // No '?' found for this keyword instance, skip it
                continue;
            }

            // Extract the full question including the '?'
            const questionText = content.slice(keywordStartIndex, questionMarkIndex + 1).trim();
            
            // Validate the question isn't too long (likely a false positive)
            if (questionText.length > 500) {
                console.warn(
                    `ConfirmationQuestionService: Skipping overly long question (${questionText.length} chars)`
                );
                continue;
            }

            questions.push({
                originalQuestionText: questionText
            });
        }

        return questions;
    }

    /**
     * Validates if the given content contains any confirmation questions
     * 
     * @param content - The content to validate
     * @returns True if confirmation questions are found
     */
    public static hasConfirmationQuestions(content: string): boolean {
        const questions = this.detectAndExtractQuestions(content);
        return questions.length > 0;
    }
}
