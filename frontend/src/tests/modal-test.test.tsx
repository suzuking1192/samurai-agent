import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import TaskDetailModal from '../components/TaskDetailModal'
import MemoryDetailModal from '../components/MemoryDetailModal'
import { Task, TaskStatus, TaskPriority, Memory, MemoryType } from '../types'

// Mock the notification function
const mockShowNotification = vi.fn()
;(global as any).showNotification = mockShowNotification

describe('Modal Components', () => {
  const mockTask: Task = {
    id: '1',
    project_id: 'project-1',
    title: 'Test Task',
    description: 'This is a test task description',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockMemory: Memory = {
    id: '1',
    project_id: 'project-1',
    content: 'This is a test memory content',
    type: MemoryType.NOTE,
    created_at: '2024-01-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TaskDetailModal', () => {
    it('renders task details when open', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <TaskDetailModal
          task={mockTask}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.getByText('This is a test task description')).toBeInTheDocument()
      expect(screen.getByText(/pending/)).toBeInTheDocument()
      expect(screen.getByText(/medium/)).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <TaskDetailModal
          task={mockTask}
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.queryByText('Test Task')).not.toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <TaskDetailModal
          task={mockTask}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      const closeButton = screen.getByText('✖️')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('MemoryDetailModal', () => {
    it('renders memory details when open', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <MemoryDetailModal
          memory={mockMemory}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.getByText('Note Memory')).toBeInTheDocument()
      expect(screen.getByText('This is a test memory content')).toBeInTheDocument()
      // Check for the type badge specifically
      expect(screen.getByText(/📝\s*Note/)).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <MemoryDetailModal
          memory={mockMemory}
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.queryByText('Note Memory')).not.toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      const mockOnSave = vi.fn()
      const mockOnDelete = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <MemoryDetailModal
          memory={mockMemory}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onDelete={mockOnDelete}
        />
      )

      const closeButton = screen.getByText('✖️')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
}) 