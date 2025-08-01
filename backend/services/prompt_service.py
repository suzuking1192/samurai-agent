from typing import List
from models import Project, Task, Memory, TaskPriority, MemoryType

class PromptService:
    """Service for generating optimized prompts for AI interactions"""
    
    def generate_chat_prompt(self, project: Project, message: str, 
                           existing_tasks: List[Task], existing_memories: List[Memory]) -> str:
        """
        Generate a chat prompt with project context
        
        Args:
            project: The current project
            message: User's message
            existing_tasks: List of existing tasks
            existing_memories: List of existing memories
            
        Returns:
            Formatted prompt string
        """
        prompt = f"""You are Samurai Agent, an AI-powered development assistant for the project "{project.name}".

Project Description: {project.description}

Current Tasks:
{self._format_tasks(existing_tasks)}

Project Memories:
{self._format_memories(existing_memories)}

User Message: {message}

Please respond to the user's message and:
1. Provide helpful guidance and suggestions
2. If the message suggests new tasks, create them with appropriate titles, descriptions, and priorities
3. If the message contains important context or decisions, create memories to remember them
4. Keep responses concise but informative

Format your response naturally, and if you create tasks or memories, include them in a structured format that can be parsed."""
        
        return prompt
    
    def generate_task_breakdown_prompt(self, project: Project, feature_description: str) -> str:
        """
        Generate a prompt for breaking down features into tasks
        
        Args:
            project: The current project
            feature_description: Description of the feature to break down
            
        Returns:
            Formatted prompt string
        """
        prompt = f"""You are Samurai Agent, helping to break down a feature for the project "{project.name}".

Project Description: {project.description}

Feature to Break Down: {feature_description}

Please break down this feature into actionable tasks. Each task should be:
- Specific and actionable
- Have a clear title and description
- Have an appropriate priority (low, medium, high)
- Be sized appropriately for development work

Create tasks that follow good development practices and can be implemented independently.

Format your response with tasks in a structured format that can be parsed."""
        
        return prompt
    
    def generate_cursor_prompt(self, project: Project, task: Task, memories: List[Memory]) -> str:
        """
        Generate an optimized prompt for Cursor based on a specific task
        
        Args:
            project: The current project
            task: The specific task to work on
            memories: Relevant project memories
            
        Returns:
            Optimized prompt string for Cursor
        """
        prompt = f"""You are working on the project "{project.name}".

Project Description: {project.description}

Current Task: {task.title}
Task Description: {task.description}
Task Priority: {task.priority.value}

Relevant Project Context:
{self._format_memories(memories)}

Please help implement this task. Consider:
1. The project context and existing decisions
2. Best practices for the technology stack
3. Code quality and maintainability
4. The specific requirements of this task

Provide clear, actionable guidance and code examples as needed."""
        
        return prompt
    
    def extract_tasks(self, ai_response: str, project_id: str) -> List[Task]:
        """
        Extract tasks from AI response
        
        Args:
            ai_response: Response from AI
            project_id: ID of the project
            
        Returns:
            List of extracted tasks
        """
        # TODO: Implement proper parsing logic
        # This is a placeholder implementation
        tasks = []
        
        # Simple extraction logic - look for task-like patterns
        lines = ai_response.split('\n')
        current_task = None
        
        for line in lines:
            line = line.strip()
            if line.startswith('Task:') or line.startswith('-') or line.startswith('*'):
                if current_task:
                    tasks.append(current_task)
                
                # Extract task title
                title = line.replace('Task:', '').replace('-', '').replace('*', '').strip()
                if title:
                    current_task = Task(
                        project_id=project_id,
                        title=title,
                        description="",
                        priority=TaskPriority.MEDIUM
                    )
            elif current_task and line:
                # Add to description
                if current_task.description:
                    current_task.description += " " + line
                else:
                    current_task.description = line
        
        if current_task:
            tasks.append(current_task)
        
        return tasks
    
    def extract_memories(self, ai_response: str, project_id: str) -> List[Memory]:
        """
        Extract memories from AI response
        
        Args:
            ai_response: Response from AI
            project_id: ID of the project
            
        Returns:
            List of extracted memories
        """
        # TODO: Implement proper parsing logic
        # This is a placeholder implementation
        memories = []
        
        # Simple extraction logic - look for memory-like patterns
        lines = ai_response.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('Memory:') or line.startswith('Note:') or line.startswith('Context:'):
                content = line.replace('Memory:', '').replace('Note:', '').replace('Context:', '').strip()
                if content:
                    memories.append(Memory(
                        project_id=project_id,
                        content=content,
                        type=MemoryType.NOTE
                    ))
        
        return memories
    
    def _format_tasks(self, tasks: List[Task]) -> str:
        """Format tasks for prompt inclusion"""
        if not tasks:
            return "No tasks yet."
        
        formatted = []
        for task in tasks:
            formatted.append(f"- {task.title} ({task.status.value}, {task.priority.value})")
            if task.description:
                formatted.append(f"  {task.description}")
        
        return "\n".join(formatted)
    
    def _format_memories(self, memories: List[Memory]) -> str:
        """Format memories for prompt inclusion"""
        if not memories:
            return "No memories yet."
        
        formatted = []
        for memory in memories:
            formatted.append(f"- [{memory.type.value}] {memory.content}")
        
        return "\n".join(formatted) 