/**
 * Project Detail End-to-End API Test
 *
 * Verifies the new project detail endpoints work and integrate with chat.
 */

const axios = require('axios')

const BACKEND_URL = 'http://localhost:8000'

async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await axios.get(`${BACKEND_URL}/health`, { timeout: 2000 })
      if (res.status === 200 && res.data.status === 'healthy') return
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Backend not available')
}

async function run() {
  console.log('🧪 Project Detail E2E Test')
  await waitForBackend()
  let projectId = null

  try {
    // 1. Create project
    const projectRes = await axios.post(`${BACKEND_URL}/projects`, {
      name: 'Project Detail Test',
      description: 'Testing project detail endpoints',
      tech_stack: 'React + FastAPI'
    })
    projectId = projectRes.data.id
    console.log('✅ Project created:', projectId)

    // 2. Ensure detail initially empty
    const emptyRes = await axios.get(`${BACKEND_URL}/projects/${projectId}/project-detail`)
    if (emptyRes.status !== 200 || typeof emptyRes.data.content !== 'string') throw new Error('Invalid get detail response')
    console.log('✅ Initial project detail retrieved (length):', emptyRes.data.content.length)

    // 3. Direct save detail
    const directContent = 'PROJECT OVERVIEW: This is a direct saved spec for testing.'
    const saveRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/save`, { content: directContent })
    if (saveRes.status !== 200 || saveRes.data.status !== 'saved') throw new Error('Direct save failed')
    console.log('✅ Direct save ok, chars:', saveRes.data.chars)

    // 4. Verify persisted content
    const getRes = await axios.get(`${BACKEND_URL}/projects/${projectId}/project-detail`)
    if (getRes.data.content !== directContent) throw new Error('Persisted content mismatch')
    console.log('✅ Directly saved content matches')

    // 5. Ingest raw long text via LLM (mock)
    const longRaw = 'Meeting Minutes:\n'.repeat(1000) + 'We decided API endpoints and data models.'
    const ingestRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/ingest`, { raw_text: longRaw })
    if (ingestRes.status !== 200 || ingestRes.data.status !== 'saved') throw new Error('Ingest failed')
    console.log('✅ Ingest (LLM digest) saved, chars:', ingestRes.data.chars)

    // 6. Verify digest replaced content
    const digestedRes = await axios.get(`${BACKEND_URL}/projects/${projectId}/project-detail`)
    if (!digestedRes.data.content || digestedRes.data.content.length === 0) throw new Error('No digested content found')
    console.log('✅ Digested content present (length):', digestedRes.data.content.length)

    // 7. Quick chat to ensure overall flow works with project detail in context
    const chatRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/chat`, { message: 'Summarize our project context' })
    if (chatRes.status === 200 && chatRes.data.response) {
      console.log('✅ Chat succeeded, response length:', chatRes.data.response.length)
    } else {
      throw new Error('Chat failed after project detail set')
    }

    console.log('\n🎉 Project Detail E2E Test Passed')
  } catch (e) {
    console.error('❌ Project Detail E2E Test Failed:', e.message)
    process.exitCode = 1
  } finally {
    if (projectId) {
      try {
        await axios.delete(`${BACKEND_URL}/projects/${projectId}`)
        console.log('🧹 Cleaned up test project')
      } catch (e) {
        console.warn('⚠️ Cleanup failed:', e.message)
      }
    }
  }
}

if (require.main === module) {
  run()
}


