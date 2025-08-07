from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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

class MemoryCategory(str, Enum):
    """Software engineering-focused memory categories."""
    # Technical Categories
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATABASE = "database"
    DEVOPS = "devops"
    AI_ML = "ai_ml"
    ARCHITECTURE = "architecture"
    SECURITY = "security"
    TESTING = "testing"
    PERFORMANCE = "performance"
    THIRD_PARTY = "third_party"
    
    # Feature Categories
    USER_AUTH = "user_auth"
    CORE_FEATURES = "core_features"
    USER_EXPERIENCE = "user_experience"
    ANALYTICS = "analytics"
    NOTIFICATIONS = "notifications"
    PAYMENTS = "payments"
    ADMIN_TOOLS = "admin_tools"
    MOBILE_FEATURES = "mobile_features"
    INTEGRATIONS = "integrations"
    ONBOARDING = "onboarding"
    
    # Legacy support
    GENERAL = "general"

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

# Category configuration for better UX
CATEGORY_CONFIG = {
    # Technical Categories
    MemoryCategory.FRONTEND: {
        "label": "Frontend",
        "icon": "🎨",
        "color": "#3b82f6",
        "type": "technical",
        "description": "UI, components, styling, user experience",
        "keywords": ["react", "vue", "angular", "css", "html", "component", "ui", "styling", "frontend", "client", "browser"]
    },
    MemoryCategory.BACKEND: {
        "label": "Backend",
        "icon": "⚙️",
        "color": "#10b981",
        "type": "technical",
        "description": "APIs, servers, business logic, architecture",
        "keywords": ["api", "server", "backend", "endpoint", "service", "microservice", "logic", "business", "controller"]
    },
    MemoryCategory.DATABASE: {
        "label": "Database",
        "icon": "🗄️",
        "color": "#f59e0b",
        "type": "technical",
        "description": "Schema, queries, data modeling, migrations",
        "keywords": ["database", "db", "sql", "nosql", "schema", "query", "migration", "data", "table", "collection"]
    },
    MemoryCategory.DEVOPS: {
        "label": "DevOps",
        "icon": "🚀",
        "color": "#8b5cf6",
        "type": "technical",
        "description": "Deployment, CI/CD, infrastructure, monitoring",
        "keywords": ["deploy", "deployment", "ci/cd", "docker", "kubernetes", "aws", "azure", "infrastructure", "monitoring"]
    },
    MemoryCategory.AI_ML: {
        "label": "AI/ML",
        "icon": "🤖",
        "color": "#ec4899",
        "type": "technical",
        "description": "Model integration, prompt engineering, AI features",
        "keywords": ["ai", "ml", "machine learning", "model", "prompt", "llm", "openai", "chatgpt", "embedding"]
    },
    MemoryCategory.ARCHITECTURE: {
        "label": "Architecture",
        "icon": "🏗️",
        "color": "#6b7280",
        "type": "technical",
        "description": "System design, patterns, technical decisions",
        "keywords": ["architecture", "design", "pattern", "structure", "system", "decision", "technical", "scalability"]
    },
    MemoryCategory.SECURITY: {
        "label": "Security",
        "icon": "🔒",
        "color": "#ef4444",
        "type": "technical",
        "description": "Authentication, authorization, data protection",
        "keywords": ["security", "auth", "authentication", "authorization", "encryption", "ssl", "jwt", "oauth"]
    },
    MemoryCategory.TESTING: {
        "label": "Testing",
        "icon": "🧪",
        "color": "#14b8a6",
        "type": "technical",
        "description": "Unit tests, integration tests, QA processes",
        "keywords": ["test", "testing", "unit", "integration", "e2e", "qa", "jest", "cypress", "selenium"]
    },
    MemoryCategory.PERFORMANCE: {
        "label": "Performance",
        "icon": "⚡",
        "color": "#f97316",
        "type": "technical",
        "description": "Optimization, caching, scalability",
        "keywords": ["performance", "optimization", "cache", "caching", "speed", "latency", "scalability", "load"]
    },
    MemoryCategory.THIRD_PARTY: {
        "label": "Third-party",
        "icon": "🔌",
        "color": "#84cc16",
        "type": "technical",
        "description": "External APIs, libraries, integrations",
        "keywords": ["api", "third-party", "integration", "library", "package", "npm", "external", "webhook"]
    },
    
    # Feature Categories
    MemoryCategory.USER_AUTH: {
        "label": "User Auth",
        "icon": "👤",
        "color": "#6366f1",
        "type": "feature",
        "description": "Login, signup, user management, profiles",
        "keywords": ["login", "signup", "user", "profile", "account", "registration", "password", "forgot password"]
    },
    MemoryCategory.CORE_FEATURES: {
        "label": "Core Features",
        "icon": "⭐",
        "color": "#f59e0b",
        "type": "feature",
        "description": "Main product functionality and workflows",
        "keywords": ["feature", "functionality", "workflow", "main", "core", "product", "business logic"]
    },
    MemoryCategory.USER_EXPERIENCE: {
        "label": "User Experience",
        "icon": "💫",
        "color": "#8b5cf6",
        "type": "feature",
        "description": "UI/UX decisions, user flows, interactions",
        "keywords": ["ux", "user experience", "flow", "journey", "interaction", "usability", "design", "wireframe"]
    },
    MemoryCategory.ANALYTICS: {
        "label": "Analytics",
        "icon": "📊",
        "color": "#06b6d4",
        "type": "feature",
        "description": "Tracking, metrics, user behavior analysis",
        "keywords": ["analytics", "tracking", "metrics", "data", "insights", "behavior", "stats", "reporting"]
    },
    MemoryCategory.NOTIFICATIONS: {
        "label": "Notifications",
        "icon": "🔔",
        "color": "#f97316",
        "type": "feature",
        "description": "Email, push, in-app messaging systems",
        "keywords": ["notification", "email", "push", "message", "alert", "reminder", "communication"]
    },
    MemoryCategory.PAYMENTS: {
        "label": "Payments",
        "icon": "💳",
        "color": "#10b981",
        "type": "feature",
        "description": "Billing, subscriptions, payment processing",
        "keywords": ["payment", "billing", "subscription", "stripe", "paypal", "checkout", "pricing", "revenue"]
    },
    MemoryCategory.ADMIN_TOOLS: {
        "label": "Admin Tools",
        "icon": "🛠️",
        "color": "#64748b",
        "type": "feature",
        "description": "Dashboard, user management, system controls",
        "keywords": ["admin", "dashboard", "management", "control", "settings", "configuration", "tools"]
    },
    MemoryCategory.MOBILE_FEATURES: {
        "label": "Mobile Features",
        "icon": "📱",
        "color": "#ec4899",
        "type": "feature",
        "description": "Mobile-specific functionality and design",
        "keywords": ["mobile", "responsive", "touch", "swipe", "app", "ios", "android", "device"]
    },
    MemoryCategory.INTEGRATIONS: {
        "label": "Integrations",
        "icon": "🔗",
        "color": "#84cc16",
        "type": "feature",
        "description": "Third-party service connections and workflows",
        "keywords": ["integration", "connect", "sync", "import", "export", "webhook", "zapier", "api connection"]
    },
    MemoryCategory.ONBOARDING: {
        "label": "Onboarding",
        "icon": "🎯",
        "color": "#3b82f6",
        "type": "feature",
        "description": "User signup flow, tutorials, getting started",
        "keywords": ["onboarding", "tutorial", "getting started", "welcome", "setup", "first time", "introduction"]
    },
    
    MemoryCategory.GENERAL: {
        "label": "General",
        "icon": "📝",
        "color": "#64748b",
        "type": "general",
        "description": "General notes and discussions",
        "keywords": []
    }
}

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
        title: Memory title
        content: Memory content
        category: Software engineering category (frontend, backend, etc.)
        type: Type of memory (feature, decision, spec, note)
        created_at: Timestamp when the memory was created
        session_id: Session identifier for conversation linking
        embedding: Vector embedding for semantic search
        embedding_text: Text used to generate the embedding
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique memory identifier")
    project_id: str = Field(..., description="Project identifier")
    title: str = Field(..., max_length=200, description="Memory title")
    content: str = Field(..., max_length=2000, description="Memory content")
    category: str = Field(default="general", description="Software engineering category")
    type: str = Field(..., pattern="^(feature|decision|spec|note)$", description="Memory type")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    session_id: Optional[str] = Field(None, description="Session identifier for conversation linking")
    embedding: Optional[List[float]] = Field(None, description="Vector embedding for semantic search")
    embedding_text: Optional[str] = Field(None, description="Text used to generate the embedding")

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
                "category": "security",
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
        description: Task description (serves as the implementation prompt for Cursor)
        status: Task status (pending, in_progress, completed)
        priority: Task priority (low, medium, high)
        completed: Whether the task is completed (legacy field)
        order: Task order/priority (legacy field)
        created_at: Timestamp when the task was created
        updated_at: Timestamp when the task was last updated
        embedding: Vector embedding for semantic search
        embedding_text: Text used to generate the embedding
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique task identifier")
    project_id: str = Field(..., description="Project identifier")
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str = Field(..., max_length=5000, description="Task description (serves as the implementation prompt for Cursor)")
    status: str = Field(default="pending", pattern="^(pending|in_progress|completed)$", description="Task status")
    priority: str = Field(default="medium", pattern="^(low|medium|high)$", description="Task priority")
    completed: bool = Field(default=False, description="Task completion status (legacy)")
    order: int = Field(default=0, ge=0, description="Task order/priority (legacy)")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    embedding: Optional[List[float]] = Field(None, description="Vector embedding for semantic search")
    embedding_text: Optional[str] = Field(None, description="Text used to generate the embedding")

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440002",
                "title": "Implement User Authentication",
                "description": "Create login and registration endpoints with JWT tokens, including proper validation and error handling",
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
        session_id: Session identifier for conversation grouping
        message: User message content
        response: AI response content
        created_at: Message timestamp
        embedding: Vector embedding for semantic search (optional)
        embedding_text: Text used to generate the embedding (optional)
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique message identifier")
    project_id: str = Field(..., description="Project identifier")
    session_id: str = Field(..., description="Session identifier for conversation grouping")
    message: str = Field(..., max_length=5000, description="User message content")
    response: str = Field(default="", max_length=15000, description="AI response content")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    embedding: Optional[List[float]] = Field(None, description="Vector embedding for semantic search")
    embedding_text: Optional[str] = Field(None, description="Text used to generate the embedding")

    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "project_id": "080e1b81-a37e-4e7a-81a6-cb185bd02e91",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "Hello, how can you help me?",
                "response": "I'm here to help you with your project!",
                "created_at": "2024-01-01T00:00:00Z"
            }
        }
        # Add model_config for Pydantic v2 compatibility
        model_config = {
            "json_encoders": {
                datetime: lambda v: v.isoformat()
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
        task_context_id: Optional task ID to use as context for this chat
    """
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    task_context_id: Optional[str] = Field(default=None, description="Task ID to use as context for this chat")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Help me implement user authentication",
                "task_context_id": "abc123"
            }
        }

class ChatResponse(BaseModel):
    """
    Response model for chat interactions.
    
    Attributes:
        response: Assistant response content
        tasks: Optional list of generated tasks
        memories: Optional list of relevant memories
        type: Response type (chat, feature_breakdown, error)
        intent_analysis: Optional intent analysis from unified agent
        memory_updated: Whether memory was updated during this interaction
        task_context: Optional task that was used as context for this response
    """
    response: str = Field(..., max_length=15000, description="Assistant response")
    tasks: Optional[List[Task]] = Field(default=None, description="Generated tasks")
    memories: Optional[List[Memory]] = Field(default=None, description="Relevant memories")
    type: str = Field(..., description="Response type")
    intent_analysis: Optional[Dict[str, Any]] = Field(default=None, description="Intent analysis from unified agent")
    memory_updated: Optional[bool] = Field(default=False, description="Whether memory was updated")
    task_context: Optional[Task] = Field(default=None, description="Task used as context for this response")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "I'll help you implement user authentication. Here are the tasks:",
                "tasks": [],
                "type": "feature_breakdown",
                "intent_analysis": {
                    "intent_type": "ready_for_action",
                    "confidence": 0.9,
                    "needs_clarification": False
                },
                "memory_updated": False
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

class Session(BaseModel):
    """
    Session data model for conversation sessions.
    
    Attributes:
        id: Unique identifier for the session
        project_id: Project identifier
        name: Session name (optional, can be auto-generated)
        created_at: Session creation timestamp
        last_activity: Last activity timestamp
        task_context_id: Optional task ID that provides context for this session
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique session identifier")
    project_id: str = Field(..., description="Project identifier")
    name: Optional[str] = Field(None, max_length=200, description="Session name")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Session creation timestamp")
    last_activity: datetime = Field(default_factory=datetime.utcnow, description="Last activity timestamp")
    task_context_id: Optional[str] = Field(default=None, description="Task ID providing context for this session")
    
    class Config:
        """Pydantic configuration for JSON serialization."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "project_id": "080e1b81-a37e-4e7a-81a6-cb185bd02e91",
                "name": "Session 1",
                "created_at": "2024-01-01T00:00:00Z",
                "last_activity": "2024-01-01T00:00:00Z"
            }
        }
        # Add model_config for Pydantic v2 compatibility
        model_config = {
            "json_encoders": {
                datetime: lambda v: v.isoformat()
            }
        }

class SessionCreateRequest(BaseModel):
    """
    Request model for creating a new session.
    
    Attributes:
        name: Optional session name
    """
    name: Optional[str] = Field(None, max_length=200, description="Optional session name")

class SessionListResponse(BaseModel):
    """
    Response model for listing sessions.
    
    Attributes:
        sessions: List of sessions
        total: Total number of sessions
    """
    sessions: List[Session] = Field(..., description="List of sessions")
    total: int = Field(..., ge=0, description="Total number of sessions")

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

class TaskContextRequest(BaseModel):
    """
    Request model for setting task context for a session.
    
    Attributes:
        task_id: ID of the task to set as context
        session_id: ID of the session to set context for
    """
    task_id: str = Field(..., description="Task ID to use as context")
    session_id: str = Field(..., description="Session ID to set context for")

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "abc123",
                "session_id": "session456"
            }
        }

class TaskContextResponse(BaseModel):
    """
    Response model for task context operations.
    
    Attributes:
        success: Whether the operation was successful
        task_context: The task that was set as context
        session_id: The session ID that was updated
    """
    success: bool = Field(..., description="Whether the operation was successful")
    task_context: Optional[Task] = Field(default=None, description="Task set as context")
    session_id: str = Field(..., description="Session ID that was updated")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "task_context": {
                    "id": "abc123",
                    "title": "Implement user authentication"
                },
                "session_id": "session456"
            }
        } 