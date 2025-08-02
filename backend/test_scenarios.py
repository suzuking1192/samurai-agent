"""
Test scenarios for comprehensive agent testing
"""

AUTHENTICATION_FLOW_SCENARIOS = {
    "vague_request": "I want to add user authentication",
    
    "detailed_response": """I need complete user authentication with email/password. Users should be able to register new accounts, login, logout, and reset forgotten passwords. Each user should have their own private todo list - no sharing between users. Use JWT tokens for authentication with the FastAPI backend. For the frontend, create separate dedicated pages for login and registration with proper form validation. Store JWT tokens securely and add middleware to protect routes that require authentication.""",
    
    "expected_tasks": [
        "user registration form",
        "password hashing", 
        "jwt token",
        "login",
        "logout",
        "password reset",
        "protected routes"
    ],
    
    "expected_memory_keywords": [
        "jwt", "token", "authentication", "email", "password"
    ]
}

TASK_MANAGEMENT_SCENARIOS = [
    {
        "message": "The user registration form is done",
        "expected_type": "task_update",
        "expected_action": "complete"
    },
    {
        "message": "Delete the password reset task",
        "expected_type": "task_update", 
        "expected_action": "delete"
    },
    {
        "message": "I finished the login endpoint",
        "expected_type": "task_update",
        "expected_action": "complete"
    },
    {
        "message": "Remove the JWT implementation task",
        "expected_type": "task_update",
        "expected_action": "delete"
    }
]

INTENT_CLASSIFICATION_SCENARIOS = [
    ("I want to add user authentication", "feature_request"),
    ("What is JWT?", "question"),
    ("The login form is done", "task_management"), 
    ("Good morning!", "general_chat"),
    ("How do I add search functionality?", "feature_request"),
    ("Delete the password reset task", "task_management"),
    ("Explain how React hooks work", "question"),
    ("I need to implement real-time notifications", "feature_request"),
    ("Can you help me with API design?", "question"),
    ("Let's build a dashboard", "feature_request"),
    ("The authentication is complete", "task_management"),
    ("Hello there!", "general_chat")
]

CLARITY_EVALUATION_SCENARIOS = {
    "vague_requests": [
        "I want to add authentication",
        "Add notifications",
        "Make it real-time",
        "Add search",
        "I need a dashboard",
        "Implement user management",
        "Add payment system",
        "Create admin panel"
    ],
    
    "clear_requests": [
        "Add email/password authentication with user registration, login, logout, and JWT tokens",
        "Implement push notifications that show in top-right corner when tasks are assigned", 
        "Add real-time WebSocket updates for todo list changes with visual indicators",
        "Create a search feature that filters todos by title and description with autocomplete",
        "Build an admin dashboard with user management, analytics charts, and system settings",
        "Implement user role management with admin, moderator, and regular user permissions",
        "Add Stripe payment integration with subscription plans and billing management",
        "Create an admin panel with user management, content moderation, and analytics"
    ]
}

CONVERSATION_CONTINUATION_SCENARIOS = {
    "continuation_messages": [
        "Yes, that's exactly what I want",
        "JWT tokens for authentication",
        "Email and password login",
        "With user registration",
        "And password reset functionality",
        "That's correct",
        "Exactly",
        "No, I meant something else",
        "Actually, let me clarify"
    ],
    
    "new_conversation_messages": [
        "I want to add a new feature",
        "How does the database work?",
        "Can you explain React components?",
        "What's the best way to structure this?",
        "I need help with deployment",
        "Let's work on something else"
    ]
}

MEMORY_MANAGEMENT_SCENARIOS = {
    "memory_creation_triggers": [
        "We decided to use PostgreSQL for the database",
        "The authentication will use JWT tokens with refresh tokens",
        "The frontend will be built with React and TypeScript",
        "We'll use FastAPI for the backend API",
        "User passwords will be hashed with bcrypt",
        "The app will have real-time notifications using WebSockets"
    ],
    
    "memory_retrieval_queries": [
        "What database are we using?",
        "How should I handle authentication?",
        "What frontend framework should I use?",
        "How do we store passwords?",
        "What's our notification strategy?"
    ]
}

