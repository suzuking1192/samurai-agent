import { extractJsonFromLLMResponse } from '../../../src/common/utils/llmResponseParser';

describe('llmResponseParser', () => {
  describe('extractJsonFromLLMResponse', () => {
    // Test Type 1: Object with files and reasoning (from step2_identify_relevant_elements.md)
    describe('Type 1: Files and Reasoning Object', () => {
      it('should extract files and reasoning object from markdown code block', () => {
        const input = `Here are the relevant elements:
\`\`\`json
{
  "files": {
    "path/to/file.ext": ["ElementOne", "ElementTwo"],
    "another/file.ext": ["ClassAlpha"]
  },
  "reasoning": "Brief explanation of why these files/elements are relevant or why none were selected."
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toEqual({
          files: {
            "path/to/file.ext": ["ElementOne", "ElementTwo"],
            "another/file.ext": ["ClassAlpha"]
          },
          reasoning: "Brief explanation of why these files/elements are relevant or why none were selected."
        });
      });

      it('should handle files object with code content in reasoning', () => {
        const input = `\`\`\`json
{
  "files": {
    "src/auth.ts": ["AuthService", "LoginComponent"],
    "src/utils.ts": ["HelperFunction"]
  },
  "reasoning": "These files contain authentication logic with functions like authenticate() and validateToken() that are relevant to the security implementation."
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files['src/auth.ts']).toEqual(['AuthService', 'LoginComponent']);
        expect(result?.files['src/auth.ts']).toContain('AuthService');
        expect(result?.reasoning).toContain('authenticate()');
      });

      it('should handle empty files object', () => {
        const input = `\`\`\`json
{
  "files": {},
  "reasoning": "No relevant files found for this task."
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toEqual({
          files: {},
          reasoning: "No relevant files found for this task."
        });
      });

      it('should handle files with nested code blocks in reasoning', () => {
        const input = `\`\`\`json
{
  "files": {
    "src/components/Button.tsx": ["Button", "ButtonProps"]
  },
  "reasoning": "The Button component contains the implementation we need. Here's the relevant code: typescript const Button = ({ onClick }) => { return <button onClick={onClick}>Click me</button>; };"
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files['src/components/Button.tsx']).toContain('Button');
        expect(result?.reasoning).toContain('typescript');
      });
    });

    // Test Type 2: Array of spec objects (from generate_spec_system_prompt.md)
    describe('Type 2: Array of Spec Objects', () => {
      it('should extract array of spec objects from markdown code block', () => {
        const input = `Here are the generated specs:
\`\`\`json
[
  {
    "title": "Implement User Authentication",
    "description": "Create a secure authentication system with JWT tokens and password hashing.",
    "parent_spec_id": null
  },
  {
    "title": "Add Login Form Component",
    "description": "Build a responsive login form with validation and error handling.",
    "parent_spec_id": "auth-spec-1"
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toEqual([
          {
            title: "Implement User Authentication",
            description: "Create a secure authentication system with JWT tokens and password hashing.",
            parent_spec_id: null
          },
          {
            title: "Add Login Form Component",
            description: "Build a responsive login form with validation and error handling.",
            parent_spec_id: "auth-spec-1"
          }
        ]);
      });

      it('should handle single spec object in array', () => {
        const input = `\`\`\`json
[
  {
    "title": "Setup Database Schema",
    "description": "Define the database tables and relationships for the user management system.",
    "parent_spec_id": null
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toEqual([
          {
            title: "Setup Database Schema",
            description: "Define the database tables and relationships for the user management system.",
            parent_spec_id: null
          }
        ]);
      });

      it('should handle specs with code examples in descriptions', () => {
        const input = `\`\`\`json
[
  {
    "title": "Create API Endpoint",
    "description": "Implement REST API endpoint. Example: javascript app.post('/api/users', (req, res) => { // Handle user creation });",
    "parent_spec_id": null
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.[0].title).toBe("Create API Endpoint");
        expect(result?.[0].description).toContain('javascript');
        expect(result?.[0].description).toContain('app.post');
      });

      it('should handle empty spec array', () => {
        const input = `\`\`\`json
[]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toEqual([]);
      });
    });

    // Edge cases and error handling
    describe('Error Handling', () => {
      it('should return null for malformed JSON', () => {
        const input = `\`\`\`json
{
  "files": {
    "test.js": ["Function1", "Function2"
  },
  "reasoning": "This JSON is missing closing brace"
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeNull();
      });

      it('should return null when no json marker is found', () => {
        const input = `This is just plain text without any json markers`;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = extractJsonFromLLMResponse('');
        expect(result).toBeNull();
      });

      it('should return null for null input', () => {
        const result = extractJsonFromLLMResponse(null as any);
        expect(result).toBeNull();
      });

      it('should handle incomplete json markers by falling back to plain JSON parsing', () => {
        const input = `\`\`\`json
{
  "test": "value"
`;
        
        const result = extractJsonFromLLMResponse(input);
        // The parser should still extract valid JSON even if markdown markers are incomplete
        expect(result).toEqual({ "test": "value" });
      });

      it('should return null for empty content between markers', () => {
        const input = `\`\`\`json
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeNull();
      });
    });

    // Real-world scenarios
    describe('Real-world LLM Response Scenarios', () => {
      it('should handle response with text before and after json block', () => {
        const input = `I'll analyze the codebase and identify relevant elements.

\`\`\`json
{
  "files": {
    "src/auth/AuthService.ts": ["AuthService", "TokenManager"],
    "src/components/LoginForm.tsx": ["LoginForm", "LoginButton"]
  },
  "reasoning": "The AuthService contains the core authentication logic, and LoginForm handles the user interface for login."
}
\`\`\`

Let me know if you need any clarification on these selections.`;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files['src/auth/AuthService.ts']).toEqual(['AuthService', 'TokenManager']);
        expect(result?.reasoning).toContain('authentication logic');
      });

      it('should handle spec generation response with multiple complex specs', () => {
        const input = `Based on your requirements, here are the specifications:

\`\`\`json
[
  {
    "title": "Implement Critical Error Tracking with PostHog via TelemetryService",
    "description": "Context: This overarching spec consolidates the agreed-upon strategy for integrating critical error tracking into the VS Code extension's Node.js environment using PostHog, as discussed in the conversation.\\nImplementation Steps:\\n - Step 1: Develop the TelemetryService.captureError wrapper to encapsulate posthog.captureException logic and property enrichment.\\n - Step 2: Integrate TelemetryService.captureError calls into SamuraiAgent for critical errors.\\n - Step 3: Integrate TelemetryService.captureError calls into ProjectDetailService for critical errors.\\n - Step 4: Integrate TelemetryService.captureError calls into LLMProviderService for critical errors.\\n - Step 5: Document the definition of 'critical errors' and guidance for their capture within the repository.\\nBackend Feature Spec:\\n - Feature/Behavior: Enables explicit capture of critical errors",
    "parent_spec_id": null
  },
  {
    "title": "Create TelemetryService Wrapper",
    "description": "Develop the TelemetryService.captureError wrapper function that encapsulates posthog.captureException with proper error property enrichment.",
    "parent_spec_id": "telemetry-main-spec"
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(Array.isArray(result)).toBe(true);
        expect(result?.length).toBe(2);
        expect(result?.[0].title).toBe("Implement Critical Error Tracking with PostHog via TelemetryService");
        expect(result?.[0].description).toContain("PostHog");
        expect(result?.[1].parent_spec_id).toBe("telemetry-main-spec");
      });

      it('should handle json with unicode characters and special formatting', () => {
        const input = `\`\`\`json
{
  "files": {
    "src/国际化.ts": ["I18nService", "TranslationManager"],
    "src/组件/按钮.tsx": ["Button", "IconButton"]
  },
  "reasoning": "These files handle internationalization (i18n) and contain Chinese characters in filenames. The I18nService manages translations while Button components handle UI elements."
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files['src/国际化.ts']).toEqual(['I18nService', 'TranslationManager']);
        expect(result?.files['src/组件/按钮.tsx']).toEqual(['Button', 'IconButton']);
        expect(result?.reasoning).toContain('internationalization');
      });

      it('should handle spec with literal newlines in description string', () => {
        const input = `\`\`\`json
[
  {
    "title": "Integrate PostHog API Key into Global Settings",
    "description": "Context: The discussion identified that PostHog telemetry is disabled.
Implementation Steps:
- Step 1: Update GlobalSettings interface.
- Step 2: Modify GlobalDataStore to load and save.
Backend Feature Spec:
- Feature/Behavior: The PostHog API key will be stored in GlobalSettings.",
    "parent_spec_id": null
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(Array.isArray(result)).toBe(true);
        expect(result?.length).toBe(1);
        expect(result?.[0].title).toBe("Integrate PostHog API Key into Global Settings");
        expect(result?.[0].description).toContain("Implementation Steps");
        expect(result?.[0].description).toContain("Backend Feature Spec");
        expect(result?.[0].parent_spec_id).toBeNull();
      });

      it('should handle the exact PostHog spec with full literal newlines (user reported case)', () => {
        // This is the EXACT output that failed for the user - with actual newlines in the JSON string value
        // The key issue is that LLMs sometimes generate JSON with literal line breaks inside string values
        const input = `\`\`\`json
[
  {
    "title": "Integrate PostHog API Key into Global Settings with Dynamic Update",
    "description": "Context: The discussion identified that PostHog telemetry is disabled.
Implementation Steps:
- Step 1: Update GlobalSettings interface to include posthogApiKey.
- Step 2: Modify GlobalDataStore to load and save the new posthogApiKey.
- Step 3: Refactor TelemetryService to expose a public method for setting the API key.
- Step 4: Extend DataStore.handleSaveGlobalSettings to detect changes.
- Step 5: Update the Webview UI to include an input field for the PostHog API key.
Backend Feature Spec:
- Feature/Behavior: The PostHog API key will be stored in and loaded from GlobalSettings.
- Inputs: GlobalSettings.posthogApiKey string (can be empty string).
- Processing/Algorithms: Multiple service methods handle the lifecycle.
- Outputs/Side Effects: TelemetryService.posthog instance is correctly updated.
- Error Handling: TelemetryService logs if initialization fails.
- Performance: Negligible impact. Settings operations are local file reads/writes.
- Security: PostHog API key stored in global_user_settings.json follows existing pattern.
- Edge Cases: Empty API key should disable PostHog telemetry gracefully.
Frontend UI Spec:
- Screens/Components: SamuraiAgentPanelWebviewViewProvider renders settings interface.
- States & Data: The input field will bind to settingsState.globalSettings.posthogApiKey.
- User Flows & Interactions: User enters/updates text in the PostHog API Key field.
- Layout & Responsive: Add a new form group under Privacy Analytics or Advanced Settings.
- Visual Spec: Label PostHog API Key, Input Type text, Placeholder Enter your PostHog API Key.
- Accessibility: Standard input field accessibility considerations apply.
- Error/Empty/Edge: Standard save success/error feedback will be shown.
Code Changes:
- Backend: Update settings models, globalDataStore, TelemetryService, and dataStore.
- Frontend: Add HTML for a new input field in settings interface.
Tests:
- Unit Test: TelemetryService.test.ts Add tests for setPostHogApiKey.
- Unit Test: GlobalDataStore.test.ts Add tests for loading and saving posthogApiKey.
- Unit Test: DataStore.test.ts Add tests for notifyGlobalSettingsChanged.
- E2E Test: Simulate entering a PostHog API key in settings and verifying telemetry.
Acceptance Criteria:
- The GlobalSettings interface includes posthogApiKey string.
- The VS Code extension Settings UI contains an input field labeled PostHog API Key.
- Changing and saving the PostHog API Key in the UI correctly updates global_user_settings.json.
- When the PostHog API Key in settings is updated and saved the service reinitializes.
- Telemetry events are successfully sent after a valid PostHog API key is provided.",
    "parent_spec_id": null
  }
]
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(Array.isArray(result)).toBe(true);
        expect(result?.length).toBe(1);
        expect(result?.[0].title).toBe("Integrate PostHog API Key into Global Settings with Dynamic Update");
        expect(result?.[0].description).toContain("Context: The discussion identified");
        expect(result?.[0].description).toContain("Implementation Steps:");
        expect(result?.[0].description).toContain("Backend Feature Spec:");
        expect(result?.[0].description).toContain("Frontend UI Spec:");
        expect(result?.[0].description).toContain("Code Changes:");
        expect(result?.[0].description).toContain("Tests:");
        expect(result?.[0].description).toContain("Acceptance Criteria:");
        expect(result?.[0].parent_spec_id).toBeNull();
      });
    });
  });
});