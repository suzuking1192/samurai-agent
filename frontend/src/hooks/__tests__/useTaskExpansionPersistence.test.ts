import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useTaskExpansionPersistence } from '../useTaskExpansionPersistence'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('useTaskExpansionPersistence', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('should initialize with empty expanded tasks', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    expect(result.current.expandedTasks).toEqual({})
    expect(result.current.isTaskExpanded('task-1')).toBe(false)
  })

  it('should load existing state from localStorage', () => {
    const savedState = {
      expandedTasks: { 'task-1': true, 'task-2': false },
      projectId: 'project-1'
    }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState))

    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true, 'task-2': false })
    expect(result.current.isTaskExpanded('task-1')).toBe(true)
    expect(result.current.isTaskExpanded('task-2')).toBe(false)
  })

  it('should not load state from different project', () => {
    const savedState = {
      expandedTasks: { 'task-1': true },
      projectId: 'project-2'
    }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState))

    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    expect(result.current.expandedTasks).toEqual({})
    expect(result.current.isTaskExpanded('task-1')).toBe(false)
  })

  it('should toggle task expansion', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.toggleTaskExpansion('task-1')
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true })
    expect(result.current.isTaskExpanded('task-1')).toBe(true)
    
    act(() => {
      result.current.toggleTaskExpansion('task-1')
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': false })
    expect(result.current.isTaskExpanded('task-1')).toBe(false)
  })

  it('should set task expansion state', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true })
    expect(result.current.isTaskExpanded('task-1')).toBe(true)
    
    act(() => {
      result.current.setTaskExpanded('task-2', false)
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true, 'task-2': false })
  })

  it('should clear all expanded tasks', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
      result.current.setTaskExpanded('task-2', true)
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true, 'task-2': true })
    
    act(() => {
      result.current.clearExpandedTasks()
    })
    
    expect(result.current.expandedTasks).toEqual({})
  })

  it('should remove specific expanded task', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
      result.current.setTaskExpanded('task-2', true)
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true, 'task-2': true })
    
    act(() => {
      result.current.removeExpandedTask('task-1')
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-2': true })
    expect(result.current.isTaskExpanded('task-1')).toBe(false)
    expect(result.current.isTaskExpanded('task-2')).toBe(true)
  })

  it('should save state to localStorage when expanded tasks change', () => {
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
    })
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-expansion-state',
      JSON.stringify({
        expandedTasks: { 'task-1': true },
        projectId: 'project-1'
      })
    )
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded')
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation()
    
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
    })
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error saving task expansion state to localStorage:',
      expect.any(Error)
    )
    
    consoleSpy.mockRestore()
  })

  it('should handle invalid localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json')
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation()
    
    const { result } = renderHook(() => useTaskExpansionPersistence('project-1'))
    
    expect(result.current.expandedTasks).toEqual({})
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading task expansion state from localStorage:',
      expect.any(Error)
    )
    
    consoleSpy.mockRestore()
  })

  it('should clear state when projectId is null', () => {
    const { result, rerender } = renderHook(
      ({ projectId }) => useTaskExpansionPersistence(projectId),
      { initialProps: { projectId: 'project-1' } }
    )
    
    act(() => {
      result.current.setTaskExpanded('task-1', true)
    })
    
    expect(result.current.expandedTasks).toEqual({ 'task-1': true })
    
    rerender({ projectId: null })
    
    expect(result.current.expandedTasks).toEqual({})
  })
})
