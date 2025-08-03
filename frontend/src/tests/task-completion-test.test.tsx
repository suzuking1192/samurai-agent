import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import TaskPanel from '../components/TaskPanel'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the API service
vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn()
}))

describe('Task Completion and Hiding', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      project_id: 'test-project',
      title: 'Active Task 1',
      description: 'This is an active task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      project_id: 'test-project',
      title: 'Completed Task',
      description: 'This task is completed',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '3',
      project_id: 'test-project',
      title: 'Active Task 2',
      description: 'Another active task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.LOW,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
  })

  test('should only display active tasks (not completed)', async () => {
    // Mock getTasks to return our test tasks
    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(mockTasks)

    render(<TaskPanel projectId="test-project" />)

    // Wait for tasks to load
    await waitFor(() => {
      // Should show only active tasks
      expect(screen.getByText('Active Task 1')).toBeInTheDocument()
      expect(screen.getByText('Active Task 2')).toBeInTheDocument()
      
      // Should NOT show completed task
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
      
      // Task count should show only active tasks (2)
      expect(screen.getByText('(2)')).toBeInTheDocument()
    })
  })

  test('should show empty state when no active tasks', async () => {
    const completedTasksOnly: Task[] = [
      {
        id: '1',
        project_id: 'test-project',
        title: 'Completed Task 1',
        description: 'This task is completed',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.MEDIUM,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue(completedTasksOnly)

    render(<TaskPanel projectId="test-project" />)

    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
      expect(screen.getByText('All caught up! Add a new task to get started.')).toBeInTheDocument()
      
      // Task count should be 0
      expect(screen.getByText('(0)')).toBeInTheDocument()
    })
  })

  test('should show empty state when no project selected', () => {
    render(<TaskPanel projectId={undefined} />)

    expect(screen.getByText('Please select a project to view tasks.')).toBeInTheDocument()
    expect(screen.getByText('(0)')).toBeInTheDocument()
  })

  test('should display empty icon in empty state', async () => {
    const { getTasks } = await import('../services/api')
    vi.mocked(getTasks).mockResolvedValue([])

    render(<TaskPanel projectId="test-project" />)

    await waitFor(() => {
      const emptyIcon = screen.getByText('✨')
      expect(emptyIcon).toBeInTheDocument()
    })
  })
}) 