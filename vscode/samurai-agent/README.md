# Samurai Agent VS Code Extension

Samurai Agent brings an AI “vibe coding partner” directly into VS Code. The extension ingests project context, routes chat queries through a multi-step agent pipeline (intent analysis → code-context assessment → spec/spec clarification flows), and renders markdown chat responses in a dedicated sidebar.

## Table of Contents
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Available Commands & Scripts](#available-commands--scripts)
- [Extension Usage](#extension-usage)
- [Agent Pipeline Details](#agent-pipeline-details)
- [Project Detail Ingestion](#project-detail-ingestion)
- [Code Extraction Heuristics](#code-extraction-heuristics)
- [Webview Chat Experience](#webview-chat-experience)
- [Testing](#testing)
- [Known Issues / Limitations](#known-issues--limitations)

## Key Features
- **Agent Panel Sidebar**: Dedicated view (`Samurai Agent → Agent Panel`) that hosts the markdown-capable chat UI, settings, and spec view tabs.
- **Intent Analysis**: Latest user message plus conversation summary are fed into `intentAnalysis.md`, returning `pure_discussion`, `feature_exploration`, or `spec_clarification` (spec generation handled via keyword shortcut).
- **Code Context Decisions**: `analyze_code_extraction_needs.md` enforces mandatory triggers for “read/inspect code” requests and always returns reasoning, ensuring traceable decisions.
- **Code Extraction Flow**: `ExtractCodeTool` scans the workspace (Tree-sitter + regex fallbacks) and, if necessary, employs heuristics for cost-tracking queries to avoid empty results.
- **Project Detail Memory**: Users can ingest or merge project context. A new `merge_project_details.md` prompt preserves existing detail unless a genuinely new insight arrives.
- **Markdown Chat Rendering**: The chat webview supports bold/italics/inline code/fenced code blocks, and deduplicates assistant messages so each response appears once.

## Architecture Overview
```
VS Code command → SamuraiAgentPanelWebviewViewProvider → SamuraiAgent.execute()
  ├─ DataStore: chat messages, session metadata, project settings, code contexts
  ├─ ProjectDetailService: reads/merges digested project detail prompts
  ├─ Intent analysis → code extraction decision → tool execution (ExtractCodeTool / CreateSpecTool)
  └─ Webview posts structured results back to chat UI
```
Core directories:
- `src/agent/core` – Samurai agent orchestration
- `src/agent/tools` – Tooling (code extraction, spec creation)
- `src/agent/prompts` – All LLM instructions (intent, extraction, project detail, etc.)
- `src/webview` – HTML/CSS/JS for the panel
- `src/persistence` – File-backed DataStore and GlobalDataStore

## Prerequisites
- Node.js 20+
- npm 10+
- VS Code 1.104.0+
- API keys for any LLM providers you plan to use (OpenAI, Anthropic, Google) — stored via the extension’s Settings tab and persisted locally.

## Project Setup
```bash
cd vscode/samurai-agent
npm install
```
To compile once:
```bash
npm run compile
```
For active development (watch mode):
```bash
npm run watch
```
Launch under VS Code using `F5` (Extension Development Host). The compiled extension entry point is `dist/extension.js`.

## Available Commands & Scripts
package.json defines:
- `npm run compile` → bundles extension & webview via webpack
- `npm run watch` → webpack watch mode
- `npm run lint`  → eslint over `src`
- `npm run test`  → runs Jest test suite (wires in `compile-tests` etc.)
- `npm run package` → production build with hidden source maps

VS Code command palette exposes:
- `Samurai Agent: Hello World` (basic sanity check)
- `Samurai Agent: Execute Agent` (invoked behind the chat UI)

## Extension Usage
1. **Start Dev Host**: Press `F5` after compiling/watching. The Samurai icon appears in the activity bar.
2. **Configure APIs**: In the extension’s Settings tab, add API keys (OpenAI, Gemini, Anthropic). Missing keys will hide unsupported models from the chat dropdown.
3. **Setup Project Detail**: Paste or ingest project context. The merge prompt keeps the original detail unless new, actionable information is provided.
4. **Chat**: Type a request in the Chat tab.
   - The assistant responds once the pipeline finishes.
   - Markdown (including code blocks) renders inline.
5. **Start New Conversation**: Clears UI, persists chat history, merges previous conversation context into project detail, and creates a new session in the DataStore.

## Agent Pipeline Details
- **Intent Analysis**: Keywords plus LLM prompt. Questions like “How is X implemented?” are forced to `feature_exploration` to trigger code extraction.
- **Code Extraction Decision**: `analyze_code_extraction_needs.md` now includes latest message, conversation summary, project detail, and existing code context. Mandatory triggers (read/inspect/update code) force extraction, and reasoning is always returned.
- **Code Extraction Execution**:
  - Directory scan limited via `isFunctionalCodeFile` heuristics.
  - Tree-sitter parsing with regex fallbacks for unsupported languages.
  - Ranking prompt (`step2_identify_relevant_elements.md`) outputs `files` + `reasoning`. If empty, heuristics target cost/usage keywords to avoid “no relevant elements” failures.
  - Structured context is fed into `extract_code_context.md`, which now demands `relevance_score`, `context`, `file_path`, AND `reasoning`.
- **Spec Generation**: `CreateSpecTool` (refactored from task terminology) persists specs via DataStore when invoked.

## Project Detail Ingestion
`ProjectDetailService` supports `merge` vs `synthesis` modes. The new merge prompt (`merge_project_details.md`) enforces:
- Keep original detail unless new insights add substantive decisions.
- Ignore short acknowledgements or repetitive text.
- Output plain text (no JSON/fences) suitable for immediate persistence.

## Code Extraction Heuristics
Heuristics kick in when LLM ranking returns no selections:
- Searches filenames and element names for cost/usage/LLM keywords.
- Adds top N largest files as a last resort when the query contains “cost”.
This prevents empty contexts for common debugging queries.

## Webview Chat Experience
Located at `src/webview/chat.js` + `chat.css`:
- Renders markdown safely (links sanitized, code blocks & lists supported).
- Deduplicates assistant messages via dataset + timestamp checks.
- Adds extensive logging for message flow and ingestion events.
- Supports configurable LLM model dropdown (filtered by available API keys).

## Testing
- `npm run test` (Jest)
- `npm run lint` for static analysis
- `npm run test:vscode` reserved for integration (requires VS Code test harness)

## Known Issues / Limitations
- Tree-sitter binaries are not bundled for every language. The service logs fallbacks (e.g., “Tree-sitter parsing not available for …, falling back to regex”).
- Large workspaces may increase first-run extraction time; consider restricting via `connectedCodebasePath` in the session metadata.
- The heuristics fallback is conservative; future improvements may index the workspace or cache ASTs.
- The hello-world activation event remains alongside the agent command; adjust `package.json` if you want different activation triggers.

---

For contributions or deeper documentation, see the inline comments within `src/agent` and the prompt files under `src/agent/prompts/**`.
