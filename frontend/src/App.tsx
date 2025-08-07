import { useState } from 'react'
import './App.css'
import './compact-layout.css'
import Chat from './components/Chat'
import TaskPanel from './components/TaskPanel'
import MemoryPanel from './components/MemoryPanel'
import ProjectSelector from './components/ProjectSelector'
import { Project } from './types'

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0)
  const [taskContextTrigger, setTaskContextTrigger] = useState(0)
  const [showMemory, setShowMemory] = useState(false)

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
  }

  const handleTaskRefresh = () => {
    setTaskRefreshTrigger(prev => prev + 1)
  }

  const handleTaskContextUpdate = () => {
    setTaskContextTrigger(prev => prev + 1)
  }

  const toggleMemory = () => {
    setShowMemory(!showMemory)
  }

  return (
    <div className="app">
      {/* Header with Memory Toggle */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">🥷 Samurai Agent</h1>
          <span className="header-subtitle">Your AI Vibe Coding Partner With Endless Memory</span>
        </div>
        <div className="header-actions">
          <ProjectSelector 
            selectedProject={selectedProject} 
            onProjectSelect={handleProjectSelect} 
          />
          <button 
            onClick={toggleMemory}
            className="memory-toggle-btn"
            title={showMemory ? 'Hide Memory Panel' : 'Show Memory Panel'}
          >
            {showMemory ? '🧠 Hide Memory' : '🧠 Show Memory'}
          </button>
        </div>
      </header>
      
      {/* Dynamic Layout Container */}
      <div className={`main-container ${showMemory ? 'memory-expanded' : 'memory-hidden'}`}>
        {/* Memory Panel - Conditionally Rendered */}
        {showMemory && (
          <div className="panel memory-panel scrollable-panel">
            <MemoryPanel projectId={selectedProject?.id} />
          </div>
        )}
        
        {/* Chat Interface - Dynamic Width */}
        <div className="chat-container">
          <Chat 
            projectId={selectedProject?.id} 
            onTaskGenerated={handleTaskRefresh}
            taskContextTrigger={taskContextTrigger}
          />
        </div>
        
        {/* Tasks Panel - Dynamic Width */}
        <div className="panel tasks-panel scrollable-panel">
          <TaskPanel 
            projectId={selectedProject?.id} 
            refreshTrigger={taskRefreshTrigger}
            onTaskContextUpdate={handleTaskContextUpdate}
          />
        </div>
      </div>
    </div>
  )
}

export default App 