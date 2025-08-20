import React, { useState, useRef, useEffect } from 'react'

const SimpleScrollTest: React.FC = () => {
  const [scrollPosition, setScrollPosition] = useState(0)
  const [savedPosition, setSavedPosition] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollPosition(scrollRef.current.scrollTop)
    }
  }

  const savePosition = () => {
    if (scrollRef.current) {
      const pos = scrollRef.current.scrollTop
      setSavedPosition(pos)
      console.log('Saved scroll position:', pos)
      // Save to sessionStorage
      sessionStorage.setItem('test-scroll-position', pos.toString())
    }
  }

  const restorePosition = () => {
    const saved = sessionStorage.getItem('test-scroll-position')
    if (saved && scrollRef.current) {
      const pos = parseInt(saved, 10)
      scrollRef.current.scrollTop = pos
      console.log('Restored scroll position to:', pos)
    }
  }

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Simple Scroll Test</h3>
        <p>Current scroll position: {scrollPosition}</p>
        <p>Saved position: {savedPosition}</p>
        <button onClick={savePosition} style={{ marginRight: '10px' }}>
          Save Position
        </button>
        <button onClick={restorePosition}>
          Restore Position
        </button>
      </div>
      
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          backgroundColor: '#fff'
        }}
      >
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: '20px',
              margin: '10px 0',
              border: '1px solid #ddd',
              borderRadius: '5px',
              backgroundColor: '#f9f9f9'
            }}
          >
            <h4>Item {i + 1}</h4>
            <p>This is item number {i + 1}. Scroll down to test the scroll functionality.</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SimpleScrollTest
