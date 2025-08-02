# Frontend-Backend Integration Tests

This directory contains comprehensive integration tests to validate the communication between the React frontend and FastAPI backend of the Samurai Agent application.

## Overview

The integration tests are designed to identify and diagnose issues with:

- **Chat Persistence**: Messages disappearing on page refresh
- **Task Integration**: Tasks not appearing when AI agent creates them
- **Memory System**: Memories not being created or displayed
- **Data Refresh**: All data lost when page refreshes
- **API Endpoint Compatibility**: Mismatches between frontend expectations and backend implementation

## Test Structure

### 1. Backend Integration Tests (`test-integration.js`)
Tests the FastAPI backend endpoints and functionality:
- Backend connectivity and health checks
- CORS configuration
- Project creation and management
- Chat persistence and message handling
- Task creation and updates
- Memory creation and retrieval
- Data persistence across requests
- Error handling

### 2. Frontend Integration Tests (`test-frontend-integration.js`)
Tests the React frontend integration with the backend:
- Frontend connectivity
- API service functions
- Chat component integration
- Task component integration
- Memory component integration
- Data persistence across browser sessions
- Error handling in components
- API endpoint compatibility

### 3. Debug Utilities (`debug-utils.js`)
Advanced debugging tools for detailed issue analysis:
- Network request monitoring
- Data structure validation
- State inspection
- Issue detection and reporting

### 4. Test Runner (`run-tests.js`)
Main test runner that executes all tests and provides comprehensive reporting.

## Prerequisites

Before running the tests, ensure:

1. **Backend is running** on `http://localhost:8000`
   ```bash
   cd backend
   python main.py
   ```

2. **Frontend is running** on `http://localhost:5173`
   ```bash
   cd frontend
   npm run dev
   ```

3. **Node.js** is installed (version 14 or higher)

## Installation

```bash
cd integration-tests
npm install
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend

# Debug utilities
npm run debug
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## Test Results Interpretation

### Success Indicators
- ✅ All tests pass
- Backend and frontend are properly connected
- Data persistence is working
- API endpoints are compatible

### Common Issues and Solutions

#### 1. Chat Persistence Issues
**Symptoms**: Messages disappear on page refresh
**Tests**: `chatPersistence`, `chatComponentIntegration`
**Likely Causes**:
- Missing `/projects/{id}/chat-messages` endpoint in backend
- Chat messages not being saved to backend storage
- Frontend not loading chat history on component mount

**Solutions**:
- Implement chat message storage in backend
- Add chat history loading in frontend components
- Ensure chat messages are associated with projects

#### 2. Task Integration Issues
**Symptoms**: Tasks not appearing when AI agent creates them
**Tests**: `taskCreation`, `taskComponentIntegration`
**Likely Causes**:
- AI agent not generating tasks in chat responses
- Task creation endpoint not working
- Frontend not refreshing task list after chat

**Solutions**:
- Implement task generation in AI agent responses
- Fix task creation API endpoint
- Add task list refresh after chat interactions

#### 3. Memory System Issues
**Symptoms**: Memories not being created or displayed
**Tests**: `memoryCreation`, `memoryComponentIntegration`
**Likely Causes**:
- AI agent not creating memories from conversations
- Memory creation endpoint not working
- Frontend not loading memories

**Solutions**:
- Implement memory creation in AI agent
- Fix memory API endpoints
- Ensure memory panel loads data correctly

#### 4. Data Refresh Issues
**Symptoms**: All data lost when page refreshes
**Tests**: `dataPersistence`, `dataPersistenceAcrossSessions`
**Likely Causes**:
- Frontend not loading initial data on app startup
- Backend not persisting data properly
- Missing data loading in useEffect hooks

**Solutions**:
- Implement data loading on app startup
- Ensure backend data persistence is working
- Add proper error handling for data loading

#### 5. API Endpoint Mismatches
**Symptoms**: 404 errors or unexpected responses
**Tests**: `apiEndpointCompatibility`
**Likely Causes**:
- Frontend calling endpoints that don't exist
- Different data structures between frontend and backend
- Missing or incorrect API routes

**Solutions**:
- Align frontend API calls with backend endpoints
- Ensure data models match between frontend and backend
- Add missing API endpoints

## Debugging Specific Issues

### Network Issues
```bash
npm run debug
```
This will run detailed network monitoring and identify:
- Failed API requests
- Slow response times
- Missing endpoints
- Data structure mismatches

### Manual Testing
1. **Check Backend Health**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **Test API Endpoints**:
   ```bash
   curl http://localhost:8000/projects
   curl http://localhost:8000/chat -X POST -H "Content-Type: application/json" -d '{"message":"test"}'
   ```

3. **Check Frontend**:
   Open browser developer tools and check:
   - Network tab for failed requests
   - Console for JavaScript errors
   - Application tab for localStorage issues

## Test Output Examples

### Successful Test Run
```
[2024-01-01T12:00:00.000Z] [INFO] Starting comprehensive integration test suite...
[2024-01-01T12:00:00.100Z] [SUCCESS] Backend is reachable and healthy
[2024-01-01T12:00:00.200Z] [SUCCESS] CORS is properly configured
[2024-01-01T12:00:00.300Z] [SUCCESS] Test project created with ID: abc-123
[2024-01-01T12:00:00.400Z] [SUCCESS] Chat message sent successfully
[2024-01-01T12:00:00.500Z] [SUCCESS] Task created with ID: def-456
[2024-01-01T12:00:00.600Z] [SUCCESS] Memory created with ID: ghi-789

