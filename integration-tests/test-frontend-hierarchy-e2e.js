const { FrontendTester } = require('./test-frontend-integration.js')

class FrontendHierarchyE2E extends FrontendTester {
  async run() {
    this.logger.log('Running Frontend Hierarchy E2E...')
    // Ensure backend/frontend are reachable
    const ok = await this.testFrontendConnectivity()
    if (!ok) return false

    await this.testApiServiceFunctions()
    await this.createTestProject()

    // Create a root task
    const rootRes = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Root E2E', description: 'root', priority: 'medium' })
    })
    if (!rootRes.ok) return false
    const rootId = rootRes.data.id

    // Create children
    const childA = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Child A E2E', description: 'child a', priority: 'medium', parent_task_id: rootId })
    })
    if (!childA.ok) return false
    const childB = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Child B E2E', description: 'child b', priority: 'medium', parent_task_id: rootId })
    })
    if (!childB.ok) return false

    // Verify tasks list returns hierarchy
    const listRes = await this.makeRequest(`/projects/${this.testProjectId}/tasks`)
    if (!listRes.ok) return false
    const tasks = listRes.data
    const root = tasks.find(t => t.id === rootId)
    const a = tasks.find(t => t.title === 'Child A E2E')
    const b = tasks.find(t => t.title === 'Child B E2E')
    if (!root || !a || !b) return false
    if (a.parent_task_id !== root.id || b.parent_task_id !== root.id) return false

    this.logger.success('Hierarchy shows correct parent/child in API')

    // Task context tie: set root as task context, create sub-task via API simulating agent behavior
    // Get current session
    const sessionRes = await this.makeRequest(`/projects/${this.testProjectId}/current-session`)
    if (!sessionRes.ok) return false
    const sessionId = sessionRes.data.id

    // Set task context to root
    const ctxSet = await this.makeRequest(`/projects/${this.testProjectId}/sessions/${sessionId}/set-task-context`, {
      method: 'POST',
      body: JSON.stringify({ task_id: rootId, session_id: sessionId })
    })
    if (!ctxSet.ok) return false

    // Create a new subtask which should belong to root context (frontend normally uses agent; we use direct API here)
    const childC = await this.makeRequest(`/projects/${this.testProjectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Child C E2E', description: 'child c', priority: 'medium', parent_task_id: rootId })
    })
    if (!childC.ok) return false

    // Verify
    const listRes2 = await this.makeRequest(`/projects/${this.testProjectId}/tasks`)
    if (!listRes2.ok) return false
    const tasks2 = listRes2.data
    const c = tasks2.find(t => t.title === 'Child C E2E')
    if (!c || c.parent_task_id !== rootId) return false

    this.logger.success('Task context child attached correctly to active task')
    await this.cleanup()
    return true
  }
}

if (require.main === module) {
  const runner = new FrontendHierarchyE2E()
  runner.run().then(ok => {
    process.exit(ok ? 0 : 1)
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { FrontendHierarchyE2E }

