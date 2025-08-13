import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import TaskListView from '../components/TaskListView'
import { Task, TaskStatus, TaskPriority } from '../types'

describe('TaskListView hierarchy rendering', () => {
  const now = '2024-01-01T00:00:00Z'
  const root: Task = {
    id: 'root', project_id: 'p', title: 'Root Task', description: 'root',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: null, depth: 1
  }
  const child: Task = {
    id: 'child', project_id: 'p', title: 'Child Task', description: 'child',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'root', depth: 2
  }
  const leaf: Task = {
    id: 'leaf', project_id: 'p', title: 'Leaf Task', description: 'leaf',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'child', depth: 3
  }

  const onTaskClick = vi.fn()

  beforeEach(() => onTaskClick.mockClear())

  test('renders roots and supports expand/collapse', () => {
    render(
      <TaskListView 
        tasks={[root, child, leaf]} 
        isLoading={false} 
        onTaskClick={onTaskClick} 
        onCreateTask={vi.fn()}
      />
    )

    // Root visible, children hidden until expanded
    expect(screen.getByText('Root Task')).toBeInTheDocument()
    expect(screen.queryByText('Child Task')).toBeNull()

    // Expand root
    fireEvent.click(screen.getByText('Root Task'))
    expect(screen.getByText('Child Task')).toBeInTheDocument()

    // Expand child to show leaf
    fireEvent.click(screen.getByText('Child Task'))
    expect(screen.getByText('Leaf Task')).toBeInTheDocument()

    // Clicking leaf calls onTaskClick (no children)
    fireEvent.click(screen.getByText('Leaf Task'))
    expect(onTaskClick).toHaveBeenCalledWith(leaf)
  })
})


