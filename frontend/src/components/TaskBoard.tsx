import React, { useState, useCallback, useMemo } from 'react'
import { Task, TaskPriority, TaskStatus } from '../types'
import { updateTask } from '../services/api'
import './TaskBoard.css'

/**
 * Props for the TaskBoard component
 */
interface TaskBoardProps {
  /** Array of tasks to display */
  tasks: Task[]
  /** Whether the component is in a loading state */
  isLoading: boolean
  /** Callback function when a task is clicked */
  onTaskClick: (task: Task) => void
  /** Project ID for API calls */
  projectId?: string
  /** Callback function when a task is updated */
  onTaskUpdate?: (updatedTask: Task) => void
  /** Object to track expanded subtasks for each task */
  expandedTasks?: Record<string, boolean>
  /** Callback to toggle task expansion */
  toggleTaskExpansion?: (taskId: string) => void
  /** Function to check if a task is expanded */
  isTaskExpanded?: (taskId: string) => boolean
}

/**
 * Internal state for drag and drop operations
 */
interface DragState {
  /** Whether a drag operation is currently active */
  isDragging: boolean
  /** The task being dragged */
  draggedTask: Task | null
  /** The priority level being dragged over */
  draggedOverPriority: TaskPriority | null
}

/**
 * TaskBoard Component
 * 
 * A Kanban-style board that displays tasks organized by priority levels.
 * Supports drag-and-drop functionality to change task priorities.
 * 
 * Features:
 * - Three priority rows: High, Medium, Low
 * - Drag and drop to change task priorities
 * - Optimistic UI updates
 * - Error handling with rollback
 * - Loading states and visual feedback
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <TaskBoard
 *   tasks={tasks}
 *   isLoading={false}
 *   onTaskClick={handleTaskClick}
 *   projectId="project-123"
 *   onTaskUpdate={handleTaskUpdate}
 * />
 * ```
 */
