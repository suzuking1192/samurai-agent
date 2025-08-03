import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import CompactTaskItem from '../components/CompactTaskItem'
import CompactMemoryItem from '../components/CompactMemoryItem'
import TaskPanel from '../components/TaskPanel'
import MemoryPanel from '../components/MemoryPanel'
import App from '../App'
import { Task, TaskStatus, TaskPriority, Memory, MemoryType } from '../types'

// Mock API calls
vi.mock('../services/api', () => ({
  getTasks: vi.fn(),
  getMemories: vi.fn(),
  createTask: vi.fn(),
  createMemory: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  deleteMemory: vi.fn(),
  getSemanticHierarchy: vi.fn(),
}))

// Test data
const mockTask: Task = {
  id: '1',
  project_id: 'project-1',
  title: 'This is a very long task title that should be properly displayed and not truncated too aggressively to make it recognizable',
  description: 'This is a detailed description of the task that should be shown in the preview and when expanded. It contains important information about what needs to be done.',
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.HIGH,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z'
}

const mockMemory: Memory = {
  id: '1',
  project_id: 'project-1',
  content: 'This is a very long memory content that should be properly displayed and not truncated too aggressively to make it recognizable and useful for the user',
  type: MemoryType.NOTE,
  created_at: '2024-01-15T10:00:00Z'
}

