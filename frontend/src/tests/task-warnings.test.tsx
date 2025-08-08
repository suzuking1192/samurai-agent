import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import TaskDetailsView from '../components/TaskDetailsView'
import { Task, TaskWarning, TaskStatus, TaskPriority } from '../types'

// Mock the API functions
vi.mock('../services/api', () => ({
  setTaskContext: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session-id' })
}))

describe('TaskDetailsView with Warnings', () => {
  const mockTaskWithWarnings: Task = {
    id: 'test-task-id',
    project_id: 'test-project-id',
    title: 'Test Task with Warnings',
    description: 'This is a test task that should have warnings',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    review_warnings: [
      {
        message: 'Error handling not explicitly mentioned',
        reasoning: 'The task description should consider error cases and how to handle them to ensure robust implementation.'
      },
      {
        message: 'Testing requirements not specified',
        reasoning: 'Consider adding specific testing requirements or acceptance criteria to ensure quality.'
      },
      {
        message: 'Security considerations may be missing',
        reasoning: 'Task involves sensitive operations but doesn\'t explicitly address security measures.'
      }
    ]
  }

  const mockTaskWithoutWarnings: Task = {
    id: 'test-task-id-2',
    project_id: 'test-project-id',
    title: 'Test Task without Warnings',
    description: 'This is a test task that should not have warnings',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockProps = {
    onBack: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    projectId: 'test-project-id',
    onTaskContextUpdate: vi.fn()
  }

  test('displays warnings when task has review warnings', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that warnings section is displayed
    expect(screen.getByText('⚠️ Review Warnings (3)')).toBeInTheDocument()
    
    // Check that all warnings are displayed
    expect(screen.getByText('Error handling not explicitly mentioned')).toBeInTheDocument()
    expect(screen.getByText('Testing requirements not specified')).toBeInTheDocument()
    expect(screen.getByText('Security considerations may be missing')).toBeInTheDocument()
    
    // Check that reasoning is displayed
    expect(screen.getByText(/The task description should consider error cases/)).toBeInTheDocument()
    expect(screen.getByText(/Consider adding specific testing requirements/)).toBeInTheDocument()
    expect(screen.getByText(/Task involves sensitive operations/)).toBeInTheDocument()
  })

  test('does not display warnings section when task has no warnings', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithoutWarnings}
      />
    )

    // Check that warnings section is not displayed
    expect(screen.queryByText(/Review Warnings/)).not.toBeInTheDocument()
  })

  test('displays correct warning count', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that the warning count is correct
    expect(screen.getByText('⚠️ Review Warnings (3)')).toBeInTheDocument()
  })

  test('displays warning structure correctly', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that warning structure includes both message and reasoning
    const warningItems = screen.getAllByText(/Warning:/)
    const reasoningItems = screen.getAllByText(/Reasoning:/)
    
    expect(warningItems).toHaveLength(3)
    expect(reasoningItems).toHaveLength(3)
  })

  test('handles empty warnings array', () => {
    const taskWithEmptyWarnings = {
      ...mockTaskWithWarnings,
      review_warnings: []
    }

    render(
      <TaskDetailsView
        {...mockProps}
        task={taskWithEmptyWarnings}
      />
    )

    // Check that warnings section is not displayed when array is empty
    expect(screen.queryByText(/Review Warnings/)).not.toBeInTheDocument()
  })

  test('handles undefined warnings', () => {
    const taskWithUndefinedWarnings = {
      ...mockTaskWithWarnings,
      review_warnings: undefined
    }

    render(
      <TaskDetailsView
        {...mockProps}
        task={taskWithUndefinedWarnings}
      />
    )

    // Check that warnings section is not displayed when warnings is undefined
    expect(screen.queryByText(/Review Warnings/)).not.toBeInTheDocument()
  })
})
