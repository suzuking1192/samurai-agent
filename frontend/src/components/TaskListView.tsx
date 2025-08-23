import React, { useState } from 'react'
import { Task, TaskPriority, TaskCreate, TaskStatus, TaskListViewProps } from '../types'
import CompactTaskItem from './CompactTaskItem'

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
  const rootTasks = React.useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks])

  const renderTaskNode = (task: Task, level: number = 0) => {
    const kids = childrenMap.get(task.id) || []
    const hasSubtasks = kids.length > 0
    const isExpanded = expansionCheck(task.id)

    return (
      <div key={task.id}>
        <CompactTaskItem
          task={task}
          onUpdate={async (taskId: string, updates: any) => {
            // Handle task updates if needed
            console.log('Task update:', taskId, updates)
          }}
          onDelete={async (taskId: string) => {
            // Handle task deletion if needed
            console.log('Task delete:', taskId)
          }}
          onTaskClick={onTaskClick}
          style={{ marginLeft: `${level * 22}px` }}
          hasSubtasks={hasSubtasks}
          isExpanded={isExpanded}
          onToggleExpansion={expansionToggle}
          onTaskDetailsClick={onTaskClick}
        />
        
        {/* Render subtasks if expanded */}
        {hasSubtasks && isExpanded && (
          <div>
            {kids.map((child) => renderTaskNode(child, level + 1))}
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
      ) : rootTasks.length === 0 ? (
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