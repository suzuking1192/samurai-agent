import React, { useState, useEffect } from 'react'
import { Task, TaskCreate, TaskUpdate, TaskStatus } from '../types'
import { getTasks, createTask, updateTask, deleteTask, completeTask } from '../services/api'
import TaskListView from './TaskListView'
import TaskDetailsView from './TaskDetailsView'

interface TaskPanelProps {
  projectId?: string
  refreshTrigger?: number
  onTaskContextUpdate?: () => void
}

const TaskPanel: React.FC<TaskPanelProps> = ({ projectId, refreshTrigger, onTaskContextUpdate }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskPanelView, setTaskPanelView] = useState<'list' | 'details'>('list')

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
      // Sort by creation date (oldest first - REVERSED ORDER)
      const sortedTasks = (projectTasks || []).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      setTasks(sortedTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
      setTasks([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTask = async (newTask: TaskCreate) => {
    if (!projectId) return

    try {
      const createdTask = await createTask(projectId, newTask)
      setTasks(prev => [...prev, createdTask]) // Add to end for oldest first order
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

  const handleCompleteTask = async (taskId: string) => {
    if (!projectId) return
    try {
      const updated = await completeTask(projectId, taskId)
      setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)))
      setSelectedTask(prev => (prev && prev.id === taskId ? updated : prev))
    } catch (error) {
      console.error('Error completing task:', error)
      showNotification('Failed to complete task', 'error')
    }
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setTaskPanelView('details')
  }

  const handleBackToList = () => {
    setSelectedTask(null)
    setTaskPanelView('list')
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
        <span className="task-count">({tasks.filter(task => task.status !== TaskStatus.COMPLETED).length})</span>
      </div>

      <div className="panel-content">
        {taskPanelView === 'list' ? (
          <TaskListView 
            tasks={tasks}
            isLoading={isLoading}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
          />
        ) : (
          <TaskDetailsView 
            task={selectedTask!}
            onBack={handleBackToList}
            onSave={handleUpdateTask}
            onDelete={handleDeleteTask}
            projectId={projectId}
            onTaskContextUpdate={onTaskContextUpdate}
            onComplete={handleCompleteTask}
          />
        )}
      </div>
    </div>
  )
}

export default TaskPanel 