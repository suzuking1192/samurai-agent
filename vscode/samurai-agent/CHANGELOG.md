# Change Log

All notable changes to the "samurai-agent" extension will be documented in this file.

## [0.0.20] - 2025-10-17

### Added
- **Beta Testing Mode**: Introduced comprehensive beta testing system for new features
  - Added beta model selection feature in settings UI
  - Integrated beta testing framework with LLM provider service
  - Added telemetry tracking for beta feature usage
  - Created comprehensive test coverage for beta models functionality
- **Code Extraction Enhancements**: Major improvements to code parsing and context extraction
  - Implemented CodeParserCache for improved performance and reduced redundant parsing
  - Added DocumentationExtractor for automatic extraction of JSDoc and docstrings
  - Added ExportAnalyzer to track module exports and public APIs
  - Added PatternDetector to identify framework-specific patterns (React, Django, Spring)
  - Implemented RelationshipTracker for better understanding of code dependencies
  - Added SnippetEnricher to provide richer code context with relationships and documentation
- **Recent Files Tracking**: Added system to track and suggest recently opened files
  - Automatically tracks recently viewed files in the workspace
  - Integrated with code extraction to provide better context
  - Added comprehensive test coverage for recent files functionality
- **Context File Pinning**: Implemented file pinning system for persistent context
  - Users can pin important files for continuous context across chat sessions
  - Pinned files are prioritized in code extraction
  - Added UI controls for managing pinned files
  - Created comprehensive test suite for file pinning functionality
- **Spec Relationship Visualization**: Enhanced spec artifact generation with relationship tracking
  - Added Mermaid diagram support for visualizing spec relationships
  - Implemented MermaidValidator for validating diagram syntax
  - Enhanced spec clarification prompts to better capture spec relationships
  - Added "Show Current Spec" button in chat UI for viewing active spec context
- **Code Extraction Keywords**: Improved keyword handling in code extraction
  - Better merging of user-provided and AI-extracted keywords
  - Enhanced duplicate keyword filtering
  - Added contextual keyword suggestions based on recent files

### Fixed
- **CRITICAL**: Fixed spec relationship tracking to ensure all specs are properly connected
  - Enhanced spec artifact generation to validate parent-child relationships
  - Improved spec clarification flow to maintain relationship integrity
  - Added comprehensive test coverage for spec relationship scenarios
- **CRITICAL**: Fixed Japanese input composition issue in chat
  - Chat no longer sends message on Enter key when composing Japanese/CJK characters
  - Added `isComposing` check to prevent premature message submission
  - Improves user experience for non-English speakers using IME
- **Code Extraction Bug**: Fixed keyword merging logic that was causing duplicate keywords
  - Improved deduplication algorithm to handle case-insensitive matching
  - Better integration between user keywords and AI-extracted keywords
- **Language Detection**: Improved language handling in spec generation
  - Changed from "last message" language detection to "main language" detection
  - Better multilingual support for users mixing English technical terms with native language

### Improved
- **Enhanced Code Parser Performance**: Major performance improvements in code parsing
  - Implemented caching layer to avoid re-parsing unchanged files
  - Optimized tree-sitter queries for better performance
  - Added performance benchmarks and optimization tests
- **Better Code Context Quality**: Significantly improved quality of extracted code context
  - Richer code snippets with documentation and relationship information
  - Better detection of framework-specific patterns and idioms
  - Enhanced understanding of module exports and API surfaces
- **Improved Spec Generation Prompts**: Enhanced prompts for better spec quality
  - Added explicit instructions for Mermaid diagram generation
  - Improved spec relationship tracking in prompts
  - Better handling of root cause analysis in bug scenarios
- **Enhanced Test Coverage**: Added extensive test suites for new features
  - Beta testing integration tests (445 new tests)
  - Code parser component tests (1,500+ new assertions)
  - Context file pinning tests (521 new tests)
  - Mermaid validation tests
  - Recent files tracking tests (512 new tests)
  - Webview functionality tests (256 new tests)

## [0.0.19] - 2025-10-15

### Note
- Version 0.0.19 was an intermediate release with incremental improvements that are now fully documented in version 0.0.20

## [0.0.18] - 2025-10-09

### Added
- **Free Tier Launch**: Introduced free tier to lower barrier to entry
  - Users can now use Samurai Agent immediately without API key setup
  - No credit card or LLM provider configuration required to get started
  - Enables instant testing and evaluation of the extension
  - Perfect for trying out the extension before committing to API costs
- **Copy All Spec Feature**: Added ability to copy entire spec hierarchy to clipboard
  - New "Copy All Spec" button on each spec card
  - Copies the selected spec and all its descendant subspecs in hierarchical markdown format
  - Automatically formats specs with proper markdown heading levels based on hierarchy depth
  - Preserves parent-child relationships in the copied content for easy sharing and documentation
