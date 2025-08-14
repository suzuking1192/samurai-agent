import { useState } from 'react'
import './App.css'
import './compact-layout.css'
import Chat from './components/Chat'
import TaskPanel from './components/TaskPanel'
import MemoryPanel from './components/MemoryPanel'
import ProjectSelector from './components/ProjectSelector'
import FullScreenModal from './components/FullScreenModal'
import { getProjectDetail, ingestProjectDetail, saveProjectDetail } from './services/api'
import { Project } from './types'

function App() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0)
  const [taskContextTrigger, setTaskContextTrigger] = useState(0)
  const [showMemory, setShowMemory] = useState(false)
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false)
  const [projectDetailMode, setProjectDetailMode] = useState<'ingest' | 'edit'>('ingest')
  const [projectDetailInput, setProjectDetailInput] = useState('')
  const [loadingProjectDetail, setLoadingProjectDetail] = useState(false)
  const [savingProjectDetail, setSavingProjectDetail] = useState(false)

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
  }

  const handleProjectCreated = (project: Project) => {
    setSelectedProject(project)
    // Open the Project Detail modal immediately after confirmed creation
    openProjectDetailModal('ingest')
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

  const openProjectDetailModal = async (mode: 'ingest' | 'edit') => {
    setProjectDetailMode(mode)
    setShowProjectDetailModal(true)
    if (mode === 'edit' && selectedProject?.id) {
      try {
        setLoadingProjectDetail(true)
        const res = await getProjectDetail(selectedProject.id)
        setProjectDetailInput(res.content || '')
      } catch (e) {
        console.error('Failed to load project detail', e)
        setProjectDetailInput('')
      } finally {
        setLoadingProjectDetail(false)
      }
    } else {
      setProjectDetailInput('')
    }
  }

  const handleSubmitProjectDetail = async () => {
    if (!selectedProject?.id) return
    try {
      setSavingProjectDetail(true)
      if (projectDetailMode === 'ingest') {
        const response = await ingestProjectDetail(selectedProject.id, projectDetailInput)
        console.log('Project detail digest initiated:', response.message)
        // Show a brief success message since the operation is now async
        alert('Project detail digest has been initiated in the background. The AI will process your text and update the project specification.')
      } else {
        await saveProjectDetail(selectedProject.id, projectDetailInput)
      }
      setShowProjectDetailModal(false)
    } catch (e) {
      console.error('Failed to save project detail', e)
      alert('Failed to process project detail. Please try again.')
    } finally {
      setSavingProjectDetail(false)
    }
  }

  return (
    <div className="app">
      {/* Header with Memory Toggle */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">🥷 Samurai Agent</h1>
          <span className="header-subtitle">Your vibe coding partner that turns ideas into AI-ready implementation specs</span>
        </div>
        <div className="header-actions">
          <ProjectSelector 
            selectedProject={selectedProject} 
            onProjectSelect={handleProjectSelect}
            onProjectCreated={handleProjectCreated}
          />
          <button 
            onClick={() => openProjectDetailModal('ingest')}
            className="button"
            title="Add Project Detail"
          >
            📄 Add Project Detail
          </button>
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
      <FullScreenModal isOpen={showProjectDetailModal} onClose={() => setShowProjectDetailModal(false)}>
        <section className="project-detail-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
          <header className="project-detail-header">
            <h2 id="project-detail-title" className="project-detail-title">
              {projectDetailMode === 'ingest' ? 'Add Project Detail' : 'Edit Project Detail Brain'}
            </h2>
            <nav className="project-detail-tabs" aria-label="Project Detail Mode">
              <button
                onClick={() => openProjectDetailModal('ingest')}
                className={`pd-tab ${projectDetailMode === 'ingest' ? 'active' : ''}`}
                aria-pressed={projectDetailMode === 'ingest'}
              >
                Add (AI Digest)
              </button>
              <button
                onClick={() => openProjectDetailModal('edit')}
                className={`pd-tab ${projectDetailMode === 'edit' ? 'active' : ''}`}
                aria-pressed={projectDetailMode === 'edit'}
              >
                Edit Project Detail Brain
              </button>
            </nav>
          </header>

          <div className="project-detail-explainer">
            Add project knowledge here — paste documentation, meeting notes, or any long text. Samurai Agent will use it as context and keep it evolving as our conversation continues. You can add or edit information anytime.
          </div>

          <div className="project-detail-body">
            <textarea
              placeholder={projectDetailMode === 'ingest' ? 'Paste raw meeting minutes, specs, documents...' : 'Edit your current project detail...'}
              value={projectDetailInput}
              onChange={(e) => setProjectDetailInput(e.target.value)}
              className="project-detail-textarea"
            />
            <div className="project-detail-helper">
              {projectDetailMode === 'ingest'
                ? 'The Samurai Agent will use AI to digest this text and save the most relevant project details as your permanent project specification for future reference.'
                : 'Editing directly updates your permanent project specification. This bypasses AI digestion.'}
            </div>
          </div>

          <footer className="project-detail-footer">
            <button onClick={() => setShowProjectDetailModal(false)} disabled={savingProjectDetail} className="modal-button secondary">Cancel</button>
            <button onClick={handleSubmitProjectDetail} disabled={savingProjectDetail || loadingProjectDetail || !selectedProject} className="modal-button primary">
              {savingProjectDetail
                ? (projectDetailMode === 'ingest' ? 'Initiating Digest…' : 'Saving…')
                : (projectDetailMode === 'ingest' ? 'Start AI Digest' : 'Save Project Detail')}
            </button>
          </footer>
        </section>
      </FullScreenModal>
    </div>
  )
}

export default App 