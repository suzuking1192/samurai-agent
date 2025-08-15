import React, { useState } from 'react'
import { Task, TaskPriority, TaskCreate, TaskStatus } from '../types'

interface TaskListViewProps {
  tasks: Task[]
  isLoading: boolean
  onTaskClick: (task: Task) => void
  onCreateTask: (task: TaskCreate) => Promise<void>
  projectId?: string
  expandedTasks?: Record<string, boolean>
  toggleTaskExpansion?: (taskId: string) => void
  isTaskExpanded?: (taskId: string) => boolean
}

const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  isLoading,
  onTaskClick,
  onCreateTask,
  projectId,
  expandedTasks,
  toggleTaskExpansion,
  isTaskExpanded
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTask, setNewTask] = useState<TaskCreate>({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM
  })

  // Use expansion state from props if provided, otherwise use defaults
  const expansionState = expandedTasks || {}
  const expansionToggle = toggleTaskExpansion || (() => {})
  const expansionCheck = isTaskExpanded || (() => false)

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

  // Filter out completed tasks for top-level display only
  const activeTasks = tasks.filter(task => task.status !== TaskStatus.COMPLETED)

  // Build a hierarchy map: parent -> children
  const childrenMap = React.useMemo(() => {
    const map = new Map<string, Task[]>()
    // Build children map from ALL tasks so completed subtasks still appear
    for (const t of tasks) {
      const parentId = (t.parent_task_id || '') as string
      if (parentId) {
        if (!map.has(parentId)) map.set(parentId, [])
        map.get(parentId)!.push(t)
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

  // Root tasks are those without parent_task_id
  const rootTasks = React.useMemo(() => activeTasks.filter(t => !t.parent_task_id), [activeTasks])

  // Remove the old local state - now using persistent state from the hook

  const renderTaskNode = (task: Task, level: number = 0, trail: boolean[] = []) => {
    const kids = childrenMap.get(task.id) || []
    const isParent = kids.length > 0
    const isExpanded = expansionCheck(task.id)
    const nodeIcon = isParent ? '📂' : '📄'
    const buildAsciiPrefix = (trailFlags: boolean[], isLast: boolean) => {
      const parts: string[] = []
      for (let i = 0; i < trailFlags.length; i++) {
        parts.push(trailFlags[i] ? '   ' : '│  ')
      }
      parts.push(isLast ? '└─ ' : '├─ ')
      return parts.join('')
    }

    return (
      <div key={task.id}>
        <div 
          className="task-item" 
          data-task-id={task.id}
          onClick={() => {
            if (isParent) {
              expansionToggle(task.id)
            } else if (level > 0) {
              onTaskClick(task)
            }
          }}
          style={{ marginLeft: `${level * 22}px`, paddingLeft: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          {isParent && (
            <span aria-label={isExpanded ? 'Collapse' : 'Expand'} style={{ marginRight: 6 }}>
              {isExpanded ? '▾' : '▸'}
            </span>
          )}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* ASCII tree prefix for VSCode-like view */}
            {level > 0 && (
              <span aria-hidden="true" style={{ fontFamily: 'monospace', color: '#64748b' }}>
                {buildAsciiPrefix(trail.slice(0, -1), trail[trail.length - 1] ?? false)}
              </span>
            )}
            <span aria-hidden="true" style={{ opacity: 0.8 }}>{nodeIcon}</span>
            <div className="task-title" title={task.title}>{task.title}</div>
            <button 
              className={`see-details-btn ${level > 0 ? 'small' : ''}`}
              onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
              aria-label={`See details for ${task.title}`}
              style={{ marginLeft: 'auto' }}
            >
              See details
            </button>
          </div>
        </div>
        {/* Simplified nested display: do not show description/meta for file-tree clarity */}
        {isParent && isExpanded && (
          <div>
            {kids.map((child, idx) => {
              const isLast = idx === kids.length - 1
              return renderTaskNode(child, level + 1, [...trail, isLast])
            })}
          </div>
        )}
      </div>
    )
  }

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
          {rootTasks.map(task => renderTaskNode(task, 0))}
        </div>
      )}
    </div>
  )
}

export default TaskListView 