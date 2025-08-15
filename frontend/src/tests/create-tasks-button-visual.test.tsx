import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import CreateTasksButton from '../components/CreateTasksButton'

describe('CreateTasksButton Visual Design', () => {
  it('should render with modern styling and all visual elements', () => {
    const mockOnClick = vi.fn()
    
    render(<CreateTasksButton onClick={mockOnClick} />)
    
    // Check that the button text is present
    expect(screen.getByText('Create tasks based on discussion so far')).toBeInTheDocument()
    
    // Check that the button has the modern gradient classes
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r')
    expect(button).toHaveClass('from-indigo-500')
    expect(button).toHaveClass('via-purple-500')
    expect(button).toHaveClass('to-pink-500')
    expect(button).toHaveClass('rounded-xl')
    expect(button).toHaveClass('shadow-lg')
    expect(button).toHaveClass('transform')
    expect(button).toHaveClass('transition-all')
  })

  it('should render disabled state with loading spinner', () => {
    const mockOnClick = vi.fn()
    
    render(<CreateTasksButton onClick={mockOnClick} disabled={true} />)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    
    // Check that the loading spinner is present
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
    
    // Check that disabled styling is applied
    expect(button).toHaveClass('disabled:from-gray-400')
    expect(button).toHaveClass('disabled:via-gray-400')
    expect(button).toHaveClass('disabled:to-gray-400')
  })

  it('should have proper accessibility attributes', () => {
    const mockOnClick = vi.fn()
    
    render(<CreateTasksButton onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    
    // Check that the button is focusable (buttons are focusable by default)
    expect(button).not.toHaveAttribute('tabIndex', '-1')
    
    // Check that it has proper focus ring styling
    expect(button).toHaveClass('focus:ring-4')
    expect(button).toHaveClass('focus:ring-purple-300')
  })
})
