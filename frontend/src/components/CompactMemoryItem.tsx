import React, { useState } from 'react'
import { Memory, MemoryType } from '../types'
import MemoryDetailModal from './MemoryDetailModal'

interface CompactMemoryItemProps {
  memory: Memory
  onDelete: (memoryId: string) => void
  style?: React.CSSProperties
}

const CompactMemoryItem: React.FC<CompactMemoryItemProps> = ({ 
  memory, 
  onDelete, 
  style 
}) => {
  const [showActions, setShowActions] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const getMemoryIcon = (type: MemoryType) => {
    switch (type) {
      case MemoryType.FEATURE:
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
      case MemoryType.FEATURE:
        return '#3498db'
      case MemoryType.DECISION:
        return '#e74c3c'
      case MemoryType.NOTE:
        return '#f39c12'
      default:
        return '#95a5a6'
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
        className="compact-memory-item"
        style={style}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={handleItemClick}
      >
        <div className="item-header">
          <span className="memory-icon" style={{ color: getMemoryColor(memory.type) }}>
            {getMemoryIcon(memory.type)}
          </span>
          
          <div className="item-title">
            {memory.content.substring(0, 50)}...
          </div>
          
          {showActions && (
            <div className="item-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(memory.id)
                }}
                className="action-btn"
                title="Delete memory"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
        
        <div className="item-description">
          {memory.content}
        </div>
        
        <div className="item-meta">
          <span className="preview">{memory.content.substring(0, 40)}...</span>
          <span className="date">{formatDate(memory.created_at)}</span>
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