import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Chat from '../components/Chat'
import { sendChatMessageWithProgress } from '../services/api'

// Mock the API service
vi.mock('../services/api', () => ({
  sendChatMessageWithProgress: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session', name: 'Test Session' }),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue({ id: 'new-session', name: 'New Session' })
}))

const mockSendChatMessageWithProgress = sendChatMessageWithProgress as any

describe('Real-Time Progress Streaming Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display real-time progress updates during message processing', async () => {
    // Mock the streaming response with real-time progress updates
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (request: any, progressCallback: any, completeCallback: any) => {
      onProgress = progressCallback
      onComplete = completeCallback
      
      // Simulate real-time progress updates
      if (onProgress) {
        // Start processing
        onProgress({
          step: 'start',
          message: '🧠 Starting to process your request...',
          details: 'Initializing the planning-first agent',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Context gathering
        onProgress({
          step: 'context',
          message: '📚 Gathering conversation context...',
          details: 'Loading previous messages and project context',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Analysis
        onProgress({
          step: 'analyzing',
          message: '🧠 Analyzing your request...',
          details: 'Understanding your intent and requirements',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Planning
        onProgress({
          step: 'planning',
          message: '📋 Creating execution plan...',
          details: 'Planning the best approach for your request',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Execution
        onProgress({
          step: 'execution',
          message: '⚙️ Executing plan...',
          details: 'Carrying out the planned actions',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Memory update
        onProgress({
          step: 'memory',
          message: '💾 Updating memory...',
          details: 'Saving important information for future reference',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Completion
        onProgress({
          step: 'completion',
          message: '🎉 Processing complete!',
          details: 'All tasks completed successfully',
          timestamp: new Date().toISOString()
        })
      }
      
      // Send final response
      if (onComplete) {
        onComplete('I have successfully processed your request and created the necessary tasks.')
      }
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

    // Wait for progress updates to start appearing
    await waitFor(() => {
      expect(screen.getByText('🧠 Starting to process your request...')).toBeInTheDocument()
    }, { timeout: 2000 })

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
    
    mockSendChatMessageWithProgress.mockImplementation(async (request: any, progressCallback: any, completeCallback: any, errorCallback: any) => {
      onError = errorCallback
      
      // Simulate an error after a brief delay
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (onError) {
        onError('Failed to process request: Network error')
      }
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

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to process request/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should show progress steps with proper styling and icons', async () => {
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (request: any, progressCallback: any, completeCallback: any) => {
      onProgress = progressCallback
      onComplete = completeCallback
      
      if (onProgress) {
        // Send a few progress updates
        onProgress({
          step: 'analyzing',
          message: '🧠 Analyzing your request...',
          details: 'Understanding your intent and requirements',
          timestamp: new Date().toISOString()
        })
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        onProgress({
          step: 'execution',
          message: '⚙️ Executing plan...',
          details: 'Carrying out the planned actions',
          timestamp: new Date().toISOString()
        })
      }
      
      if (onComplete) {
        onComplete('Processing completed successfully.')
      }
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

    // Verify progress steps appear with proper styling
    await waitFor(() => {
      expect(screen.getByText('🧠 Analyzing your request...')).toBeInTheDocument()
    }, { timeout: 2000 })

    await waitFor(() => {
      expect(screen.getByText('⚙️ Executing plan...')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify final response
    await waitFor(() => {
      expect(screen.getByText('Processing completed successfully.')).toBeInTheDocument()
    }, { timeout: 4000 })
  })

  it('should handle rapid progress updates without UI lag', async () => {
    let onProgress: ((progress: any) => void) | undefined
    let onComplete: ((response: string) => void) | undefined
    
    mockSendChatMessageWithProgress.mockImplementation(async (request: any, progressCallback: any, completeCallback: any) => {
      onProgress = progressCallback
      onComplete = completeCallback
      
      if (onProgress) {
        // Send rapid progress updates
        const steps = [
          { step: 'start', message: '🚀 Starting...', details: 'Initializing' },
          { step: 'context', message: '📚 Loading context...', details: 'Gathering information' },
          { step: 'analyzing', message: '🧠 Analyzing...', details: 'Processing request' },
          { step: 'planning', message: '📋 Planning...', details: 'Creating strategy' },
          { step: 'execution', message: '⚙️ Executing...', details: 'Running actions' },
          { step: 'memory', message: '💾 Saving...', details: 'Updating memory' },
          { step: 'completion', message: '✅ Complete!', details: 'Finished processing' }
        ]
        
        for (const step of steps) {
          onProgress({
            ...step,
            timestamp: new Date().toISOString()
          })
          await new Promise(resolve => setTimeout(resolve, 50)) // Rapid updates
        }
      }
      
      if (onComplete) {
        onComplete('All steps completed successfully.')
      }
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

    // Verify that multiple progress steps appear
    await waitFor(() => {
      expect(screen.getByText('🚀 Starting...')).toBeInTheDocument()
    }, { timeout: 2000 })

    await waitFor(() => {
      expect(screen.getByText('�� Loading context...')).toBeInTheDocument()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(screen.getByText('🧠 Analyzing...')).toBeInTheDocument()
    }, { timeout: 4000 })

    // Verify final completion
    await waitFor(() => {
      expect(screen.getByText('All steps completed successfully.')).toBeInTheDocument()
    }, { timeout: 5000 })
  })
}) 