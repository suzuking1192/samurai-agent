/**
 * Tests for improved LLM Response Parser
 * Focuses on edge cases and robustness improvements
 */

import { extractJsonFromMarkdown, parseAndValidateLlmJson } from '../src/common/utils/llmResponseParser';

describe('Improved LLM Response Parser', () => {
    describe('extractJsonFromMarkdown - Balanced JSON Extraction', () => {
        it('should extract complete JSON with nested objects', () => {
            const response = `
Here is the response:
{
  "clarification_text": "This is a test with {nested: 'objects'}",
  "score": 85,
  "metadata": {
    "nested": {
      "deep": "value"
    }
  }
}
More text after
            `;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toContain('nested');
            expect(result?.score).toBe(85);
            expect(result?.metadata?.nested?.deep).toBe('value');
        });

        it('should handle JSON in markdown code blocks with long content', () => {
            const longText = 'A'.repeat(5000);
            const response = `\`\`\`json
{
  "clarification_text": "${longText}",
  "score": 75
}
\`\`\``;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toBe(longText);
            expect(result?.score).toBe(75);
        });

        it('should extract JSON even when followed by incomplete markdown block', () => {
            const response = `\`\`\`json
{
  "clarification_text": "Complete content here",
  "score": 90
}
\`\`\`
Some additional text without closing
            `;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toBe('Complete content here');
            expect(result?.score).toBe(90);
        });

        it('should handle JSON with escaped quotes in strings', () => {
            const response = `{
  "clarification_text": "Text with \\"escaped\\" quotes",
  "score": 80
}`;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toBe('Text with "escaped" quotes');
        });

        it('should handle JSON with newlines in string values', () => {
            const response = `{
  "clarification_text": "Line 1\\nLine 2\\nLine 3",
  "score": 70
}`;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toContain('Line 1');
        });

        it('should extract balanced JSON when curly braces appear in strings', () => {
            const response = `{
  "clarification_text": "This has {braces} in the text",
  "score": 65,
  "data": {
    "more": "content"
  }
}`;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.clarification_text).toContain('{braces}');
            expect(result?.data?.more).toBe('content');
        });

        it('should handle trailing commas in JSON', () => {
            const response = `{
  "clarification_text": "Test content",
  "score": 88,
}`;
            
            const result = extractJsonFromMarkdown(response);
            expect(result).not.toBeNull();
            expect(result?.score).toBe(88);
        });

        it('should handle JSON with comments (non-standard but LLMs sometimes do this)', () => {
            const response = `{
  "clarification_text": "Test",
  // This is a comment
  "score": 92
}`;
            
            // This might fail (comments aren't valid JSON), but should not crash
            const result = extractJsonFromMarkdown(response);
            // We don't strictly require this to work, just not crash
            expect(result).toBeDefined();
        });
    });

    describe('parseAndValidateLlmJson - Edge Cases', () => {
        it('should parse spec clarification with very long text', () => {
            const longText = 'A'.repeat(10000);
            const response = `\`\`\`json
{
  "clarification_text": "${longText}",
  "score": 85
}
\`\`\``;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result.clarification_text).toBe(longText);
            expect(result.score).toBe(85);
        });

        it('should handle JSON with special characters in clarification_text', () => {
            const response = `{
  "clarification_text": "Special chars: <>&\\"'\\n\\t",
  "score": 78
}`;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result).toBeDefined();
            expect(result.score).toBe(78);
        });

        it('should throw detailed error when required fields are missing', () => {
            const response = `{
  "clarification_text": "Only has one field"
}`;
            
            expect(() => {
                parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            }).toThrow(/Missing required fields/);
        });

        it('should handle markdown code block with language specifier', () => {
            const response = `\`\`\`json
{
  "clarification_text": "Test content",
  "score": 92
}
\`\`\``;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result.clarification_text).toBe('Test content');
            expect(result.score).toBe(92);
        });

        it('should handle markdown code block without language specifier', () => {
            const response = `\`\`\`
{
  "clarification_text": "Test content",
  "score": 88
}
\`\`\``;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result.clarification_text).toBe('Test content');
            expect(result.score).toBe(88);
        });
    });

    describe('Robustness - Real-world LLM Responses', () => {
        it('should handle response with extra text before JSON', () => {
            const response = `Sure! Here's the clarification:

\`\`\`json
{
  "clarification_text": "The feature should...",
  "score": 82
}
\`\`\`

Let me know if you need more details.`;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result).toBeDefined();
            expect(result.score).toBe(82);
        });

        it('should handle JSON with Unicode characters', () => {
            const response = `{
  "clarification_text": "Test with emoji 🎉 and unicode ñ",
  "score": 95
}`;
            
            const result = parseAndValidateLlmJson(response, ['clarification_text', 'score']);
            expect(result).toBeDefined();
            expect(result.clarification_text).toContain('🎉');
        });
    });
});
