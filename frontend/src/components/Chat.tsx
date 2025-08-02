import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage, ChatRequest, ChatResponse } from '../types'
import { sendChatMessage, getChatMessages } from '../services/api'

interface ChatProps {
  projectId?: string
}

const Chat: React.FC<ChatProps> = ({ projectId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

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
      setMessages(chatMessages)
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

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !projectId || isLoading) return

    const userMessage = inputMessage.trim()
    console.log('Sending message:', userMessage)
    console.log('Current messages count:', messages.length)
    
    setInputMessage('')
    setIsLoading(true)

    // Add user message to chat
    const userChatMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      project_id: projectId,
      message: userMessage,
      response: '',
      created_at: new Date().toISOString()
    }

    console.log('Adding user message with ID:', userChatMessage.id)
    setMessages(prev => [...prev, userChatMessage])

    try {
      const request: ChatRequest = {
        project_id: projectId,
        message: userMessage
      }

      const response: ChatResponse = await sendChatMessage(request)
      
      // Add AI response to chat
      const aiChatMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        project_id: projectId,
        message: userMessage,
        response: response.response,
        created_at: new Date().toISOString()
      }

      console.log('Adding AI message with ID:', aiChatMessage.id)
      setMessages(prev => [...prev, aiChatMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        project_id: projectId,
        message: userMessage,
        response: 'Sorry, there was an error processing your message. Please try again.',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [inputMessage, projectId, isLoading, messages.length])

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
      <div className="chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start a conversation with Samurai Agent!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="message-container">
              <div className="message user-message">
                <div className="message-content">
                  <strong>You:</strong>
                  <p>{message.message}</p>
                </div>
              </div>
              
              {message.response && (
                <div className="message ai-message">
                  <div className="message-content">
                    <strong>Samurai Agent:</strong>
                    <ReactMarkdown
                      components={{
                        ul: ({children}) => <ul>{children}</ul>,
                        li: ({children}) => <li>{children}</li>,
                        strong: ({children}) => <strong>{children}</strong>,
                        em: ({children}) => <em>{children}</em>,
                        code: ({children}) => <code>{children}</code>,
                        pre: ({children}) => <pre>{children}</pre>,
                        p: ({children}) => <p>{children}</p>
                      }}
                    >
                      {message.response}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="message ai-message">
            <div className="message-content">
              <strong>Samurai Agent:</strong>
              <p>Thinking...</p>
            </div>
          </div>
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