// Enums
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum MemoryType {
  FEATURE = 'feature',
  DECISION = 'decision',
  SPEC = 'spec',
  NOTE = 'note'
}

export enum MemoryCategory {
  // Technical Categories
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DATABASE = 'database',
  DEVOPS = 'devops',
  AI_ML = 'ai_ml',
  ARCHITECTURE = 'architecture',
  SECURITY = 'security',
  TESTING = 'testing',
  PERFORMANCE = 'performance',
  THIRD_PARTY = 'third_party',
  
  // Feature Categories
  USER_AUTH = 'user_auth',
  CORE_FEATURES = 'core_features',
  USER_EXPERIENCE = 'user_experience',
  ANALYTICS = 'analytics',
  NOTIFICATIONS = 'notifications',
  PAYMENTS = 'payments',
  ADMIN_TOOLS = 'admin_tools',
  MOBILE_FEATURES = 'mobile_features',
  INTEGRATIONS = 'integrations',
  ONBOARDING = 'onboarding',
  
  // Legacy support
  GENERAL = 'general'
}

// Category configuration for better UX
export const CATEGORY_CONFIG = {
  // Technical Categories
  [MemoryCategory.FRONTEND]: {
    label: "Frontend",
    icon: "🎨",
    color: "#3b82f6",
    type: "technical",
    description: "UI, components, styling, user experience",
    keywords: ["react", "vue", "angular", "css", "html", "component", "ui", "styling", "frontend", "client", "browser"]
  },
  [MemoryCategory.BACKEND]: {
    label: "Backend",
    icon: "⚙️",
    color: "#10b981",
    type: "technical",
    description: "APIs, servers, business logic, architecture",
    keywords: ["api", "server", "backend", "endpoint", "service", "microservice", "logic", "business", "controller"]
  },
  [MemoryCategory.DATABASE]: {
    label: "Database",
    icon: "🗄️",
    color: "#f59e0b",
    type: "technical",
    description: "Schema, queries, data modeling, migrations",
    keywords: ["database", "db", "sql", "nosql", "schema", "query", "migration", "data", "table", "collection"]
  },
  [MemoryCategory.DEVOPS]: {
    label: "DevOps",
    icon: "🚀",
    color: "#8b5cf6",
    type: "technical",
    description: "Deployment, CI/CD, infrastructure, monitoring",
    keywords: ["deploy", "deployment", "ci/cd", "docker", "kubernetes", "aws", "azure", "infrastructure", "monitoring"]
  },
  [MemoryCategory.AI_ML]: {
    label: "AI/ML",
    icon: "🤖",
    color: "#ec4899",
    type: "technical",
    description: "Model integration, prompt engineering, AI features",
    keywords: ["ai", "ml", "machine learning", "model", "prompt", "llm", "openai", "chatgpt", "embedding"]
  },
  [MemoryCategory.ARCHITECTURE]: {
    label: "Architecture",
    icon: "🏗️",
    color: "#6b7280",
    type: "technical",
    description: "System design, patterns, technical decisions",
    keywords: ["architecture", "design", "pattern", "structure", "system", "decision", "technical", "scalability"]
  },
  [MemoryCategory.SECURITY]: {
    label: "Security",
    icon: "🔒",
    color: "#ef4444",
    type: "technical",
    description: "Authentication, authorization, data protection",
    keywords: ["security", "auth", "authentication", "authorization", "encryption", "ssl", "jwt", "oauth"]
  },
  [MemoryCategory.TESTING]: {
    label: "Testing",
    icon: "🧪",
    color: "#14b8a6",
    type: "technical",
    description: "Unit tests, integration tests, QA processes",
    keywords: ["test", "testing", "unit", "integration", "e2e", "qa", "jest", "cypress", "selenium"]
  },
  [MemoryCategory.PERFORMANCE]: {
    label: "Performance",
    icon: "⚡",
    color: "#f97316",
    type: "technical",
    description: "Optimization, caching, scalability",
    keywords: ["performance", "optimization", "cache", "caching", "speed", "latency", "scalability", "load"]
  },
  [MemoryCategory.THIRD_PARTY]: {
    label: "Third-party",
    icon: "🔌",
    color: "#84cc16",
    type: "technical",
    description: "External APIs, libraries, integrations",
    keywords: ["api", "third-party", "integration", "library", "package", "npm", "external", "webhook"]
  },
  
  // Feature Categories
  [MemoryCategory.USER_AUTH]: {
    label: "User Auth",
    icon: "👤",
    color: "#6366f1",
    type: "feature",
    description: "Login, signup, user management, profiles",
    keywords: ["login", "signup", "user", "profile", "account", "registration", "password", "forgot password"]
  },
  [MemoryCategory.CORE_FEATURES]: {
    label: "Core Features",
    icon: "⭐",
    color: "#f59e0b",
    type: "feature",
    description: "Main product functionality and workflows",
    keywords: ["feature", "functionality", "workflow", "main", "core", "product", "business logic"]
  },
  [MemoryCategory.USER_EXPERIENCE]: {
    label: "User Experience",
    icon: "💫",
    color: "#8b5cf6",
    type: "feature",
    description: "UI/UX decisions, user flows, interactions",
    keywords: ["ux", "user experience", "flow", "journey", "interaction", "usability", "design", "wireframe"]
  },
  [MemoryCategory.ANALYTICS]: {
    label: "Analytics",
    icon: "📊",
    color: "#06b6d4",
    type: "feature",
    description: "Tracking, metrics, user behavior analysis",
    keywords: ["analytics", "tracking", "metrics", "data", "insights", "behavior", "stats", "reporting"]
  },
  [MemoryCategory.NOTIFICATIONS]: {
    label: "Notifications",
    icon: "🔔",
    color: "#f97316",
    type: "feature",
    description: "Email, push, in-app messaging systems",
    keywords: ["notification", "email", "push", "message", "alert", "reminder", "communication"]
  },
  [MemoryCategory.PAYMENTS]: {
    label: "Payments",
    icon: "💳",
    color: "#10b981",
    type: "feature",
    description: "Billing, subscriptions, payment processing",
    keywords: ["payment", "billing", "subscription", "stripe", "paypal", "checkout", "pricing", "revenue"]
  },
  [MemoryCategory.ADMIN_TOOLS]: {
    label: "Admin Tools",
    icon: "🛠️",
    color: "#64748b",
    type: "feature",
    description: "Dashboard, user management, system controls",
    keywords: ["admin", "dashboard", "management", "control", "settings", "configuration", "tools"]
  },
  [MemoryCategory.MOBILE_FEATURES]: {
    label: "Mobile Features",
    icon: "📱",
    color: "#ec4899",
    type: "feature",
    description: "Mobile-specific functionality and design",
    keywords: ["mobile", "responsive", "touch", "swipe", "app", "ios", "android", "device"]
  },
  [MemoryCategory.INTEGRATIONS]: {
    label: "Integrations",
    icon: "🔗",
    color: "#84cc16",
    type: "feature",
    description: "Third-party service connections and workflows",
    keywords: ["integration", "connect", "sync", "import", "export", "webhook", "zapier", "api connection"]
  },
  [MemoryCategory.ONBOARDING]: {
    label: "Onboarding",
    icon: "🎯",
    color: "#3b82f6",
    type: "feature",
    description: "User signup flow, tutorials, getting started",
    keywords: ["onboarding", "tutorial", "getting started", "welcome", "setup", "first time", "introduction"]
  },
  
  [MemoryCategory.GENERAL]: {
    label: "General",
    icon: "📝",
    color: "#64748b",
    type: "general",
    description: "General notes and discussions",
    keywords: []
  }
} as const

