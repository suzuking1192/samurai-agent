import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import TaskListView from '../components/TaskListView'
import { Task, TaskStatus, TaskPriority } from '../types'

describe('TaskListView', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      project_id: 'project-1',
      title: 'Test Task 1',
      description: 'This is test task 1 description',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      project_id: 'project-1',
      title: 'Test Task 2',
      description: 'This is test task 2 description',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    }
  ]

  const mockProps = {
    tasks: mockTasks,
    isLoading: false,
    onTaskClick: vi.fn(),
    onCreateTask: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders task list correctly', () => {
    render(<TaskListView {...mockProps} />)

    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    expect(screen.getByText('Test Task 2')).toBeInTheDocument()
    expect(screen.getByText('This is test task 1 description')).toBeInTheDocument()
    expect(screen.getByText('This is test task 2 description')).toBeInTheDocument()
  })

  test('shows loading indicator when loading', () => {
    render(<TaskListView {...mockProps} isLoading={true} />)

    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  test('shows empty state when no tasks', () => {
    render(<TaskListView {...mockProps} tasks={[]} />)

    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
  })

  test('filters out completed tasks', () => {
    const tasksWithCompleted = [
      ...mockTasks,
      {
        id: '3',
        project_id: 'project-1',
        title: 'Completed Task',
        description: 'This task is completed',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.LOW,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z'
      }
    ]

    render(<TaskListView {...mockProps} tasks={tasksWithCompleted} />)

    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    expect(screen.getByText('Test Task 2')).toBeInTheDocument()
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
  })

  test('task click calls onTaskClick', () => {
    render(<TaskListView {...mockProps} />)

    const firstTask = screen.getByText('Test Task 1')
    fireEvent.click(firstTask)

    expect(mockProps.onTaskClick).toHaveBeenCalledWith(mockTasks[0])
  })

  test('shows create task form when add button is clicked', () => {
    render(<TaskListView {...mockProps} />)

    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    expect(screen.getByText('Create New Task')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task description')).toBeInTheDocument()
  })

  test('creates task when form is submitted', async () => {
    render(<TaskListView {...mockProps} />)

    // Open create form
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    // Fill form
    const titleInput = screen.getByPlaceholderText('Task title')
    const descriptionInput = screen.getByPlaceholderText('Task description')
    const prioritySelect = screen.getByDisplayValue('Medium Priority')

    fireEvent.change(titleInput, { target: { value: 'New Task' } })
    fireEvent.change(descriptionInput, { target: { value: 'New task description' } })
    fireEvent.change(prioritySelect, { target: { value: TaskPriority.HIGH } })

    // Submit form
    const createButton = screen.getByText('Create Task')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(mockProps.onCreateTask).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New task description',
        priority: TaskPriority.HIGH
      })
    })
  })

  test('create button is disabled when title is empty', () => {
    render(<TaskListView {...mockProps} />)

    // Open create form
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    const createButton = screen.getByText('Create Task')
    expect(createButton).toBeDisabled()
  })

  test('cancel button closes create form', () => {
    render(<TaskListView {...mockProps} />)

    // Open create form
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    // Cancel
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    // Should be back to add button
    expect(screen.getByText('+ Add Task')).toBeInTheDocument()
    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
  })

  test('form resets after successful creation', async () => {
    render(<TaskListView {...mockProps} />)

    // Open create form
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    // Fill and submit form
    const titleInput = screen.getByPlaceholderText('Task title')
    fireEvent.change(titleInput, { target: { value: 'New Task' } })

    const createButton = screen.getByText('Create Task')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(mockProps.onCreateTask).toHaveBeenCalled()
    })

    // Form should be closed
    expect(screen.getByText('+ Add Task')).toBeInTheDocument()
  })

  test('truncates long descriptions', () => {
    const taskWithLongDescription = {
      ...mockTasks[0],
      description: 'This is a very long description that should be truncated when it exceeds sixty characters in length'
    }

    render(<TaskListView {...mockProps} tasks={[taskWithLongDescription]} />)

    expect(screen.getByText('This is a very long description that should be truncated whe...')).toBeInTheDocument()
  })

  test('shows task date correctly', () => {
    render(<TaskListView {...mockProps} />)

    // Should show actual dates since the mock dates are from 2024
    expect(screen.getByText('12/31/2023')).toBeInTheDocument()
    expect(screen.getByText('1/1/2024')).toBeInTheDocument()
  })
}) 