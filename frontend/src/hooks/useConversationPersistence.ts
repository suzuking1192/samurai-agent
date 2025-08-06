import { useState, useEffect } from 'react'
import { ChatMessage, Session } from '../types'

interface ConversationState {
  messages: ChatMessage[]
  currentSession: Session | null
  projectId: string | null
}

const STORAGE_KEY = 'samurai-agent-conversation-state'

export const useConversationPersistence = () => {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    currentSession: null,
    projectId: null
  })

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY)
      if (savedState) {
        const parsedState = JSON.parse(savedState)
        setState(parsedState)
      }
    } catch (error) {
      console.error('Error loading conversation state from localStorage:', error)
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error('Error saving conversation state to localStorage:', error)
    }
  }, [state])

  const updateMessages = (messages: ChatMessage[]) => {
    setState(prev => ({ ...prev, messages }))
  }

  const updateSession = (session: Session | null) => {
    setState(prev => ({ ...prev, currentSession: session }))
  }

  const updateProjectId = (projectId: string | null) => {
    setState(prev => ({ ...prev, projectId }))
  }

  const clearState = () => {
    setState({
      messages: [],
      currentSession: null,
      projectId: null
    })
  }

  const getStateForProject = (projectId: string): ConversationState | null => {
    if (state.projectId === projectId) {
      return state
    }
    return null
  }

  return {
    state,
    updateMessages,
    updateSession,
    updateProjectId,
    clearState,
    getStateForProject
  }
} 