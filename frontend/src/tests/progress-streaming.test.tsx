import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Chat from '../components/Chat'
import * as api from '../services/api'

// Mock the API module
jest.mock('../services/api', () => ({
  sendChatMessageWithProgress: jest.fn(),
  getCurrentSession: jest.fn().mockResolvedValue({ id: 'test-session' }),
  getSessionMessages: jest.fn().mockResolvedValue([]),
  getTaskContext: jest.fn().mockResolvedValue({ task_context: null }),
}))

describe('Progress Streaming', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('should show progress updates one at a time in real-time', async () => {
    // Mock the streaming API call
    let progressCallback: (progress: any) => void
    ;(api.sendChatMessageWithProgress as jest.Mock).mockImplementation(
      (request, onProgress) => {
        progressCallback = onProgress
        return new Promise((resolve) => {})
      }
    )

    // Render Chat component
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument()
    })

    // Send a message
    const textarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement
    textarea.value = 'Test message'
    textarea.dispatchEvent(new Event('change'))
    screen.getByText('Send').click()

    // Send first progress update
    await act(async () => {
      progressCallback({
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify first progress is shown
    expect(screen.getByText('🧠 Starting...')).toBeInTheDocument()

    // Send second update
    await act(async () => {
      progressCallback({
        step: 'context',
        message: '📚 Loading context...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify ONLY second progress is shown (first should be gone)
    expect(screen.getByText('📚 Loading context...')).toBeInTheDocument()
    expect(screen.queryByText('🧠 Starting...')).not.toBeInTheDocument()

    // Send third update
    await act(async () => {
      progressCallback({
        step: 'analyzing',
        message: '🧠 Analyzing intent...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify ONLY third progress is shown
    expect(screen.getByText('🧠 Analyzing intent...')).toBeInTheDocument()
    expect(screen.queryByText('📚 Loading context...')).not.toBeInTheDocument()
  })

  it('should handle rapid progress updates correctly', async () => {
    let progressCallback: (progress: any) => void
    ;(api.sendChatMessageWithProgress as jest.Mock).mockImplementation(
      (request, onProgress) => {
        progressCallback = onProgress
        return new Promise((resolve) => {})
      }
    )

    render(<Chat projectId="test-project" />)

    // Send message
    const textarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement
    textarea.value = 'Test message'
    textarea.dispatchEvent(new Event('change'))
    screen.getByText('Send').click()

    // Send multiple updates rapidly
    await act(async () => {
      progressCallback({
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      })
    })

    await act(async () => {
      progressCallback({
        step: 'context',
        message: '📚 Loading context...',
        timestamp: new Date().toISOString()
      })
    })

    await act(async () => {
      progressCallback({
        step: 'analyzing',
        message: '🧠 Analyzing intent...',
        timestamp: new Date().toISOString()
      })
    })

    // Only the latest progress should be visible
    expect(screen.getByText('🧠 Analyzing intent...')).toBeInTheDocument()
    expect(screen.queryByText('🧠 Starting...')).not.toBeInTheDocument()
    expect(screen.queryByText('📚 Loading context...')).not.toBeInTheDocument()
  })

  it('should persist progress during long operations', async () => {
    let progressCallback: (progress: any) => void
    ;(api.sendChatMessageWithProgress as jest.Mock).mockImplementation(
      (request, onProgress) => {
        progressCallback = onProgress
        return new Promise((resolve) => {})
      }
    )

    render(<Chat projectId="test-project" />)

    // Send message
    const textarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement
    textarea.value = 'Test message'
    textarea.dispatchEvent(new Event('change'))
    screen.getByText('Send').click()

    // Send AI processing update
    await act(async () => {
      progressCallback({
        step: 'ai_call',
        message: '🤖 Calling AI service...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify message is shown
    expect(screen.getByText('🤖 Calling AI service...')).toBeInTheDocument()

    // Simulate long delay
    await act(async () => {
      jest.advanceTimersByTime(2000)  // 2 second delay
    })

    // Message should still be visible after delay
    expect(screen.getByText('🤖 Calling AI service...')).toBeInTheDocument()

    // Send next update
    await act(async () => {
      progressCallback({
        step: 'processing',
        message: '🔄 Processing response...',
        timestamp: new Date().toISOString()
      })
    })

    // Only new message should be visible
    expect(screen.getByText('🔄 Processing response...')).toBeInTheDocument()
    expect(screen.queryByText('🤖 Calling AI service...')).not.toBeInTheDocument()
  })
})


