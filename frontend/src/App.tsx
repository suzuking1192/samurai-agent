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
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(true)

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
  }

  const handleTaskRefresh = () => {
    setTaskRefreshTrigger(prev => prev + 1)
  }

  // Determine grid layout class based on panel visibility
  const getGridLayoutClass = () => {
    if (!showLeftPanel && !showRightPanel) return 'both-hidden'
    if (!showLeftPanel) return 'memory-hidden'
    if (!showRightPanel) return 'tasks-hidden'
    return ''
  }

  return (
    <div className="app">
      {/* Compact Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">🥷 Samurai Agent</h1>
          <span className="header-subtitle">Your AI Vibe Coding Partner With Endless Memory</span>
        </div>
        <div className="header-actions">
          <div className="layout-controls">
            <button 
              className="panel-toggle-btn"
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              title={showLeftPanel ? 'Hide Memory Panel' : 'Show Memory Panel'}
            >
              {showLeftPanel ? '⬅️ Hide Memory' : '➡️ Show Memory'}
            </button>
            <button 
              className="panel-toggle-btn"
              onClick={() => setShowRightPanel(!showRightPanel)}
              title={showRightPanel ? 'Hide Tasks Panel' : 'Show Tasks Panel'}
            >
              {showRightPanel ? 'Hide Tasks ➡️' : '⬅️ Show Tasks'}
            </button>
          </div>
          <ProjectSelector 
            selectedProject={selectedProject} 
            onProjectSelect={handleProjectSelect} 
          />
        </div>
      </header>
      
      {/* Three Panel Layout with Independent Scrolling */}
      <div className={`main-container ${getGridLayoutClass()}`}>
        {/* LEFT: Memory Panel */}
        {showLeftPanel && (
          <div className="panel memory-panel scrollable-panel">
            <MemoryPanel projectId={selectedProject?.id} />
          </div>
        )}
        
        {/* CENTER: Chat Interface */}
        <div className="chat-container">
          <Chat projectId={selectedProject?.id} onTaskGenerated={handleTaskRefresh} />
        </div>
        
        {/* RIGHT: Tasks Panel */}
        {showRightPanel && (
          <div className="panel tasks-panel scrollable-panel">
            <TaskPanel projectId={selectedProject?.id} refreshTrigger={taskRefreshTrigger} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App 