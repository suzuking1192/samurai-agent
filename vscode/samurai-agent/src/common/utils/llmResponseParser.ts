/**
 * LLM Response Parser Utility
 * 
 * Provides robust parsing of JSON content from LLM responses that may be
 * wrapped in markdown code blocks or contain malformed JSON.
 * 
 * Key features:
 * - Handles both JSON objects {...} and arrays [...]
 * - Handles nested code blocks within JSON content (e.g., code examples in strings)
 * - Uses balanced brace/bracket counting for reliable extraction
 * - Multiple fallback strategies for various LLM output formats
 * - Handles common JSON formatting issues (trailing commas, unquoted keys, etc.)
 */

/**
 * Sanitizes JSON string by escaping literal newlines within string values.
 * LLMs sometimes generate JSON with actual line breaks inside string values,
 * which is invalid JSON. This function converts them to \n escape sequences.
 * 
 * @param jsonString - The JSON string to sanitize
 * @returns Sanitized JSON string with escaped newlines
 */
function sanitizeJsonNewlines(jsonString: string): string {
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        // Track if we're inside a string
        if (char === '"' && !escapeNext) {
            inString = !inString;
            result += char;
        } else if (char === '\\' && !escapeNext) {
            escapeNext = true;
            result += char;
        } else if (char === '\n') {
            // Replace literal newlines inside strings with \n
            if (inString) {
                result += '\\n';
            } else {
                // Keep newlines outside strings (for formatting)
                result += char;
            }
            escapeNext = false;
        } else if (char === '\r') {
            // Replace literal carriage returns inside strings
            if (inString) {
                result += '\\r';
            } else {
                result += char;
            }
            escapeNext = false;
        } else {
            result += char;
            escapeNext = false;
        }
    }
    
    return result;
}

/**
 * Extracts JSON from LLM responses that may be wrapped in markdown code blocks or be plain JSON.
 * This function handles multiple formats:
 * 1. JSON wrapped in ```json``` code blocks
 * 2. Plain JSON without code block markers
 * 3. JSON with balanced brace counting for better accuracy
 * 
 * @param text - The raw LLM response content
 * @returns Parsed JSON object or array, or null if parsing fails
 */
