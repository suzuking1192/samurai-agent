"""
Response Generator for Unified Samurai Agent

This module provides dynamic LLM-generated responses that are context-aware,
personalized, and maintain the agent's personality as a "vibe coding partner".
"""

import json
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

try:
    from .gemini_service import GeminiService
    from models import Task, Memory, Project, ChatMessage
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from models import Task, Memory, Project, ChatMessage

logger = logging.getLogger(__name__)


@dataclass
class ResponseContext:
    """Context for response generation."""
    project_name: str
    tech_stack: str
    conversation_summary: str
    relevant_tasks: List[Task]
    relevant_memories: List[Memory]
    user_message: str
    intent_type: str
    confidence: float


class ResponseGenerator:
    """
    Centralized response generator that creates dynamic, context-aware responses
    using LLM calls instead of hardcoded responses.
    """
    
    def __init__(self):
        self.gemini_service = GeminiService()
        
        # Response templates and guidelines
        self.agent_personality = """
        You are a "vibe coding partner" - a knowledgeable, friendly, and helpful development assistant.
        Your responses should be:
        - Conversational and engaging
        - Contextually relevant to the project
        - Helpful and actionable
        - Concise but informative
        - Empathetic and understanding
        - Professional but not overly formal
        """
        
        # Fallback responses for when LLM generation fails
        self.fallback_responses = {
            "discussion": "I'm here to help with your project! What would you like to know about?",
            "clarification": "That's an interesting idea! Could you provide more specific details about what you want to build?",
            "error": "I encountered an issue processing your request. Please try again.",
            "confirmation": "Got it! I've processed your request.",
            "completion": "Great! I've completed that for you.",
            "deletion": "Done! I've removed that for you."
        }
    
    async def generate_discussion_response(self, context: ResponseContext) -> str:
        """
        Generate contextual discussion response for pure discussion intent.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            RELEVANT PROJECT KNOWLEDGE:
            {self._format_memories_for_context(context.relevant_memories)}
            
            RELEVANT TASKS:
            {self._format_tasks_for_context(context.relevant_tasks)}
            
            USER MESSAGE: "{context.user_message}"
            
            Provide a helpful, context-aware response that considers the existing project knowledge and current tasks.
            Be conversational and helpful, referencing relevant project context when appropriate.
            Keep your response concise but informative.
            """
            
            response = await self.gemini_service.chat_with_system_prompt(context.user_message, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating discussion response: {e}")
            return self.fallback_responses["discussion"]
    
    async def generate_clarification_questions(self, context: ResponseContext) -> str:
        """
        Generate clarifying questions for feature exploration intent.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            The user is exploring a new feature but needs more specific details. Generate 2-4 targeted clarifying questions.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            USER'S EXPLORATION: "{context.user_message}"
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            RELEVANT PROJECT KNOWLEDGE:
            {self._format_memories_for_context(context.relevant_memories)}
            
            Generate questions that help clarify:
            1. Specific functionality requirements
            2. User interface/experience details
            3. Technical implementation preferences
            4. Integration with existing features
            
            Format as a friendly response with bullet points. Start by acknowledging their idea.
            Keep your response conversational and encouraging.
            """
            
            response = await self.gemini_service.chat_with_system_prompt(context.user_message, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating clarification questions: {e}")
            return self.fallback_responses["clarification"]
    
    async def generate_spec_clarification_response(self, context: ResponseContext, accumulated_specs: Dict[str, Any]) -> str:
        """
        Generate response for specification clarification intent.
        """
        try:
            # Determine if we have enough information
            has_enough_info = len(accumulated_specs) >= 2 or len(context.user_message.split()) > 15
            
            if has_enough_info:
                system_prompt = f"""
                {self.agent_personality}
                
                The user has provided sufficient details and is ready for task creation.
                
                PROJECT: {context.project_name}
                TECH STACK: {context.tech_stack}
                
                USER'S SPECIFICATIONS: "{context.user_message}"
                
                CONVERSATION CONTEXT:
                {context.conversation_summary}
                
                ACCUMULATED SPECS: {json.dumps(accumulated_specs, indent=2)}
                
                Generate a response that:
                1. Acknowledges their detailed specifications
                2. Shows understanding of what they want to build
                3. Offers to create specific implementation tasks
                4. Encourages them to proceed with task creation
                
                Be enthusiastic and confident about creating the tasks.
                """
            else:
                system_prompt = f"""
                {self.agent_personality}
                
                The user has provided some details but needs more information for complete task creation.
                
                PROJECT: {context.project_name}
                TECH STACK: {context.tech_stack}
                
                USER'S RESPONSE: "{context.user_message}"
                
                CONVERSATION CONTEXT:
                {context.conversation_summary}
                
                Generate a response that:
                1. Thanks them for the details provided
                2. Shows progress in understanding their requirements
                3. Asks for additional specific information
                4. Maintains enthusiasm and engagement
                
                Be encouraging and specific about what additional information would be helpful.
                """
            
            response = await self.gemini_service.chat_with_system_prompt(context.user_message, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating spec clarification response: {e}")
            return "Thanks for those details! I'm getting a clearer picture. Would you like me to create tasks for this feature?"
    
    async def generate_task_creation_response(self, tool_results: List[dict], task_breakdown: List[dict], context: ResponseContext) -> str:
        """
        Generate contextual response for task creation results.
        """
        try:
            successful_results = [r for r in tool_results if r.get("success", False)]
            
            if not successful_results:
                return await self._generate_task_creation_error_response(context)
            
            system_prompt = f"""
            {self.agent_personality}
            
            You have successfully created tasks for the user. Generate an enthusiastic and helpful response.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            TASKS CREATED: {len(successful_results)}
            TASK BREAKDOWN: {json.dumps(task_breakdown, indent=2)}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            Generate a response that:
            1. Confirms successful task creation with enthusiasm
            2. Lists the created tasks in a clear, numbered format
            3. Provides encouragement for next steps
            4. References the project context when relevant
            5. Maintains the "vibe coding partner" personality
            
            Be specific about the tasks created and helpful about what comes next.
            """
            
            # Create a summary of the task creation for the prompt
            task_summary = f"Successfully created {len(successful_results)} tasks for {context.project_name}"
            
            response = await self.gemini_service.chat_with_system_prompt(task_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating task creation response: {e}")
            return f"✅ I've created {len([r for r in tool_results if r.get('success', False)])} tasks for you!"
    
    async def generate_task_completion_response(self, task: Task, context: ResponseContext) -> str:
        """
        Generate personalized response for task completion.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            The user has completed a task. Generate a congratulatory and encouraging response.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            COMPLETED TASK: {task.title}
            TASK DESCRIPTION: {task.description}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            RELEVANT TASKS:
            {self._format_tasks_for_context(context.relevant_tasks)}
            
            Generate a response that:
            1. Congratulates them on completing the task
            2. References the specific task that was completed
            3. Shows enthusiasm and encouragement
            4. Mentions what's next or remaining tasks if relevant
            5. Maintains the supportive "vibe coding partner" tone
            
            Be specific about the completed task and encouraging about progress.
            """
            
            completion_summary = f"Completed task: {task.title}"
            response = await self.gemini_service.chat_with_system_prompt(completion_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating task completion response: {e}")
            return f"✅ Great job completing '{task.title}'! Keep up the momentum!"
    
    async def generate_task_deletion_response(self, task: Task, context: ResponseContext) -> str:
        """
        Generate response for task deletion.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            The user has deleted a task. Generate a supportive response.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            DELETED TASK: {task.title}
            TASK DESCRIPTION: {task.description}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            Generate a response that:
            1. Confirms the task was deleted
            2. Shows understanding and support
            3. Maintains a positive, helpful tone
            4. Offers to help with other tasks if relevant
            5. Keeps the "vibe coding partner" personality
            
            Be supportive and helpful, not judgmental about the deletion.
            """
            
            deletion_summary = f"Deleted task: {task.title}"
            response = await self.gemini_service.chat_with_system_prompt(deletion_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating task deletion response: {e}")
            return f"🗑️ Removed '{task.title}' from your project. What would you like to work on next?"
    
    async def generate_error_response(self, error: Exception, context: ResponseContext) -> str:
        """
        Generate helpful error response with context-aware guidance.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            An error occurred while processing the user's request. Generate a helpful, empathetic response.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            USER'S REQUEST: "{context.user_message}"
            ERROR: {str(error)}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            Generate a response that:
            1. Acknowledges the error occurred
            2. Shows empathy and understanding
            3. Provides helpful guidance or suggestions
            4. Maintains the supportive "vibe coding partner" tone
            5. Offers to help them try again or try a different approach
            
            Be helpful and encouraging, not technical or overwhelming.
            """
            
            error_summary = f"Error processing: {context.user_message}"
            response = await self.gemini_service.chat_with_system_prompt(error_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating error response: {e}")
            return self.fallback_responses["error"]
    
    async def generate_session_completion_response(self, session_summary: dict, context: ResponseContext) -> str:
        """
        Generate personalized session completion response.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            The user is completing their session. Generate a personalized summary and farewell.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            SESSION SUMMARY:
            - Messages processed: {session_summary.get('session_messages_count', 0)}
            - Memories created: {session_summary.get('memories_created', 0)}
            - Insights analyzed: {session_summary.get('insights_analyzed', 0)}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            Generate a response that:
            1. Summarizes what was accomplished in the session
            2. Mentions any important decisions or insights gained
            3. Shows appreciation for the collaboration
            4. Encourages them to return for future sessions
            5. Maintains the warm "vibe coding partner" personality
            
            Be specific about their accomplishments and encouraging about future collaboration.
            """
            
            completion_summary = f"Session completed with {session_summary.get('memories_created', 0)} memories created"
            response = await self.gemini_service.chat_with_system_prompt(completion_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating session completion response: {e}")
            return "Great session! I've saved the important insights from our conversation. Looking forward to our next coding session!"
    
    async def generate_progress_update(self, stage: str, message: str, details: str, context: ResponseContext) -> str:
        """
        Generate contextual progress update messages.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            Generate a brief, encouraging progress update message for the user.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            PROGRESS STAGE: {stage}
            PROGRESS MESSAGE: {message}
            PROGRESS DETAILS: {details}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            Generate a brief, encouraging message that:
            1. Acknowledges the current progress stage
            2. Shows enthusiasm and support
            3. Keeps the user engaged and informed
            4. Maintains the "vibe coding partner" personality
            5. Is concise but informative
            
            Keep it brief and encouraging.
            """
            
            progress_summary = f"Progress: {stage} - {message}"
            response = await self.gemini_service.chat_with_system_prompt(progress_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating progress update: {e}")
            return message  # Fallback to original message
    
    async def generate_welcome_back_response(self, context: ResponseContext, last_session_info: Optional[dict] = None) -> str:
        """
        Generate personalized welcome back response for returning users.
        """
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            The user is returning to continue working on their project. Generate a warm welcome back message.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            RELEVANT TASKS:
            {self._format_tasks_for_context(context.relevant_tasks)}
            
            RELEVANT PROJECT KNOWLEDGE:
            {self._format_memories_for_context(context.relevant_memories)}
            
            LAST SESSION INFO: {json.dumps(last_session_info, indent=2) if last_session_info else "No previous session info"}
            
            Generate a response that:
            1. Welcomes them back warmly
            2. References their project and progress
            3. Mentions relevant tasks or memories from previous work
            4. Shows enthusiasm for continuing the collaboration
            5. Maintains the "vibe coding partner" personality
            
            Be personal and show you remember their project and progress.
            """
            
            welcome_summary = f"Welcome back to {context.project_name}!"
            response = await self.gemini_service.chat_with_system_prompt(welcome_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating welcome back response: {e}")
            return f"Welcome back to {context.project_name}! Ready to continue building together?"
    
    # Helper methods
    def _format_tasks_for_context(self, tasks: List[Task]) -> str:
        """Format tasks for context inclusion."""
        if not tasks:
            return "No relevant tasks found."
        
        task_parts = []
        for task in tasks:
            status = "✅" if task.completed else "⏸️"
            task_parts.append(f"{status} {task.title}")
        
        return "\n".join(task_parts)
    
    def _format_memories_for_context(self, memories: List[Memory]) -> str:
        """Format memories for context inclusion."""
        if not memories:
            return "No relevant project memories found."
        
        memory_parts = []
        for memory in memories:
            memory_parts.append(f"[{memory.type}] {memory.title}: {memory.content[:200]}...")
        
        return "\n".join(memory_parts)
    
    async def _generate_task_creation_error_response(self, context: ResponseContext) -> str:
        """Generate response when task creation fails."""
        try:
            system_prompt = f"""
            {self.agent_personality}
            
            Task creation encountered some issues. Generate a helpful response.
            
            PROJECT: {context.project_name}
            TECH STACK: {context.tech_stack}
            
            USER'S REQUEST: "{context.user_message}"
            
            Generate a response that:
            1. Acknowledges the issue occurred
            2. Shows understanding and support
            3. Encourages them to try again
            4. Offers to help troubleshoot if needed
            5. Maintains the supportive "vibe coding partner" tone
            
            Be encouraging and helpful, not technical or overwhelming.
            """
            
            error_summary = "Task creation encountered issues"
            response = await self.gemini_service.chat_with_system_prompt(error_summary, system_prompt)
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating task creation error response: {e}")
            return "I encountered some issues creating the tasks. Please try again, and I'll help you troubleshoot if needed."


# Create singleton instance
response_generator = ResponseGenerator() 