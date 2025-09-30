/**
 * LLM Response Parser Utility
 * 
 * Provides robust parsing of JSON content from LLM responses that may be
 * wrapped in markdown code blocks or contain malformed JSON.
 */

/**
 * Extracts and parses JSON content from LLM text responses.
 * Handles common LLM output formats including markdown code blocks.
 * 
 * @param text - The raw LLM response content
 * @returns Parsed JSON object or null if parsing fails
 * @throws Error if no valid JSON can be extracted after all attempts
 */
export function extractJsonFromMarkdown(text: string): Record<string, any> | null {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
        return null;
    }

    // First, try to find JSON within markdown code blocks
    const jsonBlockMatch = trimmedText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
        const jsonContent = jsonBlockMatch[1].trim();
        const parsed = attemptJsonParse(jsonContent);
        if (parsed) {
            return parsed;
        }
    }

    // Try to find JSON-like content between curly braces
    const jsonMatch = trimmedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const parsed = attemptJsonParse(jsonMatch[0]);
        if (parsed) {
            return parsed;
        }
    }

    // Try to parse the entire text as JSON (fallback)
    return attemptJsonParse(trimmedText);
}

/**
 * Safely extracts JSON from LLM response with error handling.
 * Returns null instead of throwing errors for malformed responses.
 * 
 * @param text - The raw LLM response content
 * @returns Parsed JSON object or null if parsing fails
 */
export function safeExtractJson(text: string): Record<string, any> | null {
    try {
        return extractJsonFromMarkdown(text);
    } catch (error) {
        console.warn('Failed to extract JSON from LLM response:', error);
        return null;
    }
}

/**
 * Validates that the extracted JSON contains expected fields.
 * 
 * @param json - The parsed JSON object
 * @param requiredFields - Array of required field names
 * @returns True if all required fields are present, false otherwise
 */
export function validateJsonStructure(
    json: Record<string, any> | null,
    requiredFields: string[]
): boolean {
    if (!json || typeof json !== 'object') {
        return false;
    }

    return requiredFields.every(field => field in json);
}

/**
 * Error model for parsing failures
 */
export interface ErrorModel {
    category: 'Parsing' | 'Validation' | 'Schema';
    message: string;
    originalError?: any;
}

/**
 * Error categories for different types of parsing failures
 */
export enum ErrorCategory {
    Parsing = 'Parsing',
    Validation = 'Validation',
    Schema = 'Schema'
}

/**
 * Generic utility function for parsing and validating JSON output from LLMs
 * Handles markdown wrapping, required field validation, and optional schema validation
 * 
 * @param text - Raw LLM response content
 * @param requiredFields - Array of field names that must be present in the JSON
 * @param schema - Optional schema for deeper validation (e.g., Zod schema)
 * @returns Parsed object of type T if successful
 * @throws ErrorModel with ErrorCategory.Parsing if extraction or validation fails
 */
export function parseAndValidateLlmJson<T = Record<string, any>>(
    text: string,
    requiredFields: string[],
    schema?: any
): T {
    // Step 1: Extract JSON from the text using existing utility
    const extractedJson = safeExtractJson(text);
    
    if (!extractedJson) {
        const error = new Error(`Failed to extract valid JSON from LLM response. Text: ${text.substring(0, 200)}...`);
        (error as any).category = ErrorCategory.Parsing;
        (error as any).originalError = new Error('JSON extraction failed');
        throw error;
    }
    
    // Step 2: Validate required fields are present
    if (!validateJsonStructure(extractedJson, requiredFields)) {
        const missingFields = requiredFields.filter(field => !(field in extractedJson));
        const error = new Error(`Missing required fields in LLM response: ${missingFields.join(', ')}. Available fields: ${Object.keys(extractedJson).join(', ')}`);
        (error as any).category = ErrorCategory.Parsing;
        (error as any).originalError = new Error('Required field validation failed');
        throw error;
    }
    
    // Step 3: Apply schema validation if provided
    if (schema) {
        try {
            // If schema has a parse method (like Zod), use it
            if (typeof schema.parse === 'function') {
                return schema.parse(extractedJson) as T;
            }
            // If schema has a validate method, use it
            else if (typeof schema.validate === 'function') {
                const validationResult = schema.validate(extractedJson);
                if (!validationResult.valid) {
                    const error = new Error(`Schema validation failed: ${validationResult.errors?.join(', ') || 'Unknown validation error'}`);
                    (error as any).category = ErrorCategory.Schema;
                    (error as any).originalError = validationResult;
                    throw error;
                }
                return extractedJson as T;
            }
            // For other schema types, assume they're valid if we got this far
            else {
                return extractedJson as T;
            }
        } catch (error) {
            if (error && typeof error === 'object' && 'category' in error) {
                throw error; // Re-throw our ErrorModel
            }
            const schemaError = new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            (schemaError as any).category = ErrorCategory.Schema;
            (schemaError as any).originalError = error;
            throw schemaError;
        }
    }
    
    // Return the validated JSON as the requested type
    return extractedJson as T;
}

function attemptJsonParse(raw: string): Record<string, any> | null {
    if (!raw) {
        return null;
    }

    const trimmed = raw.trim();

    const tryParse = (value: string): Record<string, any> | null => {
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    };

    const direct = tryParse(trimmed);
    if (direct) {
        return direct;
    }

    const withoutTrailingCommas = trimmed.replace(/,\s*(?=[}\]])/g, "");
    const parsedWithoutTrailingCommas = tryParse(withoutTrailingCommas);
    if (parsedWithoutTrailingCommas) {
        return parsedWithoutTrailingCommas;
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = trimmed.slice(firstBrace, lastBrace + 1);
        const balanced = tryParse(candidate);
        if (balanced) {
            return balanced;
        }

        const fixedCandidate = candidate.replace(/,\s*(?=[}\]])/g, "");
        const parsedFixedCandidate = tryParse(fixedCandidate);
        if (parsedFixedCandidate) {
            return parsedFixedCandidate;
        }
    }

    return null;
}
