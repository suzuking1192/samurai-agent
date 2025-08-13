import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi } from 'vitest'
import TaskListView from '../components/TaskListView'
import { Task, TaskPriority, TaskStatus } from '../types'

describe('TaskListView ASCII tree prefixes', () => {
  const now = '2024-01-01T00:00:00Z'
  const root: Task = {
    id: 'root', project_id: 'p', title: 'Root', description: 'root',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: null, depth: 1
  }
  const childA: Task = {
    id: 'childA', project_id: 'p', title: 'Child A', description: 'childA',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'root', depth: 2
  }
  const childB: Task = {
    id: 'childB', project_id: 'p', title: 'Child B', description: 'childB',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'root', depth: 2
  }
  const grandChild: Task = {
    id: 'grand', project_id: 'p', title: 'Grand Child', description: 'grand',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'childA', depth: 3
  }

  test('shows VSCode-like ASCII connectors and increasing left padding', () => {
    render(
      <TaskListView
        tasks={[root, childA, childB, grandChild]}
        isLoading={false}
        onTaskClick={vi.fn()}
        onCreateTask={vi.fn()}
      />
    )

    // Expand root to see first-level children
    fireEvent.click(screen.getByText('Root'))
    // Both children visible
    expect(screen.getByText('Child A')).toBeInTheDocument()
    expect(screen.getByText('Child B')).toBeInTheDocument()

    // Should render connectors for first-level: one or more of '├─' and '└─'
    const branch = screen.getAllByText(/├─|└─/)
    expect(branch.length).toBeGreaterThanOrEqual(1)

    // Expand Child A to reveal grandchild
    fireEvent.click(screen.getByText('Child A'))
    expect(screen.getByText('Grand Child')).toBeInTheDocument()

    // Verify an ASCII connector exists for the grandchild level as well
    const allBranches = screen.getAllByText(/├─|└─/)
    expect(allBranches.length).toBeGreaterThan(branch.length)

    // Check left padding increases with depth by inspecting nearest task-item style
    const childAItem = screen.getByText('Child A').closest('.task-item') as HTMLElement
    const grandItem = screen.getByText('Grand Child').closest('.task-item') as HTMLElement
    expect(childAItem).toBeTruthy()
    expect(grandItem).toBeTruthy()
    const childMargin = parseInt(getComputedStyle(childAItem!).marginLeft || '0', 10)
    const grandMargin = parseInt(getComputedStyle(grandItem!).marginLeft || '0', 10)
    expect(grandMargin).toBeGreaterThan(childMargin)
  })
})


