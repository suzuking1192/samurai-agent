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
  },
  {
    id: 'task-2',
    project_id: 'project-1',
    title: 'Test Task 2',
    description: 'Test description 2',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z'
  },
  {
    id: 'task-3',
    project_id: 'project-1',
    title: 'Test Task 3',
    description: 'Test description 3',
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z'
  }
]

const defaultProps = {
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

describe('TaskBoard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Mock scroll position persistence
    const mockSaveScrollPosition = vi.fn()
    const mockGetScrollPosition = vi.fn(() => ({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-1'
    }))
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: { scrollTop: 0, selectedTaskId: null, projectId: 'project-1' },
      saveScrollPosition: mockSaveScrollPosition,
      getScrollPosition: mockGetScrollPosition,
      clearScrollState: vi.fn()
    })
  })

  it('renders task board with tasks', () => {
    render(<TaskBoard {...defaultProps} />)
    
    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    expect(screen.getByText('Test Task 2')).toBeInTheDocument()
    expect(screen.getByText('Test Task 3')).toBeInTheDocument()
  })

  it('captures scroll position when task is clicked', async () => {
    const mockSaveScrollPosition = vi.fn()
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: { scrollTop: 0, selectedTaskId: null, projectId: 'project-1' },
      saveScrollPosition: mockSaveScrollPosition,
      getScrollPosition: vi.fn(),
      clearScrollState: vi.fn()
    })

    render(<TaskBoard {...defaultProps} />)
    
    const taskCard = screen.getByText('Test Task 1').closest('.task-card')
    expect(taskCard).toBeInTheDocument()
    
    fireEvent.click(taskCard!)
    
    expect(defaultProps.onTaskClick).toHaveBeenCalledWith(mockTasks[0])
    expect(mockSaveScrollPosition).toHaveBeenCalledWith(0, 'task-1')
  })

  it('restores scroll position when returning from detail view', async () => {
    const mockScrollState = {
      scrollTop: 150,
      selectedTaskId: 'task-2',
      projectId: 'project-1'
    }
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: vi.fn(),
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = mockScrollIntoView

    render(<TaskBoard {...defaultProps} shouldRestoreScroll={true} />)
    
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      })
    })
  })

  it('highlights previously selected task when returning from detail view', async () => {
    const mockScrollState = {
      scrollTop: 150,
      selectedTaskId: 'task-2',
      projectId: 'project-1'
    }
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: vi.fn(),
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    render(<TaskBoard {...defaultProps} shouldRestoreScroll={true} />)
    
    const taskElement = screen.getByText('Test Task 2').closest('[data-task-id="task-2"]')
    expect(taskElement).toBeInTheDocument()
    
    await waitFor(() => {
      expect(taskElement).toHaveClass('previously-selected')
    })
  })

  it('handles task click with scroll position capture', async () => {
    const mockSaveScrollPosition = vi.fn()
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: { scrollTop: 0, selectedTaskId: null, projectId: 'project-1' },
      saveScrollPosition: mockSaveScrollPosition,
      getScrollPosition: vi.fn(),
      clearScrollState: vi.fn()
    })

    render(<TaskBoard {...defaultProps} />)
    
    const taskCard = screen.getByText('Test Task 2').closest('.task-card')
    fireEvent.click(taskCard!)
    
    expect(mockSaveScrollPosition).toHaveBeenCalledWith(0, 'task-2')
    expect(defaultProps.onTaskClick).toHaveBeenCalledWith(mockTasks[1])
  })

  it('does not restore scroll position when scrollTop is 0', async () => {
    const mockScrollState = {
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-1'
    }
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: vi.fn(),
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = mockScrollIntoView

    render(<TaskBoard {...defaultProps} shouldRestoreScroll={true} />)
    
    expect(mockScrollIntoView).not.toHaveBeenCalled()
  })

  it('handles missing task element gracefully', async () => {
    const mockScrollState = {
      scrollTop: 150,
      selectedTaskId: 'non-existent-task',
      projectId: 'project-1'
    }
    
    const { useTaskScrollPersistence } = await import('../../hooks/useTaskScrollPersistence')
    vi.mocked(useTaskScrollPersistence).mockReturnValue({
      scrollState: mockScrollState,
      saveScrollPosition: vi.fn(),
      getScrollPosition: vi.fn(() => mockScrollState),
      clearScrollState: vi.fn()
    })

    // Mock querySelector to return null
    const originalQuerySelector = document.querySelector
    document.querySelector = vi.fn(() => null)

    render(<TaskBoard {...defaultProps} shouldRestoreScroll={true} />)
    
    // Should not throw an error
    await waitFor(() => {
      expect(document.querySelector).toHaveBeenCalledWith('[data-task-id="non-existent-task"]')
    })

    // Restore original querySelector
    document.querySelector = originalQuerySelector
  })
})
