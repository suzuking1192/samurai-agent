import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate } from '../types'
import { getProjects, createProject } from '../services/api'

interface ProjectSelectorProps {
  selectedProject: Project | null
  onProjectSelect: (project: Project) => void
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ 
  selectedProject, 
  onProjectSelect 
}) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProject, setNewProject] = useState<ProjectCreate>({
    name: '',
    description: ''
  })

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setIsLoading(true)
    try {
      const allProjects = await getProjects()
      setProjects(allProjects)
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return

    try {
      const createdProject = await createProject(newProject)
      setProjects(prev => [...prev, createdProject])
      setNewProject({
        name: '',
        description: ''
      })
      setShowCreateForm(false)
      onProjectSelect(createdProject)
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  const handleProjectSelect = (project: Project) => {
    onProjectSelect(project)
  }

  const handleModalClose = () => {
    setShowCreateForm(false)
    setNewProject({ name: '', description: '' })
  }

  return (
    <>
      <div className="project-selector">
        <div className="project-selector-header">
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === e.target.value)
              if (project) {
                handleProjectSelect(project)
              }
            }}
            className="project-dropdown"
          >
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="new-project-btn"
          >
            + New Project
          </button>
        </div>

        {isLoading && (
          <div className="loading-indicator">
            <p>Loading projects...</p>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Create New Project</div>
            <div className="modal-form">
              <input
                type="text"
                placeholder="Project name"
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                className="modal-input"
              />
              <textarea
                placeholder="Project description"
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                className="modal-input"
                rows={3}
              />
              <div className="modal-buttons">
                <button
                  onClick={handleModalClose}
                  className="modal-button secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim()}
                  className="modal-button primary"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProjectSelector 