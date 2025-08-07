import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProgressDisplay from '../components/ProgressDisplay'

describe('ProgressDisplay Component', () => {
  it('should show only the latest progress step', () => {
    const progressSteps = [
      {
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      },
      {
        step: 'context',
        message: '📚 Loading context...',
        timestamp: new Date().toISOString()
      },
      {
        step: 'analyzing',
        message: '🧠 Analyzing...',
        timestamp: new Date().toISOString()
      }
    ]

    render(<ProgressDisplay progress={progressSteps} isVisible={true} />)

    // Should only show the latest progress (last item in array)
    expect(screen.getByText('🧠 Analyzing...')).toBeInTheDocument()
    expect(screen.queryByText('🧠 Starting...')).not.toBeInTheDocument()
    expect(screen.queryByText('📚 Loading context...')).not.toBeInTheDocument()
    
    // Should show correct step count
    expect(screen.getByText('Step 3')).toBeInTheDocument()
  })

  it('should handle single progress step', () => {
    const singleProgress = [
      {
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      }
    ]

    render(<ProgressDisplay progress={singleProgress} isVisible={true} />)

    expect(screen.getByText('🧠 Starting...')).toBeInTheDocument()
    expect(screen.getByText('Step 1')).toBeInTheDocument()
  })

  it('should not render when not visible', () => {
    const progressSteps = [
      {
        step: 'start',
        message: '🧠 Starting...',
        timestamp: new Date().toISOString()
      }
    ]

    render(<ProgressDisplay progress={progressSteps} isVisible={false} />)

    expect(screen.queryByText('🧠 Starting...')).not.toBeInTheDocument()
  })

  it('should not render when no progress', () => {
    render(<ProgressDisplay progress={[]} isVisible={true} />)

    expect(screen.queryByText('Agent Progress')).not.toBeInTheDocument()
  })
})
