/**
 * Test suite for spec generation parser improvements
 */

import { extractJsonFromLLMResponse } from '../../src/common/utils/llmResponseParser';

describe('extractJsonFromLLMResponse - Spec Generation', () => {
  describe('Standard parsing (backward compatibility)', () => {
    it('should parse simple JSON arrays', () => {
      const input = '[{"title": "Test", "description": "A test spec"}]';
      const result = extractJsonFromLLMResponse(input);
      expect(result).toEqual([{ title: "Test", description: "A test spec" }]);
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
      const input = '```json\n[{"title": "Test", "description": "A test spec"}]\n```';
      const result = extractJsonFromLLMResponse(input);
      expect(result).toEqual([{ title: "Test", description: "A test spec" }]);
    });
  });

  describe('Spec generation parser with markdown syntax', () => {
    it('should handle backticks in description fields', () => {
      const input = `\`\`\`json
[
  {
    "title": "Update Method",
    "description": "Method 1.1: \`updateAgentStatusBanner()\` handles the UI update",
    "parent_spec_id": null
  }
]
\`\`\``;
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('title');
        expect(result[0]).toHaveProperty('description');
      }
    });

    it('should handle complex markdown in descriptions', () => {
      const input = `\`\`\`json
[
  {
    "title": "Data Model Update",
    "description": "## Implementation\\n\\nAdd \`currentArtifact\` field:\\n- Type: \`{ mermaidData: string; textSpec: string }\`\\n- Purpose: Store intermediate results",
    "parent_spec_id": null
  }
]
\`\`\``;
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(1);
        expect(result[0].title).toBe("Data Model Update");
      }
    });

    it('should extract partial results when JSON is malformed midway', () => {
      const input = `\`\`\`json
[
  {
    "title": "Valid Spec 1",
    "description": "This is valid",
    "parent_spec_id": null
  },
  {
    "title": "Valid Spec 2",
    "description": "This is also valid",
    "parent_spec_id": null
  },
  {
    "title": "Malformed Spec",
    "description": "This has unescaped backticks \` and breaks the JSON...
\`\`\``;
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        // Should extract at least the first 2 valid specs
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result[0].title).toBe("Valid Spec 1");
        expect(result[1].title).toBe("Valid Spec 2");
      }
    });

    it('should handle very long descriptions with multiple code blocks', () => {
      const input = `\`\`\`json
[
  {
    "title": "Complex Implementation",
    "description": "Step 1: Update model\\n\`\`\`typescript\\ninterface Session {\\n  currentArtifact?: ArtifactData;\\n}\\n\`\`\`\\n\\nStep 2: Implement method \`saveArtifact()\` which saves the data",
    "parent_spec_id": null
  }
]
\`\`\``;
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(1);
        expect(result[0].title).toBe("Complex Implementation");
      }
    });

    it('should maintain backward compatibility when option is not provided', () => {
      const input = '[{"title": "Test", "description": "Simple test"}]';
      const result = extractJsonFromLLMResponse(input);
      expect(result).toEqual([{ title: "Test", description: "Simple test" }]);
    });
  });

  describe('Error recovery', () => {
    it('should try standard parser first even with isSpecGeneration flag', () => {
      const input = `\`\`\`json
[
  {
    "title": "Perfect JSON",
    "description": "No issues here",
    "parent_spec_id": null
  }
]
\`\`\``;
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(1);
      }
    });

    it('should return null for completely invalid input', () => {
      const input = 'This is not JSON at all, just plain text without any structure';
      const result = extractJsonFromLLMResponse(input, { isSpecGeneration: true });
      // May return null or may extract nothing
      if (result !== null) {
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('ACTUAL FAILURE CASE - Position 20213 Error', () => {
    it('should parse the real failure case with updateAgentStatusBanner and complex markdown', () => {
      // This is the actual LLM output that failed with:
      // "Expected ',' or '}' after property value in JSON at position 20213"
      const actualFailureCase = '```json\n' +
        '[\n' +
        '  {\n' +
        '    "title": "Data Model Update: Add currentArtifact to Session",\n' +
        '    "description": "## Architectural Approach\\nOnly one clear approach given the explicit user confirmation to store the artifact data as a new property within the existing Session model in `DataStore`.\\nProceeding with: Extending the existing `Session` data model.\\n\\n### Core Idea:\\nA new property, `currentArtifact`, will be added to the `Session` model. This property will hold the most recently generated intermediate output (Mermaid data and text spec) and will be managed alongside other session-level data.\\n\\n## Implementation Specification\\n\\n#### 1. CONTEXT & OVERVIEW\\n**Context:** To store and retrieve the asynchronously generated intermediate artifacts (`mermaidData` and `textSpec`) at a session level, ensuring persistence across VS Code restarts for the current session and a clean slate for new sessions.\\n\\n**Requirement Source:** User confirmations in conversation turns 3, 5, and 6.\\n\\n**Implementation Strategy:** Extending existing data models in `DataStore`.\\n\\n**Estimated Scope:**\\n- Files to create: 0\\n- Files to modify: 2 (at least, for frontend and backend `Session` models)\\n- Estimated lines of code: ~20-30\\n- Key dependencies: `DataStore` service.\\n\\n#### 2. DETAILED IMPLEMENTATION STEPS (Method-Level)\\n\\n**Step 1: Modify Backend `Session` Model**\\nFile: `{{backend_models_file_path}}/models.py` (Likely `samurai_agent/backend/models.py` or similar based on `DataStore` context)\\nAction: Modify existing\\nCurrent file has {{N}} lines, adding at line {{M}} (likely within `Session` class definition)\\nMethod 1.1: Update `Session` class definition\\nPurpose: To add `currentArtifact` as a new field to the backend representation of a session.\\nImplementation Details:\\n- Add a new field, `currentArtifact`, to the `Session` model. This field should be capable of storing a structured object or a JSON string that can represent `{ mermaidData: string, textSpec: string, timestamp: number }`.\\n  - `mermaidData` (string): Stores the raw Mermaid syntax.\\n  - `textSpec` (string): Stores the detailed textual specification.\\n  - `timestamp` (number): Stores the UTC timestamp of when the artifact was generated.\\n- The field should be nullable or have a default empty/null value to represent a session without an active artifact.",\n' +
        '    "parent_spec_id": null\n' +
        '  },\n' +
        '  {\n' +
        '    "title": "Frontend UI: Add \'spec planning mode\' option to mode-select dropdown",\n' +
        '    "description": "## Architectural Approach\\nOnly one clear approach, as the `mode-select` dropdown is already visible and the task is to add a new option to it.\\nProceeding with: Extending the existing `mode-select` dropdown.\\n\\n## Implementation Specification\\n\\n#### 1. CONTEXT & OVERVIEW\\n**Context:** To make \'spec planning mode\' selectable by the user via the existing `mode-select` dropdown in the Chat tab, which is confirmed to be already visible.\\n\\n**Requirement Source:** User confirmation in conversation turn 3 (mode-select visibility) and 6 (adding \'spec planning mode\').\\n\\n**Implementation Strategy:** Modifying the existing frontend UI component for the mode selection dropdown.\\n\\n**Estimated Scope:**\\n- Files to create: 0\\n- Files to modify: 1 (likely `webview/chat.js` or `agentPanel.js`)\\n- Estimated lines of code: ~5-10\\n- Key dependencies: `webview/chat.js` (or related UI framework components).\\n\\n#### 2. DETAILED IMPLEMENTATION STEPS (Method-Level)\\n\\n**Step 1: Modify `mode-select` dropdown options**\\nFile: `webview/chat.js` (or the React/Vue/Svelte component responsible for `mode-select`)\\nAction: Modify existing\\nCurrent file has {{N}} lines, adding at line {{M}} (likely where options are rendered)\\nPurpose: To add \'spec planning mode\' as a selectable option in the dropdown.\\nImplementation Details:\\n- Locate the `<select id=\\"mode-select\\">` element or its rendering logic.\\n- Add a new `<option>` element to this dropdown.\\n  - Value: `specPlanningMode` (or similar internal identifier).\\n  - Display Text: `Spec Planning Mode`.",\n' +
        '    "parent_spec_id": null\n' +
        '  },\n' +
        '  {\n' +
        '    "title": "Frontend UI: Implement \'current spec\' Button and Display Logic",\n' +
        '    "description": "## Architectural Approach\\nOnly one clear approach given the explicit instructions for placement, visibility, and display method (modal/sidebar).\\nProceeding with: Integrating new UI elements and logic into the existing webview architecture.\\n\\n## Implementation Specification\\n\\n#### 1. CONTEXT & OVERVIEW\\n**Context:** To provide a user interface element (\'current spec\' button) that, when clicked, displays the most recent intermediate artifact in a dedicated modal/sidebar, conditional on the `spec planning mode` and artifact availability.\\n\\n**Requirement Source:** User confirmations in conversation turns 3, 5, and 6.\\n\\n**Implementation Strategy:** Adding new UI elements to the chat tab and implementing a dedicated display component for artifacts.\\n\\n**Estimated Scope:**\\n- Files to create: 1 (for the modal/sidebar component) + CSS\\n- Files to modify: 1-2 (e.g., `webview/chat.js` or `agentPanel.js` for button, possibly `DataStore` for state access).\\n- Estimated lines of code: ~100-200\\n- Key dependencies: `webview/chat.js`, potentially a new `{{ArtifactDisplayModal.tsx}}` component, `DataStore` (for accessing `currentArtifact`).\\n\\n#### 2. DETAILED IMPLEMENTATION STEPS (Method-Level)\\n\\n**Step 1: Add \'current spec\' Button to Chat UI**\\nFile: `webview/chat.js` (or the main React/Vue/Svelte component for the Chat tab)\\nAction: Modify existing\\nCurrent file has {{N}} lines, adding at line {{M}}\\nMethod 1.1: `renderCurrentSpecButton()` (or similar UI rendering logic)\\nPurpose: To visually render the \'current spec\' button.\\nImplementation Details:\\n- Create a new button element with the text \\"current spec\\".\\n- Place this button within a new header section, visually positioned below the API cost display within the Chat tab.\\n- **Visibility Logic:** The button should only be visible when \'spec planning mode\' is active in the `mode-select` dropdown.\\n\\n**Step 2: Implement Click Handler for \'current spec\' Button**\\nFile: `webview/chat.js` (or associated UI logic file)\\nAction: Modify existing\\nCurrent file has {{N}} lines, adding at line {{M}}\\nMethod 2.1: `handleCurrentSpecButtonClick()`\\nSignature:\\n```typescript\\nhandleCurrentSpecButtonClick(): void\\n```\\nPurpose: To trigger the display of the artifact when the button is clicked.\\nImplementation Details:\\n- When clicked, this handler should:\\n  1. Retrieve the `currentArtifact` from the `Session` model (via `DataStore`).\\n  2. Check if both `currentArtifact.mermaidData` and `currentArtifact.textSpec` exist.",\n' +
        '    "parent_spec_id": null\n' +
        '  }\n' +
        ']\n' +
        '```';

      // This should NOT throw an error anymore
      const result = extractJsonFromLLMResponse(actualFailureCase, { isSpecGeneration: true });
      
      // Validate we got a result
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      
      if (result) {
        // Should extract at least some specs (preferably all 3)
        expect(result.length).toBeGreaterThan(0);
        
        // Verify the specs we extracted are valid
        result.forEach((spec: any, index: number) => {
          expect(spec).toHaveProperty('title');
          expect(spec).toHaveProperty('description');
          expect(spec.title).toBeTruthy();
          expect(spec.description).toBeTruthy();
          expect(typeof spec.title).toBe('string');
          expect(typeof spec.description).toBe('string');
          console.log(`Spec ${index + 1} extracted: "${spec.title}"`);
        });
        
        // Check for the specific titles from the actual case
        const titles = result.map((spec: any) => spec.title);
        expect(titles).toContain("Data Model Update: Add currentArtifact to Session");
        
        // Log success
        console.log(`✓ Successfully parsed actual failure case: ${result.length} specs extracted`);
      }
    });

    it('should handle the exact error pattern with {{M}} and backticks', () => {
      // Simpler test focusing on the exact problematic pattern from the error snippet
      const problematicPattern = '```json\n' +
        '[\n' +
        '  {\n' +
        '    "title": "Test Spec",\n' +
        '    "description": "Current file has {{N}} lines, adding at line {{M}}\\nMethod 2.1: `updateAgentStatusBanner()` handles the temporary banner and make it disappear upon completion",\n' +
        '    "parent_spec_id": null\n' +
        '  }\n' +
        ']\n' +
        '```';

      const result = extractJsonFromLLMResponse(problematicPattern, { isSpecGeneration: true });
      
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      
      if (result) {
        expect(result.length).toBe(1);
        expect(result[0].title).toBe("Test Spec");
        expect(result[0].description).toContain("updateAgentStatusBanner()");
        expect(result[0].description).toContain("{{M}}");
        console.log('✓ Successfully handled {{M}} and backtick pattern');
      }
    });
  });
});

