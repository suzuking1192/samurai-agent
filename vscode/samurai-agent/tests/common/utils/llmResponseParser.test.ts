import { extractJsonFromMarkdown, safeExtractJson, validateJsonStructure, parseAndValidateLlmJson, ErrorCategory } from '../../../src/common/utils/llmResponseParser';

describe('llmResponseParser', () => {
  describe('extractJsonFromMarkdown', () => {
    it('should extract JSON from markdown code block with json language', () => {
      const input = `Here's the result:
\`\`\`json
{
  "relevance_score": 8,
  "context": "This is a test",
  "file_path": "test.js"
}
\`\`\``;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toEqual({
        relevance_score: 8,
        context: "This is a test",
        file_path: "test.js"
      });
    });

    it('should extract JSON from markdown code block without language', () => {
      const input = `Here's the result:
\`\`\`
{
  "relevance_score": 5,
  "context": "Another test"
}
\`\`\``;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toEqual({
        relevance_score: 5,
        context: "Another test"
      });
    });

    it('should extract JSON from plain JSON string', () => {
      const input = `{"relevance_score": 7, "context": "Plain JSON"}`;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toEqual({
        relevance_score: 7,
        context: "Plain JSON"
      });
    });

    it('should extract JSON from text with curly braces', () => {
      const input = `Here is the analysis: {"relevance_score": 6, "context": "Curly braces test"} and some other text`;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toEqual({
        relevance_score: 6,
        context: "Curly braces test"
      });
    });

    it('should return null for malformed JSON', () => {
      const input = `\`\`\`json
{
  "relevance_score": 8,
  "context": "This is missing a closing brace"
\`\`\``;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toBeNull();
    });

    it('should return null for non-JSON content', () => {
      const input = `This is just plain text with no JSON`;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = extractJsonFromMarkdown('');
      expect(result).toBeNull();
    });

    it('should handle multiple JSON blocks by taking the first one', () => {
      const input = `First block:
\`\`\`json
{"score": 1}
\`\`\`
Second block:
\`\`\`json
{"score": 2}
\`\`\``;
      
      const result = extractJsonFromMarkdown(input);
      expect(result).toEqual({ score: 1 });
    });
  });

  describe('safeExtractJson', () => {
    it('should return null instead of throwing for malformed JSON', () => {
      const input = `Invalid JSON: {"unclosed": "brace"`;
      
      const result = safeExtractJson(input);
      expect(result).toBeNull();
    });

    it('should successfully extract valid JSON', () => {
      const input = `{"relevance_score": 9, "context": "Valid JSON"}`;
      
      const result = safeExtractJson(input);
      expect(result).toEqual({
        relevance_score: 9,
        context: "Valid JSON"
      });
    });
  });

  describe('validateJsonStructure', () => {
    it('should return true when all required fields are present', () => {
      const json = {
        relevance_score: 8,
        context: "Test context",
        file_path: "test.js"
      };
      
      const result = validateJsonStructure(json, ['relevance_score', 'context']);
      expect(result).toBe(true);
    });

    it('should return false when required fields are missing', () => {
      const json = {
        relevance_score: 8,
        context: "Test context"
      };
      
      const result = validateJsonStructure(json, ['relevance_score', 'context', 'file_path']);
      expect(result).toBe(false);
    });

    it('should return false for null input', () => {
      const result = validateJsonStructure(null, ['relevance_score']);
      expect(result).toBe(false);
    });

    it('should return false for non-object input', () => {
      const result = validateJsonStructure("string", ['relevance_score']);
      expect(result).toBe(false);
    });

    it('should return true for empty required fields array', () => {
      const json = { any: "field" };
      const result = validateJsonStructure(json, []);
      expect(result).toBe(true);
    });
  });

  describe('parseAndValidateLlmJson', () => {
    it('should successfully parse and validate JSON with required fields', () => {
      const input = `{"new_code_context_necessary": true, "extraction_query": "Find authentication code", "reasoning": "Need to understand auth implementation"}`;
      
      const result = parseAndValidateLlmJson<{
        new_code_context_necessary: boolean;
        extraction_query: string | null;
        reasoning: string;
      }>(input, ['new_code_context_necessary', 'extraction_query', 'reasoning']);
      
      expect(result).toEqual({
        new_code_context_necessary: true,
        extraction_query: "Find authentication code",
        reasoning: "Need to understand auth implementation"
      });
    });

    it('should handle markdown-wrapped JSON', () => {
      const input = `Here's the analysis:
\`\`\`json
{
  "new_code_context_necessary": false,
  "extraction_query": null,
  "reasoning": "Existing context is sufficient"
}
\`\`\``;
      
      const result = parseAndValidateLlmJson<{
        new_code_context_necessary: boolean;
        extraction_query: string | null;
        reasoning: string;
      }>(input, ['new_code_context_necessary', 'extraction_query', 'reasoning']);
      
      expect(result).toEqual({
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: "Existing context is sufficient"
      });
    });

    it('should throw ErrorModel with Parsing category for invalid JSON', () => {
      const input = `Invalid JSON: {"unclosed": "brace"`;
      
      expect(() => {
        parseAndValidateLlmJson(input, ['new_code_context_necessary']);
      }).toThrow();
      
      try {
        parseAndValidateLlmJson(input, ['new_code_context_necessary']);
      } catch (error: any) {
        expect(error.category).toBe(ErrorCategory.Parsing);
        expect(error.message).toContain('Failed to extract valid JSON');
      }
    });

    it('should throw ErrorModel with Parsing category for missing required fields', () => {
      const input = `{"new_code_context_necessary": true}`;
      
      expect(() => {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning']);
      }).toThrow();
      
      try {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning']);
      } catch (error: any) {
        expect(error.category).toBe(ErrorCategory.Parsing);
        expect(error.message).toContain('Missing required fields');
        expect(error.message).toContain('extraction_query');
        expect(error.message).toContain('reasoning');
      }
    });

    it('should work with Zod-like schema validation', () => {
      const input = `{"new_code_context_necessary": true, "extraction_query": "Find code", "reasoning": "Need more context"}`;
      
      const mockSchema = {
        parse: jest.fn().mockReturnValue({
          new_code_context_necessary: true,
          extraction_query: "Find code",
          reasoning: "Need more context"
        })
      };
      
      const result = parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      
      expect(mockSchema.parse).toHaveBeenCalledWith({
        new_code_context_necessary: true,
        extraction_query: "Find code",
        reasoning: "Need more context"
      });
      expect(result).toEqual({
        new_code_context_necessary: true,
        extraction_query: "Find code",
        reasoning: "Need more context"
      });
    });

    it('should throw ErrorModel with Schema category for schema validation failure', () => {
      const input = `{"new_code_context_necessary": true, "extraction_query": "Find code", "reasoning": "Need more context"}`;
      
      const mockSchema = {
        parse: jest.fn().mockImplementation(() => {
          throw new Error('Schema validation failed');
        })
      };
      
      expect(() => {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      }).toThrow();
      
      try {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      } catch (error: any) {
        expect(error.category).toBe(ErrorCategory.Schema);
        expect(error.message).toContain('Schema validation failed');
      }
    });

    it('should work with validate-style schema validation', () => {
      const input = `{"new_code_context_necessary": true, "extraction_query": "Find code", "reasoning": "Need more context"}`;
      
      const mockSchema = {
        validate: jest.fn().mockReturnValue({
          valid: true
        })
      };
      
      const result = parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      
      expect(mockSchema.validate).toHaveBeenCalledWith({
        new_code_context_necessary: true,
        extraction_query: "Find code",
        reasoning: "Need more context"
      });
      expect(result).toEqual({
        new_code_context_necessary: true,
        extraction_query: "Find code",
        reasoning: "Need more context"
      });
    });

    it('should throw ErrorModel with Schema category for validate-style schema validation failure', () => {
      const input = `{"new_code_context_necessary": true, "extraction_query": "Find code", "reasoning": "Need more context"}`;
      
      const mockSchema = {
        validate: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Field validation failed']
        })
      };
      
      expect(() => {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      }).toThrow();
      
      try {
        parseAndValidateLlmJson(input, ['new_code_context_necessary', 'extraction_query', 'reasoning'], mockSchema);
      } catch (error: any) {
        expect(error.category).toBe(ErrorCategory.Schema);
        expect(error.message).toContain('Schema validation failed');
        expect(error.message).toContain('Field validation failed');
      }
    });

    it('should handle empty string input', () => {
      expect(() => {
        parseAndValidateLlmJson('', ['new_code_context_necessary']);
      }).toThrow();
      
      try {
        parseAndValidateLlmJson('', ['new_code_context_necessary']);
      } catch (error: any) {
        expect(error.category).toBe(ErrorCategory.Parsing);
        expect(error.message).toContain('Failed to extract valid JSON');
      }
    });
  });
});
