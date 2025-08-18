import { useRef, useCallback, useMemo } from 'react'

interface AutoScrollConfig {
  /** Size of the hot zone in pixels from the edge */
  hotZoneSize?: number
  /** Base scroll speed in pixels per frame */
  baseScrollSpeed?: number
  /** Maximum scroll speed in pixels per frame */
  maxScrollSpeed?: number
  /** Scroll acceleration factor */
  accelerationFactor?: number
}

interface AutoScrollState {
  isScrolling: boolean
  scrollDirection: 'up' | 'down' | null
  scrollSpeed: number
}

/**
 * Custom hook for auto-scrolling during drag-and-drop operations
 * 
 * @param containerRef - Reference to the scrollable container element
 * @param config - Configuration options for auto-scrolling behavior
 * @returns Object with auto-scroll state and control functions
 */
export const useAutoScroll = (
  containerRef: React.RefObject<HTMLElement>,
  config: AutoScrollConfig = {}
) => {
  const {
    hotZoneSize = 60,
    baseScrollSpeed = 5,
    maxScrollSpeed = 20,
    accelerationFactor = 2
  } = config

  const scrollStateRef = useRef<AutoScrollState>({
    isScrolling: false,
    scrollDirection: null,
    scrollSpeed: baseScrollSpeed
  })

  const animationFrameRef = useRef<number | null>(null)

  // Calculate scroll speed based on cursor proximity to edge
  const calculateScrollSpeed = useCallback((cursorY: number, containerRect: DOMRect): number => {
    const distanceFromTop = cursorY - containerRect.top
    const distanceFromBottom = containerRect.bottom - cursorY
    
    let speed = baseScrollSpeed
    
    if (distanceFromTop < hotZoneSize) {
      // Cursor is in top hot zone
      const proximity = 1 - (distanceFromTop / hotZoneSize)
      speed = baseScrollSpeed + (maxScrollSpeed - baseScrollSpeed) * proximity * accelerationFactor
    } else if (distanceFromBottom < hotZoneSize) {
      // Cursor is in bottom hot zone
      const proximity = 1 - (distanceFromBottom / hotZoneSize)
      speed = baseScrollSpeed + (maxScrollSpeed - baseScrollSpeed) * proximity * accelerationFactor
    }
    
    return Math.min(speed, maxScrollSpeed)
  }, [hotZoneSize, baseScrollSpeed, maxScrollSpeed, accelerationFactor])

  // Check if cursor is in hot zone
  const isInHotZone = useCallback((cursorY: number, containerRect: DOMRect): 'up' | 'down' | null => {
    const distanceFromTop = cursorY - containerRect.top
    const distanceFromBottom = containerRect.bottom - cursorY
    
    if (distanceFromTop < hotZoneSize) {
      return 'up'
    } else if (distanceFromBottom < hotZoneSize) {
      return 'down'
    }
    
    return null
  }, [hotZoneSize])

  // Perform the actual scrolling
  const performScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || !scrollStateRef.current.isScrolling) {
      return
    }

    const { scrollDirection, scrollSpeed } = scrollStateRef.current
    
    if (scrollDirection === 'up') {
      container.scrollTop -= scrollSpeed
    } else if (scrollDirection === 'down') {
      container.scrollTop += scrollSpeed
    }

    // Continue scrolling if still active
    if (scrollStateRef.current.isScrolling) {
      animationFrameRef.current = requestAnimationFrame(performScroll)
    }
  }, [containerRef])

  // Start auto-scrolling
  const startAutoScroll = useCallback((direction: 'up' | 'down', speed: number) => {
    if (scrollStateRef.current.isScrolling && scrollStateRef.current.scrollDirection === direction) {
      // Already scrolling in the same direction, just update speed
      scrollStateRef.current.scrollSpeed = speed
      return
    }

    // Stop any existing scroll
    stopAutoScroll()

    // Start new scroll
    scrollStateRef.current = {
      isScrolling: true,
      scrollDirection: direction,
      scrollSpeed: speed
    }

    animationFrameRef.current = requestAnimationFrame(performScroll)
  }, [performScroll])

  // Stop auto-scrolling
  const stopAutoScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    scrollStateRef.current = {
      isScrolling: false,
      scrollDirection: null,
      scrollSpeed: baseScrollSpeed
    }
  }, [baseScrollSpeed])

  // Handle drag over event
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const cursorY = e.clientY
    
    // Check if cursor is in hot zone
    const hotZoneDirection = isInHotZone(cursorY, containerRect)
    
    if (hotZoneDirection) {
      // Calculate scroll speed based on cursor position
      const scrollSpeed = calculateScrollSpeed(cursorY, containerRect)
      startAutoScroll(hotZoneDirection, scrollSpeed)
    } else {
      // Cursor is not in hot zone, stop scrolling
      stopAutoScroll()
    }
  }, [containerRef, isInHotZone, calculateScrollSpeed, startAutoScroll, stopAutoScroll])

  // Handle drag end event
  const handleDragEnd = useCallback(() => {
    stopAutoScroll()
  }, [stopAutoScroll])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopAutoScroll()
  }, [stopAutoScroll])

  // Memoized state for external access
  const scrollState = useMemo(() => scrollStateRef.current, [])

  return {
    scrollState,
    handleDragOver,
    handleDragEnd,
    cleanup,
    isInHotZone,
    calculateScrollSpeed
  }
}
