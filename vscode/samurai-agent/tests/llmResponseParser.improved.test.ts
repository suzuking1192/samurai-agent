/**
 * Tests for improved LLM Response Parser
 * Focuses on the new extractJsonFromLLMResponse function and the two specific JSON output types
 */

import { extractJsonFromLLMResponse } from '../src/common/utils/llmResponseParser';

describe('Improved LLM Response Parser', () => {
    describe('extractJsonFromLLMResponse - Type 1: Files and Reasoning Object', () => {
        it('should extract complete files and reasoning object with nested structures', () => {
            const response = `
Here is the analysis:
\`\`\`json
{
  "files": {
    "src/auth/AuthService.ts": ["AuthService", "TokenManager", "UserValidator"],
    "src/components/LoginForm.tsx": ["LoginForm", "LoginButton", "PasswordInput"],
    "src/utils/validation.ts": ["ValidationHelper"]
  },
  "reasoning": "The AuthService contains the core authentication logic with methods like authenticate() and validateToken(). The LoginForm handles the user interface components, and ValidationHelper provides utility functions for form validation."
}
\`\`\`
More context after
            `;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.files['src/auth/AuthService.ts']).toContain('AuthService');
            expect(result?.files['src/components/LoginForm.tsx']).toContain('LoginForm');
            expect(result?.reasoning).toContain('authentication logic');
        });

        it('should handle files object with very long reasoning text', () => {
            const longReasoning = 'A'.repeat(5000) + ' - This is a very detailed explanation of why these files are relevant to the current task.';
            const response = `\`\`\`json
{
  "files": {
    "src/core/Engine.ts": ["Engine", "EngineConfig"],
    "src/utils/Logger.ts": ["Logger", "LogLevel"]
  },
  "reasoning": "${longReasoning}"
}
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.reasoning).toBe(longReasoning);
            expect(result?.reasoning.length).toBe(longReasoning.length);
        });

        it('should extract files object even when followed by incomplete markdown block', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/api/UserAPI.ts": ["UserAPI", "UserService"],
    "src/models/User.ts": ["User", "UserProfile"]
  },
  "reasoning": "These files contain the user management functionality including API calls and data models."
}
\`\`\`
Some additional text without proper closing
            `;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.files['src/api/UserAPI.ts']).toContain('UserAPI');
            expect(result?.reasoning).toContain('user management');
        });

        it('should handle files object with escaped quotes in reasoning', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/config/settings.ts": ["Settings", "ConfigManager"]
  },
  "reasoning": "The settings file contains configuration with quoted values and special characters."
}
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.reasoning).toBe('The settings file contains configuration with quoted values and special characters.');
        });

        it('should handle files object with newlines in reasoning', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/database/Connection.ts": ["DatabaseConnection", "ConnectionPool"]
  },
  "reasoning": "Database connection logic: Handles connection pooling, manages transaction states, provides error handling"
}
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.reasoning).toContain('Database connection logic');
            expect(result?.reasoning).toContain('connection pooling');
        });

        it('should extract files object when curly braces appear in reasoning text', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/parser/JSONParser.ts": ["JSONParser", "ParseError"]
  },
  "reasoning": "The JSON parser handles complex nested structures and provides detailed error reporting for malformed JSON."
}
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.reasoning).toContain('complex nested structures');
        });
    });

    describe('extractJsonFromLLMResponse - Type 2: Array of Spec Objects', () => {
        it('should extract complete array of spec objects with nested structures', () => {
            const response = `
Here are the specifications:
\`\`\`json
[
  {
    "title": "Implement User Authentication System",
    "description": "Create a comprehensive authentication system with JWT tokens, password hashing, and session management. This includes user registration, login, logout, and password reset functionality.",
    "parent_spec_id": null
  },
  {
    "title": "Build Login Form Component",
    "description": "Develop a responsive login form with client-side validation, error handling, and accessibility features. The form should integrate with the authentication system.",
    "parent_spec_id": "auth-system-spec"
  },
  {
    "title": "Add Password Reset Feature",
    "description": "Implement secure password reset functionality including email verification and temporary token generation.",
    "parent_spec_id": "auth-system-spec"
  }
]
\`\`\`
Additional context here
            `;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(true);
            expect(result?.length).toBe(3);
            expect(result?.[0].title).toBe("Implement User Authentication System");
            expect(result?.[1].parent_spec_id).toBe("auth-system-spec");
            expect(result?.[2].description).toContain("password reset");
        });

        it('should handle spec array with very long descriptions', () => {
            const longDescription = 'A'.repeat(10000) + ' - This is a very detailed specification description.';
            const response = `\`\`\`json
[
  {
    "title": "Complex System Implementation",
    "description": "${longDescription}",
    "parent_spec_id": null
  }
]
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(true);
            expect(result?.[0].description).toBe(longDescription);
            expect(result?.[0].description.length).toBe(longDescription.length);
        });

        it('should extract spec array even when followed by incomplete markdown', () => {
            const response = `\`\`\`json
[
  {
    "title": "Database Schema Design",
    "description": "Design and implement the database schema with proper relationships and indexing.",
    "parent_spec_id": null
  },
  {
    "title": "API Endpoint Implementation",
    "description": "Create RESTful API endpoints for data access and manipulation.",
    "parent_spec_id": "db-schema-spec"
  }
]
\`\`\`
Some trailing text
            `;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(true);
            expect(result?.length).toBe(2);
            expect(result?.[0].title).toBe("Database Schema Design");
        });

        it('should handle specs with escaped quotes in descriptions', () => {
            const response = `\`\`\`json
[
  {
    "title": "Configuration Management",
    "description": "Handle application configuration with nested values and environment-specific settings.",
    "parent_spec_id": null
  }
]
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.[0].description).toBe('Handle application configuration with nested values and environment-specific settings.');
        });

        it('should handle specs with newlines in descriptions', () => {
            const response = `\`\`\`json
[
  {
    "title": "Error Handling System",
    "description": "Implement comprehensive error handling: Global error boundary, API error responses, User-friendly error messages",
    "parent_spec_id": null
  }
]
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.[0].description).toContain('comprehensive error handling');
            expect(result?.[0].description).toContain('Global error boundary');
        });

        it('should extract spec array when brackets appear in description text', () => {
            const response = `\`\`\`json
[
  {
    "title": "Array Processing System",
    "description": "Handle array operations including filtering, mapping, and reducing data transformations.",
    "parent_spec_id": null
  }
]
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).not.toBeNull();
            expect(result?.[0].description).toContain('filtering');
            expect(result?.[0].description).toContain('mapping');
        });
    });

    describe('Robustness - Real-world LLM Response Scenarios', () => {
        it('should handle response with extensive text before and after json block', () => {
            const response = `I've analyzed your requirements and here's what I found:

Based on the codebase analysis and your specifications, I've identified the following relevant elements and generated the corresponding specifications.

\`\`\`json
{
  "files": {
    "src/core/Engine.ts": ["Engine", "EngineConfig", "EngineState"],
    "src/components/UI.tsx": ["UIComponent", "Button", "Modal"]
  },
  "reasoning": "The Engine.ts file contains the core business logic that drives the application, while UI.tsx provides the user interface components needed for interaction."
}
\`\`\`

Additionally, here are the specifications for implementation:

\`\`\`json
[
  {
    "title": "Core Engine Implementation",
    "description": "Implement the main engine with state management and configuration handling.",
    "parent_spec_id": null
  }
]
\`\`\`

Let me know if you need any clarification or additional details about these selections.`;
            
            // Test the first JSON block (files and reasoning)
            const firstJsonStart = response.indexOf('```json');
            const firstJsonEnd = response.indexOf('```', firstJsonStart + 7);
            const firstJsonBlock = response.substring(firstJsonStart, firstJsonEnd + 3);
            const result1 = extractJsonFromLLMResponse(firstJsonBlock);
            
            expect(result1).toBeTruthy();
            expect(result1?.files['src/core/Engine.ts']).toEqual(['Engine', 'EngineConfig', 'EngineState']);
            expect(result1?.reasoning).toContain('core business logic');

            // Test the second JSON block (spec array)
            const secondJsonStart = response.indexOf('```json', firstJsonEnd);
            const secondJsonEnd = response.lastIndexOf('```');
            const secondJsonBlock = response.substring(secondJsonStart, secondJsonEnd + 3);
            const result2 = extractJsonFromLLMResponse(secondJsonBlock);
            
            expect(result2).toBeTruthy();
            expect(Array.isArray(result2)).toBe(true);
            expect(result2?.[0].title).toBe("Core Engine Implementation");
        });

        it('should handle JSON with Unicode characters and emojis', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/国际化/i18n.ts": ["I18nService", "TranslationManager"],
    "src/组件/按钮.tsx": ["Button", "IconButton", "ToggleButton"]
  },
  "reasoning": "These files handle internationalization (i18n) 🌍 and contain Chinese characters in filenames. The I18nService manages translations while Button components handle UI elements with emoji support 🎉."
}
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).toBeTruthy();
            expect(result?.files['src/国际化/i18n.ts']).toEqual(['I18nService', 'TranslationManager']);
            expect(result?.files['src/组件/按钮.tsx']).toEqual(['Button', 'IconButton', 'ToggleButton']);
            expect(result?.reasoning).toContain('🌍');
            expect(result?.reasoning).toContain('🎉');
        });

        it('should handle complex nested structures with code examples', () => {
            const response = `\`\`\`json
[
  {
    "title": "API Integration Service",
    "description": "Implement service for external API integration. Example usage: \`\`\`typescript\\nconst apiService = new APIService();\\nconst result = await apiService.fetch('/users');\\n\`\`\`\\n\\nThis service should handle authentication, rate limiting, and error retry logic.",
    "parent_spec_id": null
  },
  {
    "title": "Data Validation Layer",
    "description": "Create validation layer using Zod schema validation. Schema example: \`\`\`typescript\\nconst userSchema = z.object({\\n  id: z.string(),\\n  email: z.string().email()\\n});\\n\`\`\`",
    "parent_spec_id": "api-integration-spec"
  }
]
\`\`\``;
            
            const result = extractJsonFromLLMResponse(response);
            expect(result).toBeTruthy();
            expect(Array.isArray(result)).toBe(true);
            expect(result?.[0].description).toContain('typescript');
            expect(result?.[0].description).toContain('APIService');
            expect(result?.[1].description).toContain('Zod schema');
            expect(result?.[1].parent_spec_id).toBe("api-integration-spec");
        });

        it('should handle trailing commas and formatting issues', () => {
            const response = `\`\`\`json
{
  "files": {
    "src/utils/helpers.ts": ["HelperFunction", "UtilityClass"],
    "src/types/index.ts": ["UserType", "ApiResponse"]
  },
  "reasoning": "Utility functions and type definitions for the application."
}
\`\`\``;
            
            // This should work with properly formatted JSON
            const result = extractJsonFromLLMResponse(response);
            expect(result).toBeTruthy();
            expect(result?.files['src/utils/helpers.ts']).toEqual(['HelperFunction', 'UtilityClass']);
            expect(result?.reasoning).toContain('Utility functions');
        });
    });
});