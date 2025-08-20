import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskBoard from '../TaskBoard'
import { Task, TaskPriority, TaskStatus } from '../../types'

// Mock the hooks
vi.mock('../../hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    cleanup: vi.fn()
  })
}))

vi.mock('../../hooks/useTaskScrollPersistence', () => ({
  useTaskScrollPersistence: vi.fn()
}))

// Mock the API functions
vi.mock('../../services/api', () => ({
  updateTask: vi.fn(),
  createTask: vi.fn()
}))

const mockTasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Test Task 1',
    description: 'Test description 1',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  }
]

describe('Scroll Restoration Manual Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should restore scroll position when shouldRestoreScroll is true', async () => {
    const mockScrollState = {
      scrollTop: 200,
      selectedTaskId: 'task-1',
      projectId: 'project-1'
    }
    
    const mockSaveScrollPosition = vi.fn()
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: mockSaveScrollPosition,
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = mockScrollIntoView

    const props = {
      tasks: mockTasks,
      isLoading: false,
      onTaskClick: vi.fn(),
      projectId: 'project-1',
      onTaskUpdate: vi.fn(),
      onCreateTask: vi.fn(),
      expandedTasks: {},
      toggleTaskExpansion: vi.fn(),
      isTaskExpanded: vi.fn(() => false),
      selectedTask: null,
      shouldRestoreScroll: true
    }

    render(<TaskBoard {...props} />)
    
    // Verify that scroll restoration was triggered
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      })
    })
  })

  it('should NOT restore scroll position when shouldRestoreScroll is false', async () => {
    const mockScrollState = {
      scrollTop: 200,
      selectedTaskId: 'task-1',
      projectId: 'project-1'
    }
    
    const mockSaveScrollPosition = vi.fn()
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: mockSaveScrollPosition,
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = mockScrollIntoView

    const props = {
      tasks: mockTasks,
      isLoading: false,
      onTaskClick: vi.fn(),
      projectId: 'project-1',
      onTaskUpdate: vi.fn(),
      onCreateTask: vi.fn(),
      expandedTasks: {},
      toggleTaskExpansion: vi.fn(),
      isTaskExpanded: vi.fn(() => false),
      selectedTask: null,
      shouldRestoreScroll: false
    }

    render(<TaskBoard {...props} />)
    
    // Verify that scroll restoration was NOT triggered
    expect(mockScrollIntoView).not.toHaveBeenCalled()
  })
})
