import React, { useState, useEffect } from 'react'
import { Task, TaskPriority, TaskCreate, TaskUpdate } from '../types'
import { getTasks, createTask, updateTask, deleteTask } from '../services/api'
import CompactTaskItem from './CompactTaskItem'
import VirtualizedList from './VirtualizedList'
import ViewControls, { ViewMode } from './ViewControls'
import SemanticHierarchicalView from './SemanticHierarchicalView'

interface TaskPanelProps {
  projectId?: string
  refreshTrigger?: number
}

const TaskPanel: React.FC<TaskPanelProps> = ({ projectId, refreshTrigger }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [currentView, setCurrentView] = useState<ViewMode>('list')
  const [semanticOptions, setSemanticOptions] = useState({
    clustering: 'content',
    depth: 2
  })
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
      setTasks(projectTasks || []) // Ensure we always have an array
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
      const updatedTask = await updateTask(projectId!, taskId, updates)
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
    } catch (error) {
      console.error('Error updating task:', error)
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

  const handleSemanticOptionChange = (option: string, value: any) => {
    setSemanticOptions(prev => ({
      ...prev,
      [option]: value
    }))
  }

  const renderTaskItem = (task: Task, _index: number, style: React.CSSProperties) => (
    <CompactTaskItem
      key={task.id}
      task={task}
      onUpdate={handleUpdateTask}
      onDelete={handleDeleteTask}
      style={style}
    />
  )

  if (!projectId) {
    return (
      <div className="panel-content">
        <div className="empty-state">
          <p>Please select a project to view tasks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="task-panel">
      <div className="panel-header">
        <div className="panel-header-content">
          <h3>📋 Tasks</h3>
          <span className="task-count">({tasks.length})</span>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="add-task-btn"
        >
          {showCreateForm ? 'Cancel' : 'Add Task'}
        </button>
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

        <ViewControls
          currentView={currentView}
          onViewChange={setCurrentView}
          semanticOptions={semanticOptions}
          onSemanticOptionChange={handleSemanticOptionChange}
          className="view-controls-compact"
        />

        {isLoading ? (
          <div className="loading-indicator">
            <span>Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet. Create your first task!</p>
          </div>
        ) : (
          <div className="tasks-content">
            {currentView === 'list' && (
              <VirtualizedList
                items={tasks}
                itemHeight={60}
                height="calc(100vh - 300px)"
                renderItem={renderTaskItem}
                className="tasks-virtualized-list"
              />
            )}
            
            {currentView === 'semantic' && (
              <SemanticHierarchicalView
                tasks={tasks}
                memories={[]}
                onTaskUpdate={handleUpdateTask}
                onTaskDelete={handleDeleteTask}
                onMemoryDelete={() => {}}
                className="tasks-semantic-view"
                clusteringType={semanticOptions.clustering}
                depth={semanticOptions.depth}
              />
            )}
            
            {currentView === 'timeline' && (
              <div className="timeline-view">
                <p>Timeline view coming soon...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskPanel 