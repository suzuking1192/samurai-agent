import React, { useState } from 'react'
import { Task, TaskStatus, TaskPriority, TaskUpdate, CompactTaskItemProps } from '../types'

const CompactTaskItem: React.FC<CompactTaskItemProps> = ({ 
  task, 
  onUpdate, 
  onDelete,
  onTaskClick,
  style,
  hasSubtasks,
  isExpanded,
  onToggleExpansion,
  onTaskDetailsClick
}) => {
  const [showActions, setShowActions] = useState(false)

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

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Unified click behavior: expand/collapse if has subtasks, otherwise open details
    if (hasSubtasks) {
      onToggleExpansion(task.id)
    } else {
      onTaskDetailsClick(task)
    }
  }

  const handleExpansionIconClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the parent div's click handler
    onToggleExpansion(task.id)
  }

  const handleStatusChange = async (newStatus: TaskStatus) => {
    const oldStatus = task.status
    
    // If completing a task, add fade-out animation before updating
    if (newStatus === TaskStatus.COMPLETED && oldStatus !== TaskStatus.COMPLETED) {
      const taskElement = document.querySelector(`[data-task-id="${task.id}"]`)
      if (taskElement) {
        taskElement.classList.add('completing')
      }
      
      // Wait for animation before updating
      setTimeout(async () => {
        await onUpdate(task.id, { status: newStatus })
      }, 300)
    } else {
      // For other status changes, update immediately
      await onUpdate(task.id, { status: newStatus })
    }
  }

  return (
    <div 
      className="compact-task-item"
      data-task-id={task.id}
      style={style}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleItemClick}
    >
      <div className="item-header">
        <span className="task-status-icon" style={{ color: getStatusColor(task.status) }}>
          {getStatusIcon(task.status)}
        </span>
        
        <span className="task-priority-icon">
          {getPriorityIcon(task.priority)}
        </span>
        
        {/* Expansion icon for tasks with subtasks */}
        {hasSubtasks && (
          <button
            onClick={handleExpansionIconClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              marginRight: '6px',
              color: '#6b7280',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        )}
        
        <div className="item-title">
          {task.title}
        </div>
        
        {showActions && (
          <div className="item-actions">
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="action-btn"
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
              className="action-btn"
              title="Delete task"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
      
      {task.description && (
        <div className="item-description">
          {task.description}
        </div>
      )}
      
      <div className="item-meta">
        <span className="status-dot" style={{ backgroundColor: getStatusColor(task.status) }}></span>
        <span className="date">{formatDate(task.created_at)}</span>
      </div>
    </div>
  )
}

export default CompactTaskItem 