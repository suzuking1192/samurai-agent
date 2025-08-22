import { useState, useEffect } from 'react'
import { getMonthlyLLMCost } from '../services/api'
import { MonthlyLLMCost } from '../types'

export default function MonthlyCostDisplay() {
  const [monthlyCost, setMonthlyCost] = useState<MonthlyLLMCost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMonthlyCost = async () => {
      try {
        setLoading(true)
        setError(null)
        const cost = await getMonthlyLLMCost()
        setMonthlyCost(cost)
      } catch (err) {
        console.error('Failed to fetch monthly cost:', err)
        setError('Failed to load cost data')
        setMonthlyCost(null)
      } finally {
        setLoading(false)
      }
    }

    fetchMonthlyCost()
  }, [])

  if (loading) {
    return (
      <div className="monthly-cost-display loading">
        <span className="cost-icon">💰</span>
        <span className="cost-text">Loading...</span>
        <span className="cost-label">this month</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="monthly-cost-display error" title="Failed to load cost data">
        <span className="cost-icon">⚠️</span>
        <span className="cost-text">Cost unavailable</span>
        <span className="cost-label">this month</span>
      </div>
    )
  }

  if (!monthlyCost || monthlyCost.total_cost === 0) {
    return (
      <div className="monthly-cost-display zero-cost" title="No costs this month">
        <span className="cost-icon">💰</span>
        <span className="cost-text">$0.00</span>
        <span className="cost-label">this month</span>
      </div>
    )
  }

  return (
    <div className="monthly-cost-display" title={`${monthlyCost.call_count} calls this month`}>
      <span className="cost-icon">💰</span>
      <span className="cost-text">${monthlyCost.total_cost.toFixed(4)}</span>
      <span className="cost-label">this month</span>
    </div>
  )
}
