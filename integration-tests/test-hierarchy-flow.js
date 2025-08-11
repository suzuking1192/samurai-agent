const { ApiTester, TestLogger } = require('./test-integration.js')

async function run() {
  const logger = new TestLogger()
  const api = new ApiTester()
  const ok = await api.healthCheck()
  if (!ok) {
    process.exit(1)
  }

  const project = await api.createTestProject()
  if (!project) process.exit(1)

  // Create a root task
  const rootRes = await api.makeRequest(`/projects/${project.id}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Root Parent', description: 'root', priority: 'medium' })
  })
  if (!rootRes.ok) process.exit(1)
  const rootId = rootRes.data.id

  // Create a child task using parent_task_id
  const childRes = await api.makeRequest(`/projects/${project.id}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Child', description: 'child', priority: 'medium', parent_task_id: rootId })
  })
  if (!childRes.ok) process.exit(1)

  // Fetch tasks and assert hierarchy
  const listRes = await api.makeRequest(`/projects/${project.id}/tasks`)
  if (!listRes.ok) process.exit(1)
  const tasks = listRes.data
  const root = tasks.find(t => t.id === rootId)
  const child = tasks.find(t => t.title === 'Child')
  if (!root || !child || child.parent_task_id !== root.id) {
    logger.error('Hierarchy not persisted correctly')
    process.exit(1)
  }

  logger.success('Hierarchy flow test passed')
  await api.cleanup()
}

if (require.main === module) {
  run().catch(err => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { run }

