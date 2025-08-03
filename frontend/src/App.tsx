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

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
  }

  const handleTaskRefresh = () => {
    setTaskRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="app">
      {/* Clean Header without Hide Buttons */}
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
        </div>
      </header>
      
      {/* Fixed Three Panel Layout - No Hide Functionality */}
      <div className="main-container">
        {/* LEFT: Memory Panel - Fixed Width */}
        <div className="panel memory-panel scrollable-panel">
          <MemoryPanel projectId={selectedProject?.id} />
        </div>
        
        {/* CENTER: Chat Interface - Flexible */}
        <div className="chat-container">
          <Chat projectId={selectedProject?.id} onTaskGenerated={handleTaskRefresh} />
        </div>
        
        {/* RIGHT: Tasks Panel - Fixed Width */}
        <div className="panel tasks-panel scrollable-panel">
          <TaskPanel projectId={selectedProject?.id} refreshTrigger={taskRefreshTrigger} />
        </div>
      </div>
    </div>
  )
}

export default App 