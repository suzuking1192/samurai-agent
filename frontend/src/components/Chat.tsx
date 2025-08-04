import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage, ChatRequest, ChatResponse } from '../types'
import { sendChatMessage, sendChatMessageWithProgress, getChatMessages } from '../services/api'
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
      loadChatMessages()
    } else {
      setMessages([])
    }
  }, [projectId])

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    }
  }, [messages, isAtBottom])

  const loadChatMessages = async () => {
    if (!projectId) return
    
    try {
      const chatMessages = await getChatMessages(projectId)
      // Deduplicate messages based on content and timestamp
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
    }
  }

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
    if (!inputMessage.trim() || !projectId || isLoading) return

    const userMessage = inputMessage.trim()
    console.log('Sending message:', userMessage)
    
    // Clear input immediately
    setInputMessage('')
    setIsLoading(true)
    setIsProcessing(true)

    // Create optimistic user message
    const optimisticUserMessage: OptimisticMessage = {
      id: `optimistic-${Date.now()}`,
      project_id: projectId,
      message: userMessage,
      response: '',
      created_at: new Date().toISOString(),
      isOptimistic: true,
      progress: []
    }

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticUserMessage])

    try {
      const request: ChatRequest = {
        project_id: projectId,
        message: userMessage
      }

      // Use streaming progress chat
      await sendChatMessageWithProgress(
        request,
        // onProgress callback - deduplicate progress updates
        (progress) => {
          console.log('Progress update:', progress)
          
          // Update the message with deduplicated progress
          setMessages(prev => prev.map(msg => 
            msg.isOptimistic 
              ? { 
                  ...msg, 
                  progress: deduplicateProgress([...(msg.progress || []), progress])
                }
              : msg
          ))
        },
        // onComplete callback
        (response) => {
          console.log('Chat completed:', response)
          setIsProcessing(false)
          
          // Check if response was truncated
          const isTruncated = response.includes('[Response truncated') || 
                             response.includes('exceeded our limits')
          
          if (isTruncated) {
            setNotification({
              type: 'info',
              message: 'Response was comprehensive - showing key points. You can ask for more details if needed.'
            })
            // Clear notification after 5 seconds
            setTimeout(() => setNotification(null), 5000)
          }
          
          // Replace optimistic message with real message
          const realMessage: OptimisticMessage = {
            id: `real-${Date.now()}`,
            project_id: projectId,
            message: userMessage,
            response: response,
            created_at: new Date().toISOString()
          }

          setMessages(prev => {
            const filtered = prev.filter(msg => !msg.isOptimistic)
            return [...filtered, realMessage]
          })
          
          // Notify parent component about potential task generation
          onTaskGenerated?.()
        },
        // onError callback
        (error) => {
          console.error('Streaming chat error:', error)
          setIsProcessing(false)
          
          // Determine appropriate error message
          let errorResponse = 'Sorry, there was an error processing your message. Please try again.'
          
          if (error.includes('string_too_long') || error.includes('validation')) {
            errorResponse = 'The response was very detailed and exceeded our limits. The agent is processing a shorter version for you.'
          } else if (error.includes('truncated')) {
            errorResponse = 'Response was comprehensive - showing key points. You can ask for more details if needed.'
          }
          
          // Replace optimistic message with error message
          const errorMessage: OptimisticMessage = {
            id: `error-${Date.now()}`,
            project_id: projectId,
            message: userMessage,
            response: errorResponse,
            created_at: new Date().toISOString(),
            isError: true
          }

          setMessages(prev => {
            const filtered = prev.filter(msg => !msg.isOptimistic)
            return [...filtered, errorMessage]
          })
        }
      )

    } catch (error: any) {
      console.error('Error sending message:', error)
      setIsProcessing(false)
      
      // Determine appropriate error message based on error type
      let errorResponse = 'Sorry, there was an error processing your message. Please try again.'
      
      if (error.status === 500) {
        if (error.message?.includes('string_too_long') || error.message?.includes('validation')) {
          errorResponse = 'The response was very detailed and exceeded our limits. The agent is processing a shorter version for you.'
        } else if (error.message?.includes('truncated')) {
          errorResponse = 'Response was comprehensive - showing key points. You can ask for more details if needed.'
        }
      } else if (error.status === 413) {
        errorResponse = 'Your message was too long. Please try a shorter message.'
      } else if (error.status === 404) {
        errorResponse = 'Project not found. Please refresh and try again.'
      }
      
      // Replace optimistic message with error message
      const errorMessage: OptimisticMessage = {
        id: `error-${Date.now()}`,
        project_id: projectId,
        message: userMessage,
        response: errorResponse,
        created_at: new Date().toISOString(),
        isError: true
      }

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isOptimistic)
        return [...filtered, errorMessage]
      })
    } finally {
      setIsLoading(false)
    }
  }, [inputMessage, projectId, isLoading])

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
      {/* Notification display */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="notification-close"
          >
            ×
          </button>
        </div>
      )}
      
      <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start a conversation with Samurai Agent!</p>
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
              
              {/* Show progress for optimistic messages only - removed duplicate display */}
              {message.isOptimistic && message.progress && message.progress.length > 0 && (
                <div className="message ai-message">
                  <div className="message-content">
                    <div className="message-header">
                      <strong>Samurai Agent</strong>
                      <span className="message-time">Processing...</span>
                    </div>
                    <ProgressDisplay 
                      progress={message.progress} 
                      isVisible={true}
                    />
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
          placeholder="Type your message here..."
          disabled={isLoading}
          className="input"
          rows={3}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isLoading}
          className="button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default Chat 