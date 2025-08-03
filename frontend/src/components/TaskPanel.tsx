import React, { useState, useEffect } from 'react'
import { Task, TaskPriority, TaskCreate, TaskUpdate, TaskStatus } from '../types'
import { getTasks, createTask, updateTask, deleteTask } from '../services/api'
import TaskDetailModal from './TaskDetailModal'

interface TaskPanelProps {
  projectId?: string
  refreshTrigger?: number
}

const TaskPanel: React.FC<TaskPanelProps> = ({ projectId, refreshTrigger }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState<TaskCreate>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM
  })

  useEffect(() => {
    if (projectId) {
      loadTasks()
    } else {
      setTasks([])
    }
  }, [projectId, refreshTrigger])

  const loadTasks = async () => {
    if (!projectId) return
    
    setIsLoading(true)
    try {
      const projectTasks = await getTasks(projectId)
      // Sort by creation date (newest first)
      const sortedTasks = (projectTasks || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setTasks(sortedTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
      setTasks([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!projectId || !newTask.title.trim()) return

    try {
      const createdTask = await createTask(projectId, newTask)
      setTasks(prev => [createdTask, ...prev]) // Add to beginning for newest first
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

  const handleUpdateTask = async (taskId: string, updates: TaskUpdate) => {
    const oldStatus = tasks.find(task => task.id === taskId)?.status
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`)
    
    try {
      // If completing a task, add fade-out animation before hiding
      if (updates.status === TaskStatus.COMPLETED && oldStatus !== TaskStatus.COMPLETED) {
        if (taskElement) {
          taskElement.classList.add('completing')
        }
        
        // Wait for animation before updating state
        setTimeout(async () => {
          // Update backend
          const updatedTask = await updateTask(projectId!, taskId, updates)
          
          // Update local state - this will filter out the completed task
          setTasks(prev => prev.map(task => 
            task.id === taskId ? updatedTask : task
          ))
          
          // Show success notification
          showNotification('🎉 Task completed and archived!', 'success')
        }, 300)
        
      } else {
        // For other status changes, update immediately
        const updatedTask = await updateTask(projectId!, taskId, updates)
        
        setTasks(prev => prev.map(task => 
          task.id === taskId ? updatedTask : task
        ))
        
        showNotification(`Task status updated to ${updates.status}`, 'success')
      }
      
    } catch (error) {
      console.error('Error updating task:', error)
      showNotification('Failed to update task status', 'error')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(projectId!, taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (error) {
      console.error('Error deleting task:', error)
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

  const openTaskModal = (task: Task) => {
    setSelectedTask(task)
  }

  const closeTaskModal = () => {
    setSelectedTask(null)
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

  // Filter out completed tasks for display
  const activeTasks = tasks.filter(task => task.status !== TaskStatus.COMPLETED)

  if (!projectId) {
    return (
      <div className="task-panel">
        <div className="panel-header">
          <h3>📋 Tasks</h3>
          <span className="task-count">(0)</span>
        </div>
        <div className="empty-state">
          <p>Please select a project to view tasks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="task-panel">
      <div className="panel-header">
        <h3>📋 Tasks</h3>
        <span className="task-count">({activeTasks.length})</span>
      </div>

      <div className="panel-content">
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
                onClick={() => openTaskModal(task)}
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

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={true}
          onClose={closeTaskModal}
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  )
}

export default TaskPanel 