import React, { useState, useEffect } from 'react'
import { Task, TaskStatus, TaskPriority, TaskUpdate } from '../types'

interface TaskDetailsViewProps {
  task: Task
  onBack: () => void
  onSave: (taskId: string, updates: TaskUpdate) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
}

const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({
  task,
  onBack,
  onSave,
  onDelete
}) => {
  const [editMode, setEditMode] = useState(false)
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
    try {
      await onSave(task.id, formData)
      setEditMode(false)
      showNotification('Task updated successfully', 'success')
    } catch (error) {
      showNotification('Failed to update task', 'error')
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await onDelete(task.id)
        onBack()
        showNotification('Task deleted successfully', 'success')
      } catch (error) {
        showNotification('Failed to delete task', 'error')
      }
    }
  }

  const copyDescriptionToClipboard = async () => {
    if (!task?.description) return
    
    try {
      await navigator.clipboard.writeText(task.description)
      showNotification('Implementation prompt copied to clipboard!', 'success')
    } catch (error) {
      showNotification('Failed to copy implementation prompt', 'error')
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
        return '🟢'
      case TaskPriority.MEDIUM:
        return '🟡'
      case TaskPriority.HIGH:
        return '🔴'
      default:
        return '🟡'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
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

  return (
    <div className="task-details-panel">
      {/* Header with back navigation */}
      <div className="task-details-header">
        <button onClick={onBack} className="back-button">
          ← Back to Tasks
        </button>
        <div className="task-details-actions">
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
        </div>
      </div>

      {/* Task content */}
      <div className="task-details-content">
        <div className="task-details-main">
          {/* Title */}
          <div className="detail-section">
            <label className="detail-label">Title:</label>
            {editMode ? (
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="title-input"
                placeholder="Task title..."
              />
            ) : (
              <h2 className="task-title-display">{task.title}</h2>
            )}
          </div>

          {/* Status and Priority Row */}
          <div className="detail-row">
            <div className="detail-field">
              <label className="detail-label">Status:</label>
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
              <label className="detail-label">Priority:</label>
              {editMode ? (
                <select
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}
                  className="priority-select"
                >
                  <option value={TaskPriority.LOW}>🟢 Low</option>
                  <option value={TaskPriority.MEDIUM}>🟡 Medium</option>
                  <option value={TaskPriority.HIGH}>🔴 High</option>
                </select>
              ) : (
                <span className={`priority-badge priority-${task.priority}`}>
                  {getPriorityIcon(task.priority)} {task.priority}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="detail-section">
            <label className="detail-label">Description:</label>
            {editMode ? (
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="description-textarea"
                placeholder="Task description..."
                rows={8}
              />
            ) : (
              <div className="description-display">
                {task.description || 'No description provided'}
              </div>
            )}
          </div>

          {/* Copy Implementation Prompt Button */}
          <div className="detail-section">
            <button 
              onClick={copyDescriptionToClipboard}
              className="copy-button"
              disabled={!task.description}
            >
              📋 Copy Implementation Prompt
            </button>
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div className="task-details-sidebar">
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
    </div>
  )
}

export default TaskDetailsView 