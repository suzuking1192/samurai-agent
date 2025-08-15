import React from 'react'

export type ViewMode = 'list' | 'semantic' | 'timeline' | 'kanban'

interface ViewControlsProps {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
  semanticOptions?: {
    clustering: string
    depth: number
  }
  onSemanticOptionChange?: (option: string, value: any) => void
  className?: string
}

const ViewControls: React.FC<ViewControlsProps> = ({
  currentView,
  onViewChange,
  semanticOptions,
  onSemanticOptionChange,
  className = ''
}) => {
  return (
    <div className={`view-controls ${className}`}>
      <div className="view-toggle">
        <button 
          className={`view-toggle-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => onViewChange('list')}
          title="Compact list view"
        >
          📋 List
        </button>
        <button 
          className={`view-toggle-btn ${currentView === 'semantic' ? 'active' : ''}`}
          onClick={() => onViewChange('semantic')}
          title="Semantic hierarchical view"
        >
          🧠 Semantic
        </button>
        <button 
          className={`view-toggle-btn ${currentView === 'timeline' ? 'active' : ''}`}
          onClick={() => onViewChange('timeline')}
          title="Timeline view"
        >
          📅 Timeline
        </button>
        <button 
          className={`view-toggle-btn ${currentView === 'kanban' ? 'active' : ''}`}
          onClick={() => onViewChange('kanban')}
          title="Kanban board view with drag-and-drop"
        >
          📋 Kanban
        </button>
      </div>
      
      {currentView === 'semantic' && semanticOptions && onSemanticOptionChange && (
        <div className="semantic-options">
          <select 
            value={semanticOptions.clustering} 
            onChange={(e) => onSemanticOptionChange('clustering', e.target.value)}
            className="semantic-select"
          >
            <option value="content">By Content Similarity</option>
            <option value="dependencies">By Dependencies</option>
            <option value="workflow">By Workflow Stage</option>
            <option value="domain">By Domain Knowledge</option>
          </select>
          
          <label className="depth-control">
            Depth: 
            <input 
              type="range" 
              min="1" 
              max="4" 
              value={semanticOptions.depth}
              onChange={(e) => onSemanticOptionChange('depth', parseInt(e.target.value))}
              className="depth-slider"
            />
            <span className="depth-value">{semanticOptions.depth}</span>
          </label>
          
          <button 
            className="refresh-semantic-btn"
            onClick={() => onSemanticOptionChange('refresh', true)}
            title="Rebuild semantic hierarchy"
          >
            🔄 Rebuild
          </button>
        </div>
      )}
    </div>
  )
}

export default ViewControls 