- **LLM Model Tracking in Telemetry**: Enhanced telemetry system to track which LLM model is used for each chat interaction
  - Added optional `llmModelUsed` parameter to `TelemetryService.trackChatMessage()` method
  - Telemetry now includes LLM model ID (e.g., gpt-4, claude-3-sonnet, gemini-flash-2.5) in chat interaction events
  - DataStore automatically extracts LLM model from session metadata and passes it to telemetry
  - Only includes model information in telemetry when model ID is present and non-empty
  - Helps track usage patterns and model preferences across the user base

### Improved
- **Enhanced Test Coverage**: Added comprehensive unit tests for LLM model tracking
  - Tests verify model tracking for both user messages and agent responses
  - Tests ensure model information is only included when present and non-empty
  - Tests cover edge cases like undefined, empty string, and whitespace-only model IDs
  - Added integration tests in dataStore.telemetry.test.ts for end-to-end telemetry flow

## [0.0.16] - 2025-10-09

### Fixed
- **README Demo GIF**: Fixed demo gif filename in README to use correct spelling
  - Corrected filename from `samuri-agent-demo.gif` to `samurai-agent-demo.gif`
  - Ensures demo gif displays properly in VS Code marketplace and GitHub

## [0.0.15] - 2025-10-09

### Improved
- **Comprehensive README Overhaul**: Significantly improved documentation for better user onboarding and understanding
  - Added animated demo gif showcasing extension functionality with proper VS Code marketplace path formatting
  - Restructured content with clear sections: Why Samurai Agent, When to Use, How It Works, Setup, Quick Commands, Privacy & Telemetry, and FAQ
  - Enhanced value proposition explaining LLM-based code understanding vs grep-based keyword search
  - Added detailed comparison showing how Samurai Agent references existing code instead of suggesting generic solutions
  - Improved setup instructions with recommended LLM provider configuration (Gemini Flash 2.5)
  - Added comprehensive FAQ section addressing common questions about LLM-based analysis benefits
  - Clarified positioning as a complementary tool for complex features, refactoring, and difficult bugs
  - Enhanced privacy section emphasizing code privacy and telemetry control

## [0.0.14] - 2025-10-07

### Changed
- **Expanded VS Code Compatibility**: Lowered minimum VS Code version requirement from `^1.104.0` to `^1.75.0`
  - Extension now supports VS Code versions from early 2023 onwards
  - Significantly increases potential user base by supporting users who haven't updated to the latest VS Code
  - Maintains compatibility with all modern VS Code features used by the extension

## [0.0.13] - 2025-10-05

### Added
- **LLM Cost Tracking System**: Implemented comprehensive cost tracking with real-time status bar display
  - Real-time cost display in VS Code status bar showing session and total costs
  - Cost details command (`samurai-agent.showCostDetails`) for detailed cost breakdown
  - Persistent cost storage across VS Code sessions with monthly statistics
  - Cost tracking for all LLM provider calls (OpenAI, Gemini, Anthropic)
  - Automatic cost updates after each agent execution
- **Enhanced PostHog Logging**: Added comprehensive logging throughout the extension
  - Detailed cost tracking logs for debugging and monitoring
  - Enhanced error context with request IDs and execution metadata
  - Improved telemetry for better extension performance monitoring

### Fixed
- **CRITICAL**: Fixed webview lifecycle issues that caused model list and chat history to disappear
  - Added visibility change handler to re-initialize webview state when returning to tabs
  - Fixed model name not showing when closing and reopening VS Code plugin
  - Enhanced message persistence with retry mechanisms for database synchronization
  - Fixed tab switching issues that caused message loss during navigation
  - Added robust fallback mechanisms for webview state management
- **CRITICAL**: Fixed message persistence race conditions
  - Enhanced message detection logic to prevent unnecessary reloading
  - Added state tracking to prevent duplicate message loading
  - Implemented refresh throttling to prevent rapid successive refreshes
  - Added comprehensive retry mechanisms for database write operations

### Improved
- **Webview State Management**: Enhanced webview lifecycle handling
  - Centralized `refreshWebviewState()` function for consistent state management
  - Added periodic checks and timeout-based refreshes for edge cases
  - Improved DOM state checking with multiple criteria for message detection
  - Enhanced logging for debugging webview lifecycle issues
- **Cost Display Integration**: Seamless cost tracking integration
  - Status bar shows current session cost and total cost with clickable details
  - Real-time cost updates without requiring webview refresh
  - Persistent cost storage with monthly aggregation and statistics
  - Cost formatting with proper currency display and precision

## [0.0.12] - 2025-10-03

### Added
- **Keyword Trigger Hints**: Added helpful keyword trigger examples to chat input area
  - "please read the latest code" for code extraction tool
  - "create specs" for specification creation tool
- **Keyword Search for Code**: Implemented intelligent keyword-based code search functionality
- Enhanced user experience with discoverable tool triggers in chat interface

### Improved
- Chat input now displays keyword examples to help users discover tool functionality
- Better onboarding experience for new users with visible tool trigger suggestions



