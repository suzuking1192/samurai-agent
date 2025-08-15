import { useState, useEffect, useCallback } from 'react'
import { Task } from '../types'

interface TaskExpansionState {
  expandedTasks: Record<string, boolean>
  projectId: string | null
}

const STORAGE_KEY = 'samurai-agent-task-expansion-state'

export const useTaskExpansionPersistence = (projectId: string | null) => {
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})

  // Load state from localStorage on mount or when projectId changes
  useEffect(() => {
    if (!projectId) {
      setExpandedTasks({})
      return
    }

    try {
      const savedState = localStorage.getItem(STORAGE_KEY)
      if (savedState) {
        const parsedState: TaskExpansionState = JSON.parse(savedState)
        // Only load state for the current project
        if (parsedState.projectId === projectId) {
          setExpandedTasks(parsedState.expandedTasks)
        } else {
          setExpandedTasks({})
        }
      }
    } catch (error) {
      console.error('Error loading task expansion state from localStorage:', error)
      setExpandedTasks({})
    }
  }, [projectId])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!projectId) return

    try {
      const stateToSave: TaskExpansionState = {
        expandedTasks,
        projectId
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (error) {
      console.error('Error saving task expansion state to localStorage:', error)
    }
  }, [expandedTasks, projectId])

  const toggleTaskExpansion = useCallback((taskId: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }))
  }, [])

  const setTaskExpanded = useCallback((taskId: string, isExpanded: boolean) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: isExpanded
    }))
  }, [])

  const clearExpandedTasks = useCallback(() => {
    setExpandedTasks({})
  }, [])

  const removeExpandedTask = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const newState = { ...prev }
      delete newState[taskId]
      return newState
    })
  }, [])

  const isTaskExpanded = useCallback((taskId: string): boolean => {
    return !!expandedTasks[taskId]
  }, [expandedTasks])

  return {
    expandedTasks,
    toggleTaskExpansion,
    setTaskExpanded,
    clearExpandedTasks,
    removeExpandedTask,
    isTaskExpanded
  }
}