ERROR_HANDLING_SCENARIOS = {
    "invalid_inputs": [
        "",  # Empty message
        "   ",  # Whitespace only
        None,  # None value
        "A" * 10000,  # Very long message
        "🚀" * 1000,  # Many emojis
    ],
    
    "edge_cases": [
        "I want to add authentication but I don't know what that means",
        "Can you help me build something that doesn't exist?",
        "I need to implement quantum computing in my todo app",
        "How do I build a time machine?",
        "I want to add a feature that breaks the laws of physics"
    ]
}

PROJECT_CONTEXTS = {
    "todo_app": {
        "name": "Todo Application",
        "description": "A modern todo application with user authentication and real-time updates",
        "tech_stack": "React + TypeScript + FastAPI + PostgreSQL"
    },
    
    "ecommerce": {
        "name": "E-commerce Platform", 
        "description": "A full-featured e-commerce platform with payment processing",
        "tech_stack": "Next.js + Node.js + MongoDB + Stripe"
    },
    
    "blog": {
        "name": "Blog Platform",
        "description": "A content management system for blogs with user management",
        "tech_stack": "Vue.js + Django + PostgreSQL + Redis"
    },
    
    "chat_app": {
        "name": "Real-time Chat Application",
        "description": "A real-time messaging application with group chat functionality",
        "tech_stack": "React + Socket.io + Express + MongoDB"
    }
}

FEATURE_REQUEST_SCENARIOS = {
    "authentication": {
        "vague": "I want to add authentication",
        "clear": "Add email/password authentication with JWT tokens, user registration, login, logout, and password reset functionality",
        "expected_tasks": ["registration", "login", "jwt", "password", "reset"]
    },
    
    "notifications": {
        "vague": "Add notifications",
        "clear": "Implement real-time push notifications that appear in the top-right corner when users receive new messages or task assignments",
        "expected_tasks": ["notification", "real-time", "ui", "backend"]
    },
    
    "search": {
        "vague": "Add search functionality", 
        "clear": "Create a search feature that filters todos by title and description with autocomplete suggestions and real-time results",
        "expected_tasks": ["search", "filter", "autocomplete", "ui"]
    },
    
    "dashboard": {
        "vague": "I need a dashboard",
        "clear": "Build an admin dashboard with user management, analytics charts, system settings, and real-time data visualization",
        "expected_tasks": ["dashboard", "admin", "analytics", "charts", "management"]
    }
}

TASK_PARSING_SCENARIOS = {
    "standard_format": """
TASKS:
1. Create user registration form - Build React form with email and password fields
2. Set up password hashing - Implement bcrypt hashing in FastAPI backend  
3. Generate JWT tokens - Create token generation and validation logic
4. Add login endpoint - Create FastAPI endpoint for user authentication
5. Implement logout functionality - Add token invalidation and session cleanup
    """,
    
    "alternative_format": """
Here are the tasks for authentication:

1. User Registration Component - Create a React component for user signup with validation
2. Password Hashing Endpoint - Add bcrypt password hashing in FastAPI backend
3. JWT Implementation - Implement JSON Web Token authentication with refresh tokens
4. Login Form - Build login interface with error handling
5. Protected Routes - Add middleware to protect authenticated routes
    """,
    
    "numbered_list": """
1. Create user registration form
2. Set up password hashing  
3. Generate JWT tokens
4. Add login endpoint
5. Implement logout functionality
    """,
    
    "bullet_points": """
• Create user registration form
• Set up password hashing  
• Generate JWT tokens
• Add login endpoint
• Implement logout functionality
    """
}

CONTEXT_AWARENESS_SCENARIOS = {
    "follow_up_questions": [
        "How should I handle authentication errors?",
        "What's the best way to store JWT tokens?",
        "How do I implement password reset?",
        "Should I use sessions or tokens?",
        "What's the recommended password hashing method?"
    ],
    
    "context_dependent_responses": [
        "Based on our previous discussion about JWT authentication...",
        "Since we're using FastAPI for the backend...",
        "Given that we decided to use PostgreSQL...",
        "As we discussed for the React frontend...",
        "Following our authentication architecture..."
    ]
} 