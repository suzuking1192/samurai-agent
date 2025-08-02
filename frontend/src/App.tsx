import { useState } from 'react'
import './App.css'
import Chat from './components/Chat'
import TaskPanel from './components/TaskPanel'
import MemoryPanel from './components/MemoryPanel'
import ProjectSelector from './components/ProjectSelector'
import { Project } from './types'

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
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
          <ProjectSelector 
            selectedProject={selectedProject} 
            onProjectSelect={handleProjectSelect} 
          />
        </div>
      </header>
      
      {/* Three Panel Layout */}
      <div className="main-container">
        {/* LEFT: Memory Panel */}
        <div className="panel memory-panel">
          <div className="panel-header">
            🧠 Project Memory
          </div>
          <div className="panel-content">
            <MemoryPanel projectId={selectedProject?.id} />
          </div>
        </div>
        
        {/* CENTER: Chat Interface */}
        <div className="chat-container">
          <Chat projectId={selectedProject?.id} />
        </div>
        
        {/* RIGHT: Tasks Panel */}
        <div className="panel tasks-panel">
          <div className="panel-header">
            📋 Tasks & Prompts
          </div>
          <div className="panel-content">
            <TaskPanel projectId={selectedProject?.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App 