import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import FullScreenModal from '../components/FullScreenModal'
import TaskDetailModal from '../components/TaskDetailModal'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the notification function
const mockShowNotification = vi.fn()
;(global as any).showNotification = mockShowNotification

describe('FullScreen Modal System', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    // Clean up any existing modal root
    const existingRoot = document.getElementById('modal-root')
    if (existingRoot) {
      existingRoot.remove()
    }
  })

  describe('FullScreenModal Component', () => {
    it('creates modal root when it does not exist', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div>Test Content</div>
        </FullScreenModal>
      )

      const modalRoot = document.getElementById('modal-root')
      expect(modalRoot).toBeInTheDocument()
      expect(modalRoot?.parentNode).toBe(document.body)
    })

    it('renders content when open', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div data-testid="modal-content">Test Content</div>
        </FullScreenModal>
      )

      expect(screen.getByTestId('modal-content')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={false} onClose={mockOnClose}>
          <div data-testid="modal-content">Test Content</div>
        </FullScreenModal>
      )

      expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument()
    })

    it('calls onClose when overlay is clicked', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div data-testid="modal-content">Test Content</div>
        </FullScreenModal>
      )

      const overlay = document.querySelector('.fullscreen-modal-overlay')
      expect(overlay).toBeInTheDocument()
      
      if (overlay) {
        fireEvent.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('does not call onClose when content is clicked', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div data-testid="modal-content">Test Content</div>
        </FullScreenModal>
      )

      const content = screen.getByTestId('modal-content')
      fireEvent.click(content)
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('prevents body scrolling when open', () => {
      const mockOnClose = vi.fn()
      
      render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div>Test Content</div>
        </FullScreenModal>
      )

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body scrolling when closed', () => {
      const mockOnClose = vi.fn()
      
      const { rerender } = render(
        <FullScreenModal isOpen={true} onClose={mockOnClose}>
          <div>Test Content</div>
        </FullScreenModal>
      )

      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <FullScreenModal isOpen={false} onClose={mockOnClose}>
          <div>Test Content</div>
        </FullScreenModal>
      )

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('TaskDetailModal with FullScreenModal', () => {
    it('renders task details in full-screen modal', () => {
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

      // Check that modal root was created
      const modalRoot = document.getElementById('modal-root')
      expect(modalRoot).toBeInTheDocument()

      // Check that task content is rendered
      expect(screen.getByText('Test Task')).toBeInTheDocument()
      expect(screen.getByText('This is a test task description')).toBeInTheDocument()
      expect(screen.getByText(/pending/)).toBeInTheDocument()
      expect(screen.getByText(/medium/)).toBeInTheDocument()

      // Check that full-screen modal classes are applied
      expect(document.querySelector('.fullscreen-modal-overlay')).toBeInTheDocument()
      expect(document.querySelector('.fullscreen-modal-content')).toBeInTheDocument()
      expect(document.querySelector('.task-modal-container')).toBeInTheDocument()
    })

    it('uses enhanced grid layout', () => {
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

      // Check that the new grid layout is used
      expect(document.querySelector('.task-details-grid')).toBeInTheDocument()
      expect(document.querySelector('.main-content')).toBeInTheDocument()
      expect(document.querySelector('.sidebar-content')).toBeInTheDocument()
    })
  })
}) 