import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CompactTaskItem from '../CompactTaskItem'
import { Task, TaskStatus, TaskPriority } from '../../types'

// Mock task data
const mockTask: Task = {
  id: 'task-1',
  project_id: 'project-1',
  title: 'Test Task',
  description: 'Test description',
  status: TaskStatus.PENDING,
  priority: TaskPriority.MEDIUM,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
}

const mockTaskWithSubtasks: Task = {
  ...mockTask,
  id: 'task-2',
  title: 'Parent Task'
}

const mockProps = {
  task: mockTask,
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onTaskClick: vi.fn(),
  hasSubtasks: false,
  isExpanded: false,
  onToggleExpansion: vi.fn(),
  onTaskDetailsClick: vi.fn()
}

describe('CompactTaskItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task title and description', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('calls onTaskDetailsClick when task without subtasks is clicked', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={false} />)
    
    const taskItem = screen.getByText('Test Task').closest('.compact-task-item')
    fireEvent.click(taskItem!)
    
    expect(mockProps.onTaskDetailsClick).toHaveBeenCalledWith(mockTask)
    expect(mockProps.onToggleExpansion).not.toHaveBeenCalled()
  })

  it('calls onToggleExpansion when task with subtasks is clicked', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={true} />)
    
    const taskItem = screen.getByText('Test Task').closest('.compact-task-item')
    fireEvent.click(taskItem!)
    
    expect(mockProps.onToggleExpansion).toHaveBeenCalledWith(mockTask.id)
    expect(mockProps.onTaskDetailsClick).not.toHaveBeenCalled()
  })

  it('shows expansion icon for tasks with subtasks', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={true} />)
    
    const expansionIcon = screen.getByLabelText('Expand subtasks')
    expect(expansionIcon).toBeInTheDocument()
    expect(expansionIcon).toHaveTextContent('▸')
  })

  it('shows collapse icon when task is expanded', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={true} isExpanded={true} />)
    
    const collapseIcon = screen.getByLabelText('Collapse subtasks')
    expect(collapseIcon).toBeInTheDocument()
    expect(collapseIcon).toHaveTextContent('▾')
  })

  it('does not show expansion icon for tasks without subtasks', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={false} />)
    
    expect(screen.queryByLabelText(/Expand subtasks|Collapse subtasks/)).not.toBeInTheDocument()
  })

  it('expansion icon click calls onToggleExpansion and stops propagation', () => {
    render(<CompactTaskItem {...mockProps} hasSubtasks={true} />)
    
    const expansionIcon = screen.getByLabelText('Expand subtasks')
    fireEvent.click(expansionIcon)
    
    expect(mockProps.onToggleExpansion).toHaveBeenCalledWith(mockTask.id)
    // The expansion icon click should not trigger the parent div's click handler
    expect(mockProps.onTaskDetailsClick).not.toHaveBeenCalled()
  })

  it('renders status and priority icons', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    // Status icon (pending)
    expect(screen.getByText('⏳')).toBeInTheDocument()
    // Priority icon (medium)
    expect(screen.getByText('🟡')).toBeInTheDocument()
  })

  it('renders formatted date', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    // Should show the formatted date - the actual format depends on the date
    expect(screen.getByText(/Today|Yesterday|\d+ days ago|\d+\/\d+\/\d{4}/)).toBeInTheDocument()
  })

  it('shows actions on hover', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    const taskItem = screen.getByText('Test Task').closest('.compact-task-item')
    
    // Actions should not be visible initially
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    
    // Hover to show actions
    fireEvent.mouseEnter(taskItem!)
    
    // Actions should now be visible
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByTitle('Delete task')).toBeInTheDocument()
  })

  it('status change calls onUpdate', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    const taskItem = screen.getByText('Test Task').closest('.compact-task-item')
    fireEvent.mouseEnter(taskItem!)
    
    const statusSelect = screen.getByDisplayValue('Pending')
    fireEvent.change(statusSelect, { target: { value: TaskStatus.IN_PROGRESS } })
    
    expect(mockProps.onUpdate).toHaveBeenCalledWith(mockTask.id, { status: TaskStatus.IN_PROGRESS })
  })

  it('delete button calls onDelete', () => {
    render(<CompactTaskItem {...mockProps} />)
    
    const taskItem = screen.getByText('Test Task').closest('.compact-task-item')
    fireEvent.mouseEnter(taskItem!)
    
    const deleteButton = screen.getByTitle('Delete task')
    fireEvent.click(deleteButton)
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(mockTask.id)
  })
})
