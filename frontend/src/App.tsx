import React, { useState } from 'react'
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
      <header className="app-header">
        <h1>Samurai Agent</h1>
        <ProjectSelector 
          selectedProject={selectedProject} 
          onProjectSelect={handleProjectSelect} 
        />
      </header>
      
      <main className="app-main">
        <div className="panel-container">
          <div className="left-panel">
            <TaskPanel projectId={selectedProject?.id} />
          </div>
          
          <div className="center-panel">
            <Chat projectId={selectedProject?.id} />
          </div>
          
          <div className="right-panel">
            <MemoryPanel projectId={selectedProject?.id} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App 