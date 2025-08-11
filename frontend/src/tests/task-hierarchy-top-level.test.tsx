import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi } from 'vitest'
import TaskListView from '../components/TaskListView'
import { Task, TaskStatus, TaskPriority } from '../types'

describe('TaskListView top-level behavior', () => {
  const now = '2024-01-01T00:00:00Z'
  const root: Task = {
    id: 'root', project_id: 'p', title: 'Root Task', description: 'root desc',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: null, depth: 1
  }
  const child: Task = {
    id: 'child', project_id: 'p', title: 'Child Task', description: 'child desc',
    status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM, created_at: now, updated_at: now,
    parent_task_id: 'root', depth: 2
  }

  test('top-level shows title and a See details button; title toggles children', () => {
    const onTaskClick = vi.fn()
    render(
      <TaskListView 
        tasks={[root, child]} 
        isLoading={false} 
        onTaskClick={onTaskClick} 
        onCreateTask={vi.fn()}
      />
    )

    // Root title visible, details button visible
    const rootTitle = screen.getByText('Root Task')
    const seeDetails = screen.getByRole('button', { name: /See details for Root Task/i })
    expect(rootTitle).toBeInTheDocument()
    expect(seeDetails).toBeInTheDocument()

    // Child not visible until expand
    expect(screen.queryByText('Child Task')).toBeNull()

    // Clicking root title expands children
    fireEvent.click(rootTitle)
    expect(screen.getByText('Child Task')).toBeInTheDocument()

    // Clicking See details opens modal (calls onTaskClick)
    fireEvent.click(seeDetails)
    expect(onTaskClick).toHaveBeenCalledWith(root)
  })
})


