from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime
import logging
import traceback

# Import your models
from models import (
    Project, ProjectCreateRequest, 
    ChatRequest, ChatResponse,
    TaskUpdateRequest, Task, Memory, ChatMessage
)

# Import your services  
from services.gemini_service import GeminiService
from services.file_service import FileService
from services.context_service import context_service

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Samurai Agent API",
    description="AI-powered development assistant API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
file_service = FileService()
gemini_service = GeminiService()

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to catch all unhandled exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(f"Request URL: {request.url}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred. Please try again.",
            "timestamp": datetime.now().isoformat()
        }
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Middleware to log all requests and responses."""
    start_time = datetime.now()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url}")
    
    try:
        response = await call_next(request)
        
        # Log response
        process_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Response: {response.status_code} - {process_time:.3f}s")
        
        return response
    except Exception as e:
        # Log error
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"Error: {e} - {process_time:.3f}s")
        raise

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Samurai Agent API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test file service
        projects = file_service.load_projects()
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "projects_count": len(projects)
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

# Project endpoints
@app.get("/projects", response_model=List[Project])
async def get_projects():
    """Get all projects"""
    try:
        logger.info("Loading projects")
        projects = file_service.load_projects()
        logger.info(f"Loaded {len(projects)} projects")
        return projects
    except Exception as e:
        logger.error(f"Error loading projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load projects: {str(e)}")

@app.post("/projects", response_model=Project)
async def create_project(request: ProjectCreateRequest):
    """Create a new project"""
    try:
        logger.info(f"Creating project: {request.name}")
        project = Project(
            id=str(uuid.uuid4()),
            name=request.name,
            description=request.description,
            tech_stack=request.tech_stack,
            created_at=datetime.now()
        )
        
        file_service.save_project(project)
        logger.info(f"Project created successfully: {project.id}")
        return project
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a specific project"""
    try:
        logger.info(f"Getting project: {project_id}")
        project = file_service.get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    try:
        logger.info(f"Deleting project: {project_id}")
        success = file_service.delete_project(project_id)
        if not success:
            logger.warning(f"Project not found for deletion: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        logger.info(f"Project deleted successfully: {project_id}")
        return {"message": "Project deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

# Chat endpoint
@app.post("/projects/{project_id}/chat", response_model=ChatResponse)
async def chat_with_project(project_id: str, request: ChatRequest):
    """Chat about the project with intelligent context selection"""
    try:
        logger.info(f"Chat request for project {project_id}: {request.message[:50]}...")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project not found for chat: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Load memories and tasks for context selection
        logger.info("Loading project memories and tasks for context...")
        memories = file_service.load_memories(project_id)
        tasks = file_service.load_tasks(project_id)
        logger.info(f"Loaded {len(memories)} memories and {len(tasks)} tasks")
        
        # 3. Select relevant context using intelligent selection
        logger.info("Selecting relevant context...")
        relevant_memories, relevant_tasks = context_service.get_hierarchical_context(
            user_input=request.message,
            project_id=project_id,
            memories=memories,
            tasks=tasks,
            max_total_items=15
        )
        
        # 4. Format context for the AI
        context = context_service.format_context_for_prompt(
            memories=relevant_memories,
            tasks=relevant_tasks,
            project=project
        )
        
        logger.info(f"Selected {len(relevant_memories)} memories and {len(relevant_tasks)} tasks for context")
        
        # 5. Use Gemini service to respond with enhanced context
        logger.info("Generating AI response with context...")
        ai_response = await gemini_service.chat(request.message, context)
        logger.info("AI response generated successfully")
        
        # 6. Save chat message with both user message and AI response
        chat_message = ChatMessage(
            id=str(uuid.uuid4()),
            project_id=project_id,
            message=request.message,
            response=ai_response,
            created_at=datetime.now()
        )
        file_service.save_chat_message(project_id, chat_message)
        logger.info(f"Chat message saved: {chat_message.id}")
        
        # 7. Return enhanced chat response with relevant context
        return ChatResponse(
            response=ai_response,
            tasks=relevant_tasks,  # Include relevant tasks
            memories=relevant_memories,  # Include relevant memories
            type="chat"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat with project {project_id}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# Task endpoints
@app.get("/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str):
    """Get all tasks for a project"""
    try:
        logger.info(f"Loading tasks for project: {project_id}")
        tasks = file_service.load_tasks(project_id)
        logger.info(f"Loaded {len(tasks)} tasks for project {project_id}")
        return tasks
    except Exception as e:
        logger.error(f"Error loading tasks for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load tasks: {str(e)}")

@app.put("/projects/{project_id}/tasks/{task_id}")
async def update_task(project_id: str, task_id: str, request: dict):
    """Update task status"""
    try:
        logger.info(f"Updating task {task_id} in project {project_id}")
        
        # Update task with new data
        task = file_service.get_task_by_id(project_id, task_id)
        if not task:
            logger.warning(f"Task not found: {task_id}")
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Update task fields
        if 'status' in request:
            task.status = request['status']
        if 'priority' in request:
            task.priority = request['priority']
        if 'title' in request:
            task.title = request['title']
        if 'description' in request:
            task.description = request['description']
        if 'completed' in request:
            task.completed = request['completed']
        
        task.updated_at = datetime.now()
        file_service.save_task(project_id, task)
        logger.info(f"Task updated successfully: {task_id}")
        return task
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

@app.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(project_id: str, task_id: str):
    """Delete a task"""
    try:
        logger.info(f"Deleting task {task_id} from project {project_id}")
        success = file_service.delete_task(project_id, task_id)
        if not success:
            logger.warning(f"Task not found for deletion: {task_id}")
            raise HTTPException(status_code=404, detail="Task not found")
        logger.info(f"Task deleted successfully: {task_id}")
        return {"message": "Task deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")

# Additional endpoints for completeness
@app.post("/projects/{project_id}/tasks", response_model=Task)
async def create_task(project_id: str, task_data: dict):
    """Create a new task"""
    try:
        logger.info(f"Creating task in project {project_id}")
        
        # Create task with project_id
        task = Task(
            project_id=project_id,
            title=task_data.get("title", ""),
            description=task_data.get("description", ""),
            status=task_data.get("status", "pending"),
            priority=task_data.get("priority", "medium"),
            prompt=task_data.get("prompt", ""),
            completed=task_data.get("completed", False),
            order=task_data.get("order", 0)
        )
        file_service.save_task(project_id, task)
        logger.info(f"Task created successfully: {task.id}")
        return task
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")



# Chat messages endpoint
@app.get("/projects/{project_id}/chat-messages", response_model=List[ChatMessage])
async def get_project_chat_messages(project_id: str):
    """Get all chat messages for a project"""
    try:
        logger.info(f"Loading chat messages for project: {project_id}")
        messages = file_service.load_chat_messages(project_id)
        logger.info(f"Loaded {len(messages)} chat messages for project {project_id}")
        return messages
    except Exception as e:
        logger.error(f"Error loading chat messages for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load chat messages: {str(e)}")

# Memory endpoints
@app.get("/projects/{project_id}/memories", response_model=List[Memory])
async def get_memories(project_id: str):
    """Get all memories for a project"""
    try:
        logger.info(f"Loading memories for project: {project_id}")
        memories = file_service.load_memories(project_id)
        logger.info(f"Loaded {len(memories)} memories for project {project_id}")
        return memories
    except Exception as e:
        logger.error(f"Error loading memories for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load memories: {str(e)}")

@app.post("/projects/{project_id}/memories", response_model=Memory)
async def create_memory(project_id: str, memory_data: dict):
    """Create a new memory"""
    try:
        logger.info(f"Creating memory in project {project_id}")
        
        # Create memory with project_id
        memory = Memory(
            project_id=project_id,
            content=memory_data.get("content", ""),
            type=memory_data.get("type", "note")
        )
        file_service.save_memory(project_id, memory)
        logger.info(f"Memory created successfully: {memory.id}")
        return memory
    except Exception as e:
        logger.error(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create memory: {str(e)}")

@app.delete("/projects/{project_id}/memories/{memory_id}")
async def delete_memory(project_id: str, memory_id: str):
    """Delete a memory"""
    try:
        logger.info(f"Deleting memory {memory_id} from project {project_id}")
        success = file_service.delete_memory(project_id, memory_id)
        if not success:
            logger.warning(f"Memory not found for deletion: {memory_id}")
            raise HTTPException(status_code=404, detail="Memory not found")
        logger.info(f"Memory deleted successfully: {memory_id}")
        return {"message": "Memory deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting memory {memory_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete memory: {str(e)}")

# Legacy chat endpoint (keeping for backward compatibility)
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI agent"""
    try:
        logger.info(f"Legacy chat request: {request.message[:50]}...")
        
        # Simple chat without project context
        ai_response = await gemini_service.chat(request.message)
        logger.info("Legacy chat response generated successfully")
        
        return ChatResponse(
            response=ai_response,
            tasks=None,
            type="chat"
        )
    except Exception as e:
        logger.error(f"Error in legacy chat: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 