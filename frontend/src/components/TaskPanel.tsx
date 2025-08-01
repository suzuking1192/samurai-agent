import React, { useState, useEffect } from 'react'
import { Task, TaskStatus, TaskPriority, TaskCreate, TaskUpdate } from '../types'
import { getTasks, createTask, updateTask, deleteTask } from '../services/api'

interface TaskPanelProps {
  projectId?: string
}

const TaskPanel: React.FC<TaskPanelProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
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
  }, [projectId])

  const loadTasks = async () => {
    if (!projectId) return
    
    setIsLoading(true)
    try {
      const projectTasks = await getTasks(projectId)
      setTasks(projectTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!projectId || !newTask.title.trim()) return

    try {
      const createdTask = await createTask(projectId, newTask)
      setTasks(prev => [...prev, createdTask])
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
    try {
      const updatedTask = await updateTask(taskId, updates)
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return 'status-pending'
      case TaskStatus.IN_PROGRESS:
        return 'status-in-progress'
      case TaskStatus.COMPLETED:
        return 'status-completed'
      default:
        return ''
    }
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'priority-high'
      case TaskPriority.MEDIUM:
        return 'priority-medium'
      case TaskPriority.LOW:
        return 'priority-low'
      default:
        return ''
    }
  }

  if (!projectId) {
    return (
      <div className="panel-content">
        <div className="card">
          <p>Please select a project to view tasks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="task-panel">
      <div className="panel-header">
        Tasks
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="button"
          style={{ marginLeft: 'auto' }}
        >
          {showCreateForm ? 'Cancel' : 'Add Task'}
        </button>
      </div>
      
      <div className="panel-content">
        {showCreateForm && (
          <div className="card">
            <h3>Create New Task</h3>
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              className="input"
              style={{ marginBottom: '0.5rem' }}
            />
            <textarea
              placeholder="Task description"
              value={newTask.description}
              onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
              className="input"
              rows={3}
              style={{ marginBottom: '0.5rem' }}
            />
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
              className="input"
              style={{ marginBottom: '0.5rem' }}
            >
              <option value={TaskPriority.LOW}>Low Priority</option>
              <option value={TaskPriority.MEDIUM}>Medium Priority</option>
              <option value={TaskPriority.HIGH}>High Priority</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.title.trim()}
                className="button"
              >
                Create Task
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="button"
                style={{ backgroundColor: '#95a5a6' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="card">
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="card">
            <p>No tasks yet. Create your first task!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="card task-card">
              <div className="task-header">
                <h4>{task.title}</h4>
                <div className="task-actions">
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                    className="input"
                    style={{ width: 'auto', marginRight: '0.5rem' }}
                  >
                    <option value={TaskStatus.PENDING}>Pending</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.COMPLETED}>Completed</option>
                  </select>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="button"
                    style={{ backgroundColor: '#e74c3c', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <p className="task-description">{task.description}</p>
              
              <div className="task-meta">
                <span className={`task-status ${getStatusColor(task.status)}`}>
                  {task.status.replace('_', ' ')}
                </span>
                <span className={`task-priority ${getPriorityColor(task.priority)}`}>
                  {task.priority} priority
                </span>
                <span className="task-date">
                  {new Date(task.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TaskPanel 