import React, { useState, useRef, useEffect } from 'react'
import { useTaskScrollPersistence } from '../hooks/useTaskScrollPersistence'

const ScrollTest: React.FC = () => {
  const [currentScrollTop, setCurrentScrollTop] = useState(0)
  const [savedScrollTop, setSavedScrollTop] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const { scrollState, saveScrollPosition } = useTaskScrollPersistence('test-project')

  // Create many items to enable scrolling
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: `task-${i}`,
    title: `Task ${i}`,
    description: `This is task ${i} description`
  }))

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop
      setCurrentScrollTop(scrollTop)
      console.log('ScrollTest: Current scroll position:', scrollTop)
    }
  }

  const handleSaveScroll = () => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop
      const taskId = `task-${Math.floor(Math.random() * items.length)}`
      console.log('ScrollTest: Saving scroll position:', { scrollTop, taskId })
      saveScrollPosition(scrollTop, taskId)
      setSavedScrollTop(scrollTop)
      setSelectedTaskId(taskId)
    }
  }

  const handleRestoreScroll = () => {
    if (scrollContainerRef.current && scrollState.scrollTop > 0) {
      console.log('ScrollTest: Restoring scroll position to:', scrollState.scrollTop)
      scrollContainerRef.current.scrollTop = scrollState.scrollTop
    }
  }

  useEffect(() => {
    console.log('ScrollTest: scrollState changed:', scrollState)
  }, [scrollState])

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Scroll Test</h3>
        <p>Current scroll position: {currentScrollTop}</p>
        <p>Saved scroll position: {savedScrollTop}</p>
        <p>Selected task ID: {selectedTaskId}</p>
        <p>Scroll state: {JSON.stringify(scrollState)}</p>
        <button onClick={handleSaveScroll} style={{ marginRight: '10px' }}>
          Save Current Scroll Position
        </button>
        <button onClick={handleRestoreScroll}>
          Restore Scroll Position
        </button>
      </div>
      
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          backgroundColor: '#fff'
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-task-id={item.id}
            style={{
              padding: '15px',
              margin: '10px 0',
              border: '1px solid #ddd',
              borderRadius: '5px',
              backgroundColor: '#f9f9f9',
              cursor: 'pointer'
            }}
            onClick={() => {
              console.log('ScrollTest: Clicked task:', item.id)
              handleSaveScroll()
            }}
          >
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ScrollTest
