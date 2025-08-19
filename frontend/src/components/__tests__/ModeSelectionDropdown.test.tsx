import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ModeSelectionDropdown from '../ModeSelectionDropdown'
import { CodeContextMode } from '../../types'
import * as api from '../../services/api'

// Mock the API module
vi.mock('../../services/api', () => ({
  getProjectModeSelection: vi.fn()
}))

const mockApi = api as any

describe('ModeSelectionDropdown', () => {
  const defaultProps = {
    projectId: 'test-project-123',
    selectedMode: CodeContextMode.AUTO,
    onModeChange: vi.fn(),
    disabled: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default mode', () => {
    render(<ModeSelectionDropdown {...defaultProps} />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue(CodeContextMode.AUTO)
  })

  it('displays all three mode options', () => {
    render(<ModeSelectionDropdown {...defaultProps} />)
    
    const select = screen.getByRole('combobox')
    const options = select.querySelectorAll('option')
    
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveValue(CodeContextMode.AUTO)
    expect(options[0]).toHaveTextContent('Auto')
    expect(options[1]).toHaveValue(CodeContextMode.WITH_CODE_LOOKUP)
    expect(options[1]).toHaveTextContent('With Code Lookup')
    expect(options[2]).toHaveValue(CodeContextMode.WITHOUT_CODE_LOOKUP)
    expect(options[2]).toHaveTextContent('Without Code Lookup')
  })

  it('calls onModeChange when selection changes', () => {
    render(<ModeSelectionDropdown {...defaultProps} />)
    
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: CodeContextMode.WITH_CODE_LOOKUP } })
    
    expect(defaultProps.onModeChange).toHaveBeenCalledWith(CodeContextMode.WITH_CODE_LOOKUP)
  })

  it('loads current mode from API on mount', async () => {
    mockApi.getProjectModeSelection.mockResolvedValue({
      project_id: 'test-project-123',
      code_context_mode: CodeContextMode.WITH_CODE_LOOKUP
    })

    render(<ModeSelectionDropdown {...defaultProps} />)
    
    await waitFor(() => {
      expect(mockApi.getProjectModeSelection).toHaveBeenCalledWith('test-project-123')
      expect(defaultProps.onModeChange).toHaveBeenCalledWith(CodeContextMode.WITH_CODE_LOOKUP)
    })
  })

  it('defaults to AUTO mode when API call fails', async () => {
    mockApi.getProjectModeSelection.mockRejectedValue(new Error('API Error'))

    render(<ModeSelectionDropdown {...defaultProps} />)
    
    await waitFor(() => {
      expect(mockApi.getProjectModeSelection).toHaveBeenCalledWith('test-project-123')
      expect(defaultProps.onModeChange).toHaveBeenCalledWith(CodeContextMode.AUTO)
    })
  })

  it('does not load mode when projectId is not provided', () => {
    render(<ModeSelectionDropdown {...defaultProps} projectId={undefined} />)
    
    expect(mockApi.getProjectModeSelection).not.toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ModeSelectionDropdown {...defaultProps} disabled={true} />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('is disabled when loading', async () => {
    // Mock a slow API call
    mockApi.getProjectModeSelection.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        project_id: 'test-project-123',
        code_context_mode: CodeContextMode.AUTO
      }), 100))
    )

    render(<ModeSelectionDropdown {...defaultProps} />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
    
    await waitFor(() => {
      expect(select).not.toBeDisabled()
    })
  })

  it('shows loading spinner when loading', async () => {
    // Mock a slow API call
    mockApi.getProjectModeSelection.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        project_id: 'test-project-123',
        code_context_mode: CodeContextMode.AUTO
      }), 100))
    )

    render(<ModeSelectionDropdown {...defaultProps} />)
    
    // Should show loading spinner initially
    expect(screen.getByText('⟳')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.queryByText('⟳')).not.toBeInTheDocument()
    })
  })

  it('has correct tooltip for each mode', () => {
    render(<ModeSelectionDropdown {...defaultProps} selectedMode={CodeContextMode.AUTO} />)
    
    const select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('title', 'Automatically decide when to look up code')
  })

  it('updates tooltip when mode changes', () => {
    const { rerender } = render(<ModeSelectionDropdown {...defaultProps} selectedMode={CodeContextMode.AUTO} />)
    
    let select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('title', 'Automatically decide when to look up code')
    
    rerender(<ModeSelectionDropdown {...defaultProps} selectedMode={CodeContextMode.WITH_CODE_LOOKUP} />)
    
    select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('title', 'Always look up relevant code')
  })
})
