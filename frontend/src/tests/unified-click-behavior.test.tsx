import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskPanel from '../components/TaskPanel'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the API services
vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  createTask: vi.fn()
}))

// Mock the hooks
vi.mock('../hooks/useTaskExpansionPersistence', () => ({
  useTaskExpansionPersistence: vi.fn(() => ({
    expandedTasks: {},
    toggleTaskExpansion: vi.fn(),
    setTaskExpanded: vi.fn(),
    isTaskExpanded: vi.fn(() => false)
  }))
}))

// Mock the utility functions
vi.mock('../utils/taskExpansionUtils', () => ({
  identifyNewTasks: vi.fn(() => []),
  getParentTasksToAutoExpand: vi.fn(() => [])
}))

const mockTasks: Task[] = [
  {
    id: 'parent-task',
    project_id: 'project-1',
    title: 'Parent Task',
    description: 'Parent task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: 'child-task',
    project_id: 'project-1',
    title: 'Child Task',
    description: 'Child task description',
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    parent_task_id: 'parent-task'
  },
  {
    id: 'standalone-task',
    project_id: 'project-1',
    title: 'Standalone Task',
    description: 'Task without parent',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z'
  }
]

describe('Unified Click Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock getTasks to return our test data
    const { getTasks } = require('../services/api')
    getTasks.mockResolvedValue(mockTasks)
  })

  it('should expand parent task when clicked', async () => {
    const mockToggleTaskExpansion = vi.fn()
    const { useTaskExpansionPersistence } = require('../hooks/useTaskExpansionPersistence')
    useTaskExpansionPersistence.mockReturnValue({
      expandedTasks: {},
      toggleTaskExpansion: mockToggleTaskExpansion,
      setTaskExpanded: vi.fn(),
      isTaskExpanded: vi.fn(() => false)
    })

    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument()
    })

    // Click on parent task
    const parentTask = screen.getByText('Parent Task')
    fireEvent.click(parentTask)

    // Should call toggleTaskExpansion for parent task
    expect(mockToggleTaskExpansion).toHaveBeenCalledWith('parent-task')
  })

  it('should open task details when standalone task is clicked', async () => {
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Standalone Task')).toBeInTheDocument()
    })

    // Click on standalone task
    const standaloneTask = screen.getByText('Standalone Task')
    fireEvent.click(standaloneTask)

    // Should navigate to task details view
    await waitFor(() => {
      expect(screen.getByText('Task Details')).toBeInTheDocument()
    })
  })

  it('should show expansion icon for parent tasks', async () => {
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument()
    })

    // Should show expansion icon (▸) for parent task
    expect(screen.getByText('▸')).toBeInTheDocument()
  })

  it('should not show expansion icon for standalone tasks', async () => {
    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Standalone Task')).toBeInTheDocument()
    })

    // Should not show expansion icon for standalone task
    const expansionIcons = screen.getAllByText('▸')
    expect(expansionIcons).toHaveLength(1) // Only for parent task
  })

  it('should show child tasks when parent is expanded', async () => {
    const { useTaskExpansionPersistence } = require('../hooks/useTaskExpansionPersistence')
    useTaskExpansionPersistence.mockReturnValue({
      expandedTasks: { 'parent-task': true },
      toggleTaskExpansion: vi.fn(),
      setTaskExpanded: vi.fn(),
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'parent-task')
    })

    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument()
    })

    // Child task should be visible when parent is expanded
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it('should open child task details when clicked', async () => {
    const { useTaskExpansionPersistence } = require('../hooks/useTaskExpansionPersistence')
    useTaskExpansionPersistence.mockReturnValue({
      expandedTasks: { 'parent-task': true },
      toggleTaskExpansion: vi.fn(),
      setTaskExpanded: vi.fn(),
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'parent-task')
    })

    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Child Task')).toBeInTheDocument()
    })

    // Click on child task
    const childTask = screen.getByText('Child Task')
    fireEvent.click(childTask)

    // Should navigate to task details view
    await waitFor(() => {
      expect(screen.getByText('Task Details')).toBeInTheDocument()
    })
  })

  it('should show collapse icon when parent task is expanded', async () => {
    const { useTaskExpansionPersistence } = require('../hooks/useTaskExpansionPersistence')
    useTaskExpansionPersistence.mockReturnValue({
      expandedTasks: { 'parent-task': true },
      toggleTaskExpansion: vi.fn(),
      setTaskExpanded: vi.fn(),
      isTaskExpanded: vi.fn((taskId: string) => taskId === 'parent-task')
    })

    render(<TaskPanel projectId="project-1" />)
    
    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument()
    })

    // Should show collapse icon (▾) for expanded parent task
    expect(screen.getByText('▾')).toBeInTheDocument()
  })
})
