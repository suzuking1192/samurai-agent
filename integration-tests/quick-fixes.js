/**
 * Quick Fixes for Common Integration Issues
 * 
 * This script provides solutions and code snippets to fix the most common
 * frontend-backend integration issues identified by the tests.
 */

const fs = require('fs')
const path = require('path')

class QuickFixes {
  constructor() {
    this.logger = new TestLogger()
  }

  // TestLogger class for logging
  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`)
  }

  error(message) {
    this.log(message, 'error')
  }

  success(message) {
    this.log(message, 'success')
  }

  warn(message) {
    this.log(message, 'warn')
  }

  /**
   * Fix 1: Add missing chat messages endpoint to backend
   */
  generateChatMessagesEndpoint() {
    this.log('Generating chat messages endpoint for backend...')
    
    const endpointCode = `
# Add this endpoint to backend/main.py

@app.get("/projects/{project_id}/chat-messages", response_model=List[ChatMessage])
async def get_project_chat_messages(project_id: str):
    """Get all chat messages for a project"""
    try:
        return file_service.load_chat_messages(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
`

    const fileServiceCode = `
# Add this method to backend/services/file_service.py

def load_chat_messages(self, project_id: str) -> List[ChatMessage]:
    """Load chat messages for a project"""
    try:
        filename = f"project-{project_id}-chat.json"
        filepath = os.path.join(self.data_dir, filename)
        
        if not os.path.exists(filepath):
            return []
        
        with open(filepath, 'r') as f:
            data = json.load(f)
            return [ChatMessage(**msg) for msg in data]
    except Exception as e:
        print(f"Error loading chat messages: {e}")
        return []

def save_chat_message(self, project_id: str, message: ChatMessage):
    """Save a chat message for a project"""
    try:
        filename = f"project-{project_id}-chat.json"
        filepath = os.path.join(self.data_dir, filename)
        
        # Load existing messages
        messages = self.load_chat_messages(project_id)
        messages.append(message)
        
        # Save updated messages
        with open(filepath, 'w') as f:
            json.dump([msg.dict() for msg in messages], f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving chat message: {e}")
`

    this.success('Chat messages endpoint code generated')
    this.log('Add the endpoint code to backend/main.py')
    this.log('Add the file service methods to backend/services/file_service.py')
    
    return { endpointCode, fileServiceCode }
  }

  /**
   * Fix 2: Fix task update endpoint mismatch
   */
  generateTaskUpdateFix() {
    this.log('Generating task update endpoint fix...')
    
    const backendFix = `
# Fix the task update endpoint in backend/main.py
# Change from:
@app.put("/projects/{project_id}/tasks/{task_id}")
# To:
@app.put("/projects/{project_id}/tasks/{task_id}")
async def update_task(project_id: str, task_id: str, request: TaskUpdateRequest):
    """Update task completion status"""
    try:
        success = file_service.update_task_status(project_id, task_id, request.completed)
        if not success:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
`

    const frontendFix = `
// Fix the task update API call in frontend/src/services/api.ts
// Change from:
export async function updateTask(taskId: string, updates: TaskUpdate): Promise<Task> {
  return apiRequest<Task>(\`/tasks/\${taskId}\`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

// To:
export async function updateTask(projectId: string, taskId: string, updates: TaskUpdate): Promise<Task> {
  return apiRequest<Task>(\`/projects/\${projectId}/tasks/\${taskId}\`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}
`

    this.success('Task update endpoint fix generated')
    this.log('Update the backend endpoint to match frontend expectations')
    this.log('Update the frontend API call to include projectId')
    
    return { backendFix, frontendFix }
  }

  /**
   * Fix 3: Fix chat data structure mismatch
   */
  generateChatDataStructureFix() {
    this.log('Generating chat data structure fix...')
    
    const backendModelFix = `
# Update the ChatMessage model in backend/models.py
class ChatMessage(BaseModel):
    """
    Chat message data model for conversation history.
    
    Attributes:
        id: Unique identifier for the message
        project_id: Project identifier
        message: User message content
        response: AI response content
        created_at: Message timestamp
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique message identifier")
    project_id: str = Field(..., description="Project identifier")
    message: str = Field(..., max_length=5000, description="User message content")
    response: str = Field(default="", max_length=5000, description="AI response content")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
`

    const frontendTypeFix = `
// Update the ChatMessage type in frontend/src/types/index.ts
export interface ChatMessage {
  id: string
  project_id: string
  message: string
  response: string
  created_at: string
}
`

    this.success('Chat data structure fix generated')
    this.log('Update the backend ChatMessage model to match frontend expectations')
    this.log('Update the frontend ChatMessage type to match backend structure')
    
    return { backendModelFix, frontendTypeFix }
  }

  /**
   * Fix 4: Add data loading on app startup
   */
  generateDataLoadingFix() {
    this.log('Generating data loading fix for frontend...')
    
    const appStartupFix = `
// Add this to frontend/src/App.tsx or your main app component
import { useEffect, useState } from 'react'
import { getProjects } from './services/api'

function App() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const projectsData = await getProjects()
      setProjects(projectsData)
    } catch (error) {
      console.error('Error loading initial data:', error)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  // Rest of your app component
}
`

    const componentDataLoadingFix = `
// Add this to each component that needs data persistence
// Example for Chat component:
useEffect(() => {
  if (projectId) {
    loadChatMessages()
  }
}, [projectId])

const loadChatMessages = async () => {
  if (!projectId) return
  
  try {
    const chatMessages = await getChatMessages(projectId)
    setMessages(chatMessages)
  } catch (error) {
    console.error('Error loading chat messages:', error)
  }
}
`

    this.success('Data loading fix generated')
    this.log('Add data loading on app startup to ensure persistence')
    this.log('Add data loading in individual components')
    
    return { appStartupFix, componentDataLoadingFix }
  }

  /**
   * Fix 5: Add error handling and user feedback
   */
  generateErrorHandlingFix() {
    this.log('Generating error handling fix...')
    
    const errorBoundaryFix = `
// Create frontend/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
`

    const apiErrorHandlingFix = `
// Update frontend/src/services/api.ts to include better error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = \`\${API_BASE_URL}\${endpoint}\`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, { ...defaultOptions, ...options })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        errorData.detail || \`HTTP error! status: \${response.status}\`,
        response.status,
        errorData.details
      )
    }

    return response.json()
  } catch (error) {
    console.error('API request failed:', error)
    throw error
  }
}
`

    this.success('Error handling fix generated')
    this.log('Add ErrorBoundary component to catch React errors')
    this.log('Improve API error handling with better logging')
    
    return { errorBoundaryFix, apiErrorHandlingFix }
  }

  /**
   * Generate a comprehensive fix report
   */
  generateFixReport() {
    this.log('=== QUICK FIXES REPORT ===')
    
    const fixes = [
      {
        name: 'Chat Messages Endpoint',
        description: 'Add missing endpoint to retrieve chat messages',
        priority: 'High',
        files: ['backend/main.py', 'backend/services/file_service.py']
      },
      {
        name: 'Task Update Endpoint',
        description: 'Fix endpoint mismatch between frontend and backend',
        priority: 'High',
        files: ['backend/main.py', 'frontend/src/services/api.ts']
      },
      {
        name: 'Chat Data Structure',
        description: 'Align chat message data structures',
        priority: 'Medium',
        files: ['backend/models.py', 'frontend/src/types/index.ts']
      },
      {
        name: 'Data Loading',
        description: 'Add data loading on app startup',
        priority: 'Medium',
        files: ['frontend/src/App.tsx', 'frontend/src/components/*.tsx']
      },
      {
        name: 'Error Handling',
        description: 'Add comprehensive error handling',
        priority: 'Low',
        files: ['frontend/src/components/ErrorBoundary.tsx', 'frontend/src/services/api.ts']
      }
    ]

    this.log('\nRecommended Fixes (in order of priority):')
    fixes.forEach((fix, index) => {
      this.log(`${index + 1}. ${fix.name} (${fix.priority})`)
      this.log(`   Description: ${fix.description}`)
      this.log(`   Files: ${fix.files.join(', ')}`)
      this.log('')
    })

    this.log('\nTo apply all fixes:')
    this.log('1. Run the integration tests to identify specific issues')
    this.log('2. Apply the relevant fixes from this report')
    this.log('3. Test each fix individually')
    this.log('4. Re-run integration tests to verify fixes')

    return fixes
  }

  /**
   * Apply all fixes automatically (if possible)
   */
  async applyAllFixes() {
    this.log('Applying all quick fixes...')
    
    try {
      // Generate all fixes
      const chatFix = this.generateChatMessagesEndpoint()
      const taskFix = this.generateTaskUpdateFix()
      const dataFix = this.generateChatDataStructureFix()
      const loadingFix = this.generateDataLoadingFix()
      const errorFix = this.generateErrorHandlingFix()

      // Create a fixes directory
      const fixesDir = path.join(__dirname, 'generated-fixes')
      if (!fs.existsSync(fixesDir)) {
        fs.mkdirSync(fixesDir)
      }

      // Save all fixes to files
      const fixes = [
        { name: 'chat-messages-endpoint.txt', content: chatFix },
        { name: 'task-update-fix.txt', content: taskFix },
        { name: 'chat-data-structure.txt', content: dataFix },
        { name: 'data-loading-fix.txt', content: loadingFix },
        { name: 'error-handling-fix.txt', content: errorFix }
      ]

      fixes.forEach(fix => {
        const filepath = path.join(fixesDir, fix.name)
        fs.writeFileSync(filepath, JSON.stringify(fix.content, null, 2))
        this.success(`Generated fix file: ${fix.name}`)
      })

      this.success('All fixes generated successfully')
      this.log(`Check the '${fixesDir}' directory for generated fix files`)
      
      return true
    } catch (error) {
      this.error(`Failed to apply fixes: ${error.message}`)
      return false
    }
  }
}

// TestLogger class (if not already defined)
class TestLogger {
  constructor() {
    this.logs = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = { timestamp, type, message }
    this.logs.push(logEntry)
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`)
  }

  error(message) {
    this.log(message, 'error')
  }

  success(message) {
    this.log(message, 'success')
  }

  warn(message) {
    this.log(message, 'warn')
  }
}

// Run quick fixes if this file is executed directly
if (require.main === module) {
  const quickFixes = new QuickFixes()
  quickFixes.generateFixReport()
  quickFixes.applyAllFixes().then(success => {
    if (success) {
      console.log('\n=== QUICK FIXES COMPLETED ===')
      console.log('Check the generated-fixes directory for detailed fix instructions')
    } else {
      console.log('\n=== QUICK FIXES FAILED ===')
      process.exit(1)
    }
  })
}

module.exports = { QuickFixes } 