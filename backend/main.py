from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import asyncio
from dotenv import load_dotenv
import uuid
from datetime import datetime
import logging
import traceback
import json

# Import your models
from models import (
    Project, ProjectCreateRequest, 
    ChatRequest, ChatResponse,
    TaskUpdateRequest, Task, Memory, ChatMessage,
    Session, SessionCreateRequest, SessionListResponse,
    TaskContextRequest, TaskContextResponse
)

# Import your services  
from services.gemini_service import GeminiService
from services.file_service import FileService
from services.unified_samurai_agent import unified_samurai_agent
from services.context_service import context_service
from services.response_service import handle_agent_response, handle_validation_error
from services.semantic_service import SemanticService
from services.intelligent_memory_consolidation import IntelligentMemoryConsolidationService


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
semantic_service = SemanticService()
memory_consolidation_service = IntelligentMemoryConsolidationService()

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
    """Chat about the project with intelligent task and memory generation"""
    try:
        logger.info(f"Chat request for project {project_id}: {request.message[:50]}...")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project not found for chat: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Get or create current session
        current_session = file_service.get_latest_session(project_id)
        if not current_session:
            # Create a new session if none exists
            current_session = file_service.create_session(project_id)
            logger.info(f"Created new session: {current_session.id}")
        
        # 3. Handle task context from request or session
        task_context = None
        if request.task_context_id:
            # Task context provided in request - set it for the session
            task_context = file_service.get_task_by_id(project_id, request.task_context_id)
            if task_context:
                current_session.task_context_id = request.task_context_id
                current_session.last_activity = datetime.now()
                file_service.save_session(project_id, current_session)
                logger.info(f"Set task context from request: {request.task_context_id}")
            else:
                logger.warning(f"Task context ID not found: {request.task_context_id}")
        elif current_session.task_context_id:
            # Use existing task context from session
            task_context = file_service.get_task_by_id(project_id, current_session.task_context_id)
            if task_context:
                logger.info(f"Using existing task context: {current_session.task_context_id}")
            else:
                # Task was deleted, clear the context
                current_session.task_context_id = None
                file_service.save_session(project_id, current_session)
                logger.info(f"Cleared invalid task context: {current_session.task_context_id}")
        
        # 4. Load conversation history for context extraction
        conversation_history = file_service.load_chat_messages_by_session(project_id, current_session.id)
        logger.info(f"Loaded {len(conversation_history)} conversation messages for context extraction")
        
        # 5. Convert project to context dict for SamuraiAgent
        project_context = {
            "name": project.name,
            "description": project.description,
            "tech_stack": project.tech_stack
        }
        
        logger.info(f"Project context: {project.name} - {project.tech_stack}")
        if task_context:
            logger.info(f"Task context: {task_context.title}")
        
        # 6. Use Unified Samurai Agent to process the message with conversation history and task context
        logger.info("Processing message with Unified Samurai Agent...")
        result = await unified_samurai_agent.process_message(
            message=request.message,
            project_id=project_id,
            project_context=project_context,
            session_id=current_session.id,
            conversation_history=conversation_history,
            task_context=task_context
        )
        
        logger.info(f"Unified Samurai Agent response type: {result.get('type', 'unknown')}")
        
        # 5. Handle long responses seamlessly without user-facing error messages
        final_response = result.get("response", "I'm sorry, I couldn't process that request.")
        
        # Apply seamless response handling
        final_response = handle_agent_response(final_response)
        
        # 6. Create ChatMessage with processed response and session_id
        chat_message = ChatMessage(
            id=str(uuid.uuid4()),
            project_id=project_id,
            session_id=current_session.id,
            message=request.message,
            response=final_response,
            created_at=datetime.now()
        )
        
        # 7. Save chat message
        file_service.save_chat_message(project_id, chat_message)
        logger.info(f"Chat message saved: {chat_message.id}")
        
        # 8. Update session activity
        file_service.update_session_activity(project_id, current_session.id)
        
        # 9. Load current tasks and memories for response
        current_tasks = file_service.load_tasks(project_id)
        current_memories = file_service.load_memories(project_id)
        
        logger.info(f"Current state: {len(current_tasks)} tasks, {len(current_memories)} memories")
        
        # 10. Return response with generated tasks and memories
        return ChatResponse(
            response=final_response,
            tasks=result.get("tasks", []),  # Include any newly generated tasks
            memories=current_memories,  # Include all memories for context
            type=result.get("type", "chat"),
            intent_analysis=result.get("intent_analysis"),  # Include intent analysis from unified agent
            memory_updated=result.get("memory_updated", False),  # Include memory update status
            task_context=task_context  # Include the active task context
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat with project {project_id}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/projects/{project_id}/chat-with-progress")
async def chat_with_progress(project_id: str, request: ChatRequest):
    """
    Chat endpoint with real-time progress streaming using actual agent processing
    """
    async def stream_response():
        try:
            # 1. Verify project exists
            project = file_service.get_project_by_id(project_id)
            if not project:
                logger.warning(f"Project not found for chat: {project_id}")
                yield f"data: {json.dumps({'type': 'error', 'error': 'Project not found'})}\n\n"
                return
            
            # 2. Convert project to context dict
            project_context = {
                "name": project.name,
                "description": project.description,
                "tech_stack": project.tech_stack
            }
            
            # 3. Get or create current session
            current_session = file_service.get_latest_session(project_id)
            if not current_session:
                # Create a new session if none exists
                current_session = file_service.create_session(project_id)
                logger.info(f"Created new session: {current_session.id}")
            
            # 4. Handle task context from request or session
            task_context = None
            if request.task_context_id:
                # Task context provided in request - set it for the session
                task_context = file_service.get_task_by_id(project_id, request.task_context_id)
                if task_context:
                    current_session.task_context_id = request.task_context_id
                    current_session.last_activity = datetime.now()
                    file_service.save_session(project_id, current_session)
                    logger.info(f"Set task context from request: {request.task_context_id}")
                else:
                    logger.warning(f"Task context ID not found: {request.task_context_id}")
            elif current_session.task_context_id:
                # Use existing task context from session
                task_context = file_service.get_task_by_id(project_id, current_session.task_context_id)
                if task_context:
                    logger.info(f"Using existing task context: {current_session.task_context_id}")
                else:
                    # Task was deleted, clear the context
                    current_session.task_context_id = None
                    file_service.save_session(project_id, current_session)
                    logger.info(f"Cleared invalid task context: {current_session.task_context_id}")
            
            # 5. Get conversation history for planning-first agent (current session only)
            conversation_history = file_service.load_chat_messages_by_session(project_id, current_session.id)
            
            # 5. Create a progress queue for real-time updates
            progress_queue = asyncio.Queue()
            
            async def progress_callback(step: str, message: str, details: str = "", metadata: dict = None):
                """Queue progress updates for immediate streaming"""
                progress_data = {
                    'type': 'progress',
                    'progress': {
                        'step': step,
                        'message': message,
                        'details': details,
                        'timestamp': datetime.now().isoformat(),
                        'metadata': metadata or {}
                    }
                }
                await progress_queue.put(progress_data)
            
            # 6. Start unified agent processing in background
            processing_task = asyncio.create_task(
                unified_samurai_agent.process_message(
                    message=request.message,
                    project_id=project_id,
                    project_context=project_context,
                    session_id=current_session.id,
                    conversation_history=conversation_history,
                    progress_callback=progress_callback,
                    task_context=task_context
                )
            )
            
            # 7. Stream progress updates immediately as they arrive
            progress_events = []
            last_event_count = 0
            
            while not processing_task.done():
                try:
                    # Check for new progress events from queue
                    try:
                        while not progress_queue.empty():
                            progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                            progress_events.append(progress_data)
                            yield f"data: {json.dumps(progress_data)}\n\n"
                    except asyncio.TimeoutError:
                        pass
                    
                    # Small delay to prevent busy waiting
                    await asyncio.sleep(0.05)
                    
                except Exception as e:
                    logger.error(f"Error in progress streaming: {e}")
                    break
            
            # 8. Get final result
            result = await processing_task
            
            # 9. Handle long responses seamlessly
            final_response = result.get("response", "I'm sorry, I couldn't process that request.")
            final_response = handle_agent_response(final_response)
            
            # 10. Save chat message
            chat_message = ChatMessage(
                id=str(uuid.uuid4()),
                project_id=project_id,
                session_id=current_session.id,
                message=request.message,
                response=final_response,
                created_at=datetime.now()
            )
            file_service.save_chat_message(project_id, chat_message)
            
            # 11. Update session activity
            file_service.update_session_activity(project_id, current_session.id)
            
            # 12. Send final response
            yield f"data: {json.dumps({'type': 'complete', 'response': final_response})}\n\n"
            
        except Exception as e:
            logger.error(f"Chat with progress error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",  # ✅ Fixed: Proper SSE media type
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",  # ✅ Added: CORS support
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

@app.post("/projects/{project_id}/chat-stream")
async def chat_stream(project_id: str, request: ChatRequest):
    """
    Simplified streaming endpoint using proper async generators
    """
    async def stream_response():
        try:
            # 1. Verify project exists
            project = file_service.get_project_by_id(project_id)
            if not project:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Project not found'})}\n\n"
                return
            
            # 2. Setup context
            project_context = {
                "name": project.name,
                "description": project.description,
                "tech_stack": project.tech_stack
            }
            
            current_session = file_service.get_latest_session(project_id)
            if not current_session:
                current_session = file_service.create_session(project_id)
            
            # Handle task context from request or session
            task_context = None
            if request.task_context_id:
                # Task context provided in request - set it for the session
                task_context = file_service.get_task_by_id(project_id, request.task_context_id)
                if task_context:
                    current_session.task_context_id = request.task_context_id
                    current_session.last_activity = datetime.now()
                    file_service.save_session(project_id, current_session)
                    logger.info(f"Set task context from request: {request.task_context_id}")
                else:
                    logger.warning(f"Task context ID not found: {request.task_context_id}")
            elif current_session.task_context_id:
                # Use existing task context from session
                task_context = file_service.get_task_by_id(project_id, current_session.task_context_id)
                if task_context:
                    logger.info(f"Using existing task context: {current_session.task_context_id}")
                else:
                    # Task was deleted, clear the context
                    current_session.task_context_id = None
                    file_service.save_session(project_id, current_session)
                    logger.info(f"Cleared invalid task context: {current_session.task_context_id}")
            
            conversation_history = file_service.load_chat_messages_by_session(project_id, current_session.id)
            
            # 3. Create a real-time progress streaming system using asyncio.Queue
            progress_queue = asyncio.Queue()
            processing_done = asyncio.Event()
            
            async def progress_callback(step: str, message: str, details: str = "", metadata: dict = None):
                """Real-time progress callback that immediately queues progress updates"""
                progress_event = {
                    'type': 'progress',
                    'progress': {
                        'step': step,
                        'message': message,
                        'details': details,
                        'timestamp': datetime.now().isoformat(),
                        'metadata': metadata or {}
                    }
                }
                
                # Immediately queue the progress event for streaming
                await progress_queue.put(progress_event)
                logger.debug(f"Queued progress update: {step} - {message}")
            
            # 4. Start the agent processing task
            async def process_and_signal():
                """Wrapper to signal when processing is complete"""
                try:
                    result = await unified_samurai_agent.process_message(
                        message=request.message,
                        project_id=project_id,
                        project_context=project_context,
                        session_id=current_session.id,
                        conversation_history=conversation_history,
                        progress_callback=progress_callback,
                        task_context=task_context
                    )
                    return result
                finally:
                    # Signal that processing is complete
                    processing_done.set()
            
            processing_task = asyncio.create_task(process_and_signal())
            
            # 5. Stream progress events in real-time as they occur
            while not processing_done.is_set() or not progress_queue.empty():
                try:
                    # Wait for progress updates with a short timeout
                    progress_event = await asyncio.wait_for(
                        progress_queue.get(), 
                        timeout=0.1
                    )
                    
                    # Immediately stream the progress update
                    yield f"data: {json.dumps(progress_event)}\n\n"
                    logger.debug(f"Streamed progress update: {progress_event['progress']['step']}")
                    
                except asyncio.TimeoutError:
                    # No progress updates available, continue waiting
                    continue
                except Exception as e:
                    logger.error(f"Error streaming progress: {e}")
                    break
            
            # 6. Get final result
            result = await processing_task
            final_response = result.get("response", "I'm sorry, I couldn't process that request.")
            final_response = handle_agent_response(final_response)
            
            # 7. Save chat message
            chat_message = ChatMessage(
                id=str(uuid.uuid4()),
                project_id=project_id,
                session_id=current_session.id,
                message=request.message,
                response=final_response,
                created_at=datetime.now()
            )
            file_service.save_chat_message(project_id, chat_message)
            file_service.update_session_activity(project_id, current_session.id)
            
            # 8. Send final response
            yield f"data: {json.dumps({'type': 'complete', 'response': final_response})}\n\n"
            
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

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
    """Get chat messages for a project."""
    try:
        messages = file_service.load_chat_history(project_id)
        return messages
    except Exception as e:
        logger.error(f"Error loading chat messages for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load chat messages: {str(e)}")

# Session management endpoints
@app.get("/projects/{project_id}/session-messages/{session_id}", response_model=List[ChatMessage])
async def get_session_messages(project_id: str, session_id: str):
    """Get chat messages for a specific session."""
    logger.info(f"DEBUG: Route matched! project_id={project_id}, session_id={session_id}")
    try:
        # Verify project exists
        project = file_service.get_project_by_id(project_id)
        logger.info(f"Project found: {project is not None}")
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Load all sessions to debug
        all_sessions = file_service.load_sessions(project_id)
        logger.info(f"All sessions for project: {[s.id for s in all_sessions]}")
        
        # Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        logger.info(f"Looking for session {session_id}, found: {session is not None}")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages = file_service.load_chat_messages_by_session(project_id, session_id)
        logger.info(f"Loaded {len(messages)} messages for session {session_id}")
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading messages for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load session messages: {str(e)}")

@app.get("/projects/{project_id}/sessions", response_model=SessionListResponse)
async def get_project_sessions(project_id: str):
    """Get all sessions for a project."""
    try:
        logger.info(f"Loading sessions for project: {project_id}")
        
        # Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            logger.warning(f"Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info(f"Project found: {project.name}")
        
        sessions = file_service.load_sessions(project_id)
        logger.info(f"Loaded {len(sessions)} sessions")
        
        response = SessionListResponse(sessions=sessions, total=len(sessions))
        logger.info(f"Created response with {len(response.sessions)} sessions")
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading sessions for project {project_id}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to load sessions: {str(e)}")

@app.post("/projects/{project_id}/sessions", response_model=Session)
async def create_project_session(project_id: str, request: SessionCreateRequest):
    """Create a new session for a project."""
    try:
        # Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        session = file_service.create_session(project_id, request.name)
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating session for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@app.get("/projects/{project_id}/current-session", response_model=Session)
async def get_current_session(project_id: str):
    """Get the current (most recent) session for a project."""
    try:
        # Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        session = file_service.get_latest_session(project_id)
        if not session:
            # Create a new session if none exists
            session = file_service.create_session(project_id)
        
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current session for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get current session: {str(e)}")

@app.get("/projects/{project_id}/conversation-history", response_model=List[ChatMessage])
async def get_conversation_history(project_id: str):
    """Get conversation history for the current session of a project."""
    try:
        # Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get current session
        session = file_service.get_latest_session(project_id)
        if not session:
            # Return empty list if no session exists
            return []
        
        # Load conversation history for the current session
        messages = file_service.load_chat_messages_by_session(project_id, session.id)
        logger.info(f"Loaded {len(messages)} conversation messages for project {project_id}, session {session.id}")
        
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading conversation history for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load conversation history: {str(e)}")

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

@app.post("/projects/{project_id}/sessions/{session_id}/complete")
async def complete_session(project_id: str, session_id: str):
    """
    Complete a session and perform session-wide memory analysis.
    This is called when user clicks "start new conversation".
    """
    try:
        logger.info(f"Completing session {session_id} for project {project_id}")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 3. Convert project to context dict
        project_context = {
            "name": project.name,
            "description": project.description,
            "tech_stack": project.tech_stack
        }
        
        # 4. Perform session completion with unified agent
        result = await unified_samurai_agent.complete_session(
            session_id=session_id,
            project_id=project_id,
            project_context=project_context
        )
        
        logger.info(f"Session completion result: {result}")
        
        return {
            "status": "success",
            "session_id": session_id,
            "project_id": project_id,
            "completion_result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Session completion failed: {str(e)}")


@app.post("/api/projects/{project_id}/sessions/end")
async def end_session_with_consolidation(project_id: str, request: Request):
    """
    End session and perform intelligent memory consolidation.
    Enhanced endpoint for "start new conversation" functionality.
    """
    try:
        # Get request data
        data = await request.json()
        session_id = data.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        logger.info(f"Starting session end with consolidation for session {session_id}")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 3. Build project context
        project_context = {
            "name": project.name,
            "description": project.description,
            "tech_stack": project.tech_stack
        }
        
        # 4. Perform intelligent memory consolidation
        consolidation_result = await memory_consolidation_service.consolidate_session_memories(
            project_id=project_id,
            session_id=session_id,
            project_context=project_context
        )
        
        # 5. Generate new session ID for clean restart
        new_session_id = str(uuid.uuid4())
        
        # 6. Create new session
        new_session = Session(
            id=new_session_id,
            project_id=project_id,
            name=f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        )
        file_service.save_session(project_id, new_session)
        
        # 7. Build comprehensive response
        response_data = {
            "status": "session_ended",
            "memory_consolidation": {
                "status": consolidation_result.status,
                "total_insights_processed": consolidation_result.total_insights_processed,
                "total_insights_skipped": consolidation_result.total_insights_skipped,
                "categories_affected": [
                    {
                        "category": cat_result.category,
                        "memories_updated": cat_result.memories_updated,
                        "memories_created": cat_result.memories_created,
                        "insights_processed": cat_result.insights_processed,
                        "is_new_category": cat_result.is_new_category
                    }
                    for cat_result in consolidation_result.categories_affected
                ],
                "new_categories_created": consolidation_result.new_categories_created,
                "total_memories_affected": consolidation_result.total_memories_affected
            },
            "new_session_id": new_session_id,
            "insights_found": consolidation_result.total_insights_processed + consolidation_result.total_insights_skipped,
            "session_relevance": consolidation_result.session_relevance
        }
        
        logger.info(f"Session end completed successfully: {consolidation_result.status}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending session with consolidation: {e}")
        raise HTTPException(status_code=500, detail=f"Session end failed: {str(e)}")


# Task Context endpoints
@app.post("/projects/{project_id}/sessions/{session_id}/set-task-context", response_model=TaskContextResponse)
async def set_task_context(project_id: str, session_id: str, request: TaskContextRequest):
    """
    Set task context for a specific session.
    This makes the specified task the active context for the chat session.
    """
    try:
        logger.info(f"Setting task context for session {session_id}: task {request.task_id}")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 3. Verify task exists
        task = file_service.get_task_by_id(project_id, request.task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # 4. Update session with task context
        session.task_context_id = request.task_id
        session.last_activity = datetime.now()
        file_service.save_session(project_id, session)
        
        logger.info(f"Task context set successfully: task {request.task_id} for session {session_id}")
        
        return TaskContextResponse(
            success=True,
            task_context=task,
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting task context: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set task context: {str(e)}")

@app.delete("/projects/{project_id}/sessions/{session_id}/task-context")
async def clear_task_context(project_id: str, session_id: str):
    """
    Clear task context for a specific session.
    This removes any active task context from the chat session.
    """
    try:
        logger.info(f"Clearing task context for session {session_id}")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 3. Clear task context
        session.task_context_id = None
        session.last_activity = datetime.now()
        file_service.save_session(project_id, session)
        
        logger.info(f"Task context cleared successfully for session {session_id}")
        
        return {"message": "Task context cleared successfully", "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing task context: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear task context: {str(e)}")

@app.get("/projects/{project_id}/sessions/{session_id}/task-context")
async def get_task_context(project_id: str, session_id: str):
    """
    Get the current task context for a specific session.
    """
    try:
        logger.info(f"Getting task context for session {session_id}")
        
        # 1. Verify project exists
        project = file_service.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # 2. Verify session exists
        session = file_service.get_session_by_id(project_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # 3. Get task context if it exists
        task_context = None
        if session.task_context_id:
            task_context = file_service.get_task_by_id(project_id, session.task_context_id)
            # If task was deleted but session still references it, clear the context
            if not task_context:
                session.task_context_id = None
                file_service.save_session(project_id, session)
        
        return {
            "session_id": session_id,
            "task_context": task_context,
            "has_context": task_context is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task context: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get task context: {str(e)}")


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

@app.route('/api/semantic-hierarchy', methods=['POST'])
async def get_semantic_hierarchy(request: Request):
    """Get semantic hierarchy for tasks and memories"""
    try:
        data = await request.json()
        project_id = data.get('project_id')
        clustering_type = data.get('clustering_type', 'content')
        depth = data.get('depth', 2)
        
        if not project_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Project ID is required"}
            )
        
        # Load tasks and memories for the project
        tasks = file_service.load_tasks(project_id)
        memories = file_service.load_memories(project_id)
        
        # Generate semantic hierarchy
        hierarchy = semantic_service.create_advanced_hierarchy(
            tasks, memories, clustering_type, depth
        )
        
        return JSONResponse(
            status_code=200,
            content=hierarchy
        )
        
    except Exception as e:
        logger.error(f"Error generating semantic hierarchy: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to generate semantic hierarchy"}
        )



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 