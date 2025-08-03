import React, { useState, useEffect } from 'react'
import { Task, TaskStatus, TaskPriority, TaskUpdate } from '../types'
import FullScreenModal from './FullScreenModal'

interface GeneratedPrompt {
  prompt: string
  task_id: string
  generated_at: string
  prompt_length: number
  related_memories_count: number
}

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onSave: (taskId: string, updates: TaskUpdate) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [editMode, setEditMode] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    due_date: ''
  })

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: ''
      })
    }
  }, [task])

  const handleSave = async () => {
    if (!task) return
    
    try {
      await onSave(task.id, formData)
      setEditMode(false)
      showNotification('Task updated successfully', 'success')
    } catch (error) {
      showNotification('Failed to update task', 'error')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await onDelete(task.id)
        onClose()
        showNotification('Task deleted successfully', 'success')
      } catch (error) {
        showNotification('Failed to delete task', 'error')
      }
    }
  }

  const handleGeneratePrompt = async () => {
    if (!task) return
    
    setIsGeneratingPrompt(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate prompt')
      }
      
      const data: GeneratedPrompt = await response.json()
      setGeneratedPrompt(data)
      setShowPrompt(true)
      showNotification('Intelligent prompt generated successfully!', 'success')
    } catch (error) {
      console.error('Error generating prompt:', error)
      showNotification('Failed to generate prompt', 'error')
    } finally {
      setIsGeneratingPrompt(false)
    }
  }

  const copyPromptToClipboard = async () => {
    if (!generatedPrompt) return
    
    try {
      await navigator.clipboard.writeText(generatedPrompt.prompt)
      showNotification('Prompt copied to clipboard!', 'success')
    } catch (error) {
      showNotification('Failed to copy prompt', 'error')
    }
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return '📋'
      case TaskStatus.IN_PROGRESS:
        return '⏳'
      case TaskStatus.COMPLETED:
        return '✅'
      default:
        return '📝'
    }
  }

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW:
        return '🔵'
      case TaskPriority.MEDIUM:
        return '🟡'
      case TaskPriority.HIGH:
        return '🟠'
      default:
        return '⚪'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Simple notification implementation
    const notification = document.createElement('div')
    notification.className = `notification ${type}`
    notification.textContent = message
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 1001;
      ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  if (!isOpen || !task) return null

  return (
    <FullScreenModal isOpen={isOpen} onClose={onClose}>
      <div className="task-modal-container">
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">📝</span>
            {editMode ? (
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="title-input"
                placeholder="Task title..."
              />
            ) : (
              <h1>{task.title}</h1>
            )}
          </div>
          <div className="modal-actions">
            {!showPrompt && !editMode && (
              <button 
                onClick={handleGeneratePrompt} 
                className="btn-generate-prompt"
                disabled={isGeneratingPrompt}
              >
                {isGeneratingPrompt ? (
                  <>⏳ Generating...</>
                ) : (
                  <>🤖 Generate Prompt</>
                )}
              </button>
            )}
            
            {editMode ? (
              <>
                <button onClick={handleSave} className="btn-save">
                  💾 Save
                </button>
                <button onClick={() => setEditMode(false)} className="btn-cancel">
                  ✖️ Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)} className="btn-edit">
                  ✏️ Edit
                </button>
                <button onClick={handleDelete} className="btn-delete">
                  🗑️ Delete
                </button>
              </>
            )}
            <button onClick={onClose} className="btn-close">
              ✖️
            </button>
          </div>
        </div>

        <div className="modal-body">
          {showPrompt && generatedPrompt ? (
            /* Prompt Display View */
            <div className="prompt-view">
              <div className="prompt-header">
                <h2>🤖 Intelligent Prompt for AI Coding Tools</h2>
                <div className="prompt-actions">
                  <button onClick={copyPromptToClipboard} className="btn-copy">
                    📋 Copy to Clipboard
                  </button>
                  <button onClick={() => setShowPrompt(false)} className="btn-back">
                    ← Back to Task
                  </button>
                </div>
              </div>
              
              <div className="prompt-content">
                <pre className="prompt-text">{generatedPrompt.prompt}</pre>
              </div>
              
              <div className="prompt-footer">
                <p className="prompt-info">
                  This prompt includes task details + semantically related memories from your project.
                  Copy and paste into Cursor, Claude, or any AI coding tool.
                </p>
              </div>
            </div>
          ) : (
            /* Regular Task Details View */
            <div className="task-details-grid">
              {/* Left Column - Main Content */}
              <div className="main-content">
                {/* Status and Priority Row */}
                <div className="detail-row">
                <div className="detail-field">
                  <label>Status:</label>
                  {editMode ? (
                    <select
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}
                      className="status-select"
                    >
                      <option value={TaskStatus.PENDING}>📋 Pending</option>
                      <option value={TaskStatus.IN_PROGRESS}>⏳ In Progress</option>
                      <option value={TaskStatus.COMPLETED}>✅ Completed</option>
                    </select>
                  ) : (
                    <span className={`status-badge status-${task.status}`}>
                      {getStatusIcon(task.status)} {task.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                
                <div className="detail-field">
                  <label>Priority:</label>
                  {editMode ? (
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}
                      className="priority-select"
                    >
                      <option value={TaskPriority.LOW}>🔵 Low</option>
                      <option value={TaskPriority.MEDIUM}>🟡 Medium</option>
                      <option value={TaskPriority.HIGH}>🟠 High</option>
                    </select>
                  ) : (
                    <span className={`priority-badge priority-${task.priority}`}>
                      {getPriorityIcon(task.priority)} {task.priority}
                    </span>
                  )}
                </div>
              </div>

                {/* Description Section */}
                <div className="description-section">
                  <label>Description:</label>
                  {editMode ? (
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="description-textarea"
                      rows={10}
                      placeholder="Detailed task description..."
                    />
                  ) : (
                    <div className="description-display">
                      {task.description || 'No description provided'}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Metadata */}
              <div className="sidebar-content">
                <div className="metadata-section">
                  <h3>📊 Task Information</h3>
                  <div className="metadata-list">
                    <div className="metadata-item">
                      <strong>Created:</strong>
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                    <div className="metadata-item">
                      <strong>Updated:</strong>
                      <span>{formatDate(task.updated_at)}</span>
                    </div>
                    <div className="metadata-item">
                      <strong>Task ID:</strong>
                      <span className="task-id">{task.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </FullScreenModal>
  )
}

export default TaskDetailModal 