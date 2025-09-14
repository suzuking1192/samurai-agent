import React, { useState, useEffect } from 'react'
import { getProjectLLMModels, setProjectLLMModel, LLMModel } from '../services/api'

interface LLMSelectionDropdownProps {
  projectId?: string
  selectedModelId: string | null
  onModelChange: (modelId: string | null) => void
  disabled?: boolean
}

const LLMSelectionDropdown: React.FC<LLMSelectionDropdownProps> = ({
  projectId,
  selectedModelId,
  onModelChange,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)

  // Load available models and current selection when the component mounts
  useEffect(() => {
    const loadModelsAndSelection = async () => {
      if (!projectId) return
      
      setIsLoadingModels(true)
      try {
        const response = await getProjectLLMModels(projectId)
        setAvailableModels(response.available_models)
        
        // Set the selected model if one is configured
        if (response.selected_model_id) {
          onModelChange(response.selected_model_id)
        } else if (response.available_models.length > 0) {
          // If no model is selected but models are available, select the first one
          onModelChange(response.available_models[0].id)
        }
      } catch (error) {
        console.error('Error loading LLM models:', error)
        setAvailableModels([])
      } finally {
        setIsLoadingModels(false)
      }
    }

    loadModelsAndSelection()
  }, [projectId, onModelChange])

  const handleModelChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = event.target.value || null
    
    if (!projectId || !newModelId) {
      onModelChange(newModelId)
      return
    }
    
    setIsLoading(true)
    try {
      await setProjectLLMModel(projectId, newModelId)
      onModelChange(newModelId)
    } catch (error) {
      console.error('Error setting LLM model:', error)
      // Revert the selection on error
      event.target.value = selectedModelId || ''
    } finally {
      setIsLoading(false)
    }
  }

  const getModelDisplayName = (model: LLMModel): string => {
    return model.name
  }

  const getModelDescription = (model: LLMModel): string => {
    return `${model.provider} model: ${model.id}`
  }

  if (isLoadingModels) {
    return (
      <div className="llm-selection-dropdown">
        <select disabled className="llm-select">
          <option>Loading models...</option>
        </select>
        <style jsx>{`
          .llm-selection-dropdown {
            position: relative;
            display: inline-block;
          }
          
          .llm-select {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background-color: #f9fafb;
            font-size: 14px;
            color: #9ca3af;
            cursor: not-allowed;
            min-width: 200px;
          }
        `}</style>
      </div>
    )
  }

  if (availableModels.length === 0) {
    return (
      <div className="llm-selection-dropdown">
        <select disabled className="llm-select">
          <option>No models available</option>
        </select>
        <style jsx>{`
          .llm-selection-dropdown {
            position: relative;
            display: inline-block;
          }
          
          .llm-select {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background-color: #f9fafb;
            font-size: 14px;
            color: #9ca3af;
            cursor: not-allowed;
            min-width: 200px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="llm-selection-dropdown">
      <select
        value={selectedModelId || ''}
        onChange={handleModelChange}
        disabled={disabled || isLoading}
        className="llm-select"
        title={selectedModelId ? getModelDescription(availableModels.find(m => m.id === selectedModelId)!) : 'Select an LLM model'}
      >
        {availableModels.map((model) => (
          <option key={model.id} value={model.id}>
            {getModelDisplayName(model)}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="llm-loading">
          <span className="loading-spinner">⟳</span>
        </div>
      )}
      <style jsx>{`
        .llm-selection-dropdown {
          position: relative;
          display: inline-block;
        }
        
        .llm-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background-color: white;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.2s ease;
          min-width: 200px;
        }
        
        .llm-select:hover:not(:disabled) {
          border-color: #9ca3af;
        }
        
        .llm-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .llm-select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }
        
        .llm-loading {
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

export default LLMSelectionDropdown
