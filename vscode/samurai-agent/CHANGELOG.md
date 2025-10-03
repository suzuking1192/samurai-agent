# Change Log

All notable changes to the "samurai-agent" extension will be documented in this file.

## [Unreleased]

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

## [0.0.6] - 2025-01-01

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

## [0.0.5] - 2025-01-01

### Fixed
- Fixed PostHog telemetry tracking by properly loading environment variables from .env file
- Added dotenv configuration to load PostHog API key during development
- Created custom build script to inject PostHog API key during webpack build process
- PostHog tracking now works in both development and production environments
- Verified PostHog API key is properly embedded in packaged extension

## [0.0.4] - 2025-01-01

### Fixed
- Fixed code extraction not starting in production by fixing SamuraiAgent prompt file loading
- Updated SamuraiAgent to use the same prompt loading logic as CodeParserService for consistency

## [0.0.3] - 2025-01-01

### Fixed
- Fixed code extraction failure in packaged extension by ensuring workspace path is properly set in session metadata
- Fixed CodeParserService to always use workspace root instead of extension root for code scanning

### Security
- Removed hardcoded PostHog API key from webpack configuration for better security

## [0.0.2] - 2025-01-01

### Fixed
- Fixed code extraction failure in packaged extension due to incorrect prompt file path resolution
- Fixed CSS loading issue in published extension by updating webview resource paths
- Updated asset resolution to prioritize dist directory for packaged extensions

## [0.0.1] - 2025-01-01

- Initial release