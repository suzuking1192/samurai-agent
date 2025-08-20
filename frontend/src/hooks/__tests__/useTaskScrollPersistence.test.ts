import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTaskScrollPersistence } from '../useTaskScrollPersistence'

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
})

describe('useTaskScrollPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default values when no projectId is provided', () => {
    const { result } = renderHook(() => useTaskScrollPersistence(null))

    expect(result.current.scrollState).toEqual({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: null
    })
  })

  it('should initialize with default values for new project', () => {
    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    expect(result.current.scrollState).toEqual({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-123'
    })
  })

  it('should load saved state from sessionStorage', () => {
    const savedState = {
      scrollTop: 150,
      selectedTaskId: 'task-456',
      projectId: 'project-123'
    }
    
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(savedState))

    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('samurai-agent-task-scroll-state-project-123')
    expect(result.current.scrollState).toEqual(savedState)
  })

  it('should save scroll position and task ID', () => {
    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    act(() => {
      result.current.saveScrollPosition(200, 'task-789')
    })

    expect(result.current.scrollState).toEqual({
      scrollTop: 200,
      selectedTaskId: 'task-789',
      projectId: 'project-123'
    })

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state-project-123',
      JSON.stringify({
        scrollTop: 200,
        selectedTaskId: 'task-789',
        projectId: 'project-123'
      })
    )
  })

  it('should clear scroll state', () => {
    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    // First save some state
    act(() => {
      result.current.saveScrollPosition(100, 'task-123')
    })

    // Then clear it
    act(() => {
      result.current.clearScrollState()
    })

    expect(result.current.scrollState).toEqual({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-123'
    })

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'samurai-agent-task-scroll-state-project-123',
      JSON.stringify({
        scrollTop: 0,
        selectedTaskId: null,
        projectId: 'project-123'
      })
    )
  })

  it('should handle sessionStorage errors gracefully', () => {
    mockSessionStorage.getItem.mockImplementation(() => {
      throw new Error('Storage error')
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    expect(consoleSpy).toHaveBeenCalledWith('Error loading task scroll state from sessionStorage:', expect.any(Error))
    expect(result.current.scrollState).toEqual({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-123'
    })

    consoleSpy.mockRestore()
  })

  it('should handle sessionStorage setItem errors gracefully', () => {
    mockSessionStorage.setItem.mockImplementation(() => {
      throw new Error('Storage write error')
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    act(() => {
      result.current.saveScrollPosition(100, 'task-123')
    })

    expect(consoleSpy).toHaveBeenCalledWith('Error saving task scroll state to sessionStorage:', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('should update state when projectId changes', () => {
    const { result, rerender } = renderHook(
      ({ projectId }) => useTaskScrollPersistence(projectId),
      { initialProps: { projectId: 'project-123' } }
    )

    // Save state for first project
    act(() => {
      result.current.saveScrollPosition(100, 'task-123')
    })

    // Change to different project
    rerender({ projectId: 'project-456' })

    expect(result.current.scrollState).toEqual({
      scrollTop: 0,
      selectedTaskId: null,
      projectId: 'project-456'
    })

    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('samurai-agent-task-scroll-state-project-456')
  })

  it('should return current scroll state via getScrollPosition', () => {
    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    act(() => {
      result.current.saveScrollPosition(150, 'task-456')
    })

    const currentState = result.current.getScrollPosition()
    expect(currentState).toEqual({
      scrollTop: 150,
      selectedTaskId: 'task-456',
      projectId: 'project-123'
    })
  })

  it('should handle null selectedTaskId', () => {
    const { result } = renderHook(() => useTaskScrollPersistence('project-123'))

    act(() => {
      result.current.saveScrollPosition(100, null)
    })

    expect(result.current.scrollState).toEqual({
      scrollTop: 100,
      selectedTaskId: null,
      projectId: 'project-123'
    })
  })
})
