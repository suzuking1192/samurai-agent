import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import CompactTaskItem from '../components/CompactTaskItem'
import CompactMemoryItem from '../components/CompactMemoryItem'
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
  description: 'This is a detailed description of the task that should be shown in the preview and when expanded.',
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.HIGH,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z'
}

const mockMemory: Memory = {
  id: '1',
  project_id: 'project-1',
  content: 'This is a very long memory content that should be properly displayed and not truncated too aggressively to make it recognizable',
  type: MemoryType.NOTE,
  created_at: '2024-01-15T10:00:00Z'
}

describe('Simple UI Fixes Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('CRITICAL: Task title should show at least 80 characters', () => {
    render(
      <CompactTaskItem
        task={mockTask}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    
    // Get the title element
    const titleElement = screen.getByText(/This is a very long task title/)
    expect(titleElement).toBeInTheDocument()
    
    // Check the actual text content
    const titleText = titleElement.textContent || ''
    console.log('Title text length:', titleText.length)
    console.log('Title text:', titleText)
    
    // Should show at least 80 characters
    expect(titleText.length).toBeGreaterThanOrEqual(80)
  })

  test('CRITICAL: Memory content should show at least 80 characters', () => {
    render(
      <CompactMemoryItem
        memory={mockMemory}
        onDelete={vi.fn()}
      />
    )
    
    // Get the content element
    const contentElement = screen.getByText(/This is a very long memory content/)
    expect(contentElement).toBeInTheDocument()
    
    // Check the actual text content
    const contentText = contentElement.textContent || ''
    console.log('Content text length:', contentText.length)
    console.log('Content text:', contentText)
    
    // Should show at least 80 characters
    expect(contentText.length).toBeGreaterThanOrEqual(80)
  })

  test('CRITICAL: Task expansion should work without overlap', async () => {
    render(
      <CompactTaskItem
        task={mockTask}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    
    // Find and click the expand button
    const expandButton = screen.getByText('▶')
    fireEvent.click(expandButton)
    
    await waitFor(() => {
      // Should show expanded content
      expect(screen.getByText('Description:')).toBeInTheDocument()
      expect(screen.getByText('Details:')).toBeInTheDocument()
      
      // Should show the full description
      expect(screen.getByText(/This is a detailed description/)).toBeInTheDocument()
    })
  })

  test('CRITICAL: Memory expansion should work without overlap', async () => {
    render(
      <CompactMemoryItem
        memory={mockMemory}
        onDelete={vi.fn()}
      />
    )
    
    // Find and click the expand button
    const expandButton = screen.getByText('▶')
    fireEvent.click(expandButton)
    
    await waitFor(() => {
      // Should show expanded content
      expect(screen.getByText('Content:')).toBeInTheDocument()
      expect(screen.getByText('Details:')).toBeInTheDocument()
      
      // Should show the full content
      expect(screen.getByText(/This is a very long memory content/)).toBeInTheDocument()
    })
  })
}) 