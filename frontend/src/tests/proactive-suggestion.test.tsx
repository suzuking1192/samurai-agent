import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import ProactiveSuggestion from '../components/ProactiveSuggestion'

describe('ProactiveSuggestion component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders the exact assist tone message when visible', () => {
    const onDismiss = vi.fn()
    render(<ProactiveSuggestion isVisible={true} onDismiss={onDismiss} />)

    expect(
      screen.getByText(
        '💡 Tip: Just ask me to "add this as a task" or "create a task for this" and I\'ll add it to your task bar automatically!'
      )
    ).toBeInTheDocument()

    // Close button is visible
    const closeBtn = screen.getByRole('button', { name: /dismiss suggestion/i })
    expect(closeBtn).toBeInTheDocument()
  })

  test('does not render when not visible', () => {
    const onDismiss = vi.fn()
    const { container } = render(<ProactiveSuggestion isVisible={false} onDismiss={onDismiss} />)
    expect(container.querySelector('.proactive-suggestion')).toBeNull()
  })

  test('invokes onDismiss when close button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<ProactiveSuggestion isVisible={true} onDismiss={onDismiss} />)

    const closeBtn = screen.getByRole('button', { name: /dismiss suggestion/i })
    fireEvent.click(closeBtn)

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1))
  })
})


