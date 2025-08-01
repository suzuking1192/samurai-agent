from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from models import Project, Task, Memory, ChatMessage, ChatRequest, ChatResponse
from services.ai_agent import SamuraiAgent
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
ai_agent = SamuraiAgent()

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
        return file_service.get_projects()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects", response_model=Project)
async def create_project(project: Project):
    """Create a new project"""
    try:
        return file_service.create_project(project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a specific project"""
    try:
        project = file_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

# Task endpoints
@app.get("/projects/{project_id}/tasks", response_model=List[Task])
async def get_tasks(project_id: str):
    """Get all tasks for a project"""
    try:
        return file_service.get_tasks(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/tasks", response_model=Task)
async def create_task(project_id: str, task: Task):
    """Create a new task"""
    try:
        task.project_id = project_id
        return file_service.create_task(task)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task: Task):
    """Update a task"""
    try:
        updated_task = file_service.update_task(task_id, task)
        if not updated_task:
            raise HTTPException(status_code=404, detail="Task not found")
        return updated_task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    try:
        success = file_service.delete_task(task_id)
        if not success:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Memory endpoints
@app.get("/projects/{project_id}/memories", response_model=List[Memory])
async def get_memories(project_id: str):
    """Get all memories for a project"""
    try:
        return file_service.get_memories(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/projects/{project_id}/memories", response_model=Memory)
async def create_memory(project_id: str, memory: Memory):
    """Create a new memory"""
    try:
        memory.project_id = project_id
        return file_service.create_memory(memory)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a memory"""
    try:
        success = file_service.delete_memory(memory_id)
        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")
        return {"message": "Memory deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Chat endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI agent"""
    try:
        return ai_agent.process_message(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 