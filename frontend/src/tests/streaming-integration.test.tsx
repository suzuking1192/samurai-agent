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

describe('Real-Time Progress Streaming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should display real-time progress updates during message processing', async () => {
    // Mock the streaming response with real-time progress updates
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

    // Type and send a message
    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Create a new task for user authentication' } })
    fireEvent.click(sendButton)

    // Verify the optimistic message appears
    await waitFor(() => {
      expect(screen.getByText('Create a new task for user authentication')).toBeInTheDocument()
      expect(screen.getByText('Samurai Agent is thinking...')).toBeInTheDocument()
    })

    // Drive progress updates manually so tests are deterministic
    await act(async () => {
      onProgress?.({ step: 'start', message: '🧠 Starting to process your request...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'context', message: '📚 Gathering conversation context...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'analyzing', message: '🧠 Analyzing your request...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'planning', message: '📋 Creating execution plan...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'execution', message: '⚙️ Executing plan...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'memory', message: '💾 Updating memory...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'completion', message: '🎉 Processing complete!', timestamp: new Date().toISOString() })
      onComplete?.('I have successfully processed your request and created the necessary tasks.')
    })

    // Verify multiple progress steps appear in sequence
    await waitFor(() => {
      expect(screen.getByText('📚 Gathering conversation context...')).toBeInTheDocument()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(screen.getByText('🧠 Analyzing your request...')).toBeInTheDocument()
    }, { timeout: 4000 })

    await waitFor(() => {
      expect(screen.getByText('📋 Creating execution plan...')).toBeInTheDocument()
    }, { timeout: 5000 })

    await waitFor(() => {
      expect(screen.getByText('⚙️ Executing plan...')).toBeInTheDocument()
    }, { timeout: 6000 })

    await waitFor(() => {
      expect(screen.getByText('💾 Updating memory...')).toBeInTheDocument()
    }, { timeout: 7000 })

    await waitFor(() => {
      expect(screen.getByText('🎉 Processing complete!')).toBeInTheDocument()
    }, { timeout: 8000 })

    // Verify final response appears
    await waitFor(() => {
      expect(screen.getByText('I have successfully processed your request and created the necessary tasks.')).toBeInTheDocument()
    }, { timeout: 9000 })

    // Verify the API was called correctly
    expect(mockSendChatMessageWithProgress).toHaveBeenCalledWith(
      {
        message: 'Create a new task for user authentication',
        project_id: 'test-project'
      },
      expect.any(Function), // onProgress callback
      expect.any(Function), // onComplete callback
      expect.any(Function)  // onError callback
    )
  })

  it('should handle streaming errors gracefully', async () => {
    let onError: ((error: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (...args: any[]) => {
      onError = args[3]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    // Wait for the chat to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/)).toBeInTheDocument()
    })

    // Type and send a message
    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'This will cause an error' } })
    fireEvent.click(sendButton)

    await act(async () => {
      onError?.('Failed to process request: Network error')
    })
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to process request/)).toBeInTheDocument()
    })
  })

  it('should show progress steps with proper styling and icons', async () => {
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

    // Type and send a message
    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    await act(async () => {
      onProgress?.({ step: 'analyzing', message: '🧠 Analyzing your request...', timestamp: new Date().toISOString() })
      vi.advanceTimersByTime(10)
      onProgress?.({ step: 'execution', message: '⚙️ Executing plan...', timestamp: new Date().toISOString() })
      onComplete?.('Processing completed successfully.')
    })
    await waitFor(() => {
      expect(screen.getByText('🧠 Analyzing your request...')).toBeInTheDocument()
      expect(screen.getByText('⚙️ Executing plan...')).toBeInTheDocument()
      expect(screen.getByText('Processing completed successfully.')).toBeInTheDocument()
    })
  })

  it('should handle rapid progress updates without UI lag', async () => {
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

    // Type and send a message
    const input = screen.getByPlaceholderText(/Type your message here/)
    const sendButton = screen.getByText('Send')
    
    fireEvent.change(input, { target: { value: 'Rapid processing test' } })
    fireEvent.click(sendButton)

    await act(async () => {
      const steps = [
        { step: 'start', message: '🚀 Starting...' },
        { step: 'context', message: '📚 Loading context...' },
        { step: 'analyzing', message: '🧠 Analyzing...' },
      ]
      for (const s of steps) {
        onProgress?.({ ...s, timestamp: new Date().toISOString() })
        vi.advanceTimersByTime(10)
      }
      onComplete?.('All steps completed successfully.')
    })
    await waitFor(() => {
      expect(screen.getByText('🚀 Starting...')).toBeInTheDocument()
      expect(screen.getByText('📚 Loading context...')).toBeInTheDocument()
      expect(screen.getByText('🧠 Analyzing...')).toBeInTheDocument()
      expect(screen.getByText('All steps completed successfully.')).toBeInTheDocument()
    })
  })
}) 