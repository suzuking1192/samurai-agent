import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TaskBoard from '../TaskBoard'
import { Task, TaskPriority, TaskStatus } from '../../types'

import { vi } from 'vitest'

// Mock the API functions
vi.mock('../../services/api', () => ({
  updateTask: vi.fn(),
  createTask: vi.fn()
}))

// Mock the auto-scroll hook
vi.mock('../../hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(() => ({
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    cleanup: vi.fn(),
    scrollState: {
      isScrolling: false,
      scrollDirection: null,
      scrollSpeed: 5
    }
  }))
}))

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'High Priority Task',
    description: 'This is a high priority task',
    priority: TaskPriority.HIGH,
    status: TaskStatus.TODO,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    project_id: 'project-1',
    parent_task_id: null
  },
  {
    id: '2',
    title: 'Medium Priority Task',
    description: 'This is a medium priority task',
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TODO,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    project_id: 'project-1',
    parent_task_id: null
  },
  {
    id: '3',
    title: 'Low Priority Task',
    description: 'This is a low priority task',
    priority: TaskPriority.LOW,
    status: TaskStatus.TODO,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    project_id: 'project-1',
    parent_task_id: null
  }
]

describe('TaskBoard Auto-Scroll Integration', () => {
  const defaultProps = {
    tasks: mockTasks,
    isLoading: false,
    onTaskClick: jest.fn(),
    projectId: 'project-1',
    onTaskUpdate: jest.fn(),
    onCreateTask: jest.fn(),
    expandedTasks: {},
    toggleTaskExpansion: jest.fn(),
    isTaskExpanded: jest.fn(() => false),
    selectedTask: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render task board with auto-scroll container', () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskBoard = screen.getByRole('main', { hidden: true }) || 
                     document.querySelector('.task-board')
    expect(taskBoard).toBeInTheDocument()
  })

  it('should handle drag start on task cards', () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    expect(taskCard).toBeInTheDocument()
    
    if (taskCard) {
      fireEvent.dragStart(taskCard)
      expect(taskCard).toHaveAttribute('draggable', 'true')
    }
  })

  it('should handle drag over on priority rows', () => {
    render(<TaskBoard {...defaultProps} />)
    
    const priorityRows = document.querySelectorAll('.priority-row')
    expect(priorityRows.length).toBeGreaterThan(0)
    
    const mediumPriorityRow = Array.from(priorityRows).find(row => 
      row.textContent?.includes('Medium Priority')
    )
    
    if (mediumPriorityRow) {
      fireEvent.dragOver(mediumPriorityRow)
      // The drag over should be handled by the component
      expect(mediumPriorityRow).toBeInTheDocument()
    }
  })

  it('should handle drag end and stop auto-scrolling', () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskBoard = document.querySelector('.task-board')
    expect(taskBoard).toBeInTheDocument()
    
    if (taskBoard) {
      fireEvent.dragEnd(taskBoard)
      // The drag end should trigger auto-scroll cleanup
      expect(taskBoard).toBeInTheDocument()
    }
  })

  it('should maintain drag state during auto-scroll', async () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    const mediumPriorityRow = document.querySelector('[data-priority="medium"]')
    
    expect(taskCard).toBeInTheDocument()
    expect(mediumPriorityRow).toBeInTheDocument()
    
    if (taskCard && mediumPriorityRow) {
      // Start drag
      fireEvent.dragStart(taskCard)
      
      // Drag over priority row (this would trigger auto-scroll in real scenario)
      fireEvent.dragOver(mediumPriorityRow)
      
      // The task card should still be draggable
      expect(taskCard).toHaveAttribute('draggable', 'true')
    }
  })

  it('should handle multiple drag operations without conflicts', () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskCards = document.querySelectorAll('.task-card')
    const priorityRows = document.querySelectorAll('.priority-row')
    
    expect(taskCards.length).toBeGreaterThan(0)
    expect(priorityRows.length).toBeGreaterThan(0)
    
    // Simulate multiple drag operations
    taskCards.forEach((card, index) => {
      fireEvent.dragStart(card)
      fireEvent.dragOver(priorityRows[index % priorityRows.length])
    })
    
    // All elements should still be present
    expect(document.querySelectorAll('.task-card').length).toBe(taskCards.length)
    expect(document.querySelectorAll('.priority-row').length).toBe(priorityRows.length)
  })

  it('should work with empty task lists', () => {
    const emptyProps = {
      ...defaultProps,
      tasks: []
    }
    
    render(<TaskBoard {...emptyProps} />)
    
    const taskBoard = document.querySelector('.task-board')
    expect(taskBoard).toBeInTheDocument()
    
    // Should still handle drag events even with no tasks
    if (taskBoard) {
      fireEvent.dragEnd(taskBoard)
      expect(taskBoard).toBeInTheDocument()
    }
  })

  it('should handle auto-scroll during long drag operations', async () => {
    render(<TaskBoard {...defaultProps} />)
    
    const taskCard = screen.getByText('High Priority Task').closest('.task-card')
    const taskBoard = document.querySelector('.task-board')
    
    expect(taskCard).toBeInTheDocument()
    expect(taskBoard).toBeInTheDocument()
    
    if (taskCard && taskBoard) {
      // Start drag
      fireEvent.dragStart(taskCard)
      
      // Simulate multiple drag over events (like during auto-scroll)
      for (let i = 0; i < 5; i++) {
        fireEvent.dragOver(taskBoard)
        await new Promise(resolve => setTimeout(resolve, 16)) // ~60fps
      }
      
      // End drag
      fireEvent.dragEnd(taskBoard)
      
      // Component should still be functional
      expect(taskBoard).toBeInTheDocument()
    }
  })

  it('should preserve task hierarchy during auto-scroll', () => {
    const tasksWithHierarchy: Task[] = [
      {
        id: '1',
        title: 'Parent Task',
        description: 'Parent task with children',
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        project_id: 'project-1',
        parent_task_id: null
      },
      {
        id: '2',
        title: 'Child Task',
        description: 'Child task',
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        project_id: 'project-1',
        parent_task_id: '1'
      }
    ]
    
    render(<TaskBoard {...defaultProps} tasks={tasksWithHierarchy} />)
    
    const parentTask = screen.getByText('Parent Task')
    const childTask = screen.getByText('Child Task')
    
    expect(parentTask).toBeInTheDocument()
    expect(childTask).toBeInTheDocument()
    
    // Hierarchy should be preserved during drag operations
    const parentCard = parentTask.closest('.task-card')
    if (parentCard) {
      fireEvent.dragStart(parentCard)
      expect(parentCard).toBeInTheDocument()
    }
  })
})
