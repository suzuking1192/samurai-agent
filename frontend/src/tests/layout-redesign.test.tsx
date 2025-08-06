import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'

describe('Layout Redesign', () => {
  beforeEach(() => {
    // Mock the API calls
    vi.mock('../services/api', () => ({
      getProjects: vi.fn().mockResolvedValue([]),
      createProject: vi.fn(),
      deleteProject: vi.fn(),
    }))
  })

  it('should render with memory hidden by default', () => {
    render(<App />)
    
    // Check that memory toggle button shows "Show Memory"
    const memoryToggle = screen.getByText('🧠 Show Memory')
    expect(memoryToggle).toBeInTheDocument()
    
    // Check that main container has memory-hidden class
    const mainContainer = document.querySelector('.main-container')
    expect(mainContainer).toHaveClass('memory-hidden')
  })

  it('should toggle memory panel when button is clicked', () => {
    render(<App />)
    
    const memoryToggle = screen.getByText('🧠 Show Memory')
    
    // Click to show memory
    fireEvent.click(memoryToggle)
    
    // Check button text changes
    expect(screen.getByText('🧠 Hide Memory')).toBeInTheDocument()
    
    // Check main container class changes
    const mainContainer = document.querySelector('.main-container')
    expect(mainContainer).toHaveClass('memory-expanded')
    
    // Click to hide memory
    fireEvent.click(screen.getByText('🧠 Hide Memory'))
    
    // Check button text changes back
    expect(screen.getByText('🧠 Show Memory')).toBeInTheDocument()
    
    // Check main container class changes back
    expect(mainContainer).toHaveClass('memory-hidden')
  })

  it('should have correct layout classes applied', () => {
    render(<App />)
    
    const mainContainer = document.querySelector('.main-container')
    
    // Default layout should have memory-hidden class
    expect(mainContainer).toHaveClass('memory-hidden')
    expect(mainContainer).not.toHaveClass('memory-expanded')
    
    // Toggle to show memory
    const memoryToggle = screen.getByText('🧠 Show Memory')
    fireEvent.click(memoryToggle)
    
    // Memory expanded layout should have memory-expanded class
    expect(mainContainer).toHaveClass('memory-expanded')
    expect(mainContainer).not.toHaveClass('memory-hidden')
  })

  it('should have memory toggle button in header', () => {
    render(<App />)
    
    const header = document.querySelector('.header')
    const memoryToggle = header?.querySelector('.memory-toggle-btn')
    
    expect(memoryToggle).toBeInTheDocument()
    expect(memoryToggle).toHaveClass('memory-toggle-btn')
  })

  it('should have proper button styling classes', () => {
    render(<App />)
    
    const memoryToggle = screen.getByText('🧠 Show Memory')
    
    // Check that button has the correct styling classes
    expect(memoryToggle).toHaveClass('memory-toggle-btn')
    
    // Check button accessibility
    expect(memoryToggle).toHaveAttribute('title', 'Show Memory Panel')
  })

  it('should toggle button title when state changes', () => {
    render(<App />)
    
    const memoryToggle = screen.getByText('🧠 Show Memory')
    
    // Initial state
    expect(memoryToggle).toHaveAttribute('title', 'Show Memory Panel')
    
    // Click to show memory
    fireEvent.click(memoryToggle)
    
    // Check title changes
    expect(screen.getByText('🧠 Hide Memory')).toHaveAttribute('title', 'Hide Memory Panel')
  })
}) 