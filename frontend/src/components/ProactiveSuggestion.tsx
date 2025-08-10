import React from 'react'

interface ProactiveSuggestionProps {
  isVisible: boolean
  onDismiss: () => void
}

const ProactiveSuggestion: React.FC<ProactiveSuggestionProps> = ({ isVisible, onDismiss }) => {
  if (!isVisible) return null

  return (
    <div className="proactive-suggestion" role="note" aria-live="polite">
      <div className="proactive-suggestion-content">
        <span className="proactive-suggestion-text">
          💡 Tip: Just ask me to "add this as a task" or "create a task for this" and I'll add it to your task bar automatically!
        </span>
      </div>
      <button
        className="proactive-suggestion-close"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default ProactiveSuggestion


