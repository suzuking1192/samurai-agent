import React from 'react'
import './ProgressDisplay.css'

interface ProgressStep {
  step: string
  message: string
  details?: string
  timestamp?: string
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
      analyzing: '🧠',
      context: '📚',
      planning: '📋',
      validation: '✅',
      execution: '⚙️',
      memory: '💾',
      complete: '✅',
      error: '❌'
    }
    return icons[step] || '🤖'
  }
  
  const getStepColor = (step: string) => {
    const colors: Record<string, string> = {
      analyzing: 'purple',
      context: 'blue',
      planning: 'orange',
      validation: 'green',
      execution: 'cyan',
      memory: 'yellow',
      complete: 'green',
      error: 'red'
    }
    return colors[step] || 'gray'
  }
  
  return (
    <div className="agent-progress">
      <div className="progress-header">
        <span className="progress-title">Agent Progress</span>
        <span className="progress-count">Step {progress.length}</span>
      </div>
      
      <div className="progress-steps">
        {/* Only show the latest progress step */}
        {progress.slice(-1).map((step, index) => (
          <div 
            key={index}
            className={`progress-step ${step.step} current`}
          >
            <div className="step-icon">
              {getStepIcon(step.step)}
            </div>
            
            <div className="step-content">
              <div className="step-message">{step.message}</div>
              
              {step.details && (
                <div className="step-details">
                  <span className="detail-text">{step.details}</span>
                </div>
              )}
            </div>
            
            <div className="step-timestamp">
              {step.timestamp ? formatTime(step.timestamp) : 'Now'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProgressDisplay 