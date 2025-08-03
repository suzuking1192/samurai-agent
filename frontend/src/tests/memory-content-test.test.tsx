import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi } from 'vitest'
import CompactMemoryItem from '../components/CompactMemoryItem'
import { Memory, MemoryType } from '../types'

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

// Test data with very long content
const mockMemory: Memory = {
  id: '1',
  project_id: 'project-1',
  content: 'This is a very long memory content that should be properly displayed and not truncated too aggressively to make it recognizable and useful for the user. It contains important information that needs to be visible.',
  type: MemoryType.NOTE,
  created_at: '2024-01-15T10:00:00Z'
}

describe('Memory Content Display Test', () => {
  test('CRITICAL: Memory content should show full text when expanded', async () => {
    render(
      <CompactMemoryItem
        memory={mockMemory}
        onDelete={vi.fn()}
      />
    )
    
    // Initially should show truncated content
    const contentElement = screen.getByTitle(mockMemory.content)
    expect(contentElement).toBeInTheDocument()
    
    // Click expand button to show full content
    const expandButton = screen.getByText('▶')
    fireEvent.click(expandButton)
    
    await waitFor(() => {
      // Now should show the full content
      const expandedContentElement = screen.getByTitle(mockMemory.content)
      const contentText = expandedContentElement.textContent || ''
      console.log('Expanded memory content length:', contentText.length)
      console.log('Expanded memory content:', contentText)
      
      // Should show the full content (not truncated)
      expect(contentText).toBe(mockMemory.content)
    })
  })

  test('CRITICAL: Memory content should show at least 80 characters when not expanded', () => {
    render(
      <CompactMemoryItem
        memory={mockMemory}
        onDelete={vi.fn()}
      />
    )
    
    // Get the memory content preview element
    const contentElement = screen.getByTitle(mockMemory.content)
    expect(contentElement).toBeInTheDocument()
    
    // Check the actual text content
    const contentText = contentElement.textContent || ''
    console.log('Memory content length:', contentText.length)
    console.log('Memory content:', contentText)
    
    // Should show at least 80 characters
    expect(contentText.length).toBeGreaterThanOrEqual(80)
    
    // Should end with "..." since it's truncated
    expect(contentText).toMatch(/\.\.\.$/)
  })
}) 