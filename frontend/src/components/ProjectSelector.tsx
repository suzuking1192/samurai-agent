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

  return (
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
          className="input"
          style={{ minWidth: '200px' }}
        >
          <option value="">Select a project...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="button"
          style={{ marginLeft: '0.5rem' }}
        >
          {showCreateForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showCreateForm && (
        <div className="project-create-form">
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <h3>Create New Project</h3>
            <input
              type="text"
              placeholder="Project name"
              value={newProject.name}
              onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              style={{ marginBottom: '0.5rem' }}
            />
            <textarea
              placeholder="Project description"
              value={newProject.description}
              onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
              className="input"
              rows={3}
              style={{ marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
                className="button"
              >
                Create Project
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="button"
                style={{ backgroundColor: '#95a5a6' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="selected-project-info">
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <h4>{selectedProject.name}</h4>
            <p>{selectedProject.description}</p>
            <small>
              Created: {new Date(selectedProject.created_at).toLocaleDateString()}
            </small>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-indicator">
          <p>Loading projects...</p>
        </div>
      )}
    </div>
  )
}

export default ProjectSelector 