import React, { useState, useEffect } from 'react'
import { Memory, MemoryType, MemoryCreate, MemoryCategory, CATEGORY_CONFIG } from '../types'
import { getMemories, createMemory, deleteMemory } from '../services/api'
import MemoryDetailModal from './MemoryDetailModal'

interface MemoryPanelProps {
  projectId?: string
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ projectId }) => {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categoryType, setCategoryType] = useState<'all' | 'technical' | 'feature'>('all')
  const [newMemory, setNewMemory] = useState<MemoryCreate>({
    content: '',
    type: MemoryType.NOTE
  })

  useEffect(() => {
    if (projectId) {
      loadMemories()
    } else {
      setMemories([])
    }
  }, [projectId])

  const loadMemories = async () => {
    if (!projectId) return
    
    setIsLoading(true)
    try {
      const projectMemories = await getMemories(projectId)
      // Sort by creation date (newest first)
      const sortedMemories = (projectMemories || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setMemories(sortedMemories)
    } catch (error) {
      console.error('Error loading memories:', error)
      setMemories([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateMemory = async () => {
    if (!projectId || !newMemory.content.trim()) return

    try {
      const createdMemory = await createMemory(projectId, newMemory)
      setMemories(prev => [createdMemory, ...prev]) // Add to beginning for newest first
      setNewMemory({
        content: '',
        type: MemoryType.NOTE
      })
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating memory:', error)
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemory(projectId!, memoryId)
      setMemories(prev => prev.filter(memory => memory.id !== memoryId))
    } catch (error) {
      console.error('Error deleting memory:', error)
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

  const openMemoryModal = (memory: Memory) => {
    setSelectedMemory(memory)
  }

  const closeMemoryModal = () => {
    setSelectedMemory(null)
  }

  // Get filtered categories based on category type
  const getFilteredCategories = () => {
    return Object.entries(CATEGORY_CONFIG).filter(([key, config]) => {
      if (categoryType === 'all') return true
      return config.type === categoryType
    })
  }

  // Filter memories based on selected category
  const getFilteredMemories = () => {
    if (selectedCategory === 'all') return memories
    return memories.filter(memory => memory.category === selectedCategory)
  }

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category as MemoryCategory] || CATEGORY_CONFIG[MemoryCategory.GENERAL]
  }

  if (!projectId) {
    return (
      <div className="memory-panel">
        <div className="panel-header">
          <h3>💡 Memory</h3>
          <span className="memory-count">(0)</span>
        </div>
        <div className="empty-state">
          <p>Please select a project to view memories.</p>
        </div>
      </div>
    )
  }

  const filteredMemories = getFilteredMemories()

  return (
    <div className="memory-panel">
      <div className="panel-header">
        <h3>💡 Memory</h3>
        <span className="memory-count">({filteredMemories.length})</span>
      </div>

      <div className="panel-content">
        {/* Category Type Filter */}
        <div className="category-type-filter">
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${categoryType === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryType('all')}
            >
              All
            </button>
            <button 
              className={`filter-tab ${categoryType === 'technical' ? 'active' : ''}`}
              onClick={() => setCategoryType('technical')}
            >
              ⚙️ Technical
            </button>
            <button 
              className={`filter-tab ${categoryType === 'feature' ? 'active' : ''}`}
              onClick={() => setCategoryType('feature')}
            >
              ⭐ Features
            </button>
          </div>
        </div>

        {/* Specific Category Filter */}
        <div className="category-filter">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            <option value="all">All Categories</option>
            {getFilteredCategories().map(([key, config]) => (
              <option key={key} value={key.toLowerCase()}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
        </div>

        {showCreateForm && (
          <div className="create-memory-form">
            <h4>Create New Memory</h4>
            <textarea
              placeholder="Memory content"
              value={newMemory.content}
              onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
              className="input"
              rows={4}
            />
            <select
              value={newMemory.type}
              onChange={(e) => setNewMemory(prev => ({ ...prev, type: e.target.value as MemoryType }))}
              className="input"
            >
              <option value={MemoryType.NOTE}>Note</option>
              <option value={MemoryType.FEATURE}>Feature</option>
              <option value={MemoryType.DECISION}>Decision</option>
              <option value={MemoryType.SPEC}>Spec</option>
            </select>
            <div className="form-actions">
              <button
                onClick={handleCreateMemory}
                disabled={!newMemory.content.trim()}
                className="button"
              >
                Create Memory
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="button secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="add-memory-btn"
            style={{ margin: '12px', padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            + Add Memory
          </button>
        )}

        {isLoading ? (
          <div className="loading-indicator">
            <span>Loading memories...</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="empty-state">
            <p>No memories yet. Add your first memory!</p>
          </div>
        ) : (
          <div className="memory-list">
            {filteredMemories.map(memory => {
              const categoryConfig = getCategoryConfig(memory.category)
              return (
                <div 
                  key={memory.id} 
                  className="memory-item categorized"
                  onClick={() => openMemoryModal(memory)}
                  style={{ borderLeftColor: categoryConfig.color }}
                >
                  <div className="memory-header">
                    <span className="category-icon">{categoryConfig.icon}</span>
                    <div className="memory-title">
                      {memory.title || memory.content.substring(0, 50)}
                    </div>
                    <span className="category-badge" style={{ backgroundColor: categoryConfig.color }}>
                      {categoryConfig.label}
                    </span>
                  </div>
                  <div className="memory-preview">
                    {memory.content.length > 80 
                      ? `${memory.content.substring(0, 80)}...` 
                      : memory.content}
                  </div>
                  <div className="memory-meta">
                    <span className="memory-date">{formatDate(memory.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          isOpen={true}
          onClose={closeMemoryModal}
          onSave={async () => {}} // Memory updates not implemented yet
          onDelete={handleDeleteMemory}
        />
      )}
    </div>
  )
}

export default MemoryPanel 