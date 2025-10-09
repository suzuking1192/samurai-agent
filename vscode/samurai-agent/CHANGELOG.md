# Change Log

All notable changes to the "samurai-agent" extension will be documented in this file.

## [0.0.17] - 2025-10-09

### Fixed
- **README Demo GIF Display**: Fixed demo gif display in VS Code marketplace by using GitHub raw URL
  - Changed from relative path `./samurai-agent-demo.gif` to absolute GitHub raw URL
  - Ensures demo gif displays properly in VS Code marketplace and all platforms
  - Uses `https://raw.githubusercontent.com/suzuking1192/samurai-agent/main/vscode/samurai-agent/samurai-agent-demo.gif`

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