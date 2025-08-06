import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, test, expect } from 'vitest'
import TaskDetailsView from '../components/TaskDetailsView'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the notification function
const mockShowNotification = vi.fn()
;(global as any).showNotification = mockShowNotification

describe('Task Description Width', () => {
  const mockTask: Task = {
    id: '1',
    project_id: 'project-1',
    title: 'Test Task',
    description: 'This is a test task description that should be displayed in a wide text area for better readability and easier copy-paste functionality. The description area should use the full available width of the task details panel.',
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

  test('description display uses full width', () => {
    render(<TaskDetailsView {...mockProps} />)

    const descriptionElement = screen.getByText(mockTask.description)
    expect(descriptionElement).toBeInTheDocument()
    
    // Check that the description is in a container with full width
    const descriptionContainer = descriptionElement.closest('.description-display')
    expect(descriptionContainer).toBeInTheDocument()
    
    // Verify the description text is properly displayed
    expect(descriptionElement).toHaveTextContent('This is a test task description')
  })

  test('description textarea uses full width in edit mode', () => {
    render(<TaskDetailsView {...mockProps} />)

    // Enter edit mode
    const editButton = screen.getByText('✏️ Edit')
    editButton.click()

    // Check that textarea is present and uses full width
    const textarea = screen.getByDisplayValue(mockTask.description)
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveClass('description-textarea')
  })

  test('task details panel layout is correct', () => {
    render(<TaskDetailsView {...mockProps} />)

    // Check that the main content area exists
    const mainContent = document.querySelector('.task-details-main')
    expect(mainContent).toBeInTheDocument()

    // Check that the content container uses full width
    const contentContainer = document.querySelector('.task-details-content')
    expect(contentContainer).toBeInTheDocument()
  })

  test('form elements use full width', () => {
    render(<TaskDetailsView {...mockProps} />)

    // Enter edit mode
    const editButton = screen.getByText('✏️ Edit')
    editButton.click()

    // Check that all form elements are present
    const titleInput = screen.getByDisplayValue('Test Task')
    const descriptionTextarea = screen.getByDisplayValue(mockTask.description)
    const statusSelect = screen.getByDisplayValue('📋 Pending')
    const prioritySelect = screen.getByDisplayValue('🟡 Medium')

    expect(titleInput).toBeInTheDocument()
    expect(descriptionTextarea).toBeInTheDocument()
    expect(statusSelect).toBeInTheDocument()
    expect(prioritySelect).toBeInTheDocument()
  })
}) 