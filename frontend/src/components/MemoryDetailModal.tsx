import React, { useState, useEffect } from 'react'
import { Memory, MemoryType } from '../types'
import FullScreenModal from './FullScreenModal'

interface MemoryDetailModalProps {
  memory: Memory | null
  isOpen: boolean
  onClose: () => void
  onSave: (memoryId: string, updates: Partial<Memory>) => Promise<void>
  onDelete: (memoryId: string) => Promise<void>
}

const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
  memory,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    content: '',
    type: MemoryType.NOTE
  })

  useEffect(() => {
    if (memory) {
      setFormData({
        content: memory.content,
        type: memory.type
      })
    }
  }, [memory])

  const handleSave = async () => {
    if (!memory) return
    
    try {
      await onSave(memory.id, formData)
      setEditMode(false)
      showNotification('Memory updated successfully', 'success')
    } catch (error) {
      showNotification('Failed to update memory', 'error')
    }
  }

  const handleDelete = async () => {
    if (!memory) return
    
    if (window.confirm('Are you sure you want to delete this memory?')) {
      try {
        await onDelete(memory.id)
        onClose()
        showNotification('Memory deleted successfully', 'success')
      } catch (error) {
        showNotification('Failed to delete memory', 'error')
      }
    }
  }

  const getTypeIcon = (type: MemoryType) => {
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

  const getTypeLabel = (type: MemoryType) => {
    switch (type) {
      case MemoryType.FEATURE:
        return 'Feature'
      case MemoryType.DECISION:
        return 'Decision'
      case MemoryType.NOTE:
        return 'Note'
      default:
        return 'Memory'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Simple notification implementation
    const notification = document.createElement('div')
    notification.className = `notification ${type}`
    notification.textContent = message
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 1001;
      ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  if (!isOpen || !memory) return null

  return (
    <FullScreenModal isOpen={isOpen} onClose={onClose}>
      <div className="memory-modal-container">
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">💡</span>
            <h1>{getTypeLabel(memory.type)} Memory</h1>
          </div>
          <div className="modal-actions">
            {editMode ? (
              <>
                <button onClick={handleSave} className="btn-save">
                  💾 Save
                </button>
                <button onClick={() => setEditMode(false)} className="btn-cancel">
                  ✖️ Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)} className="btn-edit">
                  ✏️ Edit
                </button>
                <button onClick={handleDelete} className="btn-delete">
                  🗑️ Delete
                </button>
              </>
            )}
            <button onClick={onClose} className="btn-close">
              ✖️
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="task-details-grid">
            {/* Left Column - Main Content */}
            <div className="main-content">
              {/* Type */}
              <div className="detail-row">
              <div className="detail-field">
                <label>Type:</label>
                {editMode ? (
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as MemoryType})}
                    className="type-select"
                  >
                    <option value={MemoryType.FEATURE}>💡 Feature</option>
                    <option value={MemoryType.DECISION}>🎯 Decision</option>
                    <option value={MemoryType.NOTE}>📝 Note</option>
                  </select>
                ) : (
                  <span className={`type-badge type-${memory.type}`}>
                    {getTypeIcon(memory.type)} {getTypeLabel(memory.type)}
                  </span>
                )}
              </div>
            </div>

              {/* Content Section */}
              <div className="description-section">
                <label>Content:</label>
                {editMode ? (
                  <textarea
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    className="description-textarea"
                    rows={10}
                    placeholder="Memory content..."
                  />
                ) : (
                  <div className="description-display">
                    {memory.content || 'No content'}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Metadata */}
            <div className="sidebar-content">
              <div className="metadata-section">
                <h3>📊 Memory Information</h3>
                <div className="metadata-list">
                  <div className="metadata-item">
                    <strong>Created:</strong>
                    <span>{formatDate(memory.created_at)}</span>
                  </div>
                  <div className="metadata-item">
                    <strong>Memory ID:</strong>
                    <span className="task-id">{memory.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}

export default MemoryDetailModal 