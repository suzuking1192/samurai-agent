import React, { useState, useRef } from 'react'
import { connectCodebase, CodebaseConnectRequest } from '../services/api'

interface CodebaseIntegrationSectionProps {
  projectId: string
  currentCodebasePath?: string
  onCodebaseConnected?: (path: string) => void
}

export const CodebaseIntegrationSection: React.FC<CodebaseIntegrationSectionProps> = ({
  projectId,
  currentCodebasePath,
  onCodebaseConnected
}) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(currentCodebasePath || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConnectCodebase = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Extract the folder path from the first file's webkitRelativePath
    // When using webkitdirectory, the path format is "folderName/filePath"
    const file = files[0]
    let folderPath = ''
    
    if (file.webkitRelativePath) {
      // Extract the folder name from the relative path
      const pathParts = file.webkitRelativePath.split('/')
      if (pathParts.length > 0) {
        // Use the folder name as the path - this will be resolved to absolute by the backend
        folderPath = pathParts[0]
      } else {
        setError('Invalid folder selection. Please try selecting a folder again.')
        return
      }
    } else {
      // Fallback to file name if webkitRelativePath is not available
      folderPath = file.name
    }
    
    // Validate that we have a proper folder path
    if (!folderPath) {
      setError('Invalid folder selection. Please try selecting a folder again.')
      return
    }
    
    console.log('Selected folder path:', folderPath)
    console.log('File webkitRelativePath:', file.webkitRelativePath)
    
    setIsConnecting(true)
    setError(null)

    try {
      const request: CodebaseConnectRequest = {
        path: folderPath,
        project_id: projectId
      }

      const response = await connectCodebase(request)
      
      if (response.success) {
        // Use the absolute path returned from the backend
        setSelectedPath(response.codebase_path)
        onCodebaseConnected?.(response.codebase_path)
        setError(null)
      } else {
        setError('Failed to grant access to codebase. Please try again.')
      }
    } catch (err) {
      console.error('Error connecting codebase:', err)
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('400')) {
          setError('Invalid folder path format. Please try selecting the folder again.')
        } else if (err.message.includes('404')) {
          setError('Project not found. Please refresh the page and try again.')
        } else if (err.message.includes('500')) {
          setError('Server error. Please try again later.')
        } else {
          setError(`Failed to grant access to codebase: ${err.message}`)
        }
      } else {
        setError('Failed to grant access to codebase. Please ensure the folder path is valid and try again.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleChangePath = () => {
    setSelectedPath(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="codebase-integration-section">
      <h3 className="codebase-section-title">Codebase Access</h3>
      
      <div className="codebase-section-content">
        <p className="codebase-explainer">
          Allow Samurai Agent to access your codebase files for context. This will be used to understand your project structure and provide better assistance, but files will never be uploaded or used for training.
          <br /><br />
          <strong>Note:</strong> The browser may show an "upload" warning, but this is just for folder selection - no files will actually be uploaded.
        </p>

        {!selectedPath ? (
                  <div className="codebase-connect-section">
          <div className="codebase-browser-warning">
            <span className="warning-icon">⚠️</span>
            <span>Browser will show "upload" warning - this is normal for folder selection</span>
          </div>
          <button
            onClick={handleConnectCodebase}
            disabled={isConnecting}
            className="codebase-connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Select Codebase Folder'}
          </button>
          
          {/* Hidden file input for folder selection */}
          <input
            ref={fileInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        ) : (
          <div className="codebase-connected-section">
            <div className="codebase-path-display">
              <strong>Access Granted:</strong> {selectedPath}
            </div>
            <div className="codebase-access-note">
              Samurai Agent can now read files in this folder for context.
            </div>
            <button
              onClick={handleChangePath}
              className="codebase-change-path-button"
            >
              Change Folder
            </button>
          </div>
        )}

        {error && (
          <div className="codebase-error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
