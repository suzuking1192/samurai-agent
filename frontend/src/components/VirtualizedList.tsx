import React, { useState, useEffect, useRef, useCallback } from 'react'

interface VirtualizedListProps {
  items: any[]
  itemHeight: number
  height: string | number
  renderItem: (item: any, index: number, style: React.CSSProperties) => React.ReactNode
  className?: string
}

const VirtualizedList: React.FC<VirtualizedListProps> = ({
  items,
  itemHeight,
  height,
  renderItem,
  className = ''
}) => {
  const [startIndex, setStartIndex] = useState(0)
  const [endIndex, setEndIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    
    const visibleStart = Math.floor(scrollTop / itemHeight)
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight) + 2, // Add buffer
      items.length
    )
    
    setStartIndex(Math.max(0, visibleStart - 1)) // Add buffer at top
    setEndIndex(visibleEnd)
  }, [items.length, itemHeight])

  useEffect(() => {
    calculateVisibleRange()
  }, [calculateVisibleRange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      calculateVisibleRange()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [calculateVisibleRange])

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight
  const totalHeight = items.length * itemHeight

  return (
    <div 
      ref={containerRef}
      className={`virtualized-list ${className}`}
      style={{ 
        height, 
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index
            return renderItem(item, actualIndex, { height: itemHeight })
          })}
        </div>
      </div>
    </div>
  )
}

export default VirtualizedList 