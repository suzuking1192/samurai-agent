import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskListView from '../TaskListView'
import { Task, TaskStatus, TaskPriority } from '../../types'

// Mock the CompactTaskItem component
vi.mock('../CompactTaskItem', () => ({
  default: function MockCompactTaskItem({ task, hasSubtasks, isExpanded, onToggleExpansion, onTaskDetailsClick }: any) {
    return (
      <div 
        className="compact-task-item" 
        data-task-id={task.id}
        data-has-subtasks={hasSubtasks}
        data-is-expanded={isExpanded}
        onClick={() => {
          if (hasSubtasks) {
            onToggleExpansion(task.id)
          } else {
            onTaskDetailsClick(task)
          }
        }}
      >
        {task.title}
        {hasSubtasks && (
          <button 
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpansion(task.id)
            }}
            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        )}
      </div>
    )
  }
}))

const mockTasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Parent Task',
    description: 'Parent task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: 'task-2',
    project_id: 'project-1',
    title: 'Child Task 1',
    description: 'Child task description',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    parent_task_id: 'task-1'
  },
  {
    id: 'task-3',
    project_id: 'project-1',
    title: 'Child Task 2',
    description: 'Another child task',
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.LOW,
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z',
    parent_task_id: 'task-1'
  },
  {
    id: 'task-4',
    project_id: 'project-1',
    title: 'Standalone Task',
    description: 'Task without parent',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2023-01-04T00:00:00Z',
    updated_at: '2023-01-04T00:00:00Z'
  }
]

const mockProps = {
  tasks: mockTasks,
  isLoading: false,
  onTaskClick: vi.fn(),
  onCreateTask: vi.fn(),
  projectId: 'project-1',
  expandedTasks: {},
  toggleTaskExpansion: vi.fn(),
  isTaskExpanded: vi.fn(() => false)
}

describe('TaskListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task list with proper hierarchy', () => {
    render(<TaskListView {...mockProps} />)
    
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Standalone Task')).toBeInTheDocument()
  })

  it('correctly calculates hasSubtasks for parent tasks', () => {
    render(<TaskListView {...mockProps} />)
    
    const parentTask = screen.getByText('Parent Task').closest('.compact-task-item')
    expect(parentTask).toHaveAttribute('data-has-subtasks', 'true')
  })

  it('correctly calculates hasSubtasks for tasks without children', () => {
    render(<TaskListView {...mockProps} />)
    
    const standaloneTask = screen.getByText('Standalone Task').closest('.compact-task-item')
    expect(standaloneTask).toHaveAttribute('data-has-subtasks', 'false')
  })

  it('calls onToggleExpansion when parent task is clicked', () => {
    render(<TaskListView {...mockProps} />)
    
    const parentTask = screen.getByText('Parent Task').closest('.compact-task-item')
    fireEvent.click(parentTask!)
    
    expect(mockProps.toggleTaskExpansion).toHaveBeenCalledWith('task-1')
    expect(mockProps.onTaskClick).not.toHaveBeenCalled()
  })

  it('calls onTaskClick when standalone task is clicked', () => {
    render(<TaskListView {...mockProps} />)
    
    const standaloneTask = screen.getByText('Standalone Task').closest('.compact-task-item')
    fireEvent.click(standaloneTask!)
    
    expect(mockProps.onTaskClick).toHaveBeenCalledWith(mockTasks[3]) // Standalone task
    expect(mockProps.toggleTaskExpansion).not.toHaveBeenCalled()
  })

  it('shows expansion icon for parent tasks', () => {
    render(<TaskListView {...mockProps} />)
    
    const expandButton = screen.getByLabelText('Expand subtasks')
    expect(expandButton).toBeInTheDocument()
    expect(expandButton).toHaveTextContent('▸')
  })

  it('shows collapse icon when parent task is expanded', () => {
    const expandedProps = {
      ...mockProps,
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'task-1')
    }
    
    render(<TaskListView {...expandedProps} />)
    
    const collapseButton = screen.getByLabelText('Collapse subtasks')
    expect(collapseButton).toBeInTheDocument()
    expect(collapseButton).toHaveTextContent('▾')
  })

  it('expansion icon click calls toggleTaskExpansion and stops propagation', () => {
    render(<TaskListView {...mockProps} />)
    
    const expandButton = screen.getByLabelText('Expand subtasks')
    fireEvent.click(expandButton)
    
    expect(mockProps.toggleTaskExpansion).toHaveBeenCalledWith('task-1')
    // The expansion icon click should not trigger the parent div's click handler
    expect(mockProps.onTaskClick).not.toHaveBeenCalled()
  })

  it('renders child tasks when parent is expanded', () => {
    const expandedProps = {
      ...mockProps,
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'task-1')
    }
    
    render(<TaskListView {...expandedProps} />)
    
    // Child tasks should be visible when parent is expanded
    expect(screen.getByText('Child Task 1')).toBeInTheDocument()
    expect(screen.getByText('Child Task 2')).toBeInTheDocument()
  })

  it('does not render child tasks when parent is collapsed', () => {
    render(<TaskListView {...mockProps} />)
    
    // Child tasks should not be visible when parent is collapsed
    expect(screen.queryByText('Child Task 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Child Task 2')).not.toBeInTheDocument()
  })

  it('child tasks have correct hasSubtasks value', () => {
    const expandedProps = {
      ...mockProps,
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'task-1')
    }
    
    render(<TaskListView {...expandedProps} />)
    
    // Child tasks should have hasSubtasks=false since they don't have their own children
    const childTask1 = screen.getByText('Child Task 1').closest('.compact-task-item')
    const childTask2 = screen.getByText('Child Task 2').closest('.compact-task-item')
    
    expect(childTask1).toHaveAttribute('data-has-subtasks', 'false')
    expect(childTask2).toHaveAttribute('data-has-subtasks', 'false')
  })

  it('child task click calls onTaskClick', () => {
    const expandedProps = {
      ...mockProps,
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'task-1')
    }
    
    render(<TaskListView {...expandedProps} />)
    
    const childTask = screen.getByText('Child Task 1').closest('.compact-task-item')
    fireEvent.click(childTask!)
    
    expect(mockProps.onTaskClick).toHaveBeenCalledWith(mockTasks[1]) // Child Task 1
    expect(mockProps.toggleTaskExpansion).not.toHaveBeenCalled()
  })

  it('shows loading state when isLoading is true', () => {
    render(<TaskListView {...mockProps} isLoading={true} />)
    
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('shows empty state when no tasks', () => {
    render(<TaskListView {...mockProps} tasks={[]} />)
    
    expect(screen.getByText('No active tasks')).toBeInTheDocument()
    expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
  })

  it('shows create task form when add button is clicked', () => {
    render(<TaskListView {...mockProps} />)
    
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)
    
    expect(screen.getByText('Create New Task')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task description')).toBeInTheDocument()
  })

  it('creates task when form is submitted', async () => {
    render(<TaskListView {...mockProps} />)
    
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)
    
    const titleInput = screen.getByPlaceholderText('Task title')
    const descriptionInput = screen.getByPlaceholderText('Task description')
    const createButton = screen.getByText('Create Task')
    
    fireEvent.change(titleInput, { target: { value: 'New Task' } })
    fireEvent.change(descriptionInput, { target: { value: 'New description' } })
    fireEvent.click(createButton)
    
    await waitFor(() => {
      expect(mockProps.onCreateTask).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New description',
        priority: TaskPriority.MEDIUM
      })
    })
  })
})
