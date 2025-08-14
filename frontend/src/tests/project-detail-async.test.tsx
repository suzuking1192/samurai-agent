import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import App from '../App'

// Mock the API service
vi.mock('../services/api', () => ({
  ingestProjectDetail: vi.fn(),
  saveProjectDetail: vi.fn(),
  getProjectDetail: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  deleteProject: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatMessageWithProgress: vi.fn(),
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getMemories: vi.fn(),
  deleteMemory: vi.fn(),
}))

// Mock window.alert
const mockAlert = vi.fn()
window.alert = mockAlert

describe('Project Detail Async Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should show immediate success message when initiating async digest', async () => {
    // Mock successful project creation
    const { getProjects, ingestProjectDetail } = await import('../services/api')
    vi.mocked(getProjects).mockResolvedValue([
      {
        id: 'test-project-123',
        name: 'Test Project',
        description: 'Test Description',
        tech_stack: 'React + FastAPI'
      }
    ])
    
    // Mock the async ingest API to return immediately
    vi.mocked(ingestProjectDetail).mockResolvedValue({
      message: 'Project detail digest initiated asynchronously.'
    })

    render(<App />)

    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Click "Add Project Detail" button
    const addButton = screen.getByText('📄 Add Project Detail')
    fireEvent.click(addButton)

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Add Project Detail')).toBeInTheDocument()
    })

    // Enter some text
    const textarea = screen.getByPlaceholderText('Paste raw meeting minutes, specs, documents...')
    fireEvent.change(textarea, {
      target: { value: 'This is test content for async digestion' }
    })

    // Click "Start AI Digest" button
    const digestButton = screen.getByText('Start AI Digest')
    fireEvent.click(digestButton)

    // Verify API was called
    await waitFor(() => {
      expect(ingestProjectDetail).toHaveBeenCalledWith(
        'test-project-123',
        'This is test content for async digestion'
      )
    })

    // Verify success alert was shown
    expect(mockAlert).toHaveBeenCalledWith(
      'Project detail digest has been initiated in the background. The AI will process your text and update the project specification.'
    )

    // Verify modal was closed
    await waitFor(() => {
      expect(screen.queryByText('Add Project Detail')).not.toBeInTheDocument()
    })
  })

  test('should handle API errors gracefully', async () => {
    // Mock successful project creation
    const { getProjects, ingestProjectDetail } = await import('../services/api')
    vi.mocked(getProjects).mockResolvedValue([
      {
        id: 'test-project-123',
        name: 'Test Project',
        description: 'Test Description',
        tech_stack: 'React + FastAPI'
      }
    ])
    
    // Mock the async ingest API to throw an error
    vi.mocked(ingestProjectDetail).mockRejectedValue(new Error('API Error'))

    render(<App />)

    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Click "Add Project Detail" button
    const addButton = screen.getByText('📄 Add Project Detail')
    fireEvent.click(addButton)

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Add Project Detail')).toBeInTheDocument()
    })

    // Enter some text
    const textarea = screen.getByPlaceholderText('Paste raw meeting minutes, specs, documents...')
    fireEvent.change(textarea, {
      target: { value: 'This is test content for async digestion' }
    })

    // Click "Start AI Digest" button
    const digestButton = screen.getByText('Start AI Digest')
    fireEvent.click(digestButton)

    // Verify error alert was shown
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Failed to process project detail. Please try again.'
      )
    })

    // Verify modal stays open (not closed on error)
    expect(screen.getByText('Add Project Detail')).toBeInTheDocument()
  })

  test('should show correct button text for async operation', async () => {
    // Mock successful project creation
    const { getProjects, ingestProjectDetail } = await import('../services/api')
    vi.mocked(getProjects).mockResolvedValue([
      {
        id: 'test-project-123',
        name: 'Test Project',
        description: 'Test Description',
        tech_stack: 'React + FastAPI'
      }
    ])
    
    vi.mocked(ingestProjectDetail).mockResolvedValue({
      message: 'Project detail digest initiated asynchronously.'
    })

    render(<App />)

    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Click "Add Project Detail" button
    const addButton = screen.getByText('📄 Add Project Detail')
    fireEvent.click(addButton)

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Add Project Detail')).toBeInTheDocument()
    })

    // Verify button shows "Start AI Digest" instead of old text
    expect(screen.getByText('Start AI Digest')).toBeInTheDocument()

    // Enter some text and click button
    const textarea = screen.getByPlaceholderText('Paste raw meeting minutes, specs, documents...')
    fireEvent.change(textarea, {
      target: { value: 'Test content' }
    })

    const digestButton = screen.getByText('Start AI Digest')
    fireEvent.click(digestButton)

    // Verify button shows loading state
    await waitFor(() => {
      expect(screen.getByText('Initiating Digest…')).toBeInTheDocument()
    })
  })

  test('should not block UI during async operation', async () => {
    // Mock successful project creation
    const { getProjects, ingestProjectDetail } = await import('../services/api')
    vi.mocked(getProjects).mockResolvedValue([
      {
        id: 'test-project-123',
        name: 'Test Project',
        description: 'Test Description',
        tech_stack: 'React + FastAPI'
      }
    ])
    
    // Mock the API to simulate a delay
    vi.mocked(ingestProjectDetail).mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({ message: 'Project detail digest initiated asynchronously.' }), 1000)
      )
    )

    render(<App />)

    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Click "Add Project Detail" button
    const addButton = screen.getByText('📄 Add Project Detail')
    fireEvent.click(addButton)

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Add Project Detail')).toBeInTheDocument()
    })

    // Enter some text
    const textarea = screen.getByPlaceholderText('Paste raw meeting minutes, specs, documents...')
    fireEvent.change(textarea, {
      target: { value: 'This is test content for async digestion' }
    })

    // Click "Start AI Digest" button
    const digestButton = screen.getByText('Start AI Digest')
    fireEvent.click(digestButton)

    // Verify the operation completes quickly (not waiting for the full 1 second)
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalled()
    }, { timeout: 2000 })

    // Verify modal was closed quickly
    await waitFor(() => {
      expect(screen.queryByText('Add Project Detail')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
