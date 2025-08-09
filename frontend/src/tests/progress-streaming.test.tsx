import React from 'react'
import { render, screen, act, waitFor, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import Chat from '../components/Chat'
import * as api from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  sendChatMessageWithProgress: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session' }),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  getTaskContext: vi.fn().mockResolvedValue({ task_context: null }),
}))

describe('Progress Streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show progress updates one at a time in real-time', async () => {
    // Mock the streaming API call
    let progressCallback: ((progress: any) => void) | undefined
    ;(api as any).sendChatMessageWithProgress = vi.fn(async (...args: any[]) => {
      progressCallback = args[1]
      return Promise.resolve()
    })

    // Render Chat component
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your message here/i)).toBeInTheDocument()
    })

    // Send a message
    const textarea = screen.getByPlaceholderText(/Type your message here/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByText('Send'))

    // Send first progress update
    await act(async () => {
      progressCallback!({
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify first progress is shown (scoped to progress widget)
    const progressWidget = document.querySelector('.agent-progress') as HTMLElement
    expect(within(progressWidget).getByText('🧠 Starting...')).toBeInTheDocument()

    // Send second update
    await act(async () => {
      progressCallback!({
        step: 'context',
        message: '📚 Loading context...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify ONLY second progress is shown (first should be gone)
    expect(within(progressWidget).getByText('📚 Loading context...')).toBeInTheDocument()
    expect(within(progressWidget).queryByText('🧠 Starting...')).not.toBeInTheDocument()

    // Send third update
    await act(async () => {
      progressCallback!({
        step: 'analyzing',
        message: '🧠 Analyzing intent...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify ONLY third progress is shown
    expect(within(progressWidget).getByText('🧠 Analyzing intent...')).toBeInTheDocument()
    expect(within(progressWidget).queryByText('📚 Loading context...')).not.toBeInTheDocument()
  })

  it('should handle rapid progress updates correctly', async () => {
    let progressCallback: ((progress: any) => void) | undefined
    ;(api as any).sendChatMessageWithProgress = vi.fn(async (...args: any[]) => {
      progressCallback = args[1]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    // Send message
    const textarea = screen.getByPlaceholderText(/Type your message here/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByText('Send'))

    // Send multiple updates rapidly
    await act(async () => {
      progressCallback!({
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      })
    })

    await act(async () => {
      progressCallback!({
        step: 'context',
        message: '📚 Loading context...',
        timestamp: new Date().toISOString()
      })
    })

    await act(async () => {
      progressCallback!({
        step: 'analyzing',
        message: '🧠 Analyzing intent...',
        timestamp: new Date().toISOString()
      })
    })

    // Only the latest progress should be visible
    const progressWidget2 = document.querySelector('.agent-progress') as HTMLElement
    expect(within(progressWidget2).getByText('🧠 Analyzing intent...')).toBeInTheDocument()
    expect(within(progressWidget2).queryByText('🧠 Starting...')).not.toBeInTheDocument()
    expect(within(progressWidget2).queryByText('📚 Loading context...')).not.toBeInTheDocument()
  })

  it('should persist progress during long operations', async () => {
    let progressCallback: ((progress: any) => void) | undefined
    ;(api as any).sendChatMessageWithProgress = vi.fn(async (...args: any[]) => {
      progressCallback = args[1]
      return Promise.resolve()
    })

    render(<Chat projectId="test-project" />)

    // Send message
    const textarea = screen.getByPlaceholderText(/Type your message here/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByText('Send'))

    // Send AI processing update
    await act(async () => {
      progressCallback!({
        step: 'ai_call',
        message: '🤖 Calling AI service...',
        timestamp: new Date().toISOString()
      })
    })

    // Verify message is shown
    const progressWidget3 = document.querySelector('.agent-progress') as HTMLElement
    expect(within(progressWidget3).getByText('🤖 Calling AI service...')).toBeInTheDocument()

    // Simulate long delay
    await act(async () => {
      vi.advanceTimersByTime(2000)  // 2 second delay
    })

    // Message should still be visible after delay
    expect(screen.getByText('🤖 Calling AI service...')).toBeInTheDocument()

    // Send next update
    await act(async () => {
      progressCallback!({
        step: 'processing',
        message: '🔄 Processing response...',
        timestamp: new Date().toISOString()
      })
    })

    // Only new message should be visible
    expect(within(progressWidget3).getByText('🔄 Processing response...')).toBeInTheDocument()
    expect(within(progressWidget3).queryByText('🤖 Calling AI service...')).not.toBeInTheDocument()
  })
})


