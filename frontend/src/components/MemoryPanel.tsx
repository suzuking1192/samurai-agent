import React, { useState, useEffect } from 'react'
import { Memory, MemoryType, MemoryCreate } from '../types'
import { getMemories, createMemory, deleteMemory } from '../services/api'

interface MemoryPanelProps {
  projectId?: string
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ projectId }) => {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
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
      setMemories(projectMemories)
    } catch (error) {
      console.error('Error loading memories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateMemory = async () => {
    if (!projectId || !newMemory.content.trim()) return

    try {
      const createdMemory = await createMemory(projectId, newMemory)
      setMemories(prev => [...prev, createdMemory])
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
      await deleteMemory(memoryId)
      setMemories(prev => prev.filter(memory => memory.id !== memoryId))
    } catch (error) {
      console.error('Error deleting memory:', error)
    }
  }

  const getMemoryTypeColor = (type: MemoryType) => {
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
        return 'Unknown'
    }
  }

  if (!projectId) {
    return (
      <div className="panel-content">
        <div className="card">
          <p>Please select a project to view memories.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="memory-panel">
      <div className="panel-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Memories</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="button"
          >
            {showCreateForm ? 'Cancel' : 'Add Memory'}
          </button>
        </div>

        {showCreateForm && (
          <div className="card">
            <h3>Create New Memory</h3>
            <textarea
              placeholder="Memory content"
              value={newMemory.content}
              onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
              className="input"
              rows={4}
              style={{ marginBottom: '0.5rem' }}
            />
            <select
              value={newMemory.type}
              onChange={(e) => setNewMemory(prev => ({ ...prev, type: e.target.value as MemoryType }))}
              className="input"
              style={{ marginBottom: '0.5rem' }}
            >
              <option value={MemoryType.NOTE}>Note</option>
              <option value={MemoryType.CONTEXT}>Context</option>
              <option value={MemoryType.DECISION}>Decision</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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

        {isLoading ? (
          <div className="card">
            <p>Loading memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="card">
            <p>No memories yet. Add your first memory!</p>
          </div>
        ) : (
          memories.map((memory) => (
            <div key={memory.id} className="card memory-card">
              <div className="memory-header">
                <span
                  className="memory-type-badge"
                  style={{ backgroundColor: getMemoryTypeColor(memory.type) }}
                >
                  {getMemoryTypeLabel(memory.type)}
                </span>
                <button
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="button danger"
                  style={{ 
                    padding: '0.25rem 0.5rem', 
                    fontSize: '0.8rem'
                  }}
                >
                  Delete
                </button>
              </div>
              
              <p className="memory-content">{memory.content}</p>
              
              <div className="memory-meta">
                <span className="memory-date">
                  {new Date(memory.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default MemoryPanel 