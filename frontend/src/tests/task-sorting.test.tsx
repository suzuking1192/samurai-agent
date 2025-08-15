import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import TaskPanel from '../components/TaskPanel'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the API service
vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn()
}))

describe('Task Sorting', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-3',
      project_id: 'project-1',
      title: 'Newest Task',
      description: 'This is the newest task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-03T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z'
    },
    {
      id: 'task-1',
      project_id: 'project-1',
      title: 'Oldest Task',
      description: 'This is the oldest task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'task-2',
      project_id: 'project-1',
      title: 'Middle Task',
      description: 'This is the middle task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.LOW,
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z'
    }
  ]

  const mockTasksWithChildren: Task[] = [
    {
      id: 'parent-1',
      project_id: 'project-1',
      title: 'Parent Task',
      description: 'Parent task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'child-2',
      project_id: 'project-1',
      title: 'Newer Child',
      description: 'Newer child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-03T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z',
      parent_task_id: 'parent-1'
    },
    {
      id: 'child-1',
      project_id: 'project-1',
      title: 'Older Child',
      description: 'Older child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z',
      parent_task_id: 'parent-1'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should sort root tasks by creation date in ascending order (oldest first)', async () => {
    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(mockTasks)

    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await screen.findByText('Oldest Task')

    // Verify tasks are displayed in correct order (oldest first)
    // Use more specific selectors to avoid the "Add Task" button
    const oldestTask = screen.getByText('Oldest Task')
    const middleTask = screen.getByText('Middle Task')
    const newestTask = screen.getByText('Newest Task')
    
    // Check that they appear in the correct order in the DOM
    const taskContainer = screen.getByText('Oldest Task').closest('.task-list')
    if (taskContainer) {
      const taskElements = taskContainer.querySelectorAll('.task-item')
      expect(taskElements[0]).toHaveTextContent('Oldest Task')
      expect(taskElements[1]).toHaveTextContent('Middle Task')
      expect(taskElements[2]).toHaveTextContent('Newest Task')
    }
  })

  test('should sort child tasks by creation date in ascending order (oldest first)', async () => {
    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(mockTasksWithChildren)

    render(<TaskPanel projectId="project-1" />)

    // Wait for parent task to load
    await screen.findByText('Parent Task')

    // Click on parent to expand children
    const parentTask = screen.getByText('Parent Task')
    fireEvent.click(parentTask)

    // Wait for children to be visible
    await screen.findByText('Older Child')
    await screen.findByText('Newer Child')

    // Verify children are displayed in correct order (oldest first)
    // Use more specific selectors to get child tasks only
    const olderChild = screen.getByText('Older Child')
    const newerChild = screen.getByText('Newer Child')
    
    // Check that they appear in the correct order in the DOM
    const taskContainer = screen.getByText('Parent Task').closest('.task-list')
    if (taskContainer) {
      const childElements = taskContainer.querySelectorAll('.task-item')
      const childTaskElements = Array.from(childElements).filter(el => 
        el.textContent?.includes('Child')
      )
      expect(childTaskElements[0]).toHaveTextContent('Older Child')
      expect(childTaskElements[1]).toHaveTextContent('Newer Child')
    }
  })

  test('should add new tasks to the end of the list', async () => {
    const { getTasks, createTask } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(mockTasks)
    
    const newTask: Task = {
      id: 'new-task',
      project_id: 'project-1',
      title: 'Newly Created Task',
      description: 'A newly created task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-04T10:00:00Z',
      updated_at: '2024-01-04T10:00:00Z'
    }
    vi.mocked(createTask).mockResolvedValue(newTask)

    render(<TaskPanel projectId="project-1" />)

    // Wait for initial tasks to load
    await screen.findByText('Oldest Task')

    // Simulate creating a new task
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    // Fill in the form
    const titleInput = screen.getByPlaceholderText('Task title')
    const descriptionInput = screen.getByPlaceholderText('Task description')
    
    fireEvent.change(titleInput, { target: { value: 'Newly Created Task' } })
    fireEvent.change(descriptionInput, { target: { value: 'A newly created task' } })

    // Submit the form
    const createButton = screen.getByText('Create Task')
    fireEvent.click(createButton)

    // Verify the new task appears at the end of the list
    await screen.findByText('Newly Created Task')
    
    // Check that the new task appears at the end
    const taskContainer = screen.getByText('Oldest Task').closest('.task-list')
    if (taskContainer) {
      const taskElements = taskContainer.querySelectorAll('.task-item')
      const lastTask = taskElements[taskElements.length - 1]
      expect(lastTask).toHaveTextContent('Newly Created Task')
    }
  })
})
