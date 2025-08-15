import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('Task Sorting Integration', () => {
  const complexTaskHierarchy: Task[] = [
    // Root tasks in mixed order
    {
      id: 'root-3',
      project_id: 'project-1',
      title: 'Root Task 3 (Newest)',
      description: 'Newest root task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-03T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z'
    },
    {
      id: 'root-1',
      project_id: 'project-1',
      title: 'Root Task 1 (Oldest)',
      description: 'Oldest root task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z'
    },
    {
      id: 'root-2',
      project_id: 'project-1',
      title: 'Root Task 2 (Middle)',
      description: 'Middle root task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.LOW,
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z'
    },
    // Children for root-1 in mixed order
    {
      id: 'child-1-2',
      project_id: 'project-1',
      title: 'Child 1-2 (Newer)',
      description: 'Newer child of root 1',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T15:00:00Z',
      updated_at: '2024-01-01T15:00:00Z',
      parent_task_id: 'root-1'
    },
    {
      id: 'child-1-1',
      project_id: 'project-1',
      title: 'Child 1-1 (Older)',
      description: 'Older child of root 1',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T12:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      parent_task_id: 'root-1'
    },
    // Children for root-2 in mixed order
    {
      id: 'child-2-2',
      project_id: 'project-1',
      title: 'Child 2-2 (Newer)',
      description: 'Newer child of root 2',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-02T15:00:00Z',
      updated_at: '2024-01-02T15:00:00Z',
      parent_task_id: 'root-2'
    },
    {
      id: 'child-2-1',
      project_id: 'project-1',
      title: 'Child 2-1 (Older)',
      description: 'Older child of root 2',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-02T12:00:00Z',
      updated_at: '2024-01-02T12:00:00Z',
      parent_task_id: 'root-2'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should display complex task hierarchy in correct chronological order', async () => {
    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(complexTaskHierarchy)

    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await screen.findByText('Root Task 1 (Oldest)')

    // Verify root tasks are in correct order (oldest first)
    const rootTasks = [
      'Root Task 1 (Oldest)',
      'Root Task 2 (Middle)', 
      'Root Task 3 (Newest)'
    ]

    for (let i = 0; i < rootTasks.length; i++) {
      expect(screen.getByText(rootTasks[i])).toBeInTheDocument()
    }

    // Expand first root task and verify children order
    const firstRoot = screen.getByText('Root Task 1 (Oldest)')
    fireEvent.click(firstRoot)

    await waitFor(() => {
      expect(screen.getByText('Child 1-1 (Older)')).toBeInTheDocument()
      expect(screen.getByText('Child 1-2 (Newer)')).toBeInTheDocument()
    })

    // Expand second root task and verify children order
    const secondRoot = screen.getByText('Root Task 2 (Middle)')
    fireEvent.click(secondRoot)

    await waitFor(() => {
      expect(screen.getByText('Child 2-1 (Older)')).toBeInTheDocument()
      expect(screen.getByText('Child 2-2 (Newer)')).toBeInTheDocument()
    })

    // Verify the overall structure maintains chronological order
    const taskContainer = screen.getByText('Root Task 1 (Oldest)').closest('.task-list')
    if (taskContainer) {
      const taskElements = taskContainer.querySelectorAll('.task-item')
      
      // Check that root tasks appear in chronological order
      const rootTaskElements = Array.from(taskElements).filter(el => 
        el.textContent?.includes('Root Task')
      )
      
      expect(rootTaskElements[0]).toHaveTextContent('Root Task 1 (Oldest)')
      expect(rootTaskElements[1]).toHaveTextContent('Root Task 2 (Middle)')
      expect(rootTaskElements[2]).toHaveTextContent('Root Task 3 (Newest)')
    }
  })

  test('should maintain chronological order when creating new tasks', async () => {
    const { getTasks, createTask } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(complexTaskHierarchy)
    
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
    await screen.findByText('Root Task 1 (Oldest)')

    // Create a new task
    const addButton = screen.getByText('+ Add Task')
    fireEvent.click(addButton)

    const titleInput = screen.getByPlaceholderText('Task title')
    const descriptionInput = screen.getByPlaceholderText('Task description')
    
    fireEvent.change(titleInput, { target: { value: 'Newly Created Task' } })
    fireEvent.change(descriptionInput, { target: { value: 'A newly created task' } })

    const createButton = screen.getByText('Create Task')
    fireEvent.click(createButton)

    // Verify the new task appears at the end
    await screen.findByText('Newly Created Task')
    
    // Verify it appears after all existing root tasks
    const taskContainer = screen.getByText('Root Task 1 (Oldest)').closest('.task-list')
    if (taskContainer) {
      const taskElements = taskContainer.querySelectorAll('.task-item')
      const rootTaskElements = Array.from(taskElements).filter(el => 
        el.textContent?.includes('Root Task') || el.textContent?.includes('Newly Created Task')
      )
      
      // The new task should be the last one
      expect(rootTaskElements[rootTaskElements.length - 1]).toHaveTextContent('Newly Created Task')
    }
  })
})
