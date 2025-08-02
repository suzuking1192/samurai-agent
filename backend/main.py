from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime

# Import your models
from models import (
    Project, ProjectCreateRequest, 
    ChatRequest, ChatResponse,
    TaskUpdateRequest, Task, Memory, ChatMessage
)

# Import your services  
from services.gemini_service import GeminiService
from services.file_service import FileService

# Load environment variables
load_dotenv()

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

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Samurai Agent API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# Project endpoints
@app.get("/projects", response_model=List[Project])
async def get_projects():
    """Get all projects"""
    try:
        return file_service.load_projects()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects", response_model=Project)
async def create_project(request: ProjectCreateRequest):
    """Create a new project"""
    try:
        project = Project(
            id=str(uuid.uuid4()),
            name=request.name,
            description=request.description,
            tech_stack=request.tech_stack,
            created_at=datetime.now()
        )
        
        file_service.save_project(project)
        return project
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a specific project"""
    project = file_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    try:
        success = file_service.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"message": "Project deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Chat endpoint
@app.post("/projects/{project_id}/chat", response_model=ChatResponse)
async def chat_with_project(project_id: str, request: ChatRequest):
    """Chat about the project - simple implementation for now"""
    try:
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Get project context 
        context = f"Project: {project.name}, Tech Stack: {project.tech_stack}, Description: {project.description}"
        
        # 3. Use Gemini service to respond
        ai_response = await gemini_service.chat(request.message, context)
        
        # 4. Save chat messages
        user_message = ChatMessage(
            id=str(uuid.uuid4()),
            project_id=project_id,
            message=request.message,
            response="",
            created_at=datetime.now()
        )
        file_service.save_chat_message(project_id, user_message)
        
        assistant_message = ChatMessage(
            id=str(uuid.uuid4()),
            project_id=project_id,
            message=request.message,
            response=ai_response,
            created_at=datetime.now()
        )
        file_service.save_chat_message(project_id, assistant_message)
        
        # 5. Return simple chat response (no tasks for now)
        return ChatResponse(
            response=ai_response,
            tasks=None,  # No task generation yet
            type="chat"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Task endpoints
@app.get("/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str):
    """Get all tasks for a project"""
    try:
        return file_service.load_tasks(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/projects/{project_id}/tasks/{task_id}")
async def update_task(project_id: str, task_id: str, request: dict):
    """Update task status"""
    try:
        # Update task with new data
        task = file_service.get_task_by_id(project_id, task_id)
        if not task:
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
        return task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(project_id: str, task_id: str):
    """Delete a task"""
    try:
        success = file_service.delete_task(project_id, task_id)
        if not success:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoints for completeness
@app.post("/projects/{project_id}/tasks", response_model=Task)
async def create_task(project_id: str, task_data: dict):
    """Create a new task"""
    try:
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
        return task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# Chat messages endpoint
@app.get("/projects/{project_id}/chat-messages", response_model=List[ChatMessage])
async def get_project_chat_messages(project_id: str):
    """Get all chat messages for a project"""
    try:
        return file_service.load_chat_messages(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Memory endpoints
@app.get("/projects/{project_id}/memories", response_model=List[Memory])
async def get_memories(project_id: str):
    """Get all memories for a project"""
    try:
        return file_service.load_memories(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/memories", response_model=Memory)
async def create_memory(project_id: str, memory_data: dict):
    """Create a new memory"""
    try:
        # Create memory with project_id
        memory = Memory(
            project_id=project_id,
            content=memory_data.get("content", ""),
            type=memory_data.get("type", "note")
        )
        file_service.save_memory(project_id, memory)
        return memory
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/projects/{project_id}/memories/{memory_id}")
async def delete_memory(project_id: str, memory_id: str):
    """Delete a memory"""
    try:
        success = file_service.delete_memory(project_id, memory_id)
        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")
        return {"message": "Memory deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Legacy chat endpoint (keeping for backward compatibility)
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI agent"""
    try:
        # Simple chat without project context
        ai_response = await gemini_service.chat(request.message)
        
        return ChatResponse(
            response=ai_response,
            tasks=None,
            type="chat"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 