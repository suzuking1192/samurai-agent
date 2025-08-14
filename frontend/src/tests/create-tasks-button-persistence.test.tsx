import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('Create Tasks Button Persistence', () => {
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

  it('should show Create Tasks button after page refresh when last message has spec_clarification intent', async () => {
    // Mock conversation history with a message that has spec_clarification intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'spec_clarification' // This should persist after refresh
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is visible
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
  })

  it('should show Create Tasks button after page refresh when last message has feature_exploration intent', async () => {
    // Mock conversation history with a message that has feature_exploration intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'That sounds like an interesting feature! What kind of authentication system are you thinking about?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'feature_exploration' // This should persist after refresh
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is visible
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
  })

  it('should not show Create Tasks button after page refresh when last message has different intent', async () => {
    // Mock conversation history with a message that has a different intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'Hello',
        response: 'Hello! How can I help you today?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'pure_discussion' // This should NOT show the button
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is NOT visible
    await waitFor(() => {
      expect(screen.queryByText('Create tasks based on discussion so far')).not.toBeInTheDocument()
    })
  })

  it('should not show Create Tasks button after page refresh when last message has no intent_type', async () => {
    // Mock conversation history with a message that has no intent_type (old data)
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'Hello',
        response: 'Hello! How can I help you today?',
        created_at: '2024-01-01T00:00:00Z'
        // No intent_type field - this should NOT show the button
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is NOT visible
    await waitFor(() => {
      expect(screen.queryByText('Create tasks based on discussion so far')).not.toBeInTheDocument()
    })
  })

  it('should show Create Tasks button for the last message in conversation history', async () => {
    // Mock conversation history with multiple messages, where the last one has the right intent
    const mockMessages = [
      {
        id: 'msg-1',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'Hello',
        response: 'Hello! How can I help you today?',
        created_at: '2024-01-01T00:00:00Z',
        intent_type: 'pure_discussion'
      },
      {
        id: 'msg-2',
        project_id: 'test-project-id',
        session_id: 'test-session-id',
        message: 'I want to add user authentication',
        response: 'Great! I can help you implement user authentication. What type of authentication would you prefer?',
        created_at: '2024-01-01T00:01:00Z',
        intent_type: 'spec_clarification' // This is the last message and should show the button
      }
    ]
    
    mockApi.getSessionMessages.mockResolvedValue(mockMessages)
    
    render(<Chat projectId="test-project-id" />)
    
    // Wait for the component to load and check that the Create Tasks button is visible
    await waitFor(() => {
      expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    })
  })
})