=== INTEGRATION TEST REPORT ===
Total Tests: 9
Passed: 9
Failed: 0
Success Rate: 100.0%

✅ backendConnectivity
✅ corsConfiguration
✅ projectCreation
✅ chatPersistence
✅ taskCreation
✅ taskUpdates
✅ memoryCreation
✅ dataPersistence
✅ errorHandling
```

### Failed Test Run
```
[2024-01-01T12:00:00.000Z] [INFO] Starting comprehensive integration test suite...
[2024-01-01T12:00:00.100Z] [SUCCESS] Backend is reachable and healthy
[2024-01-01T12:00:00.200Z] [ERROR] Chat messages endpoint not implemented yet
[2024-01-01T12:00:00.300Z] [ERROR] Task creation failed: 404

=== INTEGRATION TEST REPORT ===
Total Tests: 9
Passed: 6
Failed: 3
Success Rate: 66.7%

✅ backendConnectivity
✅ corsConfiguration
✅ projectCreation
❌ chatPersistence
❌ taskCreation
❌ taskUpdates
✅ memoryCreation
✅ dataPersistence
✅ errorHandling

Issues Found:
- chatPersistence: Chat messages are not being saved or retrieved
- taskCreation: Tasks are not being created properly
- taskUpdates: Task status updates are not working
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add comprehensive error logging
3. Include cleanup procedures
4. Update this README with new test descriptions
5. Ensure tests are idempotent (can be run multiple times)

## Troubleshooting

### Common Problems

1. **Tests fail with "fetch is not defined"**
   - Install node-fetch: `npm install node-fetch`
   - Or use Node.js 18+ which has fetch built-in

2. **Backend not reachable**
   - Ensure backend is running on port 8000
   - Check for firewall or port conflicts

3. **Frontend not reachable**
   - Ensure frontend is running on port 5173
   - Check for build errors

4. **CORS errors**
   - Verify backend CORS configuration
   - Check that frontend URL is in allowed origins

5. **Data not persisting**
   - Check backend file storage permissions
   - Verify data directory exists and is writable

### Getting Help

If tests continue to fail:

1. Run the debug utilities: `npm run debug`
2. Check the detailed logs for specific error messages
3. Verify both backend and frontend are running correctly
4. Test API endpoints manually with curl or Postman
5. Check browser developer tools for frontend errors 