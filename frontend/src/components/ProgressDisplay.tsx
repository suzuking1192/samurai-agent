import React from 'react'
import './ProgressDisplay.css'

interface ProgressStep {
  step: string
  message: string
  details?: Record<string, any>
  timestamp: string
}

interface ProgressDisplayProps {
  progress: ProgressStep[]
  isVisible: boolean
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({ progress, isVisible }) => {
  if (!isVisible || !progress.length) return null
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  const getStepIcon = (step: string) => {
    const icons: Record<string, string> = {
      analyzing_request: '🧠',
      detecting_intent: '🎯',
      gathering_context: '📚',
      planning_actions: '📋',
      searching_data: '🔍',
      executing_tools: '⚙️',
      generating_response: '💬',
      complete: '✅',
      error: '❌'
    }
    return icons[step] || '🤖'
  }
  
  const getStepColor = (step: string) => {
    const colors: Record<string, string> = {
      analyzing_request: 'purple',
      detecting_intent: 'green',
      gathering_context: 'red',
      planning_actions: 'orange',
      searching_data: 'blue',
      executing_tools: 'cyan',
      generating_response: 'purple',
      complete: 'green',
      error: 'red'
    }
    return colors[step] || 'gray'
  }
  
  return (
    <div className="agent-progress">
      <div className="progress-header">
        <span className="progress-title">Agent Progress</span>
        <span className="progress-count">{progress.length} steps</span>
      </div>
      
      <div className="progress-steps">
        {progress.map((step, index) => (
          <div 
            key={index}
            className={`progress-step ${step.step} ${index === progress.length - 1 ? 'current' : 'completed'}`}
          >
            <div className="step-icon">
              {getStepIcon(step.step)}
            </div>
            
            <div className="step-content">
              <div className="step-message">{step.message}</div>
              
              {step.details && Object.keys(step.details).length > 0 && (
                <div className="step-details">
                  {step.details.tool && (
                    <span className="detail-badge tool">{step.details.tool}</span>
                  )}
                  {step.details.search_query && (
                    <span className="detail-badge search">"{step.details.search_query}"</span>
                  )}
                  {step.details.task_title && (
                    <span className="detail-badge task">{step.details.task_title}</span>
                  )}
                  {step.details.memory_title && (
                    <span className="detail-badge memory">{step.details.memory_title}</span>
                  )}
                  {step.details.new_status && (
                    <span className="detail-badge status">{step.details.new_status}</span>
                  )}
                  {step.details.tool_count && (
                    <span className="detail-badge count">{step.details.tool_count} tools</span>
                  )}
                  {step.details.intent && (
                    <span className="detail-badge intent">{step.details.intent}</span>
                  )}
                  {step.details.confidence && (
                    <span className="detail-badge confidence">{Math.round(step.details.confidence * 100)}%</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="step-timestamp">
              {formatTime(step.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProgressDisplay 