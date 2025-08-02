# Samurai Agent Test Suite

This directory contains a comprehensive test suite for the SamuraiAgent that validates the complete conversation flow from vague request to clarification to task creation, including memory management and context handling.

## Test Files

- `test_ai_agent.py` - Main test suite with comprehensive test cases
- `test_scenarios.py` - Predefined test scenarios and data
- `run_tests.py` - Simple test runner script
- `test_requirements.txt` - Testing dependencies

## Test Coverage

The test suite covers the following critical functionality:

### 1. Complete Conversation Flow
- **Vague Request → Clarification**: Tests that vague feature requests trigger appropriate clarifying questions
- **Detailed Response → Task Creation**: Validates that detailed responses create proper task breakdowns
- **Memory Creation**: Ensures important decisions are saved to memory
- **Context Awareness**: Tests that the agent remembers previous conversations

### 2. Task Management
- **Task Completion**: Tests marking tasks as complete through chat
- **Task Deletion**: Tests removing tasks through chat
- **Task Updates**: Validates task modification functionality

### 3. Intent Classification
- **Feature Requests**: Detecting when users want to build something
- **Task Management**: Identifying task completion/deletion requests
- **Questions**: Recognizing help/explanation requests
- **General Chat**: Handling casual conversation

### 4. Clarity Evaluation
- **Vague Detection**: Identifying requests that need clarification
- **Clear Detection**: Recognizing detailed, actionable requests
- **Clarification Generation**: Creating appropriate follow-up questions

### 5. Memory Management
- **Memory Creation**: Extracting and saving important decisions
- **Memory Retrieval**: Finding relevant memories for context
- **Memory Similarity**: Detecting duplicate or similar memories

### 6. Context Handling
- **Conversation Continuation**: Detecting when messages continue previous discussions
- **Context Analysis**: Smart analysis of conversation flow
- **Context-Aware Responses**: Providing responses that reference previous decisions

### 7. Error Handling
- **Invalid Inputs**: Graceful handling of edge cases
- **API Errors**: Fallback behavior when external services fail
- **Data Validation**: Ensuring data integrity

## Running the Tests

### Prerequisites

1. Install testing dependencies:
```bash
pip install -r test_requirements.txt
```

2. Ensure you have the required environment variables set (see main README)

### Quick Test Run

```bash
cd backend
python run_tests.py
```

### Using pytest

```bash
cd backend
pytest test_ai_agent.py -v
```

### Running Specific Tests

```bash
# Run only authentication flow tests
pytest test_ai_agent.py::TestSamuraiAgent::test_complete_authentication_flow -v

# Run only intent classification tests
pytest test_ai_agent.py::TestSamuraiAgent::test_intent_classification -v

# Run with coverage
pytest test_ai_agent.py --cov=services.ai_agent --cov-report=html
```

## Expected Test Output

```
🧪 Starting Samurai Agent Test Suite
==================================================

🔍 Test 1: Complete Authentication Flow
✅ Step 1 - Clarification triggered: clarification
✅ Step 2 - Tasks created: 6 tasks
  Task 1: Create user registration form
  Task 2: Set up password hashing endpoint
  Task 3: Implement JWT token generation
  Task 4: Add login endpoint
  Task 5: Create logout functionality
  Task 6: Implement password reset
✅ Step 3 - Memory saved: User Authentication Method

🔍 Test 2: Task Management Flow
✅ Task completion: ✅ Marked 'Create user registration form' as complete!
✅ Task deletion: 🗑️ Deleted 'Set up password hashing endpoint' from your project

🔍 Test 3: Conversation Context Flow
✅ Context-aware response: References previous decisions

🔍 Test 4: Intent Classification
✅ Intent classification: 'I want to add user authentication' → feature_request
✅ Intent classification: 'What is JWT?' → question
✅ Intent classification: 'The login form is done' → task_management
✅ Intent classification: 'Good morning!' → general_chat

🔍 Test 5: Clarity Evaluation
✅ Vague detection: 'I want to add authentication' → False
✅ Clear detection: 'Add email/password authentication...' → True

🔍 Test 6: Task Parsing Logic
✅ Standard parsing: 3 tasks extracted
✅ Alternative parsing: 3 tasks extracted

🔍 Test 7: Memory Management
✅ Memory management: Found 2 relevant memories

🔍 Test 8: Conversation Continuation Detection
✅ Continuation detection: 'Yes, that's right' → True
✅ Continuation detection: 'JWT tokens' → True

🔍 Test 9: Error Handling
✅ Error handling: Graceful handling of edge cases

✅ All tests passed!
🎉 Samurai Agent is working correctly!
```

## Test Scenarios

The `test_scenarios.py` file contains predefined test data for:

- **Authentication Flow**: Complete user authentication implementation
- **Task Management**: Various task completion and deletion scenarios
- **Intent Classification**: Different types of user messages
- **Clarity Evaluation**: Vague vs. clear feature requests
- **Conversation Continuation**: Messages that continue vs. start new conversations
- **Memory Management**: Memory creation and retrieval scenarios
- **Error Handling**: Edge cases and invalid inputs
- **Project Contexts**: Different project types and tech stacks
- **Feature Requests**: Various feature implementation scenarios

## Test Data Management

The test suite automatically:
- Creates unique test project IDs for each test run
- Cleans up test data files after each test
- Ensures isolated test environments
- Handles file system operations safely

## Debugging Tests

If tests fail, check:

1. **Environment Variables**: Ensure API keys are set correctly
2. **Network Connectivity**: Tests require internet access for AI services
3. **File Permissions**: Ensure write access to the `data/` directory
4. **Dependencies**: Verify all required packages are installed

### Common Issues

- **API Rate Limits**: Tests may fail if API limits are exceeded
- **Network Timeouts**: Increase timeout values for slow connections
- **File Locking**: Ensure no other processes are using test files

## Adding New Tests

To add new test cases:

1. Add test method to `TestSamuraiAgent` class
2. Use `@pytest.mark.asyncio` for async tests
3. Follow the existing pattern for setup/teardown
4. Add test scenarios to `test_scenarios.py` if needed
5. Update the test runner to include new tests

## Test Best Practices

- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up test data
- **Assertions**: Use specific, meaningful assertions
- **Documentation**: Document complex test scenarios
- **Error Handling**: Test both success and failure cases

## Performance Considerations

- Tests use real AI API calls, so they may be slow
- Consider mocking AI services for faster unit tests
- Use test data caching for repeated scenarios
- Run tests in parallel when possible

## Continuous Integration

The test suite is designed to work in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run AI Agent Tests
  run: |
    cd backend
    pip install -r test_requirements.txt
    python run_tests.py
```

## Support

For issues with the test suite:
1. Check the test output for specific error messages
2. Verify environment setup
3. Review the test scenarios for expected behavior
4. Check the main agent implementation for changes 