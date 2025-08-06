import React, { useState } from 'react'
import { Task, TaskPriority, TaskCreate, TaskStatus } from '../types'

interface TaskListViewProps {
  tasks: Task[]
  isLoading: boolean
  onTaskClick: (task: Task) => void
  onCreateTask: (task: TaskCreate) => Promise<void>
}

const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  isLoading,
  onTaskClick,
  onCreateTask
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTask, setNewTask] = useState<TaskCreate>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM
  })

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return

    try {
      await onCreateTask(newTask)
      setNewTask({
        title: '',
        description: '',
        priority: TaskPriority.MEDIUM
      })
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating task:', error)
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

  // Filter out completed tasks for display
  const activeTasks = tasks.filter(task => task.status !== TaskStatus.COMPLETED)

  return (
    <div className="task-list-view">
      {showCreateForm && (
        <div className="create-task-form">
          <h4>Create New Task</h4>
          <input
            type="text"
            placeholder="Task title"
            value={newTask.title}
            onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            className="input"
          />
          <textarea
            placeholder="Task description"
            value={newTask.description}
            onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
            className="input"
            rows={3}
          />
          <select
            value={newTask.priority}
            onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
            className="input"
          >
            <option value={TaskPriority.LOW}>Low Priority</option>
            <option value={TaskPriority.MEDIUM}>Medium Priority</option>
            <option value={TaskPriority.HIGH}>High Priority</option>
          </select>
          <div className="form-actions">
            <button
              onClick={handleCreateTask}
              disabled={!newTask.title.trim()}
              className="button"
            >
              Create Task
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="button secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="add-task-btn"
          style={{ margin: '12px', padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + Add Task
        </button>
      )}

      {isLoading ? (
        <div className="loading-indicator">
          <span>Loading tasks...</span>
        </div>
      ) : activeTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✨</div>
          <p>No active tasks</p>
          <p className="empty-subtitle">All caught up! Add a new task to get started.</p>
        </div>
      ) : (
        <div className="task-list">
          {activeTasks.map(task => (
            <div 
              key={task.id} 
              className="task-item" 
              data-task-id={task.id}
              onClick={() => onTaskClick(task)}
            >
              <div className="task-header">
                <div className="task-title">{task.title}</div>
                <div className="task-status">
                  <span className={`status-dot ${task.status}`}></span>
                </div>
              </div>
              {task.description && (
                <div className="task-description">
                  {task.description.length > 60 
                    ? `${task.description.substring(0, 60)}...` 
                    : task.description}
                </div>
              )}
              <div className="task-meta">
                <span className="task-date">{formatDate(task.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TaskListView 