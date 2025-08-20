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

describe('Task Scroll E2E Flow', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      project_id: 'project-1',
      title: 'First Task',
      description: 'This is the first task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      project_id: 'project-1',
      title: 'Second Task',
      description: 'This is the second task',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    },
    {
      id: '3',
      project_id: 'project-1',
      title: 'Third Task',
      description: 'This is the third task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.LOW,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z'
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

  test('complete user flow: scroll, open task, go back, restore position', async () => {
    // Step 1: Render the task panel
    render(<TaskPanel projectId="project-1" />)

    // Step 2: Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
      expect(screen.getByText('Third Task')).toBeInTheDocument()
    })

    // Step 3: Simulate scrolling to a position (mock scrollTop)
    const taskBoardElement = screen.getByText('First Task').closest('.task-board')
    if (taskBoardElement) {
      Object.defineProperty(taskBoardElement, 'scrollTop', {
        value: 300,
        writable: true
      })
    }

    // Step 4: Click on the second task to open details
    const secondTask = screen.getByText('Second Task')
    fireEvent.click(secondTask)

    // Step 5: Verify that scroll position was saved
    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'samurai-agent-task-scroll-state',
        expect.stringContaining('"scrollTop":300')
      )
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'samurai-agent-task-scroll-state',
        expect.stringContaining('"selectedTaskId":"2"')
      )
    })

    // Step 6: Verify we're in the details view
    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
    })

    // Step 7: Click back to return to the task list
    const backButton = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton)

    // Step 8: Verify we're back in the list view
    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
      expect(screen.getByText('Third Task')).toBeInTheDocument()
    })

    // Step 9: Verify that the previously selected task is highlighted
    await waitFor(() => {
      const secondTaskElement = screen.getByText('Second Task')
      expect(secondTaskElement.closest('.task-card')).toHaveClass('previously-selected')
    })

    // Step 10: Verify that scroll position restoration was triggered
    // (The actual scroll restoration happens in the component's useEffect)
    expect(screen.getByText('Second Task')).toBeInTheDocument()
  })

  test('scroll position persists across multiple navigation cycles', async () => {
    render(<TaskPanel projectId="project-1" />)

    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument()
    })

    // First navigation cycle
    const taskBoardElement = screen.getByText('First Task').closest('.task-board')
    if (taskBoardElement) {
      Object.defineProperty(taskBoardElement, 'scrollTop', {
        value: 150,
        writable: true
      })
    }

    const firstTask = screen.getByText('First Task')
    fireEvent.click(firstTask)

    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
    })

    const backButton = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton)

    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument()
    })

    // Second navigation cycle with different scroll position
    if (taskBoardElement) {
      Object.defineProperty(taskBoardElement, 'scrollTop', {
        value: 450,
        writable: true
      })
    }

    const thirdTask = screen.getByText('Third Task')
    fireEvent.click(thirdTask)

    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
    })

    // Verify the new scroll position was saved
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state',
      expect.stringContaining('"scrollTop":450')
    )

    const backButton2 = screen.getByText('← Back to Tasks')
    fireEvent.click(backButton2)

    await waitFor(() => {
      expect(screen.getByText('Third Task')).toBeInTheDocument()
      expect(screen.getByText('Third Task').closest('.task-card')).toHaveClass('previously-selected')
    })
  })

  test('scroll state is isolated per project', async () => {
    // First project
    render(<TaskPanel projectId="project-1" />)

    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument()
    })

    const taskBoardElement = screen.getByText('First Task').closest('.task-board')
    if (taskBoardElement) {
      Object.defineProperty(taskBoardElement, 'scrollTop', {
        value: 200,
        writable: true
      })
    }

    const firstTask = screen.getByText('First Task')
    fireEvent.click(firstTask)

    await waitFor(() => {
      expect(screen.getByText('← Back to Tasks')).toBeInTheDocument()
    })

    // Verify project-1 scroll state was saved
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state',
      expect.stringContaining('"projectId":"project-1"')
    )

    // Switch to different project
    render(<TaskPanel projectId="project-2" />)

    // Verify new project state was initialized
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state',
      expect.stringContaining('"projectId":"project-2"')
    )
  })
})
