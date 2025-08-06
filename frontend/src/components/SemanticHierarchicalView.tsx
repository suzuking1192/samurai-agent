import React, { useState, useEffect } from 'react'
import { Task, Memory } from '../types'
import { getSemanticHierarchy } from '../services/api'
import CompactTaskItem from './CompactTaskItem'
import CompactMemoryItem from './CompactMemoryItem'

interface SemanticGroup {
  name: string
  icon: string
  items: (Task | Memory)[]
  subgroups?: SemanticGroup[]
}

interface SemanticHierarchicalViewProps {
  tasks: Task[]
  memories: Memory[]
  onTaskUpdate: (taskId: string, updates: any) => void
  onTaskDelete: (taskId: string) => void
  onTaskClick: (task: Task) => void
  onMemoryDelete: (memoryId: string) => void
  className?: string
  clusteringType?: string
  depth?: number
}

const SemanticHierarchicalView: React.FC<SemanticHierarchicalViewProps> = ({
  tasks,
  memories,
  onTaskUpdate,
  onTaskDelete,
  onTaskClick,
  onMemoryDelete,
  className = '',
  clusteringType = 'content',
  depth = 2
}) => {
  const [semanticGroups, setSemanticGroups] = useState<SemanticGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    const buildSemanticHierarchy = async () => {
      if (tasks.length === 0 && memories.length === 0) {
        setSemanticGroups([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      
      try {
        // Get project ID from first task or memory
        const projectId = tasks[0]?.project_id || memories[0]?.project_id
        
        if (!projectId) {
          // Fallback to client-side grouping if no project ID
          const groups = createClientSideGroups(tasks, memories)
          setSemanticGroups(groups)
          setLoading(false)
          return
        }

        // Call backend API for semantic hierarchy
        const response = await getSemanticHierarchy(projectId, clusteringType, depth)
        
        // Convert backend response to frontend format
        const groups = convertBackendResponse(response, tasks, memories)
        setSemanticGroups(groups)
        
        // Auto-expand groups with items
        const autoExpanded = new Set<string>()
        groups.forEach(group => {
          if (group.items.length > 0) {
            autoExpanded.add(group.name)
          }
        })
        setExpandedGroups(autoExpanded)
        
      } catch (error) {
        console.error('Error building semantic hierarchy:', error)
        setError('Failed to load semantic hierarchy')
        
        // Fallback to client-side grouping
        const groups = createClientSideGroups(tasks, memories)
        setSemanticGroups(groups)
      } finally {
        setLoading(false)
      }
    }
    
    buildSemanticHierarchy()
  }, [tasks, memories, clusteringType, depth])

  const createClientSideGroups = (tasks: Task[], memories: Memory[]): SemanticGroup[] => {
    const allItems = [...tasks, ...memories]
    const groups: { [key: string]: (Task | Memory)[] } = {}

    // Define semantic categories based on common keywords
    const categories = {
      'Authentication & Security': ['auth', 'login', 'password', 'security', 'jwt', 'oauth', 'encrypt'],
      'Database & Storage': ['database', 'db', 'sql', 'schema', 'migration', 'storage', 'query'],
      'API & Backend': ['api', 'backend', 'server', 'endpoint', 'rest', 'graphql', 'middleware'],
      'Frontend & UI': ['frontend', 'ui', 'react', 'component', 'css', 'styling', 'responsive'],
      'Testing & Quality': ['test', 'testing', 'unit', 'integration', 'quality', 'bug', 'fix'],
      'Deployment & DevOps': ['deploy', 'docker', 'ci', 'cd', 'aws', 'server', 'production'],
      'User Experience': ['ux', 'user', 'interface', 'experience', 'flow', 'design'],
      'Performance & Optimization': ['performance', 'optimize', 'speed', 'cache', 'memory'],
      'Project Management': ['plan', 'sprint', 'milestone', 'deadline', 'priority', 'status']
    }

    // Group items by semantic categories
    allItems.forEach(item => {
      let content = ''
      if ('title' in item && 'description' in item) {
        // Task
        content = `${item.title} ${item.description}`.toLowerCase()
      } else if ('content' in item) {
        // Memory
        content = item.content.toLowerCase()
      }
      
      let assigned = false

      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          if (!groups[category]) {
            groups[category] = []
          }
          groups[category].push(item)
          assigned = true
          break
        }
      }

      if (!assigned) {
        if (!groups['General']) {
          groups['General'] = []
        }
        groups['General'].push(item)
      }
    })

    // Convert to SemanticGroup format
    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({
        name,
        icon: '📁',
        items: items.sort((a, b) => {
          const dateA = new Date(a.created_at)
          const dateB = new Date(b.created_at)
          return dateB.getTime() - dateA.getTime()
        })
      }))
      .sort((a, b) => b.items.length - a.items.length)
  }

  const convertBackendResponse = (response: any, tasks: Task[], memories: Memory[]): SemanticGroup[] => {
    const groups: SemanticGroup[] = []
    
    if (response.groups) {
      for (const group of response.groups) {
        const items: (Task | Memory)[] = []
        
        // Convert backend items to frontend format
        for (const item of group.items) {
          if (item.type === 'task') {
            const task = tasks.find(t => t.id === item.id)
            if (task) items.push(task)
          } else if (item.type === 'memory') {
            const memory = memories.find(m => m.id === item.id)
            if (memory) items.push(memory)
          }
        }
        
        groups.push({
          name: group.name,
          icon: group.icon || '📁',
          items: items
        })
      }
    }
    
    return groups
  }

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
      }
      return newSet
    })
  }

  const getItemCount = (group: SemanticGroup): number => {
    return group.items.length
  }

  const renderItem = (item: Task | Memory) => {
    if ('title' in item && 'description' in item) {
      // Task
      return (
        <CompactTaskItem
          key={item.id}
          task={item as Task}
          onUpdate={onTaskUpdate}
          onDelete={onTaskDelete}
          onTaskClick={onTaskClick}
        />
      )
    } else if ('content' in item) {
      // Memory
      return (
        <CompactMemoryItem
          key={item.id}
          memory={item as Memory}
          onDelete={onMemoryDelete}
        />
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className={`semantic-hierarchy-loading ${className}`}>
        <div className="loading-indicator">
          <span>🧠 Analyzing semantic relationships...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`semantic-hierarchy-error ${className}`}>
        <div className="error-state">
          <p>⚠️ {error}</p>
          <p>Using fallback grouping...</p>
        </div>
      </div>
    )
  }

  if (semanticGroups.length === 0) {
    return (
      <div className={`semantic-hierarchy-empty ${className}`}>
        <div className="empty-state">
          <p>No items to organize</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`semantic-hierarchical-view ${className}`}>
      {semanticGroups.map((group) => (
        <div key={group.name} className="semantic-group">
          <div 
            className="semantic-group-header"
            onClick={() => toggleGroup(group.name)}
          >
            <span className="semantic-group-icon">
              {group.icon}
            </span>
            <span className="semantic-group-name">{group.name}</span>
            <span className="semantic-group-count">({getItemCount(group)})</span>
            <span className="semantic-group-expand">
              {expandedGroups.has(group.name) ? '˅' : '>'}
            </span>
          </div>
          
          {expandedGroups.has(group.name) && (
            <div className="semantic-group-items">
              {group.items.map((item) => renderItem(item))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default SemanticHierarchicalView 