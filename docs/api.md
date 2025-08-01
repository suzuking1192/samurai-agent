# API Documentation

## Base URL
`http://localhost:8000`

## Endpoints

### Projects

#### GET /projects
Get all projects

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /projects
Create a new project

**Request Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

#### GET /projects/{project_id}
Get a specific project

#### DELETE /projects/{project_id}
Delete a project

### Tasks

#### GET /projects/{project_id}/tasks
Get all tasks for a project

**Response:**
```json
[
  {
    "id": "string",
    "project_id": "string",
    "title": "string",
    "description": "string",
    "status": "pending|in_progress|completed",
    "priority": "low|medium|high",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /projects/{project_id}/tasks
Create a new task

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "priority": "low|medium|high"
}
```

#### PUT /tasks/{task_id}
Update a task

#### DELETE /tasks/{task_id}
Delete a task

### Memories

#### GET /projects/{project_id}/memories
Get all memories for a project

**Response:**
```json
[
  {
    "id": "string",
    "project_id": "string",
    "content": "string",
    "type": "context|decision|note",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /projects/{project_id}/memories
Create a new memory

**Request Body:**
```json
{
  "content": "string",
  "type": "context|decision|note"
}
```

#### DELETE /memories/{memory_id}
Delete a memory

### Chat

#### POST /chat
Send a message to the AI agent

**Request Body:**
```json
{
  "project_id": "string",
  "message": "string"
}
```

**Response:**
```json
{
  "response": "string",
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "low|medium|high"
    }
  ],
  "memories": [
    {
      "content": "string",
      "type": "context|decision|note"
    }
  ]
}
```

## Data Models

### Project
- `id`: Unique identifier
- `name`: Project name
- `description`: Project description
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Task
- `id`: Unique identifier
- `project_id`: Associated project ID
- `title`: Task title
- `description`: Task description
- `status`: Task status (pending, in_progress, completed)
- `priority`: Task priority (low, medium, high)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Memory
- `id`: Unique identifier
- `project_id`: Associated project ID
- `content`: Memory content
- `type`: Memory type (context, decision, note)
- `created_at`: Creation timestamp

### ChatMessage
- `id`: Unique identifier
- `project_id`: Associated project ID
- `message`: User message
- `response`: AI response
- `created_at`: Creation timestamp 