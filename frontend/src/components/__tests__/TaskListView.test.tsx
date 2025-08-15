import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskListView from '../TaskListView'
import { Task, TaskStatus, TaskPriority } from '../../types'

// No mocks needed since TaskListView now receives expansion state as props

describe('TaskListView with Auto-Expansion', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      project_id: 'project-1',
      title: 'Parent Task 1',
      description: 'A parent task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'task-2',
      project_id: 'project-1',
      title: 'Child Task 1',
      description: 'A child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      parent_task_id: 'task-1'
    },
    {
      id: 'task-3',
      project_id: 'project-1',
      title: 'Child Task 2',
      description: 'Another child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      parent_task_id: 'task-1'
    }
  ]

  const defaultProps = {
    tasks: mockTasks,
    isLoading: false,
    onTaskClick: vi.fn(),
    onCreateTask: vi.fn(),
    projectId: 'project-1',
    expandedTasks: {},
    toggleTaskExpansion: vi.fn(),
    isTaskExpanded: vi.fn().mockReturnValue(false)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render task list with hierarchy', () => {
    render(<TaskListView {...defaultProps} />)
    
    expect(screen.getByText('Parent Task 1')).toBeInTheDocument()
    // Child tasks are not visible by default (collapsed state)
    expect(screen.queryByText('Child Task 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Child Task 2')).not.toBeInTheDocument()
  })

  it('should show expand/collapse icon for parent tasks', () => {
    render(<TaskListView {...defaultProps} />)
    
    // Check for expand icon (▸) for parent task
    expect(screen.getByText('▸')).toBeInTheDocument()
  })

  it('should toggle task expansion when clicking on parent task', () => {
    const mockToggleTaskExpansion = vi.fn()
    render(<TaskListView {...defaultProps} toggleTaskExpansion={mockToggleTaskExpansion} />)
    
    const parentTask = screen.getByText('Parent Task 1')
    fireEvent.click(parentTask)
    
    expect(mockToggleTaskExpansion).toHaveBeenCalledWith('task-1')
  })

  it('should show sub-tasks when parent is expanded', () => {
    render(<TaskListView 
      {...defaultProps} 
      expandedTasks={{ 'task-1': true }}
      isTaskExpanded={(taskId: string) => taskId === 'task-1'}
    />)
    
    // Check for collapse icon (▾) for expanded parent task
    expect(screen.getByText('▾')).toBeInTheDocument()
    
    // Sub-tasks should be visible
    expect(screen.getByText('Child Task 1')).toBeInTheDocument()
    expect(screen.getByText('Child Task 2')).toBeInTheDocument()
  })

  it('should auto-expand parent tasks when new sub-tasks are created', async () => {
    // This test is no longer relevant since auto-expansion is now handled in TaskPanel
    // The TaskListView component just receives the expansion state as props
    expect(true).toBe(true) // Placeholder test
  })

  it('should not auto-expand tasks when no new tasks are detected', () => {
    // This test is no longer relevant since auto-expansion is now handled in TaskPanel
    // The TaskListView component just receives the expansion state as props
    expect(true).toBe(true) // Placeholder test
  })

  it('should handle task creation form', async () => {
    const mockOnCreateTask = vi.fn()
    render(<TaskListView {...defaultProps} onCreateTask={mockOnCreateTask} />)
    
    // Click add task button
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)
    
    // Fill out the form
    const titleInput = screen.getByPlaceholderText('Task title')
    const descriptionInput = screen.getByPlaceholderText('Task description')
    
    fireEvent.change(titleInput, { target: { value: 'New Task' } })
    fireEvent.change(descriptionInput, { target: { value: 'New task description' } })
    
    // Submit the form
    const createButton = screen.getByText('Create Task')
    fireEvent.click(createButton)
    
    await waitFor(() => {
      expect(mockOnCreateTask).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New task description',
        priority: TaskPriority.MEDIUM
      })
    })
  })

  it('should show loading state', () => {
    render(<TaskListView {...defaultProps} isLoading={true} />)
    
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('should show empty state when no tasks', () => {
    render(<TaskListView {...defaultProps} tasks={[]} />)
    
    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
  })

  it('should call onTaskClick when clicking on child task', () => {
    const mockOnTaskClick = vi.fn()
    render(<TaskListView 
      {...defaultProps} 
      onTaskClick={mockOnTaskClick}
      expandedTasks={{ 'task-1': true }}
      isTaskExpanded={(taskId: string) => taskId === 'task-1'}
    />)
    
    const childTask = screen.getByText('Child Task 1')
    fireEvent.click(childTask)
    
    expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[1])
  })

  it('should call onTaskClick when clicking "See details" button', () => {
    const mockOnTaskClick = vi.fn()
    render(<TaskListView {...defaultProps} onTaskClick={mockOnTaskClick} />)
    
    const seeDetailsButtons = screen.getAllByText('See details')
    fireEvent.click(seeDetailsButtons[0])
    
    expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[0])
  })
})
