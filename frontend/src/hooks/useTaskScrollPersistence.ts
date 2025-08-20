import { useState, useEffect, useCallback } from 'react'

interface TaskScrollState {
  scrollTop: number
  selectedTaskId: string | null
  projectId: string | null
}

export const useTaskScrollPersistence = (projectId: string | null) => {
  const [scrollState, setScrollState] = useState<TaskScrollState>({
    scrollTop: 0,
    selectedTaskId: null,
    projectId: null
  })

  // Create project-specific storage key
  const storageKey = projectId ? `samurai-agent-task-scroll-state-${projectId}` : null

  // Load state from sessionStorage on mount or when projectId changes
  useEffect(() => {
    if (!projectId || !storageKey) {
      setScrollState({
        scrollTop: 0,
        selectedTaskId: null,
        projectId: null
      })
      return
    }

    try {
      const savedState = sessionStorage.getItem(storageKey)
      
      if (savedState) {
        const parsedState: TaskScrollState = JSON.parse(savedState)
        // Only set state if it's different from current state to avoid unnecessary re-renders
        setScrollState(prev => {
          if (prev.scrollTop !== parsedState.scrollTop || 
              prev.selectedTaskId !== parsedState.selectedTaskId || 
              prev.projectId !== parsedState.projectId) {
            return parsedState
          }
          return prev
        })
      } else {
        setScrollState(prev => {
          if (prev.projectId !== projectId) {
            return {
              scrollTop: 0,
              selectedTaskId: null,
              projectId
            }
          }
          return prev
        })
      }
    } catch (error) {
      console.error('Error loading task scroll state from sessionStorage:', error)
      setScrollState({
        scrollTop: 0,
        selectedTaskId: null,
        projectId
      })
    }
  }, [projectId, storageKey])

  // Note: We now save directly in saveScrollPosition to avoid race conditions
  // This useEffect was causing the saved state to be overwritten

  const saveScrollPosition = useCallback((scrollTop: number, selectedTaskId: string | null) => {
    const newState = {
      scrollTop,
      selectedTaskId,
      projectId
    }
    
    // Save directly to sessionStorage immediately
    if (projectId && storageKey) {
      try {
        const stateToSave = JSON.stringify(newState)
        sessionStorage.setItem(storageKey, stateToSave)
      } catch (error) {
        console.error('Error saving task scroll state directly to sessionStorage:', error)
      }
    }
    
    setScrollState(newState)
  }, [projectId, storageKey])

  const getScrollPosition = useCallback(() => {
    return scrollState
  }, [scrollState])

  const clearScrollState = useCallback(() => {
    setScrollState({
      scrollTop: 0,
      selectedTaskId: null,
      projectId
    })
  }, [projectId])

  return {
    scrollState,
    saveScrollPosition,
    getScrollPosition,
    clearScrollState
  }
}
