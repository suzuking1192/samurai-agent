import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CodebaseIntegrationSection } from '../CodebaseIntegrationSection'

// Mock the API function
vi.mock('../../services/api', () => ({
  connectCodebase: vi.fn()
}))

const mockConnectCodebase = vi.mocked(await import('../../services/api')).connectCodebase

describe('CodebaseIntegrationSection', () => {
  const defaultProps = {
    projectId: 'test-project-id',
    onCodebaseConnected: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with correct title and explanation', () => {
    render(<CodebaseIntegrationSection {...defaultProps} />)
    
    expect(screen.getByText('Codebase Access')).toBeInTheDocument()
    expect(screen.getByText(/Allow Samurai Agent to access your codebase files for context/)).toBeInTheDocument()
  })

  it('shows Select Codebase Folder button when no path is connected', () => {
    render(<CodebaseIntegrationSection {...defaultProps} />)
    
    expect(screen.getByText('Select Codebase Folder')).toBeInTheDocument()
    expect(screen.getByText(/Browser will show "upload" warning/)).toBeInTheDocument()
    expect(screen.queryByText('Change Folder')).not.toBeInTheDocument()
  })

  it('shows connected path and Change Folder button when path is provided', () => {
    render(<CodebaseIntegrationSection {...defaultProps} currentCodebasePath="/path/to/codebase" />)
    
    expect(screen.getByText('Access Granted:')).toBeInTheDocument()
    expect(screen.getByText('/path/to/codebase')).toBeInTheDocument()
    expect(screen.getByText('Change Folder')).toBeInTheDocument()
    expect(screen.queryByText('Select Codebase Folder')).not.toBeInTheDocument()
  })

  it('handles file selection and calls API successfully', async () => {
    mockConnectCodebase.mockResolvedValue({
      success: true,
      message: 'Codebase connected successfully',
      project_id: 'test-project-id',
      codebase_path: './test-folder'
    })

    render(<CodebaseIntegrationSection {...defaultProps} />)
    
    const fileInput = screen.getByDisplayValue('')
    const file = new File([''], 'test-file.txt', { type: 'text/plain' })
    // Mock webkitRelativePath for the test
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'test-folder/test-file.txt',
      writable: true
    })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(mockConnectCodebase).toHaveBeenCalledWith({
        path: './test-folder',
        project_id: 'test-project-id'
      })
    })
    
    await waitFor(() => {
      expect(defaultProps.onCodebaseConnected).toHaveBeenCalledWith('./test-folder')
    })
  })

  it('handles API error and shows error message', async () => {
    mockConnectCodebase.mockRejectedValue(new Error('API Error'))

    render(<CodebaseIntegrationSection {...defaultProps} />)
    
    const fileInput = screen.getByDisplayValue('')
    const file = new File([''], 'test-file.txt', { type: 'text/plain' })
    // Mock webkitRelativePath for the test
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'test-folder/test-file.txt',
      writable: true
    })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to grant access to codebase/)).toBeInTheDocument()
    })
  })

  it('handles Change Folder button click', () => {
    render(<CodebaseIntegrationSection {...defaultProps} currentCodebasePath="/test/path" />)
    
    const changeFolderButton = screen.getByText('Change Folder')
    fireEvent.click(changeFolderButton)
    
    // Should show Select Codebase Folder button again
    expect(screen.getByText('Select Codebase Folder')).toBeInTheDocument()
    expect(screen.queryByText('Change Folder')).not.toBeInTheDocument()
  })

  it('disables Select Codebase Folder button while connecting', async () => {
    mockConnectCodebase.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    render(<CodebaseIntegrationSection {...defaultProps} />)
    
    const fileInput = screen.getByDisplayValue('')
    const file = new File([''], 'test-file.txt', { type: 'text/plain' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    // Button should be disabled and show "Connecting..."
    expect(screen.getByText('Connecting...')).toBeInTheDocument()
    expect(screen.getByText('Connecting...')).toBeDisabled()
  })
})
