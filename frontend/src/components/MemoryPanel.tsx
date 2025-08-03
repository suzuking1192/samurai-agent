import React, { useState, useEffect } from 'react'
import { Memory, MemoryType, MemoryCreate } from '../types'
import { getMemories, createMemory, deleteMemory } from '../services/api'
import CompactMemoryItem from './CompactMemoryItem'
import VirtualizedList from './VirtualizedList'
import ViewControls, { ViewMode } from './ViewControls'
import SemanticHierarchicalView from './SemanticHierarchicalView'

interface MemoryPanelProps {
  projectId?: string
}

const MemoryPanel: React.FC<MemoryPanelProps> = ({ projectId }) => {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [currentView, setCurrentView] = useState<ViewMode>('list')
  const [semanticOptions, setSemanticOptions] = useState({
    clustering: 'content',
    depth: 2
  })
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
      setMemories(projectMemories || []) // Ensure we always have an array
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
      await deleteMemory(projectId!, memoryId)
      setMemories(prev => prev.filter(memory => memory.id !== memoryId))
    } catch (error) {
      console.error('Error deleting memory:', error)
    }
  }

  const handleSemanticOptionChange = (option: string, value: any) => {
    setSemanticOptions(prev => ({
      ...prev,
      [option]: value
    }))
  }

  const renderMemoryItem = (memory: Memory, _index: number, style: React.CSSProperties) => (
    <CompactMemoryItem
      key={memory.id}
      memory={memory}
      onDelete={handleDeleteMemory}
      style={style}
    />
  )

  if (!projectId) {
    return (
      <div className="panel-content">
        <div className="empty-state">
          <p>Please select a project to view memories.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="memory-panel">
      <div className="panel-header">
        <div className="panel-header-content">
          <h3>💡 Memories</h3>
          <span className="memory-count">({memories.length})</span>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="add-memory-btn"
        >
          {showCreateForm ? 'Cancel' : 'Add Memory'}
        </button>
      </div>

      <div className="panel-content">
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
              <option value={MemoryType.CONTEXT}>Context</option>
              <option value={MemoryType.DECISION}>Decision</option>
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

        <ViewControls
          currentView={currentView}
          onViewChange={setCurrentView}
          semanticOptions={semanticOptions}
          onSemanticOptionChange={handleSemanticOptionChange}
          className="view-controls-compact"
        />

        {isLoading ? (
          <div className="loading-indicator">
            <span>Loading memories...</span>
          </div>
        ) : memories.length === 0 ? (
          <div className="empty-state">
            <p>No memories yet. Add your first memory!</p>
          </div>
        ) : (
          <div className="memories-content">
            {currentView === 'list' && (
              <VirtualizedList
                items={memories}
                itemHeight={80}
                height="calc(100vh - 300px)"
                renderItem={renderMemoryItem}
                className="memories-virtualized-list"
              />
            )}
            
            {currentView === 'semantic' && (
              <SemanticHierarchicalView
                tasks={[]}
                memories={memories}
                onTaskUpdate={() => {}}
                onTaskDelete={() => {}}
                onMemoryDelete={handleDeleteMemory}
                className="memories-semantic-view"
                clusteringType={semanticOptions.clustering}
                depth={semanticOptions.depth}
              />
            )}
            
            {currentView === 'timeline' && (
              <div className="timeline-view">
                <p>Timeline view coming soon...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryPanel 