import React, { useState, useEffect } from 'react'
import { Project, ProjectCreate } from '../types'
import { getProjects, createProject, deleteProject } from '../services/api'

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
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [newProject, setNewProject] = useState<ProjectCreate>({
    name: '',
    description: '',
    tech_stack: ''
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
    if (!newProject.name.trim()) {
      console.log('Project name is empty')
      return
    }
    
    if (!newProject.tech_stack.trim()) {
      console.log('Tech stack is empty')
      return
    }

    console.log('Creating project:', newProject)
    
    setIsCreating(true)
    try {
      const createdProject = await createProject(newProject)
      console.log('Project created successfully:', createdProject)
      setProjects(prev => [...prev, createdProject])
      setNewProject({
        name: '',
        description: '',
        tech_stack: ''
      })
      setShowCreateForm(false)
      onProjectSelect(createdProject)
    } catch (error) {
      console.error('Error creating project:', error)
      // Add user feedback for errors
      alert(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleProjectSelect = (project: Project) => {
    onProjectSelect(project)
  }

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      await deleteProject(projectToDelete.id)
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id))
      
      // If the deleted project was selected, clear selection
      if (selectedProject?.id === projectToDelete.id) {
        onProjectSelect(null as any)
      }
      
      setShowDeleteConfirm(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleModalClose = () => {
    setShowCreateForm(false)
    setNewProject({ name: '', description: '', tech_stack: '' })
  }

  const handleDeleteModalClose = () => {
    setShowDeleteConfirm(false)
    setProjectToDelete(null)
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
          
          <div className="project-actions">
            <button
              onClick={() => setShowCreateForm(true)}
              className="new-project-btn"
            >
              + New Project
            </button>
            
            {selectedProject && (
              <button
                onClick={() => handleDeleteProject(selectedProject)}
                className="delete-project-btn"
                title="Delete Project"
              >
                🗑️ Delete
              </button>
            )}
          </div>
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
              <input
                type="text"
                placeholder="Technology stack (e.g., React, Python, Node.js)"
                value={newProject.tech_stack}
                onChange={(e) => setNewProject(prev => ({ ...prev, tech_stack: e.target.value }))}
                className="modal-input"
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
                  disabled={!newProject.name.trim() || !newProject.tech_stack.trim() || isCreating}
                  className="modal-button primary"
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && projectToDelete && (
        <div className="modal-overlay" onClick={handleDeleteModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Delete Project</div>
            <div className="modal-form">
              <p className="delete-warning">
                Are you sure you want to delete "{projectToDelete.name}"?
              </p>
              <p className="delete-warning">
                This will permanently delete the project and all its associated data (tasks, memories, chat history).
              </p>
              <div className="modal-buttons">
                <button
                  onClick={handleDeleteModalClose}
                  className="modal-button secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteProject}
                  className="modal-button danger"
                >
                  Delete Project
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