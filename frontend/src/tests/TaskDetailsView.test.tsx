import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import TaskDetailsView from '../components/TaskDetailsView'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the notification function
const mockShowNotification = vi.fn()
;(global as any).showNotification = mockShowNotification

describe('TaskDetailsView', () => {
  const mockTask: Task = {
    id: '1',
    project_id: 'project-1',
    title: 'Test Task',
    description: 'This is a test task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockProps = {
    task: mockTask,
    onBack: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders task details correctly', () => {
    render(<TaskDetailsView {...mockProps} />)

    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('This is a test task description')).toBeInTheDocument()
    expect(screen.getByText(/pending/)).toBeInTheDocument()
    expect(screen.getByText(/medium/)).toBeInTheDocument()
  })

  test('renders task without description', () => {
    const taskWithoutDescription = { ...mockTask, description: '' }
    render(<TaskDetailsView {...mockProps} task={taskWithoutDescription} />)

    expect(screen.getByText('No description provided')).toBeInTheDocument()
  })

  test('back button calls onBack', () => {
    render(<TaskDetailsView {...mockProps} />)

    const backButton = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton)

    expect(mockProps.onBack).toHaveBeenCalledTimes(1)
  })

  test('edit button toggles edit mode', () => {
    render(<TaskDetailsView {...mockProps} />)

    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)

    // Should show save and cancel buttons
    expect(screen.getByText('💾 Save')).toBeInTheDocument()
    expect(screen.getByText('✖️ Cancel')).toBeInTheDocument()

    // Should show input fields
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument()
    expect(screen.getByDisplayValue('This is a test task description')).toBeInTheDocument()
  })

  test('save button calls onSave with updated data', async () => {
    render(<TaskDetailsView {...mockProps} />)

    // Enter edit mode
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)

    // Update title
    const titleInput = screen.getByDisplayValue('Test Task')
    fireEvent.change(titleInput, { target: { value: 'Updated Task Title' } })

    // Save
    const saveButton = screen.getByText('💾 Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith('1', expect.objectContaining({
        title: 'Updated Task Title',
        description: 'This is a test task description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM
      }))
    })
  })

  test('delete button shows confirmation and calls onDelete', async () => {
    // Mock window.confirm
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    // Mock onDelete to actually call onBack
    const mockOnDelete = vi.fn().mockImplementation(() => {
      mockProps.onBack()
    })

    render(<TaskDetailsView {...mockProps} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByText('🗑️ Delete')
    fireEvent.click(deleteButton)

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this task?')
    expect(mockOnDelete).toHaveBeenCalledWith('1')
    expect(mockProps.onBack).toHaveBeenCalledTimes(1)

    mockConfirm.mockRestore()
  })

  test('delete button does not call onDelete when cancelled', () => {
    // Mock window.confirm to return false
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TaskDetailsView {...mockProps} />)

    const deleteButton = screen.getByText('🗑️ Delete')
    fireEvent.click(deleteButton)

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this task?')
    expect(mockProps.onDelete).not.toHaveBeenCalled()

    mockConfirm.mockRestore()
  })

  test('copy button copies description to clipboard', async () => {
    // Mock navigator.clipboard
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
    Object.assign(navigator, { clipboard: mockClipboard })

    render(<TaskDetailsView {...mockProps} />)

    const copyButton = screen.getByText('📋 Copy Implementation Prompt')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('This is a test task description')
    })
  })

  test('copy button is disabled when no description', () => {
    const taskWithoutDescription = { ...mockTask, description: '' }
    render(<TaskDetailsView {...mockProps} task={taskWithoutDescription} />)

    const copyButton = screen.getByText('📋 Copy Implementation Prompt')
    expect(copyButton).toBeDisabled()
  })

  test('status and priority dropdowns work in edit mode', () => {
    render(<TaskDetailsView {...mockProps} />)

    // Enter edit mode
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)

    // Change status
    const statusSelect = screen.getByDisplayValue('📋 Pending')
    fireEvent.change(statusSelect, { target: { value: TaskStatus.IN_PROGRESS } })

    // Change priority
    const prioritySelect = screen.getByDisplayValue('🟡 Medium')
    fireEvent.change(prioritySelect, { target: { value: TaskPriority.HIGH } })

    // Save
    const saveButton = screen.getByText('💾 Save')
    fireEvent.click(saveButton)

    expect(mockProps.onSave).toHaveBeenCalledWith('1', expect.objectContaining({
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH
    }))
  })

  test('cancel button exits edit mode', () => {
    render(<TaskDetailsView {...mockProps} />)

    // Enter edit mode
    const editButton = screen.getByText('✏️ Edit')
    fireEvent.click(editButton)

    // Cancel
    const cancelButton = screen.getByText('✖️ Cancel')
    fireEvent.click(cancelButton)

    // Should be back to view mode
    expect(screen.getByText('✏️ Edit')).toBeInTheDocument()
    expect(screen.getByText('🗑️ Delete')).toBeInTheDocument()
    expect(screen.queryByText('💾 Save')).not.toBeInTheDocument()
    expect(screen.queryByText('✖️ Cancel')).not.toBeInTheDocument()
  })
}) 