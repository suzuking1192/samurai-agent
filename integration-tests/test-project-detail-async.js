const axios = require('axios')

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

async function waitForBackend() {
  console.log('⏳ Waiting for backend to be ready...')
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get(`${BACKEND_URL}/health`)
      console.log('✅ Backend is ready')
      return
    } catch (error) {
      if (i === 29) {
        console.error('❌ Backend not available after 30 attempts')
        throw new Error('Backend not available')
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

async function run() {
  console.log('🧪 Project Detail Async E2E Test')
  await waitForBackend()
  let projectId = null

  try {
    // 1. Create project
    const projectRes = await axios.post(`${BACKEND_URL}/projects`, {
      name: 'Async Project Detail Test',
      description: 'Testing async project detail digest functionality',
      tech_stack: 'React + FastAPI'
    })
    projectId = projectRes.data.id
    console.log('✅ Project created:', projectId)

    // 2. Test async ingest - should return immediately
    const startTime = Date.now()
    const longRaw = 'Meeting Minutes:\n'.repeat(1000) + 'We decided API endpoints and data models.'
    
    const ingestRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/ingest`, { 
      raw_text: longRaw,
      mode: 'merge'
    })
    
    const responseTime = Date.now() - startTime
    
    // Verify immediate response
    if (ingestRes.status !== 202) {
      throw new Error(`Expected 202 status, got ${ingestRes.status}`)
    }
    
    if (!ingestRes.data.message || !ingestRes.data.message.includes('initiated asynchronously')) {
      throw new Error('Invalid response message')
    }
    
    console.log(`✅ Async ingest initiated successfully in ${responseTime}ms`)
    console.log('📤 Response:', ingestRes.data)

    // 3. Wait a bit for background processing (optional - just to see if it completes)
    console.log('⏳ Waiting for background processing...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 4. Check if project detail was updated (this might take longer)
    console.log('🔍 Checking if project detail was updated...')
    const getRes = await axios.get(`${BACKEND_URL}/projects/${projectId}/project-detail`)
    
    if (getRes.status !== 200) {
      throw new Error('Failed to get project detail')
    }
    
    console.log('✅ Project detail retrieved successfully')
    console.log(`📄 Content length: ${getRes.data.content.length} characters`)
    
    // 5. Test with different modes
    console.log('🔄 Testing different ingest modes...')
    
    // Test replace mode
    const replaceRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/ingest`, { 
      raw_text: 'New content for replace mode',
      mode: 'replace'
    })
    
    if (replaceRes.status !== 202) {
      throw new Error('Replace mode failed')
    }
    console.log('✅ Replace mode initiated successfully')
    
    // Test append mode
    const appendRes = await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/ingest`, { 
      raw_text: 'Additional content for append mode',
      mode: 'append'
    })
    
    if (appendRes.status !== 202) {
      throw new Error('Append mode failed')
    }
    console.log('✅ Append mode initiated successfully')

    // 6. Test error handling
    console.log('🚨 Testing error handling...')
    
    // Test with non-existent project
    try {
      await axios.post(`${BACKEND_URL}/projects/non-existent-project/project-detail/ingest`, { 
        raw_text: 'Test content'
      })
      throw new Error('Should have failed with non-existent project')
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly handled non-existent project')
      } else {
        throw error
      }
    }
    
    // Test with empty text
    try {
      await axios.post(`${BACKEND_URL}/projects/${projectId}/project-detail/ingest`, { 
        raw_text: ''
      })
      throw new Error('Should have failed with empty text')
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly handled empty text')
      } else {
        throw error
      }
    }

    console.log('🎉 All async project detail tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    process.exit(1)
  } finally {
    // Cleanup - delete test project
    if (projectId) {
      try {
        await axios.delete(`${BACKEND_URL}/projects/${projectId}`)
        console.log('🧹 Test project cleaned up')
      } catch (error) {
        console.warn('⚠️ Failed to cleanup test project:', error.message)
      }
    }
  }
}

// Run the test
run().catch(error => {
  console.error('💥 Test runner failed:', error)
  process.exit(1)
})
