# Change Log

All notable changes to the "samurai-agent" extension will be documented in this file.

## [Unreleased]

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