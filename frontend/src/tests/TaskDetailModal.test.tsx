import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import TaskDetailModal from '../components/TaskDetailModal'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the FullScreenModal component
vi.mock('../components/FullScreenModal', () => ({
  default: function MockFullScreenModal({ children, isOpen, onClose }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="fullscreen-modal">
        <button onClick={onClose} data-testid="close-button">Close</button>
        {children}
      </div>
    )
  }
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

describe('TaskDetailModal', () => {
  const mockTask: Task = {
    id: 'test-task-1',
    project_id: 'test-project-1',
    title: 'Test Task',
    description: 'This is a test task description that serves as the implementation prompt for Cursor.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockProps = {
    task: mockTask,
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders task details correctly', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('This is a test task description that serves as the implementation prompt for Cursor.')).toBeInTheDocument()
    expect(screen.getByText('📋 pending')).toBeInTheDocument()
    expect(screen.getByText('🟡 medium')).toBeInTheDocument()
  })

  test('shows implementation prompt label instead of description', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    expect(screen.getByText('Implementation Prompt:')).toBeInTheDocument()
  })

  test('shows copy to cursor button when task has description', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    expect(screen.getByText('📋 Copy to Cursor')).toBeInTheDocument()
  })

  test('does not show copy button when task has no description', () => {
    const taskWithoutDescription = { ...mockTask, description: '' }
    render(<TaskDetailModal {...mockProps} task={taskWithoutDescription} />)
    
    expect(screen.queryByText('📋 Copy to Cursor')).not.toBeInTheDocument()
  })

  test('copy to cursor button copies description to clipboard', async () => {
    render(<TaskDetailModal {...mockProps} />)
    
    const copyButton = screen.getByText('📋 Copy to Cursor')
    fireEvent.click(copyButton)
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'This is a test task description that serves as the implementation prompt for Cursor.'
      )
    })
  })

  test('does not show generate prompt button', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    expect(screen.queryByText('🤖 Generate Prompt')).not.toBeInTheDocument()
    expect(screen.queryByText('⏳ Generating...')).not.toBeInTheDocument()
  })

  test('edit mode works correctly', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)
    
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument()
    expect(screen.getByDisplayValue('This is a test task description that serves as the implementation prompt for Cursor.')).toBeInTheDocument()
    expect(screen.getByText('💾 Save')).toBeInTheDocument()
    expect(screen.getByText('✖️ Cancel')).toBeInTheDocument()
  })

  test('save functionality works', async () => {
    render(<TaskDetailModal {...mockProps} />)
    
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)
    
    const saveButton = screen.getByText('💾 Save')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith('test-task-1', {
        title: 'Test Task',
        description: 'This is a test task description that serves as the implementation prompt for Cursor.',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        due_date: ''
      })
    })
  })

  test('delete functionality works', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true)
    
    const deleteButton = screen.getByText('🗑️ Delete')
    fireEvent.click(deleteButton)
    
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this task?')
    expect(mockProps.onDelete).toHaveBeenCalledWith('test-task-1')
  })

  test('close functionality works', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    const closeButton = screen.getByTestId('close-button')
    fireEvent.click(closeButton)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  test('shows correct placeholder text in edit mode', () => {
    render(<TaskDetailModal {...mockProps} />)
    
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)
    
    const textarea = screen.getByPlaceholderText('Enter your complete implementation prompt for Cursor...')
    expect(textarea).toBeInTheDocument()
  })

  test('shows fallback text when no description provided', () => {
    const taskWithoutDescription = { ...mockTask, description: '' }
    render(<TaskDetailModal {...mockProps} task={taskWithoutDescription} />)
    
    expect(screen.getByText('No implementation prompt provided')).toBeInTheDocument()
  })
}) 