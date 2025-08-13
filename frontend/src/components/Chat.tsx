import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage, Session, Task } from '../types'
import { sendChatMessageWithProgress, createSession, getCurrentSession, getSessionMessages, endSessionWithConsolidation, SessionEndResponse, getTaskContext, clearTaskContext, getSuggestionStatus, dismissSuggestion } from '../services/api'
import ProgressDisplay from './ProgressDisplay'
import ProactiveSuggestion from './ProactiveSuggestion'

interface ChatProps {
  projectId?: string
  onTaskGenerated?: () => void
  taskContextTrigger?: number // Add trigger for immediate task context updates
}

interface OptimisticMessage extends ChatMessage {
  isOptimistic?: boolean
  isError?: boolean
  progress?: any[]
}

const Chat: React.FC<ChatProps> = ({ projectId, onTaskGenerated, taskContextTrigger }) => {
  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [agentActivity, setAgentActivity] = useState<string>('')
  const [notification, setNotification] = useState<{type: 'info' | 'warning' | 'error', message: string} | null>(null)
  
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [taskContext, setTaskContext] = useState<Task | null>(null)
  const [showProactiveSuggestion, setShowProactiveSuggestion] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  

  useEffect(() => {
    if (projectId) {
      loadCurrentSession()
    } else {
      setMessages([])
      setCurrentSession(null)
      setShowProactiveSuggestion(false)
    }
  }, [projectId])

  // Reload conversation history when session changes
  useEffect(() => {
    if (currentSession && projectId) {
      loadConversationHistory(currentSession.id)
      loadTaskContext(currentSession.id)
      // Fetch suggestion status for one-time tip
      loadSuggestionStatus()
      // Removed breakdown suggestion API usage
    }
  }, [currentSession?.id, projectId])

  // Immediate task context update when taskContextTrigger changes
  useEffect(() => {
    if (currentSession?.id && projectId && taskContextTrigger) {
      loadTaskContext(currentSession.id)
    }
  }, [taskContextTrigger, currentSession?.id, projectId])

  const loadCurrentSession = async () => {
    if (!projectId) return
    
    try {
      const session = await getCurrentSession(projectId)
      setCurrentSession(session)
      
      // Immediately load conversation history when session is available
      if (session) {
        await loadConversationHistory(session.id)
      }
    } catch (error) {
      console.error('Error loading current session:', error)
      setCurrentSession(null)
      setMessages([])
    }
  }

  const loadConversationHistory = async (sessionId?: string) => {
    const targetSessionId = sessionId || currentSession?.id
    if (!projectId || !targetSessionId) return
    
    setIsLoadingHistory(true)
    try {
      console.log('Loading conversation history for session:', targetSessionId)
      const sessionMessages = await getSessionMessages(projectId, targetSessionId)
      console.log('Loaded session messages:', sessionMessages.length, 'messages')
      
      // Sort messages by creation time to ensure proper order
      const sortedMessages = sessionMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      setMessages(sortedMessages)
    } catch (error) {
      console.error('Error loading conversation history:', error)
      setMessages([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const loadTaskContext = async (sessionId: string) => {
    if (!projectId || !sessionId) return
    
    try {
      const response = await getTaskContext(projectId, sessionId)
      setTaskContext(response.task_context || null)
    } catch (error) {
      console.error('Error loading task context:', error)
      setTaskContext(null)
    }
  }

  // Removed: breakdown suggestion loader

  const loadSuggestionStatus = async () => {
    try {
      const status = await getSuggestionStatus()
      setShowProactiveSuggestion(status.should_show)
    } catch (e) {
      // Fail silent
      setShowProactiveSuggestion(false)
    }
  }

  const handleDismissSuggestion = async () => {
    try {
      await dismissSuggestion()
    } catch (e) {
      // ignore
    } finally {
      setShowProactiveSuggestion(false)
    }
  }

  const handleClearTaskContext = async () => {
    if (!projectId || !currentSession?.id) return
    
    try {
      await clearTaskContext(projectId, currentSession.id)
      setTaskContext(null)
      setNotification({ type: 'info', message: 'Task context cleared' })
      setTimeout(() => setNotification(null), 3000)
    } catch (error) {
      console.error('Error clearing task context:', error)
      setNotification({ type: 'error', message: 'Failed to clear task context' })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  

  const handleStartNewConversation = async () => {
    console.log('Starting new conversation with memory consolidation, projectId:', projectId)
    if (!projectId) {
      console.error('Cannot start new conversation: projectId is undefined')
      setNotification({
        type: 'error',
        message: 'Please select a project first before starting a new conversation.'
      })
      return
    }
    
    if (!currentSession) {
      console.log('No current session, creating new session directly')
      try {
        const newSession = await createSession(projectId)
        console.log('Created new session:', newSession)
        setCurrentSession(newSession)
        setMessages([])
        
        setNotification({
          type: 'info',
          message: 'New conversation started! Send your first message.'
        })
        
        setTimeout(() => setNotification(null), 3000)
      } catch (error) {
        console.error('Error creating new session:', error)
        setNotification({
          type: 'error',
          message: 'Failed to start new conversation'
        })
      }
      return
    }
    
    try {
      // Show loading state
      setNotification({
        type: 'info',
        message: 'Saving insights and starting new conversation...'
      })
      
      // End current session with memory consolidation
      console.log('Ending session with consolidation:', currentSession.id)
      const consolidationResult: SessionEndResponse = await endSessionWithConsolidation(
        projectId, 
        currentSession.id
      )
      
      console.log('Memory consolidation completed:', consolidationResult)
      
      // Create new session using the returned session ID
      const newSession: Session = {
        id: consolidationResult.new_session_id,
        project_id: projectId,
        name: `Session ${new Date().toLocaleString()}`,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      }
      
      setCurrentSession(newSession)
      setMessages([])
      
      // Show consolidation summary
      const { memory_consolidation } = consolidationResult
      let summaryMessage = 'New conversation started!'
      
      if (memory_consolidation.status === 'completed') {
        const categoriesText = memory_consolidation.categories_affected.length > 0 
          ? memory_consolidation.categories_affected.map(cat => 
              `${cat.category}: ${cat.memories_updated + cat.memories_created} memories`
            ).join(', ')
          : 'No categories'
        
        summaryMessage = `✨ Insights saved! ${memory_consolidation.total_insights_processed} insights processed across ${memory_consolidation.categories_affected.length} categories. ${categoriesText}.`
      } else if (memory_consolidation.status === 'skipped_too_short') {
        summaryMessage = 'New conversation started! (Previous session was too short to extract insights)'
      } else if (memory_consolidation.status === 'no_relevant_insights') {
        summaryMessage = 'New conversation started! (No significant insights found in previous session)'
      }
      
      setNotification({
        type: 'info',
        message: summaryMessage
      })
      
      // Clear notification after 5 seconds (longer for consolidation info)
      setTimeout(() => {
        setNotification(null)
      }, 5000)
      
    } catch (error) {
      console.error('Error starting new conversation with consolidation:', error)
      setNotification({
        type: 'error',
        message: 'Failed to start new conversation. Please try again.'
      })
      
      // Fallback to simple session creation
      try {
        const newSession = await createSession(projectId)
        setCurrentSession(newSession)
        setMessages([])
      } catch (fallbackError) {
        console.error('Fallback session creation also failed:', fallbackError)
      }
    }
  }

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    }
  }, [messages, isAtBottom])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const atBottom = scrollTop + clientHeight >= scrollHeight - 10
    setIsAtBottom(atBottom)
  }

  const updateAgentActivity = (activity: string) => {
    setAgentActivity(activity)
  }

  const handleSendMessage = useCallback(async () => {
    console.log('handleSendMessage called, projectId:', projectId)
    if (!inputMessage.trim() || isLoading) return
    
    if (!projectId) {
      setNotification({
        type: 'error',
        message: 'Please select a project first before sending messages.'
      })
      return
    }

    const userMessage = inputMessage.trim()
    console.log('Sending message:', userMessage)
    
    // Clear input immediately
    setInputMessage('')
    setIsLoading(true)
    
    
    // Create optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: `optimistic-${Date.now()}`,
      project_id: projectId,
      session_id: currentSession?.id || '',
      message: userMessage,
      response: '',
      created_at: new Date().toISOString(),
      isOptimistic: true,
      progress: []
    }
    
    setMessages(prev => [...prev, optimisticMessage])
    
    try {
      // Send message with progress tracking
      await sendChatMessageWithProgress(
        { message: userMessage, project_id: projectId },
        (progress) => {
          // Add timestamp to progress
          const progressWithTimestamp = {
            ...progress,
            timestamp: new Date().toISOString()
          }
          
          console.log(`🎯 Chat component received progress #${progress.progressNumber || '?'}:`, {
            step: progress.step,
            message: progress.message,
            timeSinceStart: progress.timeSinceStart,
            timeSinceLastProgress: progress.timeSinceLastProgress,
            frontendReceivedAt: progress.frontendReceivedAt
          })
          
          // Update progress immediately for real-time display
          setMessages(prev => prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? { 
                  ...msg, 
                  // Replace progress array instead of appending to show latest state
                  progress: [progressWithTimestamp]
                }
              : msg
          ))
          updateAgentActivity(progress.message || 'Processing...')
        },
        (finalResponse) => {
          // Replace optimistic message with real response
          setMessages(prev => prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? {
                  ...msg,
                  response: finalResponse,
                  isOptimistic: false,
                  progress: undefined
                }
              : msg
          ))
          setIsLoading(false)
          updateAgentActivity('')
          
          if (onTaskGenerated) {
            onTaskGenerated()
          }
        },
        (error) => {
          // Handle error
          setMessages(prev => prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? {
                  ...msg,
                  response: `Error: ${error}`,
                  isError: true,
                  isOptimistic: false,
                  progress: undefined
                }
              : msg
          ))
          setIsLoading(false)
          updateAgentActivity('')
        }
      )
      
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Handle error
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id 
          ? {
              ...msg,
              response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isError: true,
              isOptimistic: false,
              progress: undefined
            }
          : msg
      ))
      setIsLoading(false)
      updateAgentActivity('')
    }
  }, [inputMessage, projectId, isLoading, currentSession, onTaskGenerated])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage()
  }

  if (!projectId) {
    return (
      <div className="chat-container">
        <div className="chat-messages" ref={chatMessagesRef}>
          <div className="empty-state">
            <p>Please select a project to start chatting with Samurai Agent.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      {/* Header with Start New Conversation button */}
      <div className="chat-header">
        <h3>Chat with Samurai Agent</h3>
        {!projectId ? (
          <div className="no-project-message">
            Please select a project to start chatting
          </div>
        ) : (
          <button
            onClick={handleStartNewConversation}
            className="start-new-conversation-btn"
            disabled={isLoading || !projectId}
            title={!projectId ? "Please select a project first" : "Start a new conversation"}
          >
            🆕 Start New Conversation
          </button>
        )}
      </div>

      {/* Task Context Indicator */}
      {taskContext && (
        <div className="task-context-indicator">
          <div className="task-context-content">
            <div className="task-context-info">
              <span className="task-context-icon">🎯</span>
              <div className="task-context-text">
                <strong>Focused on this task:</strong>
                <span className="task-context-title">{taskContext.title}</span>
                <span className="task-context-subtitle">I'll help you refine this task description for Cursor</span>
              </div>
            </div>
            <button
              onClick={handleClearTaskContext}
              className="task-context-clear"
              title="Clear task context"
            >
              ✖️
            </button>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Agent activity indicator */}
      {agentActivity && (
        <div className="agent-activity">
          <span className="activity-indicator">●</span>
          {agentActivity}
        </div>
      )}

      <div 
        className="chat-messages" 
        ref={chatMessagesRef}
        onScroll={handleScroll}
      >
        {/* Proactive suggestion banner appears above the input but within chat container; render here above messages end */}
        {isLoadingHistory ? (
          <div className="empty-state">
            <div className="loading-indicator">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Loading conversation history...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            {!projectId ? (
              <p>Please select a project from the dropdown above to start chatting with Samurai Agent!</p>
            ) : (
              <p>No messages yet. Start a conversation with Samurai Agent!</p>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="message-container">
              <div className={`message user-message ${message.isOptimistic ? 'optimistic' : ''} ${message.isError ? 'error' : ''}`}>
                <div className="message-content">
                  <div className="message-header">
                    <strong>You</strong>
                    <span className="message-time">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-text">
                    {message.message}
                  </div>
                  {message.isOptimistic && (
                    <div className="message-status">
                      <span className="status-indicator">Sending...</span>
                    </div>
                  )}
                  {message.isError && (
                    <div className="message-status error">
                      <span className="status-indicator">Failed to send</span>
                    </div>
                  )}
                </div>
              </div>
              
              {message.response && (
                <div className={`message ai-message ${message.isError ? 'error' : ''}`}>
                  <div className="message-content">
                    <div className="message-header">
                      <strong>Samurai Agent</strong>
                      <span className="message-time">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">
                      <ReactMarkdown
                        components={{
                          ul: ({children}) => <ul className="markdown-list">{children}</ul>,
                          ol: ({children}) => <ol className="markdown-list">{children}</ol>,
                          li: ({children}) => <li className="markdown-list-item">{children}</li>,
                          strong: ({children}) => <strong className="markdown-strong">{children}</strong>,
                          em: ({children}) => <em className="markdown-em">{children}</em>,
                          code: ({children, className}) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="markdown-inline-code">{children}</code>
                            ) : (
                              <code className="markdown-code">{children}</code>
                            );
                          },
                          pre: ({children}) => <pre className="markdown-code-block">{children}</pre>,
                          p: ({children}) => <p className="markdown-paragraph">{children}</p>,
                          h1: ({children}) => <h1 className="markdown-heading markdown-h1">{children}</h1>,
                          h2: ({children}) => <h2 className="markdown-heading markdown-h2">{children}</h2>,
                          h3: ({children}) => <h3 className="markdown-heading markdown-h3">{children}</h3>,
                          h4: ({children}) => <h4 className="markdown-heading markdown-h4">{children}</h4>,
                          h5: ({children}) => <h5 className="markdown-heading markdown-h5">{children}</h5>,
                          h6: ({children}) => <h6 className="markdown-heading markdown-h6">{children}</h6>,
                          blockquote: ({children}) => <blockquote className="markdown-blockquote">{children}</blockquote>,
                          a: ({href, children}) => <a href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">{children}</a>,
                          hr: () => <hr className="markdown-hr" />,
                          table: ({children}) => <table className="markdown-table">{children}</table>,
                          thead: ({children}) => <thead className="markdown-thead">{children}</thead>,
                          tbody: ({children}) => <tbody className="markdown-tbody">{children}</tbody>,
                          tr: ({children}) => <tr className="markdown-tr">{children}</tr>,
                          th: ({children}) => <th className="markdown-th">{children}</th>,
                          td: ({children}) => <td className="markdown-td">{children}</td>,
                        }}
                      >
                        {message.response}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show progress for optimistic messages */}
              {message.isOptimistic && (
                <div className="message ai-message">
                  <div className="message-content">
                    <div className="message-header">
                      <strong>Samurai Agent</strong>
                      <span className="message-time">Processing...</span>
                    </div>
                    
                      {/* Always show typing indicator for better feedback in tests and UX */}
                      <div className="typing-indicator">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="typing-text">Samurai Agent is thinking...</span>
                      </div>

                      {/* Show latest progress if available */}
                      {message.progress && message.progress.length > 0 && (
                        <ProgressDisplay 
                          progress={message.progress} 
                          isVisible={true}
                        />
                      )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom"
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}
      
      {/* Proactive Suggestion directly above the main chat text box */}
      <ProactiveSuggestion isVisible={showProactiveSuggestion} onDismiss={handleDismissSuggestion} />

      <form onSubmit={handleSubmit} className="chat-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={!projectId ? "Please select a project first..." : "I want to implement user authentication..."}
          disabled={isLoading || !projectId}
          className="input"
          rows={3}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isLoading || !projectId}
          className="button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default Chat 