import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Chat from '../components/Chat'
import { sendChatMessageWithProgress } from '../services/api'

// Mock the API service
vi.mock('../services/api', () => ({
  sendChatMessageWithProgress: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session', name: 'Test Session' }),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue({ id: 'new-session', name: 'New Session' }),
  getTaskContext: vi.fn().mockResolvedValue({ task_context: null })
}))

const mockSendChatMessageWithProgress = sendChatMessageWithProgress as any

describe('Chatbox Markdown Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should render task creation response with markdown formatting instead of raw JSON', async () => {
    // Mock the streaming response with a task creation response that includes markdown
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (...args: any[]) => {
      onProgress = args[1]
      onComplete = args[2]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    // Wait for the chat to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/)).toBeInTheDocument()
    })

    // Type and send a message that triggers task creation
    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Create tasks for implementing a login feature' } })
    fireEvent.click(sendButton)

    // Verify the optimistic message appears
    await waitFor(() => {
      expect(screen.getByText('Create tasks for implementing a login feature')).toBeInTheDocument()
      expect(screen.getByText('Samurai Agent is thinking...')).toBeInTheDocument()
    })

    // Simulate progress updates
    await act(async () => {
      onProgress?.({ step: 'start', message: '🧠 Starting to process your request...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'planning', message: '📋 Creating task breakdown...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'execution', message: '⚙️ Creating tasks...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'completion', message: '✅ Tasks created', timestamp: new Date().toISOString() })
      
      // Complete with a response that includes markdown-formatted tasks
      const markdownResponse = `✅ I've created 2 tasks for you!

## 1. Implement login feature
Create user authentication system with JWT tokens and session management

*Priority: high*

  - **Create login form**
    Design and implement the login form UI with React components

    *Priority: medium*

You can now work on these tasks one by one. Let me know when you complete any of them!`
      
      onComplete?.(markdownResponse)
    })

    // Verify the final response appears with proper markdown rendering
    await waitFor(() => {
      // Check that the main task title is rendered as a heading
      expect(screen.getByText('1. Implement login feature')).toBeInTheDocument()
      
      // Check that the subtask is rendered as a bullet point
      expect(screen.getByText('Create login form')).toBeInTheDocument()
      
      // Check that descriptions are present
      expect(screen.getByText(/Create user authentication system/)).toBeInTheDocument()
      expect(screen.getByText(/Design and implement the login form UI/)).toBeInTheDocument()
      
      // Check that priority information is displayed
      expect(screen.getByText(/Priority: high/)).toBeInTheDocument()
      expect(screen.getByText(/Priority: medium/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify that NO raw JSON is displayed
    await waitFor(() => {
      // These should NOT be present in the rendered output
      expect(screen.queryByText(/task_id/)).not.toBeInTheDocument()
      expect(screen.queryByText(/parent_task_id/)).not.toBeInTheDocument()
      expect(screen.queryByText(/description/)).not.toBeInTheDocument()
      expect(screen.queryByText(/priority/)).not.toBeInTheDocument()
      expect(screen.queryByText(/status/)).not.toBeInTheDocument()
      
      // No raw JSON braces
      expect(screen.queryByText(/{/)).not.toBeInTheDocument()
      expect(screen.queryByText(/}/)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle complex task hierarchies with nested subtasks', async () => {
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (...args: any[]) => {
      onProgress = args[1]
      onComplete = args[2]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Create a comprehensive authentication system' } })
    fireEvent.click(sendButton)

    await act(async () => {
      onProgress?.({ step: 'completion', message: '✅ Tasks created', timestamp: new Date().toISOString() })
      
      // Complete with a complex hierarchical response
      const complexMarkdownResponse = `✅ I've created 3 tasks for you!

## 1. Implement authentication system
Complete authentication system with frontend and backend components

*Priority: high*

  - **Frontend authentication**
    Login/logout UI components and user interface

    *Priority: medium*

    - **Login form component**
      Create the login form React component with validation

      *Priority: low*

You can now work on these tasks one by one. Let me know when you complete any of them!`
      
      onComplete?.(complexMarkdownResponse)
    })

    // Verify complex hierarchy is rendered correctly
    await waitFor(() => {
      // Main task
      expect(screen.getByText('1. Implement authentication system')).toBeInTheDocument()
      
      // First level subtask
      expect(screen.getByText('Frontend authentication')).toBeInTheDocument()
      
      // Second level subtask (nested)
      expect(screen.getByText('Login form component')).toBeInTheDocument()
      
      // Descriptions
      expect(screen.getByText(/Complete authentication system/)).toBeInTheDocument()
      expect(screen.getByText(/Login\/logout UI components/)).toBeInTheDocument()
      expect(screen.getByText(/Create the login form React component/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle task creation with missing optional fields gracefully', async () => {
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (...args: any[]) => {
      onProgress = args[1]
      onComplete = args[2]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Create a simple task' } })
    fireEvent.click(sendButton)

    await act(async () => {
      onProgress?.({ step: 'completion', message: '✅ Tasks created', timestamp: new Date().toISOString() })
      
      // Complete with a response that has minimal task data
      const minimalMarkdownResponse = `✅ I've created 1 task for you!

## 1. Simple task
Untitled Task

You can now work on these tasks one by one. Let me know when you complete any of them!`
      
      onComplete?.(minimalMarkdownResponse)
    })

    // Verify minimal task is rendered without crashing
    await waitFor(() => {
      expect(screen.getByText('1. Simple task')).toBeInTheDocument()
      expect(screen.getByText('Untitled Task')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle empty task list gracefully', async () => {
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (...args: any[]) => {
      onProgress = args[1]
      onComplete = args[2]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Create tasks for something not software related' } })
    fireEvent.click(sendButton)

    await act(async () => {
      onProgress?.({ step: 'completion', message: '✅ Processing complete', timestamp: new Date().toISOString() })
      
      // Complete with a response for non-software tasks
      const emptyResponse = `I understand you're asking about something that's not related to software engineering implementation. 

For software engineering tasks only, I can help you create tasks that produce concrete changes to: application code, tests, configuration, CI/CD pipelines, infrastructure-as-code, database schemas/migrations, APIs, security/hardening, performance tuning, or developer documentation.

What software engineering task would you like to work on?`
      
      onComplete?.(emptyResponse)
    })

    // Verify empty response is handled gracefully
    await waitFor(() => {
      expect(screen.getByText(/not related to software engineering/)).toBeInTheDocument()
      expect(screen.getByText(/What software engineering task would you like to work on/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
