import React, { useState } from 'react'
import { Memory, MemoryType } from '../types'
import MemoryDetailModal from './MemoryDetailModal'

interface CompactMemoryItemProps {
  memory: Memory
  onDelete: (memoryId: string) => void
  level?: number
  style?: React.CSSProperties
}

const CompactMemoryItem: React.FC<CompactMemoryItemProps> = ({ 
  memory, 
  onDelete, 
  level = 0,
  style 
}) => {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [isExpanding, setIsExpanding] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const getMemoryIcon = (type: MemoryType) => {
    switch (type) {
      case MemoryType.CONTEXT:
        return '💡'
      case MemoryType.DECISION:
        return '🎯'
      case MemoryType.NOTE:
        return '📝'
      default:
        return '💭'
    }
  }

  const getMemoryColor = (type: MemoryType) => {
    switch (type) {
      case MemoryType.CONTEXT:
        return '#3498db'
      case MemoryType.DECISION:
        return '#e74c3c'
      case MemoryType.NOTE:
        return '#f39c12'
      default:
        return '#95a5a6'
    }
  }

  const getMemoryTypeLabel = (type: MemoryType) => {
    switch (type) {
      case MemoryType.CONTEXT:
        return 'Context'
      case MemoryType.DECISION:
        return 'Decision'
      case MemoryType.NOTE:
        return 'Note'
      default:
        return 'Memory'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  // CRITICAL: Enhanced content display with better truncation
  const getDisplayContent = () => {
    const maxLength = 80
    if (memory.content.length <= maxLength) {
      return memory.content
    }
    return memory.content.substring(0, maxLength) + '...'
  }

  // CRITICAL: Get preview of content for subtitle
  const getContentPreview = () => {
    const maxLength = 60
    if (memory.content.length <= maxLength) {
      return null // Don't show preview if content is short
    }
    return memory.content.substring(0, maxLength) + '...'
  }

  const handleToggle = () => {
    setIsExpanding(true)
    setExpanded(!expanded)
    setTimeout(() => setIsExpanding(false), 300) // Match animation duration
  }

  const handleItemClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setModalOpen(true)
  }

  const handleSaveMemory = async (memoryId: string, updates: Partial<Memory>) => {
    // For now, we'll just close the modal since memory updates aren't implemented yet
    console.log('Memory update:', memoryId, updates)
  }

  const handleDeleteMemory = async (memoryId: string) => {
    await onDelete(memoryId)
  }

  return (
    <>
      <div 
        className={`compact-memory-item ${expanded ? 'expanded' : ''} ${isExpanding ? 'expanding' : ''}`}
        style={{ 
          paddingLeft: `${level * 16 + 12}px`,
          ...style 
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={handleItemClick}
      >
      <div className="compact-memory-header">
        <div className="compact-memory-main">
          <button
            className="expand-button"
            onClick={handleToggle}
          >
            {expanded ? '▼' : '▶'}
          </button>
          
          <span className="memory-icon" style={{ color: getMemoryColor(memory.type) }}>
            {getMemoryIcon(memory.type)}
          </span>
          
          <span className="memory-type-badge" style={{ backgroundColor: getMemoryColor(memory.type) }}>
            {getMemoryTypeLabel(memory.type)}
          </span>
          
          {/* CRITICAL: Enhanced content container */}
          <div className="item-title-container">
            <div className="memory-content-preview" title={memory.content}>
              {expanded ? memory.content : getDisplayContent()}
            </div>
            
            {/* CRITICAL: Show content preview as subtitle when not expanded */}
            {!expanded && getContentPreview() && (
              <div className="item-subtitle">
                <div className="item-preview">
                  {getContentPreview()}
                </div>
                <div className="item-meta">
                  {formatDate(memory.created_at)} • {getMemoryTypeLabel(memory.type)}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="compact-memory-meta">
          {!expanded && (
            <span className="memory-date">
              {formatDate(memory.created_at)}
            </span>
          )}
          
          {showActions && (
            <div className="compact-memory-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(memory.id)
                }}
                className="compact-delete-btn"
                title="Delete memory"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* CRITICAL: Proper expansion behavior without overlap */}
      <div className={`compact-memory-details ${expanded ? 'visible' : 'hidden'}`}>
        <div className="details-content">
          <div className="description-section">
            <h4>Content:</h4>
            <p>{memory.content}</p>
          </div>
          
          <div className="metadata-section">
            <h4>Details:</h4>
            <div className="metadata-grid">
              <span><strong>Type:</strong> {getMemoryTypeLabel(memory.type)}</span>
              <span><strong>Created:</strong> {new Date(memory.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
      
      <MemoryDetailModal
        memory={memory}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveMemory}
        onDelete={handleDeleteMemory}
      />
    </>
  )
}

export default CompactMemoryItem 