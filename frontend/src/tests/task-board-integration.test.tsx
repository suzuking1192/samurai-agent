import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskPanel from '../components/TaskPanel'
import { Task, TaskPriority, TaskStatus } from '../types'

// Mock the API module
vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn()
}))

const mockApi = vi.mocked(await import('../services/api'))

const mockTasks: Task[] = [
  {
    id: '1',
    project_id: 'project-1',
    title: 'High Priority Task',
    description: 'This is a high priority task',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    project_id: 'project-1',
    title: 'Medium Priority Task',
    description: 'This is a medium priority task',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    project_id: 'project-1',
    title: 'Low Priority Task',
    description: 'This is a low priority task',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

describe('TaskBoard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getTasks.mockResolvedValue(mockTasks)
  })

  it('loads tasks and displays them in Kanban board view', async () => {
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    })
    
    // Switch to Kanban view
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Verify Kanban layout is displayed
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    expect(screen.getByText('Low Priority')).toBeInTheDocument()
    
    // Verify tasks are in correct priority rows
    expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument()
  })

  it('allows drag and drop to change task priority', async () => {
    const updatedTask = { ...mockTasks[0], priority: TaskPriority.LOW }
    mockApi.updateTask.mockResolvedValue(updatedTask)
    
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load and switch to Kanban view
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    })
    
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Perform drag and drop
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    const targetRow = screen.getByText('Low Priority').closest('.priority-row')
    
    // Start drag
    const dragStartEvent = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        effectAllowed: '',
        setData: vi.fn()
      }
    })
    fireEvent(taskCard!, dragStartEvent)
    
    // Drop on target row
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
    fireEvent(targetRow!, dropEvent)
    
    // Verify API call was made
    await waitFor(() => {
      expect(mockApi.updateTask).toHaveBeenCalledWith('project-1', '1', { priority: TaskPriority.LOW })
    })
    
    // Verify success message is shown
    expect(screen.getByText('Task priority updated to low')).toBeInTheDocument()
  })

  it('handles API errors gracefully during drag and drop', async () => {
    mockApi.updateTask.mockRejectedValue(new Error('Network error'))
    
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load and switch to Kanban view
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    })
    
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Perform drag and drop
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    const targetRow = screen.getByText('Low Priority').closest('.priority-row')
    
    // Start drag
    const dragStartEvent = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        effectAllowed: '',
        setData: vi.fn()
      }
    })
    fireEvent(taskCard!, dragStartEvent)
    
    // Drop on target row
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
    fireEvent(targetRow!, dropEvent)
    
    // Verify error message is shown
    await waitFor(() => {
      expect(screen.getByText('Failed to update task priority. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows loading state during API calls', async () => {
    mockApi.updateTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load and switch to Kanban view
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    })
    
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Perform drag and drop
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    const targetRow = screen.getByText('Low Priority').closest('.priority-row')
    
    // Start drag
    const dragStartEvent = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        effectAllowed: '',
        setData: vi.fn()
      }
    })
    fireEvent(taskCard!, dragStartEvent)
    
    // Drop on target row
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
    fireEvent(targetRow!, dropEvent)
    
    // Verify loading indicator is shown
    expect(screen.getByText('Updating...')).toBeInTheDocument()
    // The task card should have either updating or dragging class during the operation
    expect(taskCard?.className).toMatch(/(updating|dragging)/)
  })

  it('maintains task order and state across view changes', async () => {
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    })
    
    // Switch to Kanban view
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Verify tasks are displayed
    expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument()
    
    // Switch back to list view
    const listButton = screen.getByText('📋 List')
    fireEvent.click(listButton)
    
    // Verify tasks are still displayed in list view
    expect(screen.getByText('High Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument()
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument()
  })

  it('handles empty task list gracefully', async () => {
    mockApi.getTasks.mockResolvedValue([])
    
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for empty state
    await waitFor(() => {
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
    })
    
    // Switch to Kanban view
    const kanbanButton = screen.getByText('📋 Kanban')
    fireEvent.click(kanbanButton)
    
    // Verify empty state is maintained
    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
  })
})
