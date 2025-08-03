import React, { useState } from 'react'
import { Task, TaskStatus, TaskPriority, TaskUpdate } from '../types'
import TaskDetailModal from './TaskDetailModal'

interface CompactTaskItemProps {
  task: Task
  onUpdate: (taskId: string, updates: TaskUpdate) => void
  onDelete: (taskId: string) => void
  level?: number
  style?: React.CSSProperties
}

const CompactTaskItem: React.FC<CompactTaskItemProps> = ({ 
  task, 
  onUpdate, 
  onDelete, 
  level = 0,
  style 
}) => {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [isExpanding, setIsExpanding] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return '⏳'
      case TaskStatus.IN_PROGRESS:
        return '🔄'
      case TaskStatus.COMPLETED:
        return '✅'
      default:
        return '📝'
    }
  }

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return '🔴'
      case TaskPriority.MEDIUM:
        return '🟡'
      case TaskPriority.LOW:
        return '🟢'
      default:
        return '⚪'
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return '#f59e0b'
      case TaskStatus.IN_PROGRESS:
        return '#3b82f6'
      case TaskStatus.COMPLETED:
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  // CRITICAL: Enhanced title display with better truncation
  const getDisplayTitle = () => {
    const maxLength = 80
    if (task.title.length <= maxLength) {
      return task.title
    }
    return task.title.substring(0, maxLength) + '...'
  }

  // CRITICAL: Get preview of description
  const getDescriptionPreview = () => {
    if (!task.description) return null
    const maxLength = 60
    if (task.description.length <= maxLength) {
      return task.description
    }
    return task.description.substring(0, maxLength) + '...'
  }

  const handleToggle = () => {
    setIsExpanding(true)
    setExpanded(!expanded)
    setTimeout(() => setIsExpanding(false), 300) // Match animation duration
  }

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setModalOpen(true)
  }

  const handleSaveTask = async (taskId: string, updates: TaskUpdate) => {
    await onUpdate(taskId, updates)
  }

  const handleDeleteTask = async (taskId: string) => {
    await onDelete(taskId)
  }

  return (
    <>
      <div 
        className={`compact-task-item ${expanded ? 'expanded' : ''} ${isExpanding ? 'expanding' : ''}`}
        style={{ 
          paddingLeft: `${level * 16 + 12}px`,
          ...style 
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={handleItemClick}
      >
      <div className="compact-task-header">
        <div className="compact-task-main">
          <button
            className="expand-button"
            onClick={handleToggle}
            style={{ visibility: task.description ? 'visible' : 'hidden' }}
          >
            {expanded ? '▼' : '▶'}
          </button>
          
          <span className="task-status-icon" style={{ color: getStatusColor(task.status) }}>
            {getStatusIcon(task.status)}
          </span>
          
          <span className="task-priority-icon">
            {getPriorityIcon(task.priority)}
          </span>
          
          {/* CRITICAL: Enhanced title container */}
          <div className="item-title-container">
            <div className="task-title" title={task.title}>
              {getDisplayTitle()}
            </div>
            
            {/* CRITICAL: Show description preview as subtitle */}
            {!expanded && task.description && (
              <div className="item-subtitle">
                <div className="item-preview">
                  {getDescriptionPreview()}
                </div>
                <div className="item-meta">
                  {formatDate(task.created_at)} • {task.status.replace('_', ' ')}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="compact-task-meta">
          {!expanded && (
            <span className="task-date">
              {formatDate(task.created_at)}
            </span>
          )}
          
          {showActions && (
            <div className="compact-task-actions">
              <select
                value={task.status}
                onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
                className="compact-status-select"
                onClick={(e) => e.stopPropagation()}
              >
                <option value={TaskStatus.PENDING}>Pending</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.COMPLETED}>Completed</option>
              </select>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(task.id)
                }}
                className="compact-delete-btn"
                title="Delete task"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* CRITICAL: Proper expansion behavior without overlap */}
      <div className={`compact-task-details ${expanded ? 'visible' : 'hidden'}`}>
        <div className="details-content">
          {task.description && (
            <div className="description-section">
              <h4>Description:</h4>
              <p>{task.description}</p>
            </div>
          )}
          
          <div className="metadata-section">
            <h4>Details:</h4>
            <div className="metadata-grid">
              <span><strong>Status:</strong> {task.status.replace('_', ' ')}</span>
              <span><strong>Priority:</strong> {task.priority}</span>
              <span><strong>Created:</strong> {new Date(task.created_at).toLocaleString()}</span>
              <span><strong>Updated:</strong> {new Date(task.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
      
      <TaskDetailModal
        task={task}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </>
  )
}

export default CompactTaskItem 