### Added
- **PostHog Error Tracking**: Implemented centralized error tracking system with `TelemetryService.captureError` method
- **SamuraiAgent Error Monitoring**: Added PostHog error capture to SamuraiAgent.execute method for critical error tracking
- **ExtractCodeTool Error Monitoring**: Added comprehensive PostHog error tracking to ExtractCodeTool for all error scenarios:
  - Main execution failures with detailed context (query, projectId, execution time)
  - Codebase scanning failures with path and configuration details
  - LLM ranking failures with query and file count information
  - File reading failures with specific file path information
- **Error Context Enrichment**: Enhanced error tracking with rich contextual data including service name, function name, and relevant parameters
- **Comprehensive Test Coverage**: Added unit tests for error tracking functionality in both SamuraiAgent and ExtractCodeTool

### Fixed
- **CRITICAL**: Fixed consistent model selection across all SamuraiAgent methods (handlePureDiscussion, handleFeatureExploration, handleSpecClarification, handleGeneratingSpecs, analyzeUserIntent)
- **CRITICAL**: Enhanced LLM response parser to handle truncated JSON responses from Gemini API due to token limits
- **CRITICAL**: Fixed null reference errors in LLM ranking process when extractJsonFromLLMResponse returns null
- **CRITICAL**: Fixed maxTokens priority - explicit request maxTokens now takes precedence over project-level settings
- **CRITICAL**: Improved maxTokens logic to rely on model defaults instead of project settings for better performance
- Fixed model parameter passing from session metadata to all LLM requests throughout the system
- Improved error handling for empty or malformed LLM responses with comprehensive debugging

### Improved
- Added comprehensive Gemini API debugging with safety filter detection and detailed response analysis
- Enhanced JSON parsing with advanced truncation repair strategies for incomplete responses
- Added detailed logging for LLM request/response flow to diagnose API issues
- Improved ExtractCodeTool to handle truncated responses from Gemini due to safety filters or token limits
- Enhanced LLM response parser with 5 different parsing strategies including truncation repair
- Added prompt content logging for debugging Gemini safety filter issues
- Increased ExtractCodeTool maxTokens from 8192 to 20000 for better response quality
- Enhanced maxTokens logging to show which value is being used (explicit request vs project setting vs model default)
- Updated LLM model maxTokens to use realistic default values (4K for OpenAI/Anthropic, 8K for Gemini)
- Simplified maxTokens logic to use explicit request values for Google/Gemini, model defaults otherwise

### Added
- Advanced JSON repair strategies for handling truncated responses (ellipsis patterns, incomplete strings, etc.)
- Comprehensive Gemini-specific debugging including safety ratings and finish reason analysis
- Detailed logging for model selection consistency across all components
- Enhanced error messages for LLM parsing failures with specific diagnostic information
- Removed unused hello world command from package.json for cleaner extension structure

## [0.0.6] - 2025-10-02

### Fixed
- **CRITICAL**: Fixed LLM JSON parsing failure in production for array format responses
- **CRITICAL**: Fixed empty LLM response handling with better error messages and debugging
- Improved LLM response parser to handle both object `{}` and array `[{},{}]` formats robustly
- Enhanced JSON extraction with multiple fallback strategies for various LLM output formats
- Fixed type system to properly handle arrays in addition to objects
- Added intelligent truncation handling that respects markdown code block boundaries
- Improved balanced extraction logic for nested JSON structures with code blocks
- Added comprehensive test coverage for production array format scenarios
- Enhanced error handling for empty, short, and non-JSON LLM responses with specific diagnostic messages

### Improved
- LLM JSON parsing is now more robust and handles edge cases better
- Better error handling for malformed JSON in markdown code blocks
- Enhanced parsing strategies for different LLM response formats

## [0.0.5] - 2025-10-02

### Fixed
- Fixed PostHog telemetry tracking by properly loading environment variables from .env file
- Added dotenv configuration to load PostHog API key during development
- Created custom build script to inject PostHog API key during webpack build process
- PostHog tracking now works in both development and production environments
- Verified PostHog API key is properly embedded in packaged extension

## [0.0.4] - 2025-10-02

### Fixed
- Fixed code extraction not starting in production by fixing SamuraiAgent prompt file loading
- Updated SamuraiAgent to use the same prompt loading logic as CodeParserService for consistency

## [0.0.3] - 2025-10-02

### Fixed
- Fixed code extraction failure in packaged extension by ensuring workspace path is properly set in session metadata
- Fixed CodeParserService to always use workspace root instead of extension root for code scanning

### Security
- Removed hardcoded PostHog API key from webpack configuration for better security

## [0.0.2] - 2025-10-01

### Fixed
- Fixed code extraction failure in packaged extension due to incorrect prompt file path resolution
- Fixed CSS loading issue in published extension by updating webview resource paths
- Updated asset resolution to prioritize dist directory for packaged extensions

## [0.0.1] - 2025-10-01

- Initial release