// Core interfaces
export interface Project {
  id: string
  name: string
  description: string
  tech_stack: string
  created_at: string
  updated_at?: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  created_at: string
  updated_at: string
}

export interface Memory {
  id: string
  project_id: string
  title: string
  content: string
  category: string
  type: MemoryType
  created_at: string
}

export interface ChatMessage {
  id: string
  project_id: string
  session_id: string
  message: string
  response: string
  created_at: string
}

export interface Session {
  id: string
  project_id: string
  name: string | null
  created_at: string
  last_activity: string
}

// Request/Response interfaces
export interface ChatRequest {
  project_id?: string
  message: string
}

export interface ChatResponse {
  response: string
  tasks: Task[]
  memories: Memory[]
}

export interface ProjectCreate {
  name: string
  description: string
  tech_stack: string
}

export interface TaskCreate {
  title: string
  description: string
  priority: TaskPriority
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
}

export interface MemoryCreate {
  content: string
  type: MemoryType
  category?: string
}

// API response interfaces
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Component prop interfaces
export interface ProjectSelectorProps {
  selectedProject: Project | null
  onProjectSelect: (project: Project) => void
}

export interface ChatProps {
  projectId?: string
}

export interface TaskPanelProps {
  projectId?: string
}

export interface MemoryPanelProps {
  projectId?: string
}

// Loading states
export interface LoadingState {
  isLoading: boolean
  error: string | null
} 