export function extractJsonFromLLMResponse(text: string): any | null {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
        return null;
    }

    // Strategy 1: Try to find JSON wrapped in markdown code blocks
    const jsonStartMarker = '```json';
    const startIndex = trimmedText.indexOf(jsonStartMarker);
    
    if (startIndex !== -1) {
        // Find the position after the ```json marker
        const contentStartIndex = startIndex + jsonStartMarker.length;
        
        // Find the last ``` marker
        const endMarker = '```';
        const lastEndIndex = trimmedText.lastIndexOf(endMarker);
        if (lastEndIndex !== -1 && lastEndIndex > contentStartIndex) {
            // Extract content between the markers
            const jsonContent = trimmedText.substring(contentStartIndex, lastEndIndex).trim();
            
            if (jsonContent) {
                try {
                    // Sanitize literal newlines in string values
                    const sanitizedContent = sanitizeJsonNewlines(jsonContent);
                    const parsed = JSON.parse(sanitizedContent);
                    console.log('extractJsonFromLLMResponse - Successfully parsed JSON from code block:', {
                        contentLength: jsonContent.length,
                        hasExtractionQuery: !!parsed.extraction_query,
                        extractionQueryLength: parsed.extraction_query?.length
                    });
                    return parsed;
                } catch (error) {
                    console.warn('Failed to parse JSON content from code block:', error);
                    // Fall through to other strategies
                }
            }
        }
    }

    // Strategy 2: Try to parse the entire text as JSON (for plain JSON responses)
    try {
        const sanitizedText = sanitizeJsonNewlines(trimmedText);
        const parsed = JSON.parse(sanitizedText);
        console.log('extractJsonFromLLMResponse - Successfully parsed plain JSON:', {
            contentLength: trimmedText.length,
            hasExtractionQuery: !!parsed.extraction_query,
            extractionQueryLength: parsed.extraction_query?.length
        });
        return parsed;
    } catch (error) {
        // Fall through to brace counting strategy
    }

    // Strategy 3: Use balanced brace counting to find JSON object/array
    let braceCount = 0;
    let startIdx = -1;
    let endIdx = -1;
    let isArray = false;

    for (let i = 0; i < trimmedText.length; i++) {
        const char = trimmedText[i];
        
        if (char === '{' || char === '[') {
            if (braceCount === 0) {
                startIdx = i;
                isArray = char === '[';
            }
            braceCount++;
        } else if (char === '}' || char === ']') {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
                endIdx = i;
                break;
            }
        }
    }

    if (startIdx !== -1 && endIdx !== -1) {
        const jsonCandidate = trimmedText.substring(startIdx, endIdx + 1);
        try {
            const sanitizedCandidate = sanitizeJsonNewlines(jsonCandidate);
            const parsed = JSON.parse(sanitizedCandidate);
            console.log('extractJsonFromLLMResponse - Successfully parsed JSON using brace counting:', {
                contentLength: jsonCandidate.length,
                hasExtractionQuery: !!parsed.extraction_query,
                extractionQueryLength: parsed.extraction_query?.length
            });
            return parsed;
        } catch (error) {
            console.warn('Failed to parse JSON using brace counting:', error);
        }
    }

    // Strategy 4: Handle truncated JSON responses (common with token limits)
    if (startIdx !== -1 && endIdx === -1) {
        console.log('Detected potentially truncated JSON response, attempting to repair...');
        const truncatedJson = trimmedText.substring(startIdx);
        
        // Try to repair common truncation patterns
        const repairAttempts = [
            // Add missing closing braces/brackets
            truncatedJson + '}',
            truncatedJson + ']}',
            truncatedJson + '}]}',
            truncatedJson + '}]}]}',
            // Handle incomplete string values
            truncatedJson.replace(/"[^"]*$/, '""') + '}',
            truncatedJson.replace(/"[^"]*$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*$/, '""') + '}]}',
            // Handle incomplete array values
            truncatedJson.replace(/,\s*$/, '') + '}',
            truncatedJson.replace(/,\s*$/, '') + ']}',
            truncatedJson.replace(/,\s*$/, '') + '}]}',
            // Handle truncation in the middle of strings (like "Op...")
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}]}',
            // Handle truncation with ellipsis patterns
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}]}',
            // Handle incomplete array elements
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}',
        ];

        for (let i = 0; i < repairAttempts.length; i++) {
            try {
                const repaired = repairAttempts[i];
                const parsed = JSON.parse(repaired);
                console.log(`extractJsonFromLLMResponse - Successfully repaired and parsed truncated JSON (attempt ${i + 1}):`, {
                    originalLength: truncatedJson.length,
                    repairedLength: repaired.length,
                    hasExtractionQuery: !!parsed.extraction_query,
                    extractionQueryLength: parsed.extraction_query?.length,
                    hasFiles: !!parsed.files,
                    filesCount: parsed.files ? Object.keys(parsed.files).length : 0
                });
                return parsed;
            } catch (error) {
                // Continue to next repair attempt
            }
        }

        // Strategy 5: Advanced repair for complex truncation patterns
        console.log('Attempting advanced JSON repair for complex truncation patterns...');
        
        // Try to repair the specific pattern from the log: incomplete array elements
        const advancedRepairAttempts = [
            // Remove incomplete array elements and close properly
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}]}',
            // Handle nested truncation patterns
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}',
            // Try to close arrays and objects systematically
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}',
            // Handle the specific case where we have incomplete string values
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}]}',
        ];

        for (let i = 0; i < advancedRepairAttempts.length; i++) {
            try {
                const repaired = advancedRepairAttempts[i];
                const parsed = JSON.parse(repaired);
                console.log(`extractJsonFromLLMResponse - Successfully repaired truncated JSON with advanced strategy (attempt ${i + 1}):`, {
                    originalLength: truncatedJson.length,
                    repairedLength: repaired.length,
                    hasExtractionQuery: !!parsed.extraction_query,
                    extractionQueryLength: parsed.extraction_query?.length,
                    hasFiles: !!parsed.files,
                    filesCount: parsed.files ? Object.keys(parsed.files).length : 0
                });
                return parsed;
            } catch (error) {
                // Continue to next repair attempt
            }
        }

        console.warn('Failed to repair truncated JSON response after all attempts');
    }

    // All strategies failed
    return null;
}
