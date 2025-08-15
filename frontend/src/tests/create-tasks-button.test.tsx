import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Chat from '../components/Chat'
import * as api from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  sendChatMessageWithProgress: vi.fn(),
  getCurrentSession: vi.fn(),
  getSessionMessages: vi.fn(),
  getTaskContext: vi.fn(),
  getSuggestionStatus: vi.fn(),
  dismissSuggestion: vi.fn(),
}))

const mockApi = api as any

describe('Create Tasks Button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockApi.getCurrentSession.mockResolvedValue({
      id: 'test-session-id',
      project_id: 'test-project-id',
      name: 'Test Session',
      created_at: '2024-01-01T00:00:00Z',
      last_activity: '2024-01-01T00:00:00Z'
    })
    
    mockApi.getSessionMessages.mockResolvedValue([])
    mockApi.getTaskContext.mockResolvedValue(null)
    mockApi.getSuggestionStatus.mockResolvedValue({ show: false })
  })

  it('should show Create Tasks button when agent response has spec_clarification intent', async () => {
    // Mock a message with spec_clarification intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'spec_clarification'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is visible
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
  })

  it('should show Create Tasks button when agent response has feature_exploration intent', async () => {
    // Mock a message with feature_exploration intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'That sounds like an interesting feature! What kind of authentication system are you thinking about?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'feature_exploration'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is visible
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
  })

  it('should not show Create Tasks button when agent response has different intent', async () => {
    // Mock a message with different intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'Hello',
        response: 'Hello! How can I help you today?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'pure_discussion'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument()
    })
    
    // Check that the Create Tasks button is NOT visible
    expect(screen.queryByText('Create tasks based on discussion so far')).not.toBeInTheDocument()
  })

  it('should not show Create Tasks button when intent_type is undefined', async () => {
    // Mock a message without intent_type
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'Hello',
        response: 'Hello! How can I help you today?',
        created_at: '2024-01-01T00:00:00Z'
        // No intent_type field
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument()
    })
    
    // Check that the Create Tasks button is NOT visible
    expect(screen.queryByText('Create tasks based on discussion so far')).not.toBeInTheDocument()
  })

  it('should send create tasks message when button is clicked', async () => {
    // Mock a message with spec_clarification intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'spec_clarification'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    // Mock the streaming response
    mockApi.sendChatMessageWithProgress.mockImplementation(async (request, onProgress, onComplete) => {
      // Simulate progress updates
      onProgress({
        step: 'processing',
        message: 'Processing your request...',
        details: 'Creating tasks based on discussion',
        timestamp: '2024-01-01T00:00:00Z'
      })
      
      // Simulate completion
      onComplete('I have created tasks based on our discussion about user authentication.', 'ready_for_action')
    })
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
    
    // Click the Create Tasks button
    const createTasksButton = screen.getByText('Create tasks based on discussion so far').closest('button')
    fireEvent.click(createTasksButton)
    
    // Verify that the API was called with the correct message
    await waitFor(() => {
      expect(mockApi.sendChatMessageWithProgress).toHaveBeenCalledWith(
        {
          message: 'create tasks with the discussion so far',
          project_id: 'test-project-id'
        },
        expect.any(Function), // onProgress callback
        expect.any(Function), // onComplete callback
        expect.any(Function)  // onError callback
      )
    })
  })

  it('should disable Create Tasks button when loading', async () => {
    // Mock a message with spec_clarification intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'spec_clarification'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    // Mock a delayed response to simulate loading state
    mockApi.sendChatMessageWithProgress.mockImplementation(async (request, onProgress, onComplete) => {
      // Don't call onComplete immediately to keep loading state
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
    
    // Click the Create Tasks button
    const createTasksButton = screen.getByText('Create tasks based on discussion so far').closest('button')
    fireEvent.click(createTasksButton)
    
    // Verify the button is disabled during loading
    await waitFor(() => {
      expect(createTasksButton).toBeDisabled()
    })
  })

  it('should handle errors when Create Tasks button is clicked', async () => {
    // Mock a message with spec_clarification intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'spec_clarification'
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    // Mock an error response
    mockApi.sendChatMessageWithProgress.mockImplementation(async (request, onProgress, onComplete, onError) => {
      onError('Failed to create tasks')
    })
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
    
    // Click the Create Tasks button
    const createTasksButton = screen.getByText('Create tasks based on discussion so far').closest('button')
    fireEvent.click(createTasksButton)
    
    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to create tasks')).toBeInTheDocument()
    })
  })
})