const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  isLoading,
  onTaskClick,
  projectId,
  onTaskUpdate,
  expandedTasks = {},
  toggleTaskExpansion,
  isTaskExpanded = () => false
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedTask: null,
    draggedOverPriority: null
  })
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filter out completed tasks
  const activeTasks = tasks.filter(task => task.status !== TaskStatus.COMPLETED)

  // Build hierarchy map: parent -> children
  const childrenMap = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const parentId = (task.parent_task_id || '') as string
      if (parentId) {
        if (!map.has(parentId)) map.set(parentId, [])
        map.get(parentId)!.push(task)
      }
    }
    
    // Sort children by creation date (oldest first) for each parent
    for (const [parentId, children] of map.entries()) {
      children.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
    
    return map
  }, [tasks])

  // Get root tasks (those without parent_task_id)
  const rootTasks = useMemo(() => activeTasks.filter(task => !task.parent_task_id), [activeTasks])

  // Group root tasks by priority
  const tasksByPriority = {
    [TaskPriority.LOW]: rootTasks.filter(task => task.priority === TaskPriority.LOW),
    [TaskPriority.MEDIUM]: rootTasks.filter(task => task.priority === TaskPriority.MEDIUM),
    [TaskPriority.HIGH]: rootTasks.filter(task => task.priority === TaskPriority.HIGH)
  }

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDragState({
      isDragging: true,
      draggedTask: task,
      draggedOverPriority: null
    })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, priority: TaskPriority) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragState(prev => ({
      ...prev,
      draggedOverPriority: priority
    }))
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragState(prev => ({
      ...prev,
      draggedOverPriority: null
    }))
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetPriority: TaskPriority) => {
    e.preventDefault()
    
    if (!dragState.draggedTask || !projectId) return
    
    const taskId = dragState.draggedTask.id
    const currentPriority = dragState.draggedTask.priority
    
    // Don't update if priority hasn't changed
    if (currentPriority === targetPriority) {
      setDragState({
        isDragging: false,
        draggedTask: null,
        draggedOverPriority: null
      })
      return
    }

    // Optimistic update
    const optimisticTask = { ...dragState.draggedTask, priority: targetPriority }
    onTaskUpdate?.(optimisticTask)
    
    setUpdatingTaskId(taskId)
    setError(null)
    setSuccessMessage(null)

    try {
      const updatedTask = await updateTask(projectId, taskId, { priority: targetPriority })
      onTaskUpdate?.(updatedTask)
      setSuccessMessage(`Task priority updated to ${targetPriority}`)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      // Revert optimistic update
      onTaskUpdate?.(dragState.draggedTask)
      setError('Failed to update task priority. Please try again.')
      
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000)
    } finally {
      setUpdatingTaskId(null)
      setDragState({
        isDragging: false,
        draggedTask: null,
        draggedOverPriority: null
      })
    }
  }, [dragState, projectId, onTaskUpdate])

  const getPriorityLabel = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW:
        return 'Low Priority'
      case TaskPriority.MEDIUM:
        return 'Medium Priority'
      case TaskPriority.HIGH:
        return 'High Priority'
      default:
        return priority
    }
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW:
        return '#10b981' // green
      case TaskPriority.MEDIUM:
        return '#f59e0b' // amber
      case TaskPriority.HIGH:
        return '#ef4444' // red
      default:
        return '#6b7280' // gray
    }
  }

  const renderTaskCard = (task: Task, level: number = 0) => {
    const isBeingUpdated = updatingTaskId === task.id
    const isDragging = dragState.draggedTask?.id === task.id
    const children = childrenMap.get(task.id) || []
    const isParent = children.length > 0
    const isExpanded = isTaskExpanded(task.id)
    const isTopLevel = !task.parent_task_id

    return (
      <div
        key={task.id}
        className={`task-card ${isDragging ? 'dragging' : ''} ${isBeingUpdated ? 'updating' : ''}`}
        draggable={!isBeingUpdated}
        onDragStart={(e) => handleDragStart(e, task)}
        onClick={() => onTaskClick(task)}
        style={{
          opacity: isDragging ? 0.5 : 1,
          cursor: 'pointer',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '8px',
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          position: 'relative',
          marginLeft: isTopLevel ? '0px' : `${level * 20}px`
        }}
      >
        {isBeingUpdated && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '12px',
            color: '#3b82f6'
          }}>
            Updating...
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          {isParent && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTaskExpansion?.(task.id)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                marginRight: '8px',
                color: '#6b7280',
                padding: '2px'
              }}
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
          <div style={{ fontWeight: '500', flex: 1 }}>
            {task.title}
          </div>
          {isParent && (
            <span style={{
              fontSize: '12px',
              color: '#9ca3af',
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '8px'
            }}>
              {children.length} subtask{children.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {task.description && (
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '8px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {task.description}
          </div>
        )}
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          <span>Status: {task.status}</span>
          <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
        </div>

        {/* Render subtasks if expanded */}
        {isParent && isExpanded && (
          <div style={{ marginTop: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
            {children.map(child => renderTaskCard(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderPriorityRow = (priority: TaskPriority) => {
    const tasks = tasksByPriority[priority]
    const isDragOver = dragState.draggedOverPriority === priority
    const color = getPriorityColor(priority)

    return (
      <div
        key={priority}
        className={`priority-row ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => handleDragOver(e, priority)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, priority)}
        style={{
          border: `2px solid ${isDragOver ? color : '#e5e7eb'}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: isDragOver ? `${color}10` : '#f9fafb',
          transition: 'all 0.2s ease',
          minHeight: '120px',
          position: 'relative'
        }}
        data-priority={priority}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `2px solid ${color}`
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: color,
            marginRight: '8px'
          }} />
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>
            {getPriorityLabel(priority)} ({tasks.length} tasks)
          </h3>
          <span style={{
            marginLeft: 'auto',
            backgroundColor: color,
            color: 'white',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {tasks.length}
          </span>
        </div>
        
        <div className="task-cards">
          {tasks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
              padding: '20px'
            }}>
              No tasks
            </div>
          ) : (
            tasks.map(renderTaskCard)
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#6b7280'
      }}>
        Loading tasks...
      </div>
    )
  }

  return (
    <div className="task-board">
      {/* Error and Success Messages */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
      
      {successMessage && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#16a34a',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {successMessage}
        </div>
      )}

      {/* Priority Rows */}
      <div className="priority-rows">
        {renderPriorityRow(TaskPriority.HIGH)}
        {renderPriorityRow(TaskPriority.MEDIUM)}
        {renderPriorityRow(TaskPriority.LOW)}
      </div>

      {/* Empty State */}
      {activeTasks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No active tasks</h3>
          <p style={{ margin: 0 }}>All caught up! Add a new task to get started.</p>
        </div>
      )}
    </div>
  )
}

export default TaskBoard
