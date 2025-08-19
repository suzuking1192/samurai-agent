import React, { useState, useEffect } from 'react'
import { CodeContextMode } from '../types'
import { getProjectModeSelection } from '../services/api'

interface ModeSelectionDropdownProps {
  projectId?: string
  selectedMode: CodeContextMode
  onModeChange: (mode: CodeContextMode) => void
  disabled?: boolean
}

const ModeSelectionDropdown: React.FC<ModeSelectionDropdownProps> = ({
  projectId,
  selectedMode,
  onModeChange,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false)

  // Load the current mode from the backend when the component mounts
  useEffect(() => {
    const loadCurrentMode = async () => {
      if (!projectId) return
      
      setIsLoading(true)
      try {
        const response = await getProjectModeSelection(projectId)
        const mode = response.code_context_mode as CodeContextMode
        onModeChange(mode)
      } catch (error) {
        console.error('Error loading mode selection:', error)
        // Default to AUTO if loading fails
        onModeChange(CodeContextMode.AUTO)
      } finally {
        setIsLoading(false)
      }
    }

    loadCurrentMode()
  }, [projectId, onModeChange])

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = event.target.value as CodeContextMode
    onModeChange(newMode)
  }

  const getModeLabel = (mode: CodeContextMode): string => {
    switch (mode) {
      case CodeContextMode.AUTO:
        return 'Auto'
      case CodeContextMode.WITH_CODE_LOOKUP:
        return 'With Code Lookup'
      case CodeContextMode.WITHOUT_CODE_LOOKUP:
        return 'Without Code Lookup'
      default:
        return 'Auto'
    }
  }

  const getModeDescription = (mode: CodeContextMode): string => {
    switch (mode) {
      case CodeContextMode.AUTO:
        return 'Automatically decide when to look up code'
      case CodeContextMode.WITH_CODE_LOOKUP:
        return 'Always look up relevant code'
      case CodeContextMode.WITHOUT_CODE_LOOKUP:
        return 'Never look up code'
      default:
        return 'Automatically decide when to look up code'
    }
  }

  return (
    <div className="mode-selection-dropdown">
      <select
        value={selectedMode}
        onChange={handleModeChange}
        disabled={disabled || isLoading}
        className="mode-select"
        title={getModeDescription(selectedMode)}
      >
        <option value={CodeContextMode.AUTO}>
          {getModeLabel(CodeContextMode.AUTO)}
        </option>
        <option value={CodeContextMode.WITH_CODE_LOOKUP}>
          {getModeLabel(CodeContextMode.WITH_CODE_LOOKUP)}
        </option>
        <option value={CodeContextMode.WITHOUT_CODE_LOOKUP}>
          {getModeLabel(CodeContextMode.WITHOUT_CODE_LOOKUP)}
        </option>
      </select>
      {isLoading && (
        <div className="mode-loading">
          <span className="loading-spinner">⟳</span>
        </div>
      )}
      <style jsx>{`
        .mode-selection-dropdown {
          position: relative;
          display: inline-block;
        }
        
        .mode-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background-color: white;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.2s ease;
          min-width: 140px;
        }
        
        .mode-select:hover:not(:disabled) {
          border-color: #9ca3af;
        }
        
        .mode-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .mode-select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }
        
        .mode-loading {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }
        
        .loading-spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
          font-size: 16px;
          color: #6b7280;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default ModeSelectionDropdown
