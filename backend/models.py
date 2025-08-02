from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
import uuid

class TaskStatus(str, Enum):
    """Enumeration for task status values."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TaskPriority(str, Enum):
    """Enumeration for task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class MemoryType(str, Enum):
    """Enumeration for memory types."""
    FEATURE = "feature"
    DECISION = "decision"
    SPEC = "spec"
    NOTE = "note"

class ChatRole(str, Enum):
    """Enumeration for chat message roles."""
    USER = "user"
    ASSISTANT = "assistant"

class ResponseType(str, Enum):
    """Enumeration for chat response types."""
    CHAT = "chat"
    FEATURE_BREAKDOWN = "feature_breakdown"
    ERROR = "error"

# Core Data Models

class Project(BaseModel):
    """
    Core project data model representing a development project.
    
    Attributes:
        id: Unique identifier for the project
        name: Project name
        description: Project description
        tech_stack: Technology stack used in the project
        created_at: Timestamp when the project was created
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique project identifier")
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    description: str = Field(..., max_length=500, description="Project description")
    tech_stack: str = Field(..., max_length=200, description="Technology stack")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Samurai Agent",
                "description": "AI-powered development assistant",
                "tech_stack": "Python, FastAPI, React, TypeScript",
                "created_at": "2024-01-01T00:00:00"
            }
        }

class Memory(BaseModel):
    """
    Memory data model for storing project-related information.
    
    Attributes:
        id: Unique identifier for the memory
        project_id: Project identifier
        content: Memory content
        type: Type of memory (context, decision, note)
        created_at: Timestamp when the memory was created
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique memory identifier")
    project_id: str = Field(..., description="Project identifier")
    content: str = Field(..., max_length=2000, description="Memory content")
    type: str = Field(..., pattern="^(context|decision|note)$", description="Memory type")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "title": "Authentication System Design",
                "content": "Implement JWT-based authentication with refresh tokens",
                "type": "decision",
                "created_at": "2024-01-01T00:00:00"
            }
        }

class Task(BaseModel):
    """
    Task data model for development tasks and features.
    
    Attributes:
        id: Unique identifier for the task
        project_id: Project identifier
        title: Task title
        description: Task description
        status: Task status (pending, in_progress, completed)
        priority: Task priority (low, medium, high)
        prompt: Generated Cursor prompt for the task (optional)
        completed: Whether the task is completed (legacy field)
        order: Task order/priority (legacy field)
        created_at: Timestamp when the task was created
        updated_at: Timestamp when the task was last updated
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique task identifier")
    project_id: str = Field(..., description="Project identifier")
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(..., max_length=1000, description="Task description")
    status: str = Field(default="pending", pattern="^(pending|in_progress|completed)$", description="Task status")
    priority: str = Field(default="medium", pattern="^(low|medium|high)$", description="Task priority")
    prompt: Optional[str] = Field(default="", max_length=2000, description="Generated Cursor prompt")
    completed: bool = Field(default=False, description="Task completion status (legacy)")
    order: int = Field(default=0, ge=0, description="Task order/priority (legacy)")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440002",
                "title": "Implement User Authentication",
                "description": "Create login and registration endpoints",
                "prompt": "Create a user authentication system with JWT tokens",
                "completed": False,
                "order": 1,
                "created_at": "2024-01-01T00:00:00"
            }
        }

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

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440003",
                "role": "user",
                "content": "How do I implement authentication?",
                "timestamp": "2024-01-01T00:00:00"
            }
        }

# Request/Response Models

class ProjectCreateRequest(BaseModel):
    """
    Request model for creating a new project.
    
    Attributes:
        name: Project name
        description: Project description
        tech_stack: Technology stack
    """
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    description: str = Field(..., max_length=500, description="Project description")
    tech_stack: str = Field(..., max_length=200, description="Technology stack")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "E-commerce Platform",
                "description": "A modern e-commerce platform with React frontend",
                "tech_stack": "React, Node.js, PostgreSQL"
            }
        }

class ChatRequest(BaseModel):
    """
    Request model for chat interactions.
    
    Attributes:
        message: User message content
    """
    message: str = Field(..., min_length=1, max_length=2000, description="User message")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Help me implement user authentication"
            }
        }

class ChatResponse(BaseModel):
    """
    Response model for chat interactions.
    
    Attributes:
        response: Assistant response content
        tasks: Optional list of generated tasks
        type: Response type (chat, feature_breakdown, error)
    """
    response: str = Field(..., max_length=5000, description="Assistant response")
    tasks: Optional[List[Task]] = Field(default=None, description="Generated tasks")
    type: str = Field(..., pattern="^(chat|feature_breakdown|error)$", description="Response type")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "I'll help you implement user authentication. Here are the tasks:",
                "tasks": [],
                "type": "feature_breakdown"
            }
        }

class TaskUpdateRequest(BaseModel):
    """
    Request model for updating task status.
    
    Attributes:
        completed: Task completion status
    """
    completed: bool = Field(..., description="Task completion status")

    class Config:
        json_schema_extra = {
            "example": {
                "completed": True
            }
        }

class MemoryCreateRequest(BaseModel):
    """
    Request model for creating a new memory.
    
    Attributes:
        content: Memory content
        type: Memory type
    """
    content: str = Field(..., max_length=2000, description="Memory content")
    type: str = Field(..., pattern="^(context|decision|note)$", description="Memory type")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Database Schema Design",
                "content": "Users table with email, password_hash, created_at fields",
                "type": "spec"
            }
        }

class MemoryUpdateRequest(BaseModel):
    """
    Request model for updating an existing memory.
    
    Attributes:
        title: Memory title
        content: Memory content
        type: Memory type
    """
    title: str = Field(..., min_length=1, max_length=200, description="Memory title")
    content: str = Field(..., max_length=2000, description="Memory content")
    type: str = Field(..., pattern="^(feature|decision|spec|note)$", description="Memory type")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Database Schema",
                "content": "Users table with email, password_hash, created_at, updated_at fields",
                "type": "spec"
            }
        }

# Additional Utility Models

class ProjectListResponse(BaseModel):
    """
    Response model for listing projects.
    
    Attributes:
        projects: List of projects
        total: Total number of projects
    """
    projects: List[Project] = Field(..., description="List of projects")
    total: int = Field(..., ge=0, description="Total number of projects")

class MemoryListResponse(BaseModel):
    """
    Response model for listing memories.
    
    Attributes:
        memories: List of memories
        total: Total number of memories
    """
    memories: List[Memory] = Field(..., description="List of memories")
    total: int = Field(..., ge=0, description="Total number of memories")

class TaskListResponse(BaseModel):
    """
    Response model for listing tasks.
    
    Attributes:
        tasks: List of tasks
        total: Total number of tasks
    """
    tasks: List[Task] = Field(..., description="List of tasks")
    total: int = Field(..., ge=0, description="Total number of tasks")

class ChatHistoryResponse(BaseModel):
    """
    Response model for chat history.
    
    Attributes:
        messages: List of chat messages
        total: Total number of messages
    """
    messages: List[ChatMessage] = Field(..., description="List of chat messages")
    total: int = Field(..., ge=0, description="Total number of messages")

class ErrorResponse(BaseModel):
    """
    Standard error response model.
    
    Attributes:
        error: Error message
        code: Error code
        details: Additional error details
    """
    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    details: Optional[str] = Field(None, description="Additional error details")

    class Config:
        json_schema_extra = {
            "example": {
                "error": "Project not found",
                "code": "PROJECT_NOT_FOUND",
                "details": "The requested project does not exist"
            }
        } 