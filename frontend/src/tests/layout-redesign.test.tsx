import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'

describe('Layout Redesign', () => {
  beforeEach(() => {
    // Mock the API calls
    vi.mock('../services/api', () => ({
      getProjects: vi.fn().mockResolvedValue([]),
      createProject: vi.fn().mockResolvedValue({
        id: 'p1',
        name: 'New Project',
        description: '',
        tech_stack: 'TS',
        created_at: new Date().toISOString(),
      }),
      deleteProject: vi.fn(),
      getProjectDetail: vi.fn().mockResolvedValue({ content: '' }),
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

  it('auto-opens Project Detail modal after creating a project and shows explainer text', async () => {
    render(<App />)

    // Open new project form
    fireEvent.click(screen.getByText('+ New Project'))

    // Fill in form
    const nameInput = screen.getByPlaceholderText('Project name')
    const descInput = screen.getByPlaceholderText('Project description')
    const techInput = screen.getByPlaceholderText('Technology stack (e.g., React, Python, Node.js)')
    fireEvent.change(nameInput, { target: { value: 'New Project' } })
    fireEvent.change(descInput, { target: { value: '' } })
    fireEvent.change(techInput, { target: { value: 'TS' } })

    // Create project
    fireEvent.click(screen.getByText('Create Project'))

    // Modal should open with explainer text
    await waitFor(() => {
      expect(
        screen.getByText(
          'you can add long text document like documentation or meeting minutes or note to samurai agent to consider it as context, this will be kept updating as our conversation goes and you can update by adding more information here anytime'
        )
      ).toBeInTheDocument()
    })
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