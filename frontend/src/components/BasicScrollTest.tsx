import React, { useState, useRef } from 'react'

const BasicScrollTest: React.FC = () => {
  const [currentScroll, setCurrentScroll] = useState(0)
  const [savedScroll, setSavedScroll] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (scrollRef.current) {
      setCurrentScroll(scrollRef.current.scrollTop)
    }
  }

  const saveScroll = () => {
    if (scrollRef.current) {
      const pos = scrollRef.current.scrollTop
      setSavedScroll(pos)
      localStorage.setItem('test-scroll', pos.toString())
      alert(`Saved scroll position: ${pos}`)
    }
  }

  const restoreScroll = () => {
    const saved = localStorage.getItem('test-scroll')
    if (saved && scrollRef.current) {
      const pos = parseInt(saved, 10)
      scrollRef.current.scrollTop = pos
      alert(`Restored scroll position: ${pos}`)
    } else {
      alert('No saved scroll position found')
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
        <h2>Basic Scroll Test</h2>
        <p>Current scroll: {currentScroll}</p>
        <p>Saved scroll: {savedScroll}</p>
        <button onClick={saveScroll} style={{ marginRight: '10px', padding: '10px' }}>
          Save Scroll
        </button>
        <button onClick={restoreScroll} style={{ padding: '10px' }}>
          Restore Scroll
        </button>
      </div>
      
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#fff'
        }}
      >
        {Array.from({ length: 50 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: '20px',
              margin: '10px 0',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}
          >
            <h3>Item {i + 1}</h3>
            <p>This is item number {i + 1}. Scroll down to test the scroll functionality.</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BasicScrollTest
