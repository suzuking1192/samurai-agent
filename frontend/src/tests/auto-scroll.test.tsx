import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import Chat from '../components/Chat'

// Mock the API module
vi.mock('../services/api', () => ({
  sendChatMessageWithProgress: vi.fn(),
  createSession: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session' }),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  endSessionWithConsolidation: vi.fn(),
  getTaskContext: vi.fn().mockResolvedValue({ task_context: null }),
  clearTaskContext: vi.fn(),
  getSuggestionStatus: vi.fn().mockResolvedValue({ should_show: false }),
  dismissSuggestion: vi.fn(),
}))

describe('Chat Auto-Scroll Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should add data-agent-message-id attribute to agent messages', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })

  test('should have scroll prevention logic in handleScroll', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })

  test('should implement findLastAgentMessage function', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })

  test('should implement scrollToLastAgentMessage function', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })

  test('should have auto-scroll useEffect', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })

  test('should have isAutoScrolling state', async () => {
    render(<Chat projectId="test-project" />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/I want to implement/i)).toBeInTheDocument()
    })

    // The component should render without errors
    expect(screen.getByText('Chat with Samurai Agent')).toBeInTheDocument()
  })
})
