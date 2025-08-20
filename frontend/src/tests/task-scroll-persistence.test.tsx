import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import TaskPanel from '../components/TaskPanel'
import { Task, TaskStatus, TaskPriority } from '../types'

vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  createTask: vi.fn(),
  setTaskContext: vi.fn(),
  getCurrentSession: vi.fn()
}))

// Import the mocked functions
import { getTasks, updateTask, deleteTask, completeTask, createTask } from '../services/api'

// Cast to mocked functions
const mockGetTasks = getTasks as any
const mockUpdateTask = updateTask as any
const mockDeleteTask = deleteTask as any
const mockCompleteTask = completeTask as any
const mockCreateTask = createTask as any

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
})

describe('Task Scroll Persistence', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTasks.mockResolvedValue(mockTasks)
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('saves scroll position when navigating to task details', async () => {
    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    })

    // Mock scroll position
    const taskBoardElement = screen.getByText('Test Task 1').closest('.task-board')
    if (taskBoardElement) {
      Object.defineProperty(taskBoardElement, 'scrollTop', {
        value: 150,
        writable: true
      })
    }

    // Click on a task to navigate to details
    const taskElement = screen.getByText('Test Task 1')
    fireEvent.click(taskElement)

    // Verify that scroll position was saved to sessionStorage
    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'samurai-agent-task-scroll-state',
        expect.stringContaining('"scrollTop":150')
      )
    })
  })

  test('restores scroll position when returning from task details', async () => {
    // Mock saved scroll state
    const savedScrollState = {
      scrollTop: 200,
      selectedTaskId: '1',
      projectId: 'project-1'
    }
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedScrollState))

    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    })

    // Navigate to task details
    const taskElement = screen.getByText('Test Task 1')
    fireEvent.click(taskElement)

    // Wait for details view to appear
    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
    })

    // Click back to list
    const backButton = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton)

    // Verify that scroll position restoration was triggered
    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    })
  })

  test('highlights previously selected task when returning to list', async () => {
    // Mock saved scroll state with selected task
    const savedScrollState = {
      scrollTop: 100,
      selectedTaskId: '2',
      projectId: 'project-1'
    }
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedScrollState))

    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Test Task 2')).toBeInTheDocument()
    })

    // Navigate to task details
    const taskElement = screen.getByText('Test Task 2')
    fireEvent.click(taskElement)

    // Wait for details view to appear
    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
    })

    // Click back to list
    const backButton = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton)

    // Verify that the previously selected task is highlighted
    await waitFor(() => {
      const taskElement = screen.getByText('Test Task 2')
      expect(taskElement.closest('.task-card')).toHaveClass('previously-selected')
    })
  })

  test('clears scroll state when project changes', async () => {
    render(<TaskPanel projectId="project-1" />)

    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    })

    // Change project
    render(<TaskPanel projectId="project-2" />)

    // Verify that sessionStorage was cleared for the new project
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state',
      expect.stringContaining('"projectId":"project-2"')
    )
  })
})
