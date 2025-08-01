import { useState, useEffect, useCallback } from 'react'
import { Project, ProjectCreate, ApiError } from '../types'
import { getProjects, createProject, deleteProject } from '../services/api'

interface UseProjectsReturn {
  projects: Project[]
  isLoading: boolean
  error: string | null
  createProject: (project: ProjectCreate) => Promise<Project | null>
  deleteProject: (projectId: string) => Promise<boolean>
  refreshProjects: () => Promise<void>
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const fetchedProjects = await getProjects()
      setProjects(fetchedProjects)
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to load projects'
      setError(errorMessage)
      console.error('Error loading projects:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createNewProject = useCallback(async (projectData: ProjectCreate): Promise<Project | null> => {
    setError(null)
    
    try {
      const newProject = await createProject(projectData)
      setProjects(prev => [...prev, newProject])
      return newProject
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to create project'
      setError(errorMessage)
      console.error('Error creating project:', err)
      return null
    }
  }, [])

  const deleteProjectById = useCallback(async (projectId: string): Promise<boolean> => {
    setError(null)
    
    try {
      await deleteProject(projectId)
      setProjects(prev => prev.filter(project => project.id !== projectId))
      return true
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to delete project'
      setError(errorMessage)
      console.error('Error deleting project:', err)
      return false
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    await loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return {
    projects,
    isLoading,
    error,
    createProject: createNewProject,
    deleteProject: deleteProjectById,
    refreshProjects
  }
}

// Hook for managing a single project
interface UseProjectReturn {
  project: Project | null
  isLoading: boolean
  error: string | null
  refreshProject: () => Promise<void>
}

export function useProject(projectId: string | undefined): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setProject(null)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const fetchedProject = await getProjects()
      const foundProject = fetchedProject.find(p => p.id === projectId)
      setProject(foundProject || null)
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to load project'
      setError(errorMessage)
      console.error('Error loading project:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const refreshProject = useCallback(async () => {
    await loadProject()
  }, [loadProject])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  return {
    project,
    isLoading,
    error,
    refreshProject
  }
} 