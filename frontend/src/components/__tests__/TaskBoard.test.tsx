import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskBoard from '../TaskBoard'
import { Task, TaskPriority, TaskStatus } from '../../types'

// Mock the API module
vi.mock('../../services/api', () => ({
  updateTask: vi.fn()
}))

const mockUpdateTask = vi.mocked(await import('../../services/api')).updateTask

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
  },
  {
    id: '4',
    project_id: 'project-1',
    title: 'Completed Task',
    description: 'This task is completed',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

const defaultProps = {
  tasks: mockTasks,
  isLoading: false,
  onTaskClick: vi.fn(),
  projectId: 'project-1',
  onTaskUpdate: vi.fn()
}

describe('TaskBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders all priority rows', () => {
      render(<TaskBoard {...defaultProps} />)
      
      expect(screen.getByText('High Priority')).toBeInTheDocument()
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })

    it('displays tasks in correct priority rows', () => {
      render(<TaskBoard {...defaultProps} />)
      
      expect(screen.getByText('High Priority Task')).toBeInTheDocument()
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument()
      expect(screen.getByText('Low Priority Task')).toBeInTheDocument()
    })

    it('filters out completed tasks', () => {
      render(<TaskBoard {...defaultProps} />)
      
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
    })

    it('shows task counts in priority headers', () => {
      render(<TaskBoard {...defaultProps} />)
      
      // Should show 1 for each priority (excluding completed task)
      const countElements = screen.getAllByText('1')
      expect(countElements).toHaveLength(3) // One for each priority
    })

    it('displays empty state when no active tasks', () => {
      const emptyTasks = mockTasks.filter(task => task.status === TaskStatus.COMPLETED)
      render(<TaskBoard {...defaultProps} tasks={emptyTasks} />)
      
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
      expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
    })

    it('shows loading state', () => {
      render(<TaskBoard {...defaultProps} isLoading={true} />)
      
      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
    })
  })

  describe('Task Card Interaction', () => {
    it('calls onTaskClick when task card is clicked', () => {
      render(<TaskBoard {...defaultProps} />)
      
      fireEvent.click(screen.getByText('High Priority Task'))
      
      expect(defaultProps.onTaskClick).toHaveBeenCalledWith(mockTasks[0])
    })

    it('displays task description when available', () => {
      render(<TaskBoard {...defaultProps} />)
      
      expect(screen.getByText('This is a high priority task')).toBeInTheDocument()
    })

    it('displays task status and creation date', () => {
      render(<TaskBoard {...defaultProps} />)
      
      const statusElements = screen.getAllByText(/Status:/)
      expect(statusElements.length).toBeGreaterThan(0)
      const createdElements = screen.getAllByText(/Created:/)
      expect(createdElements.length).toBeGreaterThan(0)
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('makes task cards draggable', () => {
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      expect(taskCard).toHaveAttribute('draggable', 'true')
    })

    it('handles drag start correctly', () => {
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const dragEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      
      fireEvent(taskCard!, dragEvent)
      
      // The task card should have dragging class applied
      expect(taskCard).toHaveClass('dragging')
    })

    it('handles drag over correctly', () => {
      render(<TaskBoard {...defaultProps} />)
      
      const priorityRow = screen.getByText('Low Priority').closest('.priority-row')
      const dragOverEvent = new Event('dragover', { bubbles: true })
      Object.defineProperty(dragOverEvent, 'preventDefault', { value: vi.fn() })
      Object.defineProperty(dragOverEvent, 'dataTransfer', {
        value: { dropEffect: '' }
      })
      
      fireEvent(priorityRow!, dragOverEvent)
      
      // The priority row should have drag-over class applied
      expect(priorityRow).toHaveClass('drag-over')
    })

    it('handles drop correctly and updates task priority', async () => {
      const updatedTask = { ...mockTasks[0], priority: TaskPriority.LOW }
      mockUpdateTask.mockResolvedValue(updatedTask)
      
      render(<TaskBoard {...defaultProps} />)
      
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
      
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('project-1', '1', { priority: TaskPriority.LOW })
        expect(defaultProps.onTaskUpdate).toHaveBeenCalledWith(updatedTask)
      })
    })

    it('shows success message after successful priority update', async () => {
      const updatedTask = { ...mockTasks[0], priority: TaskPriority.LOW }
      mockUpdateTask.mockResolvedValue(updatedTask)
      
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const targetRow = screen.getByText('Low Priority').closest('.priority-row')
      
      // Start drag and drop
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      fireEvent(taskCard!, dragStartEvent)
      
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
      fireEvent(targetRow!, dropEvent)
      
      await waitFor(() => {
        expect(screen.getByText('Task priority updated to low')).toBeInTheDocument()
      })
    })

    it('shows error message when priority update fails', async () => {
      mockUpdateTask.mockRejectedValue(new Error('Update failed'))
      
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const targetRow = screen.getByText('Low Priority').closest('.priority-row')
      
      // Start drag and drop
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      fireEvent(taskCard!, dragStartEvent)
      
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
      fireEvent(targetRow!, dropEvent)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to update task priority. Please try again.')).toBeInTheDocument()
      })
    })

    it('does not update when dropping on same priority', async () => {
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const targetRow = screen.getByText('High Priority').closest('.priority-row')
      
      // Start drag and drop on same priority
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      fireEvent(taskCard!, dragStartEvent)
      
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
      fireEvent(targetRow!, dropEvent)
      
      // Should not call updateTask
      expect(mockUpdateTask).not.toHaveBeenCalled()
    })

    it('shows updating indicator during API call', async () => {
      mockUpdateTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<TaskBoard {...defaultProps} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const targetRow = screen.getByText('Low Priority').closest('.priority-row')
      
      // Start drag and drop
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      fireEvent(taskCard!, dragStartEvent)
      
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
      fireEvent(targetRow!, dropEvent)
      
      // Should show updating indicator
      expect(screen.getByText('Updating...')).toBeInTheDocument()
      expect(taskCard).toHaveClass('updating')
    })
  })

  describe('Visual Feedback', () => {
    it('applies correct colors for different priorities', () => {
      render(<TaskBoard {...defaultProps} />)
      
      const highPriorityRow = screen.getByText('High Priority').closest('.priority-row')
      const mediumPriorityRow = screen.getByText('Medium Priority').closest('.priority-row')
      const lowPriorityRow = screen.getByText('Low Priority').closest('.priority-row')
      
      expect(highPriorityRow).toHaveAttribute('data-priority', 'high')
      expect(mediumPriorityRow).toHaveAttribute('data-priority', 'medium')
      expect(lowPriorityRow).toHaveAttribute('data-priority', 'low')
    })

    it('shows empty state for priority rows with no tasks', () => {
      const singleTask = [mockTasks[0]] // Only high priority task
      render(<TaskBoard {...defaultProps} tasks={singleTask} />)
      
      const noTasksElements = screen.getAllByText('No tasks')
      expect(noTasksElements.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('handles missing projectId gracefully', () => {
      render(<TaskBoard {...defaultProps} projectId={undefined} />)
      
      const taskCard = screen.getByText('High Priority Task').closest('.task-card')
      const targetRow = screen.getByText('Low Priority').closest('.priority-row')
      
      // Start drag and drop
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: {
          effectAllowed: '',
          setData: vi.fn()
        }
      })
      fireEvent(taskCard!, dragStartEvent)
      
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() })
      fireEvent(targetRow!, dropEvent)
      
      // Should not call updateTask when projectId is missing
      expect(mockUpdateTask).not.toHaveBeenCalled()
    })
  })
})
