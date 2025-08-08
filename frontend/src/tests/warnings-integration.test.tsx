import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import TaskDetailsView from '../components/TaskDetailsView'
import { Task, TaskStatus, TaskPriority } from '../types'

// Mock the API functions
vi.mock('../services/api', () => ({
  setTaskContext: vi.fn(),
  getCurrentSession: vi.fn().mockResolvedValue({ id: 'test-session-id' })
}))

describe('TaskDetailsView Warnings Integration', () => {
  const mockTaskWithWarnings: Task = {
    id: 'task-123',
    project_id: 'project-456',
    title: 'Implement user authentication system',
    description: 'Create a complete user authentication system with login, signup, password reset, and session management. Include proper validation, error handling, and security measures.',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    review_warnings: [
      {
        message: 'Security considerations need more detail',
        reasoning: 'The task involves sensitive user data but doesn\'t specify encryption requirements, rate limiting, or audit logging.'
      },
      {
        message: 'Testing strategy not defined',
        reasoning: 'No mention of unit tests, integration tests, or security testing requirements for the authentication system.'
      },
      {
        message: 'Error handling could be more specific',
        reasoning: 'Should specify how to handle various error scenarios like network failures, database errors, and invalid credentials.'
      }
    ]
  }

  const mockProps = {
    onBack: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    projectId: 'project-456',
    onTaskContextUpdate: vi.fn()
  }

  test('displays task details with warnings in sidebar', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that task title is displayed
    expect(screen.getByText('Implement user authentication system')).toBeInTheDocument()
    
    // Check that task description is displayed
    expect(screen.getByText(/Create a complete user authentication system/)).toBeInTheDocument()
    
    // Check that warnings section is displayed in sidebar
    expect(screen.getByText('⚠️ Review Warnings (3)')).toBeInTheDocument()
    
    // Check that all warning messages are displayed
    expect(screen.getByText('Security considerations need more detail')).toBeInTheDocument()
    expect(screen.getByText('Testing strategy not defined')).toBeInTheDocument()
    expect(screen.getByText('Error handling could be more specific')).toBeInTheDocument()
    
    // Check that warning reasoning is displayed
    expect(screen.getByText(/The task involves sensitive user data/)).toBeInTheDocument()
    expect(screen.getByText(/No mention of unit tests/)).toBeInTheDocument()
    expect(screen.getByText(/Should specify how to handle/)).toBeInTheDocument()
  })

  test('warnings have proper styling and structure', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that warnings section has proper heading
    const warningsHeading = screen.getByText('⚠️ Review Warnings (3)')
    expect(warningsHeading).toBeInTheDocument()
    expect(warningsHeading.tagName).toBe('H3')
    
    // Check that warning items have proper structure
    const warningMessages = screen.getAllByText(/Warning:/)
    const reasoningMessages = screen.getAllByText(/Reasoning:/)
    
    expect(warningMessages).toHaveLength(3)
    expect(reasoningMessages).toHaveLength(3)
    
    // Check that each warning has both message and reasoning
    warningMessages.forEach((message, index) => {
      expect(message).toBeInTheDocument()
      expect(reasoningMessages[index]).toBeInTheDocument()
    })
  })

  test('task metadata is displayed correctly', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that task information is displayed
    expect(screen.getByText('📊 Task Information')).toBeInTheDocument()
    expect(screen.getByText(/Created:/)).toBeInTheDocument()
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
    expect(screen.getByText(/Task ID:/)).toBeInTheDocument()
    expect(screen.getByText('task-123')).toBeInTheDocument()
  })

  test('warnings and metadata are in sidebar', () => {
    render(
      <TaskDetailsView
        {...mockProps}
        task={mockTaskWithWarnings}
      />
    )

    // Check that sidebar contains both metadata and warnings
    const sidebar = screen.getByText('📊 Task Information').closest('.task-details-sidebar')
    expect(sidebar).toBeInTheDocument()
    
    // Check that warnings section is also in the sidebar
    const warningsSection = screen.getByText('⚠️ Review Warnings (3)').closest('.warnings-section')
    expect(warningsSection).toBeInTheDocument()
  })
})
