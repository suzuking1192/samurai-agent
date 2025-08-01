import React, { useState, useEffect, useRef } from 'react'
import { ChatMessage, ChatRequest, ChatResponse } from '../types'
import { sendChatMessage, getChatMessages } from '../services/api'

interface ChatProps {
  projectId?: string
}

const Chat: React.FC<ChatProps> = ({ projectId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId) {
      loadChatMessages()
    } else {
      setMessages([])
    }
  }, [projectId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !projectId || isLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Add user message to chat
    const userChatMessage: ChatMessage = {
      id: Date.now().toString(),
      project_id: projectId,
      message: userMessage,
      response: '',
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userChatMessage])

    try {
      const request: ChatRequest = {
        project_id: projectId,
        message: userMessage
      }

      const response: ChatResponse = await sendChatMessage(request)
      
      // Add AI response to chat
      const aiChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        project_id: projectId,
        message: userMessage,
        response: response.response,
        created_at: new Date().toISOString()
      }

      setMessages(prev => [...prev, aiChatMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        project_id: projectId,
        message: userMessage,
        response: 'Sorry, there was an error processing your message. Please try again.',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!projectId) {
    return (
      <div className="panel-content">
        <div className="card">
          <p>Please select a project to start chatting with Samurai Agent.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="panel-header">
        Chat with Samurai Agent
      </div>
      
      <div className="chat-messages">
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
                    <p>{message.response}</p>
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
      
      <div className="chat-input">
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
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading}
          className="button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default Chat 