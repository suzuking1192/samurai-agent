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
      it('should repair malformed JSON with missing brackets', () => {
        const input = `\`\`\`json
{
  "files": {
    "test.js": ["Function1", "Function2"
  },
  "reasoning": "This JSON is missing closing brace"
\`\`\``;
        
        // The improved parser can now repair this malformed JSON
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files?.['test.js']).toEqual(['Function1', 'Function2']);
        expect(result?.reasoning).toBe("This JSON is missing closing brace");
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

      it('should extract score from end when main parsing misses it', () => {
        // This test handles the case where the clarification_text is very long
        // and the parser might extract only part of the JSON, missing the score at the end
        const input = `\`\`\`json
{
  "clarification_text": "Excellent, thank you for the repeated clarification on the token limit warning – confirming that the frontend will indeed **only display the number of pinned files** and provide a general warning about token limits without real-time calculation. This simplifies the frontend implementation considerably.\\n\\nCombined with our previous discussions, we now have a clearer picture of the frontend feature: a new textbox at the top-left for @ file pinning, autocomplete limited to open files, session-level persistence. The backend integration question remains: if the process_message method in UnifiedSamuraiAgent needs to accept these manually pinned files, should we introduce a new parameter, for example, pinned_files_content: Optional[List[Dict[str, str]]] (e.g., [{'path': 'file.py', 'content': '...'}]) to the process_message signature?",
  "score": 85
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.clarification_text).toContain("Excellent, thank you");
        expect(result?.clarification_text).toContain("process_message signature");
        // This is the critical assertion - score should be 85, not undefined
        expect(result?.score).toBe(85);
      });

      it('should extract score with various formatting patterns', () => {
        // Test different score formatting patterns
        const testCases = [
          { input: '{"clarification_text": "test", "score": 95}', expectedScore: 95 },
          { input: '{"clarification_text": "test","score":75}', expectedScore: 75 },
          { input: '{"clarification_text": "test", "score" : 60 }', expectedScore: 60 },
          { input: '{"clarification_text": "test", "score": 100}', expectedScore: 100 },
          { input: '{"clarification_text": "test", "score": 0}', expectedScore: 0 },
        ];
        
        testCases.forEach(({ input, expectedScore }) => {
          const result = extractJsonFromLLMResponse(input);
          expect(result).toBeTruthy();
          expect(result?.score).toBe(expectedScore);
        });
      });

      it('should return null for plain conversational text without JSON', () => {
        // Test case where LLM returns conversational text instead of JSON
        const input = `Excellent! I understand you're reiterating the importance of focusing on the VS Code extension, and that the chosen approach for token limits on the frontend is:

* **C. The frontend will only display the number of pinned files and rely on the 5-file limit, with a general warning that large files *could* exceed limits, without specific token counts.** This clarifies the scope of frontend token management.

Regarding your repeated request to "please read the latest code and find relevant code files":

Your answers to these will help finalize the integration details between the VS Code extension and the backend.`;
        
        const result = extractJsonFromLLMResponse(input);
        // Should return null since there's no valid JSON
        expect(result).toBeNull();
      });

      it('should handle truncated JSON with unterminated string at end', () => {
        // Test case where JSON response is truncated mid-string (common with token limits)
        const input = `\`\`\`json
{
  "mermaidData": "graph TD\\n    A[Component] --> B[Component]\\n    B --> C[Result]",
  "textSpec": "This is a very long specification that gets truncated mid-sentence because the LLM hit its token limit and the response was cut`;
        
        const result = extractJsonFromLLMResponse(input);
        // Should successfully repair by closing the string and completing the JSON
        expect(result).toBeTruthy();
        expect(result?.mermaidData).toContain("graph TD");
        expect(result?.textSpec).toContain("very long specification");
        // The truncated text should be there, even if incomplete
        expect(result?.textSpec).toContain("truncated");
      });

      it('should handle artifact generation response with truncated textSpec', () => {
        // Real-world test case from artifact generation with missing closing markers
        const input = `\`\`\`json
{
  "mermaidData": "graph TD\\n    subgraph VS Code Extension\\n        UI_Chat[Chat Interface]\\n        UI_PinInput(Pin File Textbox)\\n    end\\n    UI_Chat --> UI_PinInput",
  "textSpec": "**Functional Requirements:**\\n\\n*   **FR1: File Pinning UI:**\\n    *   The VS Code Extension shall provide a dedicated textbox UI element.\\n\\n*   **FR2: Autocomplete:**\\n    *   The textbox shall implement autocomplete functionality`;
        
        const result = extractJsonFromLLMResponse(input);
        // Should successfully repair the truncated response
        expect(result).toBeTruthy();
        expect(result?.mermaidData).toContain("graph TD");
        expect(result?.mermaidData).toContain("VS Code Extension");
        expect(result?.textSpec).toContain("Functional Requirements");
        expect(result?.textSpec).toContain("File Pinning UI");
      });

      it('should handle artifact with only mermaidData and missing textSpec field', () => {
        // Test case where LLM response was truncated before textSpec field was generated
        // This is the EXACT scenario from the user's error log
        const input = `\`\`\`json
{
  "mermaidData": "graph TD\\n    subgraph VSCode Extension\\n        U[User] -->|Interacts with Chat UI (Pinned Files)| WV(Webview: Chat UI)\\n        WV -->|Sends User Message & Pinned File Paths| EX(Extension Main Thread)\\n    end\\n\\n    subgraph Backend Services\\n        FSA -->|HTTP POST /chat_with_progress| BAPI(Backend API Gateway)\\n    end\\n\\n    style WV fill:#E0BBE4,stroke:#8D6B9D,stroke-width:2px\\n    style LLM_PS`;
        
        const result = extractJsonFromLLMResponse(input);
        // Should successfully repair and add placeholder textSpec
        expect(result).toBeTruthy();
        expect(result?.mermaidData).toContain("graph TD");
        expect(result?.mermaidData).toContain("VSCode Extension");
        expect(result?.textSpec).toBeTruthy();
        expect(typeof result?.textSpec).toBe('string');
        expect(result?.textSpec.length).toBeGreaterThan(0);
        // The placeholder text should indicate truncation
        expect(result?.textSpec).toContain("truncated");
      });

      it('should handle artifact with only textSpec and missing mermaidData field', () => {
        // Test case where only textSpec is present (rare but possible)
        const input = `\`\`\`json
{
  "textSpec": "**Functional Requirements:**\\n\\n*   **FR1: File Pinning UI:**\\n    *   The VS Code Extension shall provide a dedicated textbox`;
        
        const result = extractJsonFromLLMResponse(input);
        // Should successfully repair and add placeholder mermaidData
        expect(result).toBeTruthy();
        expect(result?.textSpec).toContain("Functional Requirements");
        expect(result?.mermaidData).toBeTruthy();
        expect(typeof result?.mermaidData).toBe('string');
        expect(result?.mermaidData).toContain("graph TD");
        expect(result?.mermaidData).toContain("truncated");
      });

      it('should not modify non-artifact responses', () => {
        // Ensure we don't add artifact fields to other types of responses
        const input = `\`\`\`json
{
  "files": {
    "test.js": ["func1", "func2"]
  },
  "reasoning": "Some reasoning"
}
\`\`\``;
        
        const result = extractJsonFromLLMResponse(input);
        expect(result).toBeTruthy();
        expect(result?.files).toBeTruthy();
        expect(result?.reasoning).toBe("Some reasoning");
        // Should NOT have artifact fields added
        expect(result?.mermaidData).toBeUndefined();
        expect(result?.textSpec).toBeUndefined();
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