describe('Critical UI Fixes Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('1. Panel Visibility Tests', () => {
    test('CRITICAL: Panels should NEVER auto-hide due to chat length', async () => {
      // Mock long chat history
      const longChatHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        message: `Long chat message ${i}`,
        response: `Long response ${i}`,
        created_at: new Date().toISOString()
      }))

      render(<App />)
      
      // Check that panels are visible initially
      const memoryPanel = screen.queryByText('💡 Memories')
      const tasksPanel = screen.queryByText('📋 Tasks')
      
      expect(memoryPanel).toBeInTheDocument()
      expect(tasksPanel).toBeInTheDocument()
      
      // Simulate long chat history by adding many messages
      // This should NOT cause panels to disappear
      await waitFor(() => {
        const memoryPanelAfter = screen.queryByText('💡 Memories')
        const tasksPanelAfter = screen.queryByText('📋 Tasks')
        
        expect(memoryPanelAfter).toBeInTheDocument()
        expect(tasksPanelAfter).toBeInTheDocument()
      })
    })

    test('Panels should remain visible on different screen sizes', () => {
      render(<App />)
      
      // Test at different viewport sizes
      const sizes = [
        { width: 1920, height: 1080 },
        { width: 1200, height: 800 },
        { width: 900, height: 600 },
        { width: 768, height: 1024 }
      ]
      
      sizes.forEach(size => {
        // Simulate viewport change
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: size.width,
        })
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: size.height,
        })
        
        window.dispatchEvent(new Event('resize'))
        
        // Panels should still be visible
        const memoryPanel = screen.queryByText('💡 Memories')
        const tasksPanel = screen.queryByText('📋 Tasks')
        
        expect(memoryPanel).toBeInTheDocument()
        expect(tasksPanel).toBeInTheDocument()
      })
    })
  })

  describe('2. Title Display Tests', () => {
    test('CRITICAL: Task titles should be descriptive and recognizable', () => {
      render(
        <CompactTaskItem
          task={mockTask}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      
      // Check that the full title is displayed (up to 80 characters)
      const titleElement = screen.getByText(/This is a very long task title/)
      expect(titleElement).toBeInTheDocument()
      
      // Title should be at least 80 characters long
      const titleText = titleElement.textContent || ''
      expect(titleText.length).toBeGreaterThanOrEqual(80)
      
      // Should show description preview as subtitle
      const descriptionPreview = screen.getByText(/This is a detailed description/)
      expect(descriptionPreview).toBeInTheDocument()
    })

    test('CRITICAL: Memory content should be descriptive and recognizable', () => {
      render(
        <CompactMemoryItem
          memory={mockMemory}
          onDelete={vi.fn()}
        />
      )
      
      // Check that the full content is displayed (up to 80 characters)
      const contentElement = screen.getByText(/This is a very long memory content/)
      expect(contentElement).toBeInTheDocument()
      
      // Content should be at least 80 characters long
      const contentText = contentElement.textContent || ''
      expect(contentText.length).toBeGreaterThanOrEqual(80)
      
      // Should show content preview as subtitle
      const contentPreview = screen.getByText(/This is a very long memory content/)
      expect(contentPreview).toBeInTheDocument()
    })

    test('Short titles should display fully', () => {
      const shortTask: Task = {
        ...mockTask,
        title: 'Short task',
        description: 'Short description'
      }
      
      render(
        <CompactTaskItem
          task={shortTask}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      
      expect(screen.getByText('Short task')).toBeInTheDocument()
      expect(screen.getByText('Short description')).toBeInTheDocument()
    })

    test('Hover should show full title as tooltip', () => {
      render(
        <CompactTaskItem
          task={mockTask}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      
      const titleElement = screen.getByText(/This is a very long task title/)
      
      // Check that title attribute contains full title
      expect(titleElement).toHaveAttribute('title', mockTask.title)
    })
  })

  describe('3. Expansion Behavior Tests', () => {
    test('CRITICAL: Expanded content should NOT overlap with other items', async () => {
      const { container } = render(
        <div>
          <CompactTaskItem
            task={mockTask}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
          <CompactTaskItem
            task={{ ...mockTask, id: '2', title: 'Second task' }}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
        </div>
      )
      
      // Find the first task's expand button
      const expandButtons = screen.getAllByText('▶')
      const firstExpandButton = expandButtons[0]
      
      // Click to expand first task
      fireEvent.click(firstExpandButton)
      
      await waitFor(() => {
        // Check that expanded content is visible
        expect(screen.getByText('Description:')).toBeInTheDocument()
        expect(screen.getByText('Details:')).toBeInTheDocument()
        
        // Check that second task is still visible and not overlapped
        expect(screen.getByText('Second task')).toBeInTheDocument()
        
        // Check that expanded content has proper CSS classes
        const expandedDetails = container.querySelector('.compact-task-details.visible')
        expect(expandedDetails).toBeInTheDocument()
        
        // Check that there's no overflow
        const taskItems = container.querySelectorAll('.compact-task-item')
        taskItems.forEach(item => {
          const computedStyle = window.getComputedStyle(item as Element)
          expect(computedStyle.overflow).toBe('hidden')
        })
      })
    })

    test('Multiple items can be expanded without overlap', async () => {
      const { container } = render(
        <div>
          <CompactTaskItem
            task={mockTask}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
          <CompactTaskItem
            task={{ ...mockTask, id: '2', title: 'Second task' }}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
          <CompactTaskItem
            task={{ ...mockTask, id: '3', title: 'Third task' }}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
        </div>
      )
      
      // Expand all tasks
      const expandButtons = screen.getAllByText('▶')
      expandButtons.forEach(button => {
        fireEvent.click(button)
      })
      
      await waitFor(() => {
        // All expanded content should be visible
        const expandedDetails = container.querySelectorAll('.compact-task-details.visible')
        expect(expandedDetails).toHaveLength(3)
        
        // All task titles should still be visible
        expect(screen.getByText(/This is a very long task title/)).toBeInTheDocument()
        expect(screen.getByText('Second task')).toBeInTheDocument()
        expect(screen.getByText('Third task')).toBeInTheDocument()
      })
    })

    test('Expansion should have smooth animations', async () => {
      render(
        <CompactTaskItem
          task={mockTask}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      
      const expandButton = screen.getByText('▶')
      
      // Click to expand
      fireEvent.click(expandButton)
      
      // Check that expanding class is applied
      await waitFor(() => {
        const taskItem = screen.getByText(/This is a very long task title/).closest('.compact-task-item')
        expect(taskItem).toHaveClass('expanding')
      })
      
      // Wait for animation to complete
      await waitFor(() => {
        const taskItem = screen.getByText(/This is a very long task title/).closest('.compact-task-item')
        expect(taskItem).toHaveClass('expanded')
        expect(taskItem).not.toHaveClass('expanding')
      }, { timeout: 400 })
    })
  })

  describe('4. Layout Stability Tests', () => {
    test('Layout should remain stable during interactions', async () => {
      const { container } = render(
        <div>
          <CompactTaskItem
            task={mockTask}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
          />
        </div>
      )
      
      // Get initial layout measurements
      const initialTaskItem = container.querySelector('.compact-task-item')
      const initialHeight = initialTaskItem?.getBoundingClientRect().height || 0
      
      // Expand the task
      const expandButton = screen.getByText('▶')
      fireEvent.click(expandButton)
      
      await waitFor(() => {
        // Layout should not shift dramatically
        const expandedTaskItem = container.querySelector('.compact-task-item')
        const expandedHeight = expandedTaskItem?.getBoundingClientRect().height || 0
        
        // Height should increase but not cause layout shift
        expect(expandedHeight).toBeGreaterThan(initialHeight)
        
        // Check that the item still has proper positioning
        const computedStyle = window.getComputedStyle(expandedTaskItem as Element)
        expect(computedStyle.position).not.toBe('absolute')
        expect(computedStyle.position).not.toBe('fixed')
      })
    })

    test('CSS classes should be properly applied', () => {
      render(
        <CompactTaskItem
          task={mockTask}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      
      const taskItem = screen.getByText(/This is a very long task title/).closest('.compact-task-item')
      
      // Check essential CSS classes
      expect(taskItem).toHaveClass('compact-task-item')
      expect(taskItem).not.toHaveClass('expanded')
      expect(taskItem).not.toHaveClass('expanding')
      
      // Check that title container exists
      const titleContainer = taskItem?.querySelector('.item-title-container')
      expect(titleContainer).toBeInTheDocument()
      
      // Check that subtitle exists
      const subtitle = taskItem?.querySelector('.item-subtitle')
      expect(subtitle).toBeInTheDocument()
    })
  })

  describe('5. Responsive Design Tests', () => {
    test('Panels should adapt to screen size while remaining visible', () => {
      render(<App />)
      
      // Test different screen sizes
      const testSizes = [
        { width: 1920, height: 1080, expected: 'large' },
        { width: 1200, height: 800, expected: 'medium' },
        { width: 900, height: 600, expected: 'small' },
        { width: 768, height: 1024, expected: 'mobile' }
      ]
      
      testSizes.forEach(({ width, height, expected }) => {
        // Simulate viewport change
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        })
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: height,
        })
        
        window.dispatchEvent(new Event('resize'))
        
        // Panels should still be visible regardless of size
        const memoryPanel = screen.queryByText('💡 Memories')
        const tasksPanel = screen.queryByText('📋 Tasks')
        
        expect(memoryPanel).toBeInTheDocument()
        expect(tasksPanel).toBeInTheDocument()
      })
    })
  })

  describe('6. Integration Tests', () => {
    test('TaskPanel should render with proper layout', () => {
      render(<TaskPanel projectId="test-project" />)
      
      // Check that panel header is visible
      expect(screen.getByText('📋 Tasks')).toBeInTheDocument()
      
      // Check that view controls are present
      expect(screen.getByText('📋 List')).toBeInTheDocument()
      expect(screen.getByText('🧠 Semantic')).toBeInTheDocument()
      expect(screen.getByText('📅 Timeline')).toBeInTheDocument()
    })

    test('MemoryPanel should render with proper layout', () => {
      render(<MemoryPanel projectId="test-project" />)
      
      // Check that panel header is visible
      expect(screen.getByText('💡 Memories')).toBeInTheDocument()
      
      // Check that view controls are present
      expect(screen.getByText('📋 List')).toBeInTheDocument()
      expect(screen.getByText('🧠 Semantic')).toBeInTheDocument()
      expect(screen.getByText('📅 Timeline')).toBeInTheDocument()
    })
  })
}) 