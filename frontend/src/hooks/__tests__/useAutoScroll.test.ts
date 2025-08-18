import { renderHook, act } from '@testing-library/react'
import { useAutoScroll } from '../useAutoScroll'
import { vi, beforeEach } from 'vitest'

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn()
const mockCancelAnimationFrame = vi.fn()

beforeEach(() => {
  global.requestAnimationFrame = mockRequestAnimationFrame
  global.cancelAnimationFrame = mockCancelAnimationFrame
  vi.clearAllMocks()
})

describe('useAutoScroll', () => {
  const createMockContainer = (scrollTop = 0, clientHeight = 400, scrollHeight = 800) => {
    return {
      current: {
        scrollTop,
        clientHeight,
        scrollHeight,
        getBoundingClientRect: vi.fn().mockReturnValue({
          top: 100,
          bottom: 500,
          left: 0,
          right: 300,
          width: 300,
          height: 400
        })
      }
    }
  }

  const createMockDragEvent = (clientY: number) => ({
    clientY,
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: ''
    }
  }) as unknown as React.DragEvent

  it('should initialize with default configuration', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))

    expect(result.current.scrollState).toEqual({
      isScrolling: false,
      scrollDirection: null,
      scrollSpeed: 5
    })
  })

  it('should detect cursor in top hot zone', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    // Cursor at top edge (100 + 30 = 130, which is within 60px hot zone)
    const dragEvent = createMockDragEvent(130)
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(result.current.isInHotZone(130, containerRef.current!.getBoundingClientRect())).toBe('up')
  })

  it('should detect cursor in bottom hot zone', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    // Cursor at bottom edge (500 - 30 = 470, which is within 60px hot zone)
    const dragEvent = createMockDragEvent(470)
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(result.current.isInHotZone(470, containerRef.current!.getBoundingClientRect())).toBe('down')
  })

  it('should not detect cursor outside hot zones', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    // Cursor in middle (300, which is not in hot zones)
    const dragEvent = createMockDragEvent(300)
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(result.current.isInHotZone(300, containerRef.current!.getBoundingClientRect())).toBeNull()
  })

  it('should calculate scroll speed based on cursor proximity', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef, {
      hotZoneSize: 60,
      baseScrollSpeed: 5,
      maxScrollSpeed: 20,
      accelerationFactor: 2
    }))
    
    const containerRect = containerRef.current!.getBoundingClientRect()
    
    // Cursor very close to top edge (should have high speed)
    const speedNearEdge = result.current.calculateScrollSpeed(110, containerRect)
    expect(speedNearEdge).toBeGreaterThan(5)
    
    // Cursor at edge of hot zone (should have base speed)
    const speedAtEdge = result.current.calculateScrollSpeed(160, containerRect)
    expect(speedAtEdge).toBe(5)
  })

  it('should start auto-scrolling when cursor enters hot zone', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    const dragEvent = createMockDragEvent(130) // Top hot zone
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(mockRequestAnimationFrame).toHaveBeenCalled()
  })

  it('should stop auto-scrolling when cursor leaves hot zone', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    // First, enter hot zone
    const dragEventInZone = createMockDragEvent(130)
    act(() => {
      result.current.handleDragOver(dragEventInZone)
    })
    
    expect(mockRequestAnimationFrame).toHaveBeenCalled()
    
    // Then, leave hot zone
    const dragEventOutZone = createMockDragEvent(300)
    act(() => {
      result.current.handleDragOver(dragEventOutZone)
    })
    
    expect(mockCancelAnimationFrame).toHaveBeenCalled()
  })

  it('should stop auto-scrolling on drag end', () => {
    const containerRef = createMockContainer()
    const { result } = renderHook(() => useAutoScroll(containerRef))
    
    // Start scrolling
    const dragEvent = createMockDragEvent(130)
    act(() => {
      result.current.handleDragOver(dragEvent)
    })
    
    expect(mockRequestAnimationFrame).toHaveBeenCalled()
    
    // End drag
    act(() => {
      result.current.handleDragEnd()
    })
    
    expect(mockCancelAnimationFrame).toHaveBeenCalled()
  })

  it('should cleanup on unmount', () => {
    const containerRef = createMockContainer()
    const { result, unmount } = renderHook(() => useAutoScroll(containerRef))
    
    // Start scrolling
    const dragEvent = createMockDragEvent(130)
    act(() => {
      result.current.handleDragOver(dragEvent)
    })
    
    // Unmount
    unmount()
    
    expect(mockCancelAnimationFrame).toHaveBeenCalled()
  })

  it('should use custom configuration', () => {
    const containerRef = createMockContainer()
    const customConfig = {
      hotZoneSize: 100,
      baseScrollSpeed: 10,
      maxScrollSpeed: 30,
      accelerationFactor: 3
    }
    
    const { result } = renderHook(() => useAutoScroll(containerRef, customConfig))
    
    // Test with cursor position that would be in hot zone with custom size
    const dragEvent = createMockDragEvent(150) // Within 100px of top
    
    act(() => {
      result.current.handleDragOver(dragEvent)
    })

    expect(result.current.isInHotZone(150, containerRef.current!.getBoundingClientRect())).toBe('up')
  })
})
