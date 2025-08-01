from typing import List
from models import ChatRequest, ChatResponse, Task, Memory
from .gemini_service import GeminiService
from .prompt_service import PromptService
from .file_service import FileService

class SamuraiAgent:
    """Main AI agent class that coordinates all services"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.prompt_service = PromptService()
        self.file_service = FileService()
    
    async def process_message(self, request: ChatRequest) -> ChatResponse:
        """
        Process a chat message and return AI response with tasks and memories
        
        Args:
            request: ChatRequest containing project_id and message
            
        Returns:
            ChatResponse with AI response, generated tasks, and memories
        """
        try:
            # Get project context
            project = self.file_service.get_project(request.project_id)
            if not project:
                raise ValueError(f"Project {request.project_id} not found")
            
            # Get existing tasks and memories for context
            existing_tasks = self.file_service.get_tasks(request.project_id)
            existing_memories = self.file_service.get_memories(request.project_id)
            
            # Generate prompt with context
            prompt = self.prompt_service.generate_chat_prompt(
                project=project,
                message=request.message,
                existing_tasks=existing_tasks,
                existing_memories=existing_memories
            )
            
            # Get AI response
            ai_response = await self.gemini_service.generate_response(prompt)
            
            # Parse response for tasks and memories
            tasks = self.prompt_service.extract_tasks(ai_response, request.project_id)
            memories = self.prompt_service.extract_memories(ai_response, request.project_id)
            
            # Save new tasks and memories
            saved_tasks = []
            for task in tasks:
                saved_task = self.file_service.create_task(task)
                saved_tasks.append(saved_task)
            
            saved_memories = []
            for memory in memories:
                saved_memory = self.file_service.create_memory(memory)
                saved_memories.append(saved_memory)
            
            return ChatResponse(
                response=ai_response,
                tasks=saved_tasks,
                memories=saved_memories
            )
            
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error processing message: {str(e)}")
    
    async def break_down_feature(self, project_id: str, feature_description: str) -> List[Task]:
        """
        Break down a feature into actionable tasks
        
        Args:
            project_id: ID of the project
            feature_description: Description of the feature to break down
            
        Returns:
            List of generated tasks
        """
        try:
            project = self.file_service.get_project(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")
            
            # Generate task breakdown prompt
            prompt = self.prompt_service.generate_task_breakdown_prompt(
                project=project,
                feature_description=feature_description
            )
            
            # Get AI response
            ai_response = await self.gemini_service.generate_response(prompt)
            
            # Extract tasks
            tasks = self.prompt_service.extract_tasks(ai_response, project_id)
            
            # Save tasks
            saved_tasks = []
            for task in tasks:
                saved_task = self.file_service.create_task(task)
                saved_tasks.append(saved_task)
            
            return saved_tasks
            
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error breaking down feature: {str(e)}")
    
    async def generate_cursor_prompt(self, project_id: str, task_id: str) -> str:
        """
        Generate an optimized prompt for Cursor based on a specific task
        
        Args:
            project_id: ID of the project
            task_id: ID of the task
            
        Returns:
            Optimized prompt string for Cursor
        """
        try:
            project = self.file_service.get_project(project_id)
            task = self.file_service.get_task(task_id)
            
            if not project or not task:
                raise ValueError("Project or task not found")
            
            # Get relevant memories for context
            memories = self.file_service.get_memories(project_id)
            
            # Generate Cursor prompt
            prompt = self.prompt_service.generate_cursor_prompt(
                project=project,
                task=task,
                memories=memories
            )
            
            return prompt
            
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error generating Cursor prompt: {str(e)}") 