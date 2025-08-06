import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage, ChatRequest, ChatResponse, Session } from '../types'
import { sendChatMessage, sendChatMessageWithProgress, getChatMessages, createSession, getCurrentSession, getSessionMessages, getConversationHistory } from '../services/api'
import ProgressDisplay from './ProgressDisplay'

interface ChatProps {
  projectId?: string
  onTaskGenerated?: () => void
}

interface OptimisticMessage extends ChatMessage {
  isOptimistic?: boolean
  isError?: boolean
  progress?: any[]
}

const Chat: React.FC<ChatProps> = ({ projectId, onTaskGenerated }) => {
  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [agentActivity, setAgentActivity] = useState<string>('')
  const [notification, setNotification] = useState<{type: 'info' | 'warning' | 'error', message: string} | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  // Helper function to deduplicate progress updates
  const deduplicateProgress = (progressArray: any[]): any[] => {
    const seen = new Set()
    return progressArray.filter(progress => {
      // Create a unique key for each progress update (step + message only)
      const key = `${progress.step}-${progress.message}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  useEffect(() => {
    if (projectId) {
      loadCurrentSession()
    } else {
      setMessages([])
      setCurrentSession(null)
    }
  }, [projectId])

  // Reload conversation history when session changes
  useEffect(() => {
    if (currentSession && projectId) {
      loadConversationHistory(currentSession.id)
    }
  }, [currentSession?.id, projectId])

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

  const loadChatMessages = async (sessionId: string) => {
    if (!projectId) return
    
    try {
      console.log('Loading chat messages for session:', sessionId)
      const chatMessages = await getSessionMessages(projectId, sessionId)
      console.log('Loaded chat messages:', chatMessages.length)
      
      // Deduplicate messages
      const uniqueMessages = chatMessages.filter((message, index, self) => 
        index === self.findIndex(m => 
          m.message === message.message && 
          m.response === message.response &&
          Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 1000
        )
      )
      setMessages(uniqueMessages)
    } catch (error) {
      console.error('Error loading chat messages:', error)
      setMessages([])
    }
  }

  const handleStartNewConversation = async () => {
    console.log('Starting new conversation, projectId:', projectId)
    if (!projectId) {
      console.error('Cannot start new conversation: projectId is undefined')
      setNotification({
        type: 'error',
        message: 'Please select a project first before starting a new conversation.'
      })
      return
    }
    
    try {
      // Create a new session
      const newSession = await createSession(projectId)
      console.log('Created new session:', newSession)
      setCurrentSession(newSession)
      
      // Clear messages for new conversation
      setMessages([])
      
      setNotification({
        type: 'info',
        message: 'New conversation started! Send your first message.'
      })
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotification(null)
      }, 3000)
    } catch (error) {
      console.error('Error starting new conversation:', error)
      setNotification({
        type: 'error',
        message: 'Failed to start new conversation'
      })
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
    setIsProcessing(true)
    
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
      let response: ChatResponse
      
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
          
          setMessages(prev => prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? { ...msg, progress: [...(msg.progress || []), progressWithTimestamp] }
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
          setIsProcessing(false)
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
          setIsProcessing(false)
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
      setIsProcessing(false)
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
                    
                                         {message.progress && message.progress.length > 0 ? (
                       <ProgressDisplay 
                         progress={message.progress} 
                         isVisible={true}
                       />
                     ) : (
                       <div className="typing-indicator">
                         <div className="typing-dots">
                           <span></span>
                           <span></span>
                           <span></span>
                         </div>
                         <span className="typing-text">Samurai Agent is thinking...</span>
                       </div>
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
      
      <form onSubmit={handleSubmit} className="chat-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={!projectId ? "Please select a project first..." : "Type your message here..."}
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