import uuid
import re
import json
from datetime import datetime
from typing import List, Dict, Optional
import logging
import asyncio
import sys

try:
    from .gemini_service import GeminiService
    from .file_service import FileService
    from .memory_categorization import detect_memory_category, generate_category_specific_title
    from .agent_planning import AgentPlanningPhase, IntelligentAgent, CommonIssuePatterns, ResponseLengthHandler
    from .tool_calling_agent import EnhancedSamuraiAgent
    from .consolidated_memory import ConsolidatedMemoryService
    from .vector_context_service import vector_context_service
    from models import Task, Memory, Project, MemoryCategory, ChatMessage
except ImportError:
    # Fallback for when running the file directly
    import sys
    import os
    # Add parent directory to path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from file_service import FileService
    from memory_categorization import detect_memory_category, generate_category_specific_title
    from agent_planning import AgentPlanningPhase, IntelligentAgent, CommonIssuePatterns, ResponseLengthHandler
    from tool_calling_agent import EnhancedSamuraiAgent
    from consolidated_memory import ConsolidatedMemoryService
    from vector_context_service import vector_context_service
    from models import Task, Memory, Project, MemoryCategory, ChatMessage

logger = logging.getLogger(__name__)


class SamuraiAgent:
    """Enhanced AI agent with intelligent decision-making, feature clarification, and task management"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.file_service = FileService()
        self.intelligent_agent = IntelligentAgent()
        self.enhanced_agent = EnhancedSamuraiAgent()
        self.consolidated_memory_service = ConsolidatedMemoryService()
    
    async def process_message(self, message: str, project_id: str, project_context: dict, session_id: str = None) -> dict:
        """Enhanced message processing with vector-enhanced context understanding and tool calling capabilities"""
        
        try:
            # Get all messages from current session for full conversation context
            session_messages = self._get_session_messages(project_id, session_id)
            
            # Generate vector-enhanced context using full conversation
            vector_context = await self._build_vector_enhanced_context(
                message, project_id, session_messages, project_context
            )
            
            logger.info(f"Vector context summary: {vector_context.get('summary', {})}")
            
            # Enhanced tool detection with vector context
            tool_plan = await self.should_use_tools_enhanced(message, vector_context.get('context_info', {}))
            logger.info(f"Tool plan: {tool_plan}")
            
            # Execute tools if needed
            tool_results = []
            if tool_plan.get("requires_tools", False):
                tool_results = await self.execute_planned_tools(
                    tool_plan['tool_calls'], project_id, vector_context.get('context_info', {})
                )
                logger.info(f"Tool results: {tool_results}")
            
            # Generate response based on tool execution
            if tool_results:
                response = await self.generate_response_with_tools(
                    message, tool_results, vector_context.get('context_info', {})
                )
                response_type = "tool_response"
            else:
                # Use existing enhanced agent for regular processing with vector context
                result = await self.enhanced_agent.process_message(message, project_id, project_context)
                response = result.get("response", "I couldn't process your request.")
                response_type = result.get("type", "response")
            
            return {
                "type": response_type,
                "response": response,
                "tool_calls_made": len(tool_results),
                "tool_results": tool_results,
                "context_used": vector_context.get('context_info', {}),
                "vector_context_summary": vector_context.get('summary', {})
            }
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "type": "error",
                "response": "I encountered an error processing your message. Please try again.",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {},
                "vector_context_summary": {}
            }
    
    async def _build_vector_enhanced_context(
        self, 
        message: str, 
        project_id: str, 
        session_messages: List[ChatMessage], 
        project_context: dict
    ) -> dict:
        """
        Build comprehensive context using vector-enhanced semantic similarity.
        
        Args:
            message: Current user message
            project_id: Project identifier
            session_messages: All messages from current session
            project_context: Project context information
            
        Returns:
            Dictionary containing assembled context and summary
        """
        try:
            # Generate embedding for full conversation context
            conversation_embedding = vector_context_service.get_conversation_context_embedding(
                session_messages, message
            )
            
            if not conversation_embedding:
                logger.warning("Failed to generate conversation embedding, falling back to basic context")
                return self._build_fallback_context(message, project_id, session_messages, project_context)
            
            # Get all tasks and memories for the project
            all_tasks = self.file_service.load_tasks(project_id)
            all_memories = self.file_service.load_memories(project_id)
            
            # Find relevant tasks and memories using vector similarity
            relevant_tasks = vector_context_service.find_relevant_tasks(
                conversation_embedding, all_tasks, project_id
            )
            
            relevant_memories = vector_context_service.find_relevant_memories(
                conversation_embedding, all_memories, project_id
            )
            
            # Assemble comprehensive context
            assembled_context = vector_context_service.assemble_vector_context(
                session_messages, relevant_tasks, relevant_memories, message
            )
            
            # Get context summary for monitoring
            context_summary = vector_context_service.get_vector_context_summary(
                session_messages, relevant_tasks, relevant_memories
            )
            
            # Build context info for tool calling
            context_info = {
                "conversation_context": assembled_context,
                "relevant_tasks": [task for task, _ in relevant_tasks],
                "relevant_memories": [memory for memory, _ in relevant_memories],
                "session_messages": session_messages,
                "project_context": project_context
            }
            
            return {
                "assembled_context": assembled_context,
                "context_info": context_info,
                "summary": context_summary,
                "relevant_tasks_with_scores": relevant_tasks,
                "relevant_memories_with_scores": relevant_memories
            }
            
        except Exception as e:
            logger.error(f"Error building vector-enhanced context: {e}")
            return self._build_fallback_context(message, project_id, session_messages, project_context)
    
    async def _build_fallback_context(
        self, 
        message: str, 
        project_id: str, 
        session_messages: List[ChatMessage], 
        project_context: dict
    ) -> dict:
        """
        Build fallback context when vector enhancement fails.
        
        Args:
            message: Current user message
            project_id: Project identifier
            session_messages: All messages from current session
            project_context: Project context information
            
        Returns:
            Dictionary containing fallback context
        """
        try:
            # Use existing context retrieval methods as fallback
            conversation_history = self._get_conversation_history_for_planning(project_id, None, max_messages=10)
            context_info = await self.extract_conversation_context(conversation_history)
            
            # Get basic relevant memories and tasks
            relevant_memories = self._retrieve_relevant_memories(message, project_id)
            relevant_tasks = self._retrieve_relevant_tasks(message, project_id)
            
            # Build basic context
            assembled_context = self._build_enhanced_context(message, project_id, project_context)
            
            return {
                "assembled_context": assembled_context.get("conversation", ""),
                "context_info": context_info,
                "summary": {
                    "session_messages_count": len(session_messages),
                    "relevant_tasks_count": len(relevant_tasks),
                    "relevant_memories_count": len(relevant_memories),
                    "fallback_used": True
                },
                "relevant_tasks_with_scores": [(task, 0.0) for task in relevant_tasks],
                "relevant_memories_with_scores": [(memory, 0.0) for memory in relevant_memories]
            }
            
        except Exception as e:
            logger.error(f"Error building fallback context: {e}")
            return {
                "assembled_context": "",
                "context_info": {},
                "summary": {"error": str(e)},
                "relevant_tasks_with_scores": [],
                "relevant_memories_with_scores": []
            }
    
    def _get_session_messages(self, project_id: str, session_id: str = None) -> List[ChatMessage]:
        """
        Get all messages from the current session.
        
        Args:
            project_id: Project identifier
            session_id: Session identifier (optional)
            
        Returns:
            List of chat messages from the session
        """
        try:
            if session_id:
                # Get messages for specific session
                return self.file_service.load_chat_messages_by_session(project_id, session_id)
            else:
                # Get all messages (fallback for backward compatibility)
                return self.file_service.load_chat_history(project_id)
        except Exception as e:
            logger.error(f"Error getting session messages: {e}")
            return []
    
    async def _analyze_intent(self, message: str) -> str:
        """Use LLM to intelligently determine user intent with fallback to keyword analysis"""
        
        # Primary: LLM-based analysis
        try:
            llm_intent = await self._llm_intent_analysis(message)
            logger.info(f"LLM intent analysis: {llm_intent}")
            
            # Check if LLM returned a valid intent
            if llm_intent in ["feature_request", "task_management", "question", "general_chat"]:
                return llm_intent
            else:
                logger.warning(f"LLM returned invalid intent: {llm_intent}, falling back to keyword analysis")
        except Exception as e:
            logger.warning(f"LLM intent analysis failed: {e}, falling back to keyword analysis")
        
        # Fallback: Original keyword-based analysis
        fallback_intent = self._keyword_intent_analysis(message)
        logger.info(f"Fallback keyword analysis: {fallback_intent}")
        return fallback_intent

    async def _llm_intent_analysis(self, message: str) -> str:
        """Use LLM to analyze user intent with sophisticated understanding"""
        
        system_prompt = """
        You are an expert at understanding developer intent. Analyze the user's message and classify it into exactly one of these categories:

        **feature_request**: User wants to build, add, create, or implement something new
        Examples:
        - "I want to add user authentication"
        - "Let's create a search feature" 
        - "Can you help me build a dashboard"
        - "I need to implement real-time notifications"
        - "How do I add a payment system" (asking HOW to add = wants to add)
        - "We should build an admin panel"

        **task_management**: User is managing existing tasks (completing, deleting, updating)
        Examples:
        - "The login form is done"
        - "I finished the registration task"
        - "Delete the email verification task"
        - "Remove the JWT implementation"
        - "Change the authentication to use sessions"
        - "I completed the user interface"

        **question**: User is asking for explanation, help, or technical information (not asking to build)
        Examples:
        - "What is JWT?"
        - "How does authentication work?"
        - "Explain REST APIs"
        - "What's the difference between React and Vue?"
        - "Why use PostgreSQL over MySQL?"
        - "What are best practices for API design?"

        **general_chat**: Casual conversation, greetings, or non-technical discussion
        Examples:
        - "Hello"
        - "Good morning"
        - "How are you?"
        - "What should I work on today?"
        - "I'm feeling stuck"
        - "Thanks for the help"

        IMPORTANT DISTINCTIONS:
        - "How do I add X?" = feature_request (wants to add X)
        - "How does X work?" = question (wants to understand X)
        - "I built the login form" = task_management (reporting completion)
        - "I want to build a login form" = feature_request (wants to create)

        Analyze this message: "{message}"

        Return ONLY the category name (feature_request, task_management, question, or general_chat).
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                message, 
                system_prompt.format(message=message)
            )
            
            # Check if the response indicates an API error
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API returned error response, falling back to keyword analysis")
                raise Exception("LLM API error detected")
            
            # Extract intent from response
            response_clean = response.strip().lower()
            
            # Map possible variations to standard intents
            intent_mapping = {
                "feature_request": "feature_request",
                "feature request": "feature_request", 
                "build": "feature_request",
                "create": "feature_request",
                
                "task_management": "task_management",
                "task management": "task_management",
                "task": "task_management",
                "management": "task_management",
                
                "question": "question",
                "ask": "question",
                "explain": "question",
                
                "general_chat": "general_chat",
                "general chat": "general_chat",
                "chat": "general_chat",
                "casual": "general_chat"
            }
            
            # Find matching intent
            for key, intent in intent_mapping.items():
                if key in response_clean:
                    return intent
            
            # If no clear match, analyze response content
            if any(word in response_clean for word in ["add", "build", "create", "implement", "make"]):
                return "feature_request"
            elif any(word in response_clean for word in ["done", "complete", "finish", "delete", "remove"]):
                return "task_management"
            elif any(word in response_clean for word in ["what", "how", "why", "explain"]):
                return "question"
            else:
                return "general_chat"
                
        except Exception as e:
            logger.error(f"Error in LLM intent analysis: {e}")
            raise e

    def _keyword_intent_analysis(self, message: str) -> str:
        """Fallback keyword-based intent analysis (original logic)"""
        
        message_lower = message.lower()
        
        # Task management detection
        task_mgmt_keywords = [
            "task is done", "task done", "finished", "completed", "complete",
            "delete task", "remove task", "cancel task", 
            "change task", "update task", "modify task"
        ]
        if any(keyword in message_lower for keyword in task_mgmt_keywords):
            return "task_management"
        
        # Feature request detection
        feature_keywords = [
            "add", "create", "build", "implement", "make", "develop",
            "i want to", "i need", "i'd like to", "let's add", "let's create",
            "can you help me build", "how do i add", "how do i create"
        ]
        if any(keyword in message_lower for keyword in feature_keywords):
            return "feature_request"
        
        # Question detection
        question_words = ["what", "how", "why", "when", "where", "which", "explain"]
        if any(message_lower.startswith(word) for word in question_words):
            return "question"
        
        return "general_chat"
    
    async def _evaluate_clarity(self, message: str, context: dict) -> dict:
        """Evaluate if feature request is specific enough to implement"""
        
        system_prompt = """
        Evaluate if this feature request is specific enough to break down into implementation tasks.

        SUFFICIENTLY CLEAR examples (can implement immediately):
        - "Add user authentication" (clear enough to create basic auth tasks)
        - "Add email/password authentication with user registration, login, logout, and password reset functionality"
        - "Create a todo list with add, edit, delete, mark complete, and filter by status"
        - "Implement real-time chat with message history, user typing indicators, and emoji support"
        - "I need to add user authentication to my app" (clear enough)
        - "I should implement a shopping cart feature" (clear enough)
        - "TODO: Fix the login bug and add password reset" (clear enough)
        - "Can you help me create tasks for building a REST API?" (clear enough)

        TOO VAGUE examples (need more details):
        - "Add notifications" (What triggers them? How displayed?)
        - "Make it real-time" (What specifically should be real-time?)
        - "Add search functionality" (Search what? How should results display?)
        - "Improve the UI" (What specifically?)

        Feature request: "{message}"

        Return only: CLEAR or VAGUE
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt.format(message=message))
            is_clear = "CLEAR" in response.upper()
            
            logger.info(f"Clarity evaluation for '{message}': {response.strip()} -> {'CLEAR' if is_clear else 'VAGUE'}")
            
            return {
                "clear": is_clear,
                "reason": response.strip()
            }
        except Exception as e:
            logger.error(f"Error evaluating clarity: {e}")
            return {"clear": False, "reason": "Could not evaluate"}
    
    async def _ask_clarifying_questions(self, message: str, context: dict) -> dict:
        """Generate clarifying questions for vague feature requests"""
        
        system_prompt = f"""
        The user wants to add a feature but their request is too vague. Generate 2-4 specific clarifying questions to understand exactly what they want to build.

        Project Context:
        - Project: {context.get('name', 'Unknown')}
        - Tech Stack: {context.get('tech_stack', 'Unknown')}
        - Description: {context.get('description', 'Unknown')}

        User's vague request: "{message}"

        Generate questions that help clarify:
        1. Specific functionality needed
        2. User interface/experience details  
        3. Technical requirements or constraints
        4. Integration with existing features

        Format as a friendly response with bullet points. Start with acknowledging their idea, then ask questions.

        Example format:
        "That's a great idea for your project! To help me break this down into specific tasks, I need to understand a few details:

        • [Specific question about functionality]
        • [Question about user interface/experience]  
        • [Question about technical requirements]
        • [Question about scope/integration]

        Once I understand these details, I can create a perfect implementation plan for you!"
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            return {
                "type": "clarification",
                "response": response,
                "tasks": []
            }
        except Exception as e:
            logger.error(f"Error generating clarifying questions: {e}")
            return {
                "type": "error",
                "response": "I'd love to help with that feature! Could you provide more specific details about what you want to build?",
                "tasks": []
            }
    
    async def _handle_feature_request(self, message: str, project_context: dict, project_id: str = None) -> dict:
        """Break down feature request with full project context"""
        
        # Build enhanced context
        if project_id:
            enhanced_context = self._build_enhanced_context(message, project_id, project_context)
            memory_context = enhanced_context["memory_context"]
            task_context = enhanced_context["task_context"]
        else:
            memory_context = "No previous project knowledge available."
            task_context = "No existing tasks found."
        
        # Enhanced system prompt with memory and task context
        system_prompt = f"""
You are an expert software architect. Break down the user's feature request into 3-7 specific, actionable tasks.

Project Context:
- Project: {project_context.get('name', 'Unknown')}
- Tech Stack: {project_context.get('tech_stack', 'Unknown')}
- Description: {project_context.get('description', 'Unknown')}

{memory_context}

{task_context}

User Request: {message}

IMPORTANT: Consider existing project knowledge and tasks when creating the breakdown:
- Don't duplicate existing completed tasks
- Build upon previous decisions and specifications
- Ensure new tasks integrate with existing work
- Reference relevant memories in task descriptions

Rules for task breakdown:
1. Each task should take 30-60 minutes to complete
2. Tasks should be in logical development order
3. Be specific about what to implement
4. Consider existing project architecture and decisions
5. Each task should be suitable for AI coding tools like Cursor

Format your response exactly like this:
TASKS:
1. [Specific task title] - [Clear description considering existing context]
2. [Specific task title] - [Clear description considering existing context]
3. [Specific task title] - [Clear description considering existing context]

Example:
TASKS:
1. Create user registration form component - Build a React form with email, password fields and validation
2. Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
3. Implement JWT token generation - Add JWT creation and validation logic in backend
"""

        try:
            # Get AI breakdown with enhanced context
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            # Check if the response indicates an API error
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API returned error response in feature breakdown, using fallback")
                return {
                    "type": "error",
                    "response": "I'm having trouble processing that request right now. Could you try again?",
                    "tasks": []
                }
            
            # Parse tasks from response
            parsed_tasks = self._parse_tasks_from_response(response)
            
            if not parsed_tasks:
                return {
                    "type": "error",
                    "response": "I couldn't break down that feature. Could you be more specific about what you want to build?",
                    "tasks": []
                }
            
            # Create task objects with enhanced context
            task_objects = self._create_task_objects(parsed_tasks, project_id)
            
            # Enhanced response that references existing context
            response_parts = [f"Great! I've broken down your feature into {len(task_objects)} actionable tasks."]
            
            if memory_context != "No relevant project memories found.":
                response_parts.append("I've considered your existing project decisions and architecture.")
            
            if task_context != "No relevant tasks found.":
                response_parts.append("These tasks will integrate with your existing work.")
            
            response_text = " ".join(response_parts)
            
            return {
                "type": "feature_breakdown", 
                "response": response_text,
                "tasks": task_objects
            }
            
        except Exception as e:
            logger.error(f"Error in enhanced feature breakdown: {e}")
            return {
                "type": "error",
                "response": "I had trouble processing that request. Could you try rephrasing what you want to build?",
                "tasks": []
            }
    
    async def _handle_task_management(self, message: str, project_id: str) -> dict:
        """Handle task completion, deletion, or updates through chat"""
        
        operation = self._detect_task_operation(message)
        
        if operation["operation"] == "none":
            return {
                "type": "error",
                "response": "I couldn't understand which task you're referring to. Could you be more specific?",
                "tasks": []
            }
        
        # Load existing tasks
        tasks = self.file_service.load_tasks(project_id)
        
        if not tasks:
            return {
                "type": "error", 
                "response": "You don't have any tasks yet. Create some tasks first by describing a feature you want to build!",
                "tasks": []
            }
        
        task_ref = operation["task_reference"]
        
        # Find matching task (simple keyword matching)
        matching_task = None
        for task in tasks:
            if any(word in task.title.lower() for word in task_ref.split()):
                matching_task = task
                break
        
        if not matching_task:
            task_list = "\n".join([f"• {task.title}" for task in tasks[:5]])
            return {
                "type": "error",
                "response": f"I couldn't find a matching task. Your current tasks are:\n{task_list}\n\nCould you be more specific?",
                "tasks": []
            }
        
        # Perform the operation
        if operation["operation"] == "complete":
            matching_task.completed = True
            self.file_service.save_tasks(project_id, tasks)
            
            completed_count = sum(1 for t in tasks if t.completed)
            total_count = len(tasks)
            
            return {
                "type": "task_update",
                "response": f"✅ Marked '{matching_task.title}' as complete! Progress: {completed_count}/{total_count} tasks finished.",
                "tasks": []
            }
        
        elif operation["operation"] == "delete":
            tasks = [t for t in tasks if t.id != matching_task.id]
            self.file_service.save_tasks(project_id, tasks)
            
            return {
                "type": "task_update", 
                "response": f"🗑️ Deleted '{matching_task.title}' from your project. {len(tasks)} tasks remaining.",
                "tasks": []
            }
        
        elif operation["operation"] == "update":
            # For now, just acknowledge - could enhance to actually update task
            return {
                "type": "task_update",
                "response": f"I understand you want to update '{matching_task.title}'. Task updates aren't fully implemented yet, but I've noted your request!",
                "tasks": []
            }
        
        return {
            "type": "error",
            "response": "Something went wrong with the task operation. Please try again.",
            "tasks": []
        }
    
    async def _handle_regular_chat(self, message: str, project_context: dict, project_id: str = None) -> dict:
        """Handle chat with full project context awareness"""
        
        # Build enhanced context
        if project_id:
            enhanced_context = self._build_enhanced_context(message, project_id, project_context)
            memory_context = enhanced_context["memory_context"]
            task_context = enhanced_context["task_context"]
            
            # Create context-aware prompt
            system_prompt = f"""
You are a helpful development assistant for this project:

Project: {project_context.get('name', 'Unknown')}
Tech Stack: {project_context.get('tech_stack', 'Unknown')}

{memory_context}

{task_context}

Please provide helpful, context-aware advice that considers the existing project knowledge and current tasks.
"""
            
            try:
                response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
                
                # Check if the response indicates an API error
                if "I'm having trouble processing that request" in response or "Error:" in response:
                    logger.warning("LLM API returned error response in chat, using fallback")
                    return {
                        "type": "chat",
                        "response": "I'm here to help with your project! What would you like to know about?",
                        "tasks": []
                    }
                
                return {
                    "type": "chat",
                    "response": response,
                    "tasks": []
                }
            except Exception as e:
                logger.error(f"Error in enhanced chat: {e}")
                return {
                    "type": "chat",
                    "response": "I'm here to help with your project! What would you like to know about?",
                    "tasks": []
                }
        else:
            # Fallback to simple context
            context_string = f"Project: {project_context.get('name', 'Unknown')}, Tech Stack: {project_context.get('tech_stack', 'Unknown')}"
            try:
                response = await self.gemini_service.chat(message, context_string)
                return {
                    "type": "chat",
                    "response": response,
                    "tasks": []
                }
            except Exception as e:
                logger.error(f"Error in fallback chat: {e}")
                return {
                    "type": "chat",
                    "response": "I'm here to help with your project! What would you like to know about?",
                    "tasks": []
                }
    
    def _detect_task_operation(self, message: str) -> dict:
        """Detect if user wants to complete, delete, or update a task"""
        message_lower = message.lower()
        
        # Complete/Done detection
        done_patterns = [
            "task is done", "task done", "is finished", "is completed", "is complete",
            "finished the", "completed the", "done with"
        ]
        if any(pattern in message_lower for pattern in done_patterns):
            return {
                "operation": "complete",
                "task_reference": self._extract_task_reference(message)
            }
        
        # Delete/Remove detection
        delete_patterns = [
            "delete", "remove", "cancel", "get rid of", "don't need"
        ]
        if any(pattern in message_lower for pattern in delete_patterns):
            return {
                "operation": "delete", 
                "task_reference": self._extract_task_reference(message)
            }
        
        # Update/Change detection
        update_patterns = [
            "change", "update", "modify", "instead", "rather than"
        ]
        if any(pattern in message_lower for pattern in update_patterns):
            return {
                "operation": "update",
                "task_reference": self._extract_task_reference(message),
                "new_description": message  # Full message for context
            }
        
        return {"operation": "none"}

    def _extract_task_reference(self, message: str) -> str:
        """Extract which task the user is referring to"""
        # Look for task titles or keywords in the message
        # This is a simple implementation - could be enhanced with fuzzy matching
        
        message_lower = message.lower()
        
        # Common task-related keywords to help identify the task
        task_keywords = [
            "login", "register", "auth", "form", "api", "endpoint", 
            "component", "jwt", "password", "email", "database"
        ]
        
        found_keywords = [kw for kw in task_keywords if kw in message_lower]
        return " ".join(found_keywords) if found_keywords else message_lower[:50]
    
    def _parse_tasks_from_response(self, ai_response: str) -> List[dict]:
        """Parse tasks from AI response"""
        tasks = []
        lines = ai_response.split('\n')
        
        # Look for the TASKS: section
        in_tasks_section = False
        
        for line in lines:
            line = line.strip()
            
            # Check if we're entering the tasks section
            if line.upper().startswith('TASKS:'):
                in_tasks_section = True
                continue
            
            # If we're in the tasks section, look for numbered tasks
            if in_tasks_section and line:
                # Check for numbered task format: "1. [title] - [description]"
                if line[0].isdigit() and '. ' in line:
                    # Extract task number, title, and description
                    parts = line.split('. ', 1)
                    if len(parts) == 2:
                        task_content = parts[1]
                        
                        # Split on " - " to separate title and description
                        if ' - ' in task_content:
                            title, description = task_content.split(' - ', 1)
                        else:
                            # If no description separator, use the whole content as title
                            title = task_content
                            description = ""
                        
                        task = {
                            'title': title.strip(),
                            'description': description.strip(),
                            'priority': 'MEDIUM'
                        }
                        tasks.append(task)
                
                # Also check for bullet point format: "• [title] - [description]"
                elif line.startswith('•') or line.startswith('-'):
                    task_content = line[1:].strip()
                    
                    if ' - ' in task_content:
                        title, description = task_content.split(' - ', 1)
                    else:
                        title = task_content
                        description = ""
                    
                    task = {
                        'title': title.strip(),
                        'description': description.strip(),
                        'priority': 'MEDIUM'
                    }
                    tasks.append(task)
        
        return tasks
    
    def _create_task_objects(self, parsed_tasks: List[dict], project_id: str = None) -> List[Task]:
        """Create Task objects from parsed task data with improved title generation"""
        tasks = []
        
        for i, task_data in enumerate(parsed_tasks):
            # Generate short, readable title
            title = self._generate_short_title(task_data.get('title', 'Untitled Task'), 'task')
            
            # Truncate description if it's too long (max 1000 characters)
            description = task_data.get('description', '')
            if len(description) > 1000:
                description = description[:997] + "..."
                logger.warning(f"Task description truncated: {description[:50]}...")
            
            task = Task(
                id=str(uuid.uuid4()),
                project_id=project_id or "",
                title=title,
                description=description,
                prompt='',  # Will be set later
                completed=False,
                order=i + 1,  # Add order field
                created_at=datetime.now()
            )
            tasks.append(task)
        
        return tasks

    def _generate_short_title(self, content: str, type: str = 'task', max_length: int = 35) -> str:
        """Generate short, scannable titles for tasks and memories"""
        
        # Simple title generation logic - could be enhanced with LLM
        content_lower = content.lower()
        
        # Extract key action words for tasks
        if type == 'task':
            action_words = ['add', 'create', 'build', 'implement', 'setup', 'configure', 'fix', 'update', 'improve', 'refactor']
            for word in action_words:
                if word in content_lower:
                    # Extract the object after the action word
                    parts = content_lower.split(word, 1)
                    if len(parts) > 1:
                        object_part = parts[1].strip()
                        # Take first few words as title
                        words = object_part.split()[:3]
                        title = f"{word.title()} {' '.join(words)}"
                        if len(title) <= max_length:
                            return title
            
            # Fallback: take first few meaningful words
            words = content.split()[:4]
            title = ' '.join(words)
            if len(title) > max_length:
                title = title[:max_length-3] + "..."
            return title
        
        # For memories, focus on key concepts
        else:
            # Extract key technical terms
            tech_terms = ['auth', 'api', 'database', 'ui', 'frontend', 'backend', 'deployment', 'testing']
            for term in tech_terms:
                if term in content_lower:
                    # Find context around the term
                    idx = content_lower.find(term)
                    start = max(0, idx - 20)
                    end = min(len(content), idx + len(term) + 20)
                    context = content[start:end].strip()
                    words = context.split()[:3]
                    title = ' '.join(words)
                    if len(title) <= max_length:
                        return title
            
            # Fallback: take first few words
            words = content.split()[:3]
            title = ' '.join(words)
            if len(title) > max_length:
                title = title[:max_length-3] + "..."
            return title
    
    def _generate_cursor_prompt(self, task_title: str, task_description: str, project_context: dict) -> str:
        """Generate optimized Cursor prompt for a specific task"""
        
        prompt = f"""
# Cursor Prompt: {task_title}

## Task Description
{task_description}

## Project Context
- **Project**: {project_context.get('name', 'Unknown')}
- **Tech Stack**: {project_context.get('tech_stack', 'Unknown')}
- **Description**: {project_context.get('description', 'Unknown')}

## Implementation Requirements
1. Follow the project's existing code style and patterns
2. Use the specified tech stack: {project_context.get('tech_stack', 'Unknown')}
3. Implement the task as described above
4. Include proper error handling and validation
5. Add appropriate comments and documentation
6. Consider integration with existing features

## Code Guidelines
- Write clean, maintainable code
- Follow best practices for the tech stack
- Include necessary imports and dependencies
- Handle edge cases appropriately
- Add tests if applicable

## Expected Output
Complete implementation of the task with all necessary files, components, and configurations.
"""
        
        return prompt.strip()
    
    async def _update_memory_from_conversation(self, message: str, response: str, project_id: str, project_context: dict) -> None:
        """Extract and save important decisions/information from conversation using consolidated memory system"""
        
        conversation = f"User: {message}\nAssistant: {response}"
        
        try:
            # Extract important decisions or information
            important_info = await self._extract_important_decisions(conversation, project_context)
            
            if important_info:
                for info in important_info:
                    # Detect category for the information
                    category = detect_memory_category(info['content'])
                    
                    # Add to consolidated memory for the category
                    result = self.consolidated_memory_service.add_information_to_consolidated_memory(
                        category.value,
                        project_id,
                        info['content'],
                        info['title']
                    )
                    
                    logger.info(f"Consolidated memory update: {result.get('message', 'No update')}")
                
        except Exception as e:
            logger.error(f"Error updating consolidated memory: {e}")

    async def _extract_important_decisions(self, conversation: str, project_context: dict) -> List[dict]:
        """Use AI to extract important decisions or technical information"""
        
        system_prompt = f"""
        Analyze this conversation and extract any important technical decisions, feature specifications, or architectural choices that should be remembered for this project.

        Project Context:
        - Project: {project_context.get('name', 'Unknown')}
        - Tech Stack: {project_context.get('tech_stack', 'Unknown')}

        Conversation:
        {conversation}

        Extract information that falls into these categories:
        1. "decision" - Technical decisions made (database choice, architecture, etc.)
        2. "context" - Important context or background information
        3. "note" - Important implementation notes, constraints, or specifications

        Return in this format if there's important information:
        MEMORY_ITEMS:
        [Title] | [Type] | [Content]

        Example:
        MEMORY_ITEMS:
        User Authentication Method | decision | Decided to use JWT tokens with email/password, including email verification
        Notification System | note | In-app notifications as top-right popups with sound alerts for task assignments

        If no important information to remember, return: NO_MEMORY_ITEMS
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(conversation, system_prompt)
            
            if "NO_MEMORY_ITEMS" in response:
                return []
            
            # Parse memory items
            memory_items = []
            lines = response.split('\n')
            
            for line in lines:
                if '|' in line and 'MEMORY_ITEMS:' not in line:
                    parts = [part.strip() for part in line.split('|')]
                    if len(parts) >= 3:
                        memory_items.append({
                            'title': parts[0],
                            'type': parts[1],
                            'content': parts[2]
                        })
            
            return memory_items
            
        except Exception as e:
            logger.error(f"Error extracting decisions: {e}")
            return []

    def _find_similar_memory(self, new_info: dict, existing_memories: List[Memory]) -> Optional[Memory]:
        """Find if similar memory already exists"""
        new_title_words = set(new_info['title'].lower().split())
        
        for memory in existing_memories:
            # Use the title field directly
            existing_words = set(memory.title.lower().split())
            
            # If 50% or more words overlap, consider it similar
            overlap = len(new_title_words.intersection(existing_words))
            total_unique_words = len(new_title_words.union(existing_words))
            
            if total_unique_words > 0 and overlap / total_unique_words >= 0.5:
                return memory
        
        return None

    def _find_similar_memory_for_consolidation(self, new_info: dict, existing_memories: List[Memory]) -> Optional[Memory]:
        """Find if new information should be merged with existing memory using higher similarity threshold"""
        new_title_words = set(new_info['title'].lower().split())
        new_content_words = set(new_info['content'].lower().split())
        
        for memory in existing_memories:
            # Check both title and content for similarity
            existing_title_words = set(memory.title.lower().split())
            existing_content_words = set(memory.content.lower().split())
            
            # Calculate similarity scores
            title_overlap = len(new_title_words.intersection(existing_title_words))
            content_overlap = len(new_content_words.intersection(existing_content_words))
            
            # Higher threshold for consolidation (70% similarity)
            title_similarity = title_overlap / len(new_title_words.union(existing_title_words)) if len(new_title_words.union(existing_title_words)) > 0 else 0
            content_similarity = content_overlap / len(new_content_words.union(existing_content_words)) if len(new_content_words.union(existing_content_words)) > 0 else 0
            
            # If either title or content is very similar, consolidate
            if title_similarity > 0.7 or content_similarity > 0.7:
                return memory
        
        return None

    async def _expand_memory(self, existing_memory: Memory, new_information: dict) -> Memory:
        """Expand existing memory with new information using LLM while maintaining category"""
        
        try:
            # Combine content for category detection
            combined_content = f"{existing_memory.content}\n\n{new_information['content']}"
            
            # Detect category from combined content
            category = detect_memory_category(combined_content)
            
            # Generate category-specific title
            title = await generate_category_specific_title(combined_content, category)
            
            # If title generation failed, use fallback
            if not title or len(title.strip()) < 3:
                title = self._generate_short_title(combined_content, 'memory', 40)
            
            # Create expansion prompt
            prompt = f"""
            Expand this existing memory with new information:
            
            EXISTING MEMORY:
            Title: {existing_memory.title}
            Content: {existing_memory.content}
            
            NEW INFORMATION:
            Title: {new_information['title']}
            Content: {new_information['content']}
            
            Create an updated memory that:
            - Combines both old and new information
            - Maintains chronological flow
            - Keeps important details
            - Has a concise, descriptive title (max 50 characters)
            - Content should be comprehensive but focused (max 500 words)
            
            Return in format:
            TITLE: [updated title]
            CONTENT: [updated content]
            """
            
            response = await self.gemini_service.chat_with_system_prompt("", prompt)
            
            # Parse response and update memory
            parsed_title = self._extract_title_from_response(response)
            content = self._extract_content_from_response(response)
            
            # Use generated title if LLM title is not good
            if not parsed_title or len(parsed_title.strip()) < 3:
                parsed_title = title
            
            # Update the existing memory
            existing_memory.title = parsed_title
            existing_memory.content = content
            existing_memory.category = category.value
            existing_memory.updated_at = datetime.now()
            
            return existing_memory
            
        except Exception as e:
            logger.error(f"Error expanding memory: {e}")
            # Fallback: simple concatenation with category update
            existing_memory.content = f"{existing_memory.content}\n\nUpdate: {new_information['content']}"
            existing_memory.category = detect_memory_category(existing_memory.content).value
            existing_memory.updated_at = datetime.now()
            return existing_memory

    async def _create_comprehensive_memory(self, information: dict, project_id: str) -> Optional[Memory]:
        """Create a comprehensive memory that captures broader context with proper categorization"""
        
        try:
            # Detect category from content
            category = detect_memory_category(information['content'])
            
            # Generate category-specific title
            title = await generate_category_specific_title(information['content'], category)
            
            # If title generation failed, use fallback
            if not title or len(title.strip()) < 3:
                title = self._generate_short_title(information['content'], 'memory', 40)
            
            # Only create if we have meaningful content
            if title and information['content'] and len(information['content'].strip()) > 10:
                return Memory(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    title=title,
                    content=information['content'],
                    category=category.value,
                    type=information['type'] if information['type'] in ['feature', 'decision', 'spec', 'note'] else 'note',
                    created_at=datetime.now()
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating comprehensive memory: {e}")
            return None

    def _extract_title_from_response(self, response: str) -> str:
        """Extract title from LLM response"""
        lines = response.split('\n')
        for line in lines:
            if line.strip().startswith('TITLE:'):
                return line.split('TITLE:', 1)[1].strip()
        return "Memory"

    def _extract_content_from_response(self, response: str) -> str:
        """Extract content from LLM response"""
        lines = response.split('\n')
        content_lines = []
        in_content = False
        
        for line in lines:
            if line.strip().startswith('CONTENT:'):
                in_content = True
                content_lines.append(line.split('CONTENT:', 1)[1].strip())
            elif in_content and line.strip():
                content_lines.append(line.strip())
            elif in_content and not line.strip():
                break
        
        return '\n'.join(content_lines) if content_lines else "Memory content"

    # Context Management Methods
    def _get_conversation_history_for_planning(self, project_id: str, session_id: str = None, max_messages: int = 10) -> List[Dict]:
        """Get recent conversation history for planning phase"""
        
        try:
            if session_id:
                # Get messages for specific session
                chat_history = self.file_service.load_chat_messages_by_session(project_id, session_id)
            else:
                # Get all messages (fallback for backward compatibility)
                chat_history = self.file_service.load_chat_history(project_id)
            
            if not chat_history:
                return []
            
            # Get recent messages (last N messages)
            recent_messages = chat_history[-max_messages:]
            
            # Convert to planning format
            planning_history = []
            for msg in recent_messages:
                # Determine role based on message content
                # If message is empty and response has content, it's an assistant message
                # If message has content, it's a user message
                if msg.message and not msg.response:
                    role = "user"
                    content = msg.message
                elif msg.response and not msg.message:
                    role = "assistant"
                    content = msg.response
                else:
                    # Fallback: assume user message if both are present
                    role = "user"
                    content = msg.message or msg.response
                
                planning_history.append({
                    "role": role,
                    "content": content,
                    "timestamp": msg.created_at.isoformat() if hasattr(msg, 'created_at') else None
                })
            
            return planning_history
            
        except Exception as e:
            logger.error(f"Error getting conversation history for planning: {e}")
            return []
    
    def _get_conversation_context(self, project_id: str, session_id: str = None, max_messages: int = 10) -> str:
        """Get recent conversation context with smart truncation"""
        
        try:
            if session_id:
                # Get messages for specific session
                chat_history = self.file_service.load_chat_messages_by_session(project_id, session_id)
            else:
                # Get all messages (fallback for backward compatibility)
                chat_history = self.file_service.load_chat_history(project_id)
            
            if not chat_history:
                return ""
            
            # Get recent messages (last N messages)
            recent_messages = chat_history[-max_messages:]
            
            # Format for context
            context_parts = []
            for msg in recent_messages:
                # Determine role and content
                if msg.message and not msg.response:
                    role_prefix = "User"
                    content = msg.message
                elif msg.response and not msg.message:
                    role_prefix = "Agent"
                    content = msg.response
                else:
                    # Fallback
                    role_prefix = "User"
                    content = msg.message or msg.response
                
                context_parts.append(f"{role_prefix}: {content}")
            
            context = "\n".join(context_parts)
            
            # If context is too long, create summary
            if len(context) > 2000:  # Roughly 500 tokens
                return self._create_context_summary(recent_messages, {})
            
            return context
            
        except Exception as e:
            logger.error(f"Error getting conversation context: {e}")
            return ""

    def _create_context_summary(self, messages: List[dict], project_context: dict) -> str:
        """Create a concise summary of conversation for context"""
        
        if len(messages) <= 3:
            # If few messages, return as-is
            formatted_messages = []
            for msg in messages:
                if msg.message and not msg.response:
                    formatted_messages.append(f"User: {msg.message}")
                elif msg.response and not msg.message:
                    formatted_messages.append(f"Agent: {msg.response}")
                else:
                    formatted_messages.append(f"User: {msg.message or msg.response}")
            return "\n".join(formatted_messages)
        
        # Extract key information
        user_messages = []
        agent_responses = []
        
        for msg in messages:
            if msg.message and not msg.response:
                user_messages.append(msg.message)
            elif msg.response and not msg.message:
                agent_responses.append(msg.response)
            else:
                # Fallback
                user_messages.append(msg.message or msg.response)
        
        # Create structured summary
        summary_parts = []
        
        # Last user message (always important)
        if user_messages:
            summary_parts.append(f"Latest request: {user_messages[-1]}")
        
        # Previous context (simplified)
        if len(user_messages) > 1:
            summary_parts.append(f"Previous requests: {', '.join(user_messages[-3:-1])}")
        
        # Any clarifications asked
        clarification_responses = [resp for resp in agent_responses if "?" in resp]
        if clarification_responses:
            summary_parts.append(f"Clarifications asked: {len(clarification_responses)} questions")
        
        return " | ".join(summary_parts)

    def _is_conversation_continuation(self, current_message: str, recent_context: str) -> bool:
        """Detect if current message is continuing previous conversation"""
        
        if not recent_context:
            return False
        
        # Check for continuation indicators
        continuation_indicators = [
            # Direct answers
            "yes", "no", "that's right", "exactly", "correct",
            # Clarifications
            "i mean", "actually", "specifically", "to clarify",
            # Short responses that need context
            len(current_message.split()) <= 5,
            # Pronouns referring to previous context
            any(word in current_message.lower() for word in ["it", "that", "this", "them", "those"])
        ]
        
        # Simple heuristic: if message is short or has continuation words
        if len(current_message.split()) <= 3:
            return True
        
        continuation_words = ["yes", "no", "that", "it", "specifically", "exactly", "actually"]
        if any(word in current_message.lower() for word in continuation_words):
            return True
        
        return False

    def _extract_accumulated_requirements(self, conversation_context: str, current_message: str) -> dict:
        """Extract accumulated requirements from conversation flow"""
        
        # Combine context and current message
        full_context = f"{conversation_context}\nUser: {current_message}"
        
        # Look for feature requirements that have been clarified
        requirements = {
            "feature_type": None,
            "specifications": [],
            "clarifications": [],
            "is_complete": False
        }
        
        # Simple extraction (could be enhanced with LLM)
        lines = full_context.split('\n')
        
        for line in lines:
            if line.startswith('User:'):
                user_msg = line[5:].strip()
                # Look for specific requirements
                if any(word in user_msg.lower() for word in ["with", "including", "using", "that"]):
                    requirements["specifications"].append(user_msg)
            
            if line.startswith('Agent:') and '?' in line:
                requirements["clarifications"].append(line[6:].strip())
        
        # Determine if enough info has been gathered
        if len(requirements["specifications"]) >= 2 or len(current_message.split()) > 10:
            requirements["is_complete"] = True
        
        return requirements

    async def _smart_context_analysis(self, message: str, conversation_context: str, project_context: dict) -> dict:
        """Analyze message with conversation context using LLM"""
        
        system_prompt = f"""
        You are analyzing a user message within an ongoing conversation context. 

        Conversation Context:
        {conversation_context}

        Current Message: "{message}"

        Project Context:
        - Project: {project_context.get('name', 'Unknown')}
        - Tech Stack: {project_context.get('tech_stack', 'Unknown')}

        Analyze the current message considering the conversation context and determine:

        1. INTENT: What does the user want?
           - feature_request_new: Starting a new feature request
           - feature_request_continuation: Providing more details for ongoing feature discussion
           - feature_request_complete: Completed clarification, ready for task breakdown
           - task_management: Managing existing tasks
           - question: Asking for help/explanation
           - general_chat: Casual conversation

        2. CONTEXT_STATUS: How much context do we have?
           - sufficient: Enough information to proceed with task creation
           - needs_clarification: Need more details before proceeding
           - continuing_clarification: User is providing requested clarification

        3. ACCUMULATED_INFO: What information has been gathered so far?

        Return in this format:
        INTENT: [intent_type]
        CONTEXT_STATUS: [status]
        ACCUMULATED_INFO: [summary of gathered requirements]
        READY_FOR_TASKS: [yes/no]
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            # Check if the response indicates an API error
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API returned error response in context analysis, using fallback")
                return {
                    "intent": "feature_request_continuation",
                    "context_status": "needs_clarification",
                    "accumulated_info": "User is providing clarification",
                    "ready_for_tasks": False
                }
            
            # Parse response
            analysis = {
                "intent": "general_chat",
                "context_status": "sufficient", 
                "accumulated_info": "",
                "ready_for_tasks": False
            }
            
            lines = response.split('\n')
            for line in lines:
                if line.startswith('INTENT:'):
                    analysis["intent"] = line.split(':', 1)[1].strip().lower()
                elif line.startswith('CONTEXT_STATUS:'): 
                    analysis["context_status"] = line.split(':', 1)[1].strip().lower()
                elif line.startswith('ACCUMULATED_INFO:'):
                    analysis["accumulated_info"] = line.split(':', 1)[1].strip()
                elif line.startswith('READY_FOR_TASKS:'):
                    ready = line.split(':', 1)[1].strip().lower()
                    analysis["ready_for_tasks"] = ready in ["yes", "true"]
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error in smart context analysis: {e}")
            return {
                "intent": "feature_request_continuation",
                "context_status": "needs_clarification",
                "accumulated_info": "User is providing clarification",
                "ready_for_tasks": False
            }

    # Memory & Task Retrieval Methods
    def _retrieve_relevant_memories(self, message: str, project_id: str) -> List[Memory]:
        """Retrieve memories relevant to the current message, prioritizing consolidated memories"""
        
        try:
            all_memories = self.file_service.load_memories(project_id)
            
            if not all_memories:
                return []
            
            # Prioritize consolidated memories
            consolidated_memories = [m for m in all_memories if m.id.endswith('_consolidated')]
            regular_memories = [m for m in all_memories if not m.id.endswith('_consolidated')]
            
            message_words = set(message.lower().split())
            relevant_memories = []
            
            # Check consolidated memories first (they contain more comprehensive information)
            for memory in consolidated_memories:
                memory_words = set((memory.title + " " + memory.content).lower().split())
                overlap = len(message_words.intersection(memory_words))
                
                if overlap > 0:
                    # Boost score for consolidated memories
                    relevant_memories.append((memory, overlap * 2))
            
            # Then check regular memories
            for memory in regular_memories:
                memory_words = set((memory.title + " " + memory.content).lower().split())
                overlap = len(message_words.intersection(memory_words))
                
                if overlap > 0:
                    relevant_memories.append((memory, overlap))
            
            # Sort by relevance and return top 3
            relevant_memories.sort(key=lambda x: x[1], reverse=True)
            return [memory for memory, score in relevant_memories[:3]]
            
        except Exception as e:
            logger.error(f"Error retrieving memories: {e}")
            return []

    def _retrieve_relevant_tasks(self, message: str, project_id: str) -> List[Task]:
        """Retrieve tasks relevant to the current message"""
        
        try:
            all_tasks = self.file_service.load_tasks(project_id)
            
            if not all_tasks:
                return []
            
            message_words = set(message.lower().split())
            relevant_tasks = []
            
            for task in all_tasks:
                # Check title and description for relevance
                task_words = set((task.title + " " + task.description).lower().split())
                
                # Calculate relevance score
                overlap = len(message_words.intersection(task_words))
                
                # Boost score for incomplete tasks (more relevant)
                if not task.completed:
                    overlap += 1
                
                if overlap > 0:
                    relevant_tasks.append((task, overlap))
            
            # Sort by relevance and return top 5
            relevant_tasks.sort(key=lambda x: x[1], reverse=True)
            return [task for task, score in relevant_tasks[:5]]
            
        except Exception as e:
            logger.error(f"Error retrieving tasks: {e}")
            return []

    async def _smart_content_search(self, query: str, content_items: List[str]) -> List[int]:
        """Use LLM to find semantically relevant content (enhanced version)"""
        
        if not content_items:
            return []
        
        # For now, use simple keyword matching
        # Could be enhanced with embeddings or LLM similarity
        query_words = set(query.lower().split())
        
        relevant_indices = []
        for i, content in enumerate(content_items):
            content_words = set(content.lower().split())
            overlap = len(query_words.intersection(content_words))
            
            if overlap > 0:
                relevant_indices.append((i, overlap))
        
        # Sort by relevance
        relevant_indices.sort(key=lambda x: x[1], reverse=True)
        return [i for i, score in relevant_indices[:3]]

    def _build_enhanced_context(self, message: str, project_id: str, project_context: dict) -> dict:
        """Build comprehensive context including memories and tasks"""
        
        # Get conversation context (from previous enhancement)
        conversation_context = self._get_conversation_context(project_id)
        
        # Retrieve relevant memories and tasks
        relevant_memories = self._retrieve_relevant_memories(message, project_id)
        relevant_tasks = self._retrieve_relevant_tasks(message, project_id)
        
        # Build enhanced context
        enhanced_context = {
            "project": project_context,
            "conversation": conversation_context,
            "relevant_memories": relevant_memories,
            "relevant_tasks": relevant_tasks,
            "memory_context": self._format_memory_context(relevant_memories),
            "task_context": self._format_task_context(relevant_tasks)
        }
        
        return enhanced_context

    def _format_memory_context(self, memories: List[Memory]) -> str:
        """Format memories for context inclusion"""
        
        if not memories:
            return "No relevant project memories found."
        
        memory_parts = []
        for memory in memories:
            memory_parts.append(f"[{memory.type}] {memory.title}: {memory.content}")
        
        return "Relevant Project Knowledge:\n" + "\n".join(memory_parts)

    def _format_task_context(self, tasks: List[Task]) -> str:
        """Format tasks for context inclusion"""
        
        if not tasks:
            return "No relevant tasks found."
        
        completed_tasks = [t for t in tasks if t.completed]
        pending_tasks = [t for t in tasks if not t.completed]
        
        context_parts = []
        
        if completed_tasks:
            completed_list = [f"✅ {task.title}" for task in completed_tasks]
            context_parts.append("Completed Tasks:\n" + "\n".join(completed_list))
        
        if pending_tasks:
            pending_list = [f"⏸️ {task.title}" for task in pending_tasks]
            context_parts.append("Pending Tasks:\n" + "\n".join(pending_list))
        
        return "\n\n".join(context_parts) if context_parts else "No relevant tasks found."

    async def get_related_memories_for_task(self, task_id: str, limit: int = 5) -> List[Memory]:
        """Get semantically related memories for a task using vector similarity"""
        try:
            # Get the task
            task = self.file_service.get_task_by_id_global(task_id)
            if not task:
                return []
            
            # Create search text from task
            search_text = f"{task.title} {task.description}"
            
            # Get all memories for the project
            project_memories = self.file_service.load_memories(task.project_id)
            
            # Calculate similarity scores using semantic search
            memory_scores = []
            for memory in project_memories:
                # Create memory text for comparison
                memory_text = f"{memory.title} {memory.content}"
                
                # Use simple text similarity for now (can be enhanced with embeddings)
                similarity = self._calculate_text_similarity(search_text, memory_text)
                memory_scores.append((memory, similarity))
            
            # Sort by similarity and return top results
            memory_scores.sort(key=lambda x: x[1], reverse=True)
            related_memories = [memory for memory, score in memory_scores[:limit] if score > 0.1]
            
            return related_memories
            
        except Exception as e:
            logger.error(f"Error getting related memories for task {task_id}: {e}")
            return []

    def _determine_response_type(self, response: str, original_message: str) -> str:
        """Determine the type of response based on content and original message"""
        
        response_lower = response.lower()
        message_lower = original_message.lower()
        
        # Check for specific response patterns
        if any(word in response_lower for word in ["step", "steps", "first", "then", "next"]):
            return "guided_help"
        
        if any(word in response_lower for word in ["could you", "can you", "what", "how", "?"]):
            return "clarification"
        
        if any(word in response_lower for word in ["solution", "fix", "problem", "issue"]):
            return "direct_solution"
        
        if any(word in message_lower for word in ["add", "create", "build", "implement"]):
            return "feature_breakdown"
        
        if any(word in message_lower for word in ["done", "complete", "finish", "delete"]):
            return "task_update"
        
        # Default to chat
        return "chat"
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity using simple word overlap"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0

    def generate_intelligent_prompt(self, task: Task, project: dict, related_memories: List[Memory]) -> str:
        """Generate a comprehensive prompt for AI coding tools using task + related memories"""
        try:
            # Build context from memories
            memory_context = ""
            if related_memories:
                memory_context = "\n## Related Context from Project Memory:\n"
                for i, memory in enumerate(related_memories, 1):
                    memory_context += f"\n### {i}. {memory.title} ({memory.type})\n"
                    memory_context += f"{memory.content}\n"
            
            # Generate comprehensive prompt
            prompt_template = f"""# Task: {task.title}

## Project Context
- **Project**: {project.get('name', 'Unknown Project')}
- **Task Priority**: {task.priority}
- **Task Status**: {task.status}
- **Created**: {task.created_at.strftime('%Y-%m-%d %H:%M') if hasattr(task, 'created_at') else 'Not specified'}

## Task Description
{task.description}

{memory_context}

## Technical Requirements
Based on the context above, please:

1. **Analyze the task requirements** and break down what needs to be implemented
2. **Consider the existing project context** and related decisions from the memory
3. **Implement the solution** following best practices and the patterns established in this project
4. **Include proper error handling** and validation
5. **Add appropriate comments** explaining key decisions
6. **Consider edge cases** and potential issues

## Additional Context
- Follow the existing code style and architecture patterns shown in the related memories
- Ensure the implementation integrates well with existing features
- Consider performance and scalability implications
- Include tests if applicable

Please provide a complete, production-ready implementation."""

            return prompt_template
            
        except Exception as e:
            logger.error(f"Error generating intelligent prompt: {e}")
            # Fallback to simple prompt
            return f"""# Task: {task.title}

## Task Description
{task.description}

Please implement this task following best practices and include proper error handling."""

    # ============================================================================
    # ENHANCED CONTEXT UNDERSTANDING AND TOOL CALLING METHODS
    # ============================================================================
    
    async def extract_conversation_context(self, conversation_history: List[Dict]) -> Dict:
        """
        Extract context from recent conversation for reference resolution
        """
        if not conversation_history:
            return {"referenced_items": [], "user_intent": "unknown", "context_clarity": "low"}
        
        # Get last 5 messages for context
        recent_messages = conversation_history[-5:]
        conversation_text = "\n".join([
            f"{msg.get('role', 'user')}: {msg.get('content', '')}" 
            for msg in recent_messages
        ])
        
        context_prompt = f"""
        Analyze this conversation to understand what the user is referring to:
        
        RECENT CONVERSATION:
        {conversation_text}
        
        When the user says "those", "these", or "them", what specific items are they referring to?
        What action do they want to take?
        
        Look for:
        1. Numbered lists (1. item, 2. item, etc.)
        2. Specific features or tasks mentioned
        3. User intent (create_tasks, create_memory, etc.)
        
        Return JSON:
        {{
            "referenced_items": ["item1", "item2", "item3"],
            "user_intent": "create_tasks|update_tasks|create_memory|general_question",
            "context_clarity": "high|medium|low"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                context_prompt, 
                "You are a context analysis assistant. Return only valid JSON."
            )
            return json.loads(response)
        except Exception as e:
            logger.error(f"Context extraction error: {e}")
            return {"referenced_items": [], "user_intent": "unknown", "context_clarity": "low"}
    
    def enhance_user_message_with_context(self, user_message: str, context_info: Dict) -> str:
        """
        Enhance user message with context information
        """
        if not context_info.get("referenced_items"):
            return user_message
        
        enhanced_message = f"""
        User message: {user_message}
        
        CONTEXT: When user says "those" or "these", they are referring to:
        {chr(10).join(f"- {item}" for item in context_info['referenced_items'])}
        
        User intent: {context_info.get('user_intent', 'unknown')}
        """
        
        return enhanced_message

    async def should_use_tools_enhanced(self, user_message: str, context_info: Dict) -> Dict:
        """
        Enhanced tool detection that considers context
        """
        # Combine original message with context
        enhanced_message = self.enhance_user_message_with_context(user_message, context_info)
        
        tool_detection_prompt = f"""
        Analyze this message and decide if tools should be used:
        
        {enhanced_message}
        
        AVAILABLE TOOLS:
        - create_task: Create new tasks
        - update_task: Modify existing tasks
        - change_task_status: Update task status  
        - create_memory: Store new memories
        - search_tasks: Find tasks
        - search_memories: Find memories
        
        EXAMPLES THAT NEED TOOLS:
        - "Create a task for implementing authentication" → create_task
        - "Can you create those tasks for me?" (with context showing specific tasks) → create_task (multiple)
        - "Mark the login task as completed" → change_task_status
        - "Add a memory about database choice" → create_memory
        
        EXAMPLES THAT DON'T NEED TOOLS:
        - "How do I implement authentication?" → No tools (just explanation)
        - "What's the best database?" → No tools (just advice)
        
        IMPORTANT: If user says "create those tasks" and context has referenced items, 
        use create_task tool for each referenced item.
        
        Return JSON:
        {{
            "requires_tools": true/false,
            "tool_calls": [
                {{
                    "tool": "create_task",
                    "parameters": {{"title": "Task Title", "description": "Task Description"}},
                    "reasoning": "User asked to create specific task"
                }}
            ],
            "confidence": 0.9
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                tool_detection_prompt,
                "You are a tool detection assistant. Return only valid JSON."
            )
            return json.loads(response)
        except Exception as e:
            logger.error(f"Tool detection error: {e}")
            return {"requires_tools": False, "tool_calls": []}

    async def execute_planned_tools(self, tool_calls: List[Dict], project_id: str, context_info: Dict) -> List[Dict]:
        """
        Execute tools based on planning with context awareness
        """
        results = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("tool")
            params = tool_call.get("parameters", {})
            
            try:
                if tool_name == "create_task":
                    # Handle context-based task creation
                    if context_info.get("user_intent") == "create_tasks" and context_info.get("referenced_items"):
                        # Create multiple tasks from context
                        for item in context_info["referenced_items"]:
                            result = await self.create_task_tool(
                                title=item,
                                description=f"Task from conversation: {item}",
                                project_id=project_id
                            )
                            results.append(result)
                    else:
                        # Single task creation
                        result = await self.create_task_tool(
                            title=params.get("title", "New Task"),
                            description=params.get("description", ""),
                            project_id=project_id
                        )
                        results.append(result)
                
                elif tool_name == "create_memory":
                    result = await self.create_memory_tool(
                        title=params.get("title", "New Memory"),
                        content=params.get("content", ""),
                        project_id=project_id
                    )
                    results.append(result)
                
                # Add other tool executions as needed
                
            except Exception as e:
                logger.error(f"Tool execution error for {tool_name}: {e}")
                results.append({
                    "tool": tool_name,
                    "success": False,
                    "error": str(e)
                })
        
        return results

    async def create_task_tool(self, title: str, description: str, project_id: str) -> Dict:
        """
        Tool execution for task creation
        """
        try:
            # Create task object
            task = Task(
                id=str(uuid.uuid4()),
                title=title,
                description=description,
                status="pending",
                priority="medium",
                project_id=project_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Save to file system using existing file service
            existing_tasks = self.file_service.load_tasks(project_id)
            existing_tasks.append(task)
            self.file_service.save_tasks(project_id, existing_tasks)
            
            return {
                "tool": "create_task",
                "success": True,
                "task_id": task.id,
                "title": title,
                "message": f"✅ Created task: {title}"
            }
        except Exception as e:
            return {
                "tool": "create_task", 
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to create task: {str(e)}"
            }

    async def create_memory_tool(self, title: str, content: str, project_id: str) -> Dict:
        """
        Tool execution for memory creation
        """
        try:
            # Create memory object
            memory = Memory(
                id=str(uuid.uuid4()),
                title=title,
                content=content,
                category=MemoryCategory.GENERAL,
                type="note",  # Add required type field
                project_id=project_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Save to file system using existing file service
            existing_memories = self.file_service.load_memories(project_id)
            existing_memories.append(memory)
            self.file_service.save_memories(project_id, existing_memories)
            
            return {
                "tool": "create_memory",
                "success": True,
                "memory_id": memory.id,
                "title": title,
                "message": f"💡 Created memory: {title}"
            }
        except Exception as e:
            return {
                "tool": "create_memory",
                "success": False, 
                "error": str(e),
                "message": f"❌ Failed to create memory: {str(e)}"
            }

    async def generate_response_with_tools(self, user_message: str, tool_results: List[Dict], context_info: Dict) -> str:
        """
        Generate response that incorporates tool execution results
        """
        successful_results = [r for r in tool_results if r.get("success", False)]
        
        if not successful_results:
            return "I attempted to help but encountered some issues. Please try again."
        
        # Generate contextual response
        response_prompt = f"""
        The user asked: "{user_message}"
        
        Context: {context_info.get('user_intent', 'unknown')}
        
        I executed these actions successfully:
        {json.dumps(successful_results, indent=2)}
        
        Generate a helpful response that:
        1. Confirms what actions were taken
        2. Shows the results
        3. Is conversational and friendly
        4. Uses appropriate emojis from the results
        
        Example: "✅ I've created 3 tasks for you: 1. Task A, 2. Task B, 3. Task C"
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                response_prompt,
                "You are a helpful assistant. Generate a friendly, concise response."
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Response generation error: {e}")
            return f"✅ I completed {len(successful_results)} action(s) for you."


# CLI Testing Interface
async def cli_test():
    """CLI interface for testing the AI agent"""
    print("🥷 Samurai Agent CLI Test Interface")
    print("Type 'exit' to quit, 'help' for commands")
    print("-" * 50)
    
    # Initialize agent
    agent = SamuraiAgent()
    
    # Create or load test project
    test_project = Project(
        id="test-project",
        name="Test Todo App",
        description="A test todo application for CLI testing",
        tech_stack="React + FastAPI + PostgreSQL",
        created_at=datetime.now()
    )
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    print(f"Project: {test_project.name}")
    print(f"Tech Stack: {test_project.tech_stack}")
    print("-" * 50)
    
    while True:
        try:
            user_input = input("\n💬 You: ").strip()
            
            if user_input.lower() == 'exit':
                print("👋 Goodbye!")
                break
            
            if user_input.lower() == 'help':
                print("""
Available commands:
- Ask about features: "I want to add user authentication"
- Manage tasks: "Login task is done", "Delete email verification task"  
- Ask questions: "How does JWT work?"
- General chat: "What should I work on next?"
- View tasks: "show tasks"
- View memories: "show memories"
- View context: "show context"
- View enhanced context: "show enhanced context"
- Clear all data: "clear all"
- Help: "help"
- Exit: "exit"
                """)
                continue
            
            if user_input.lower() == 'show tasks':
                tasks = agent.file_service.load_tasks(test_project.id)
                if tasks:
                    print(f"\n📋 Current Tasks ({len(tasks)}):")
                    for i, task in enumerate(tasks, 1):
                        status = "✅" if task.completed else "⏸️"
                        print(f"{status} {i}. {task.title}")
                else:
                    print("\n📋 No tasks yet. Try asking for a feature!")
                continue
            
            if user_input.lower() == 'show memories':
                memories = agent.file_service.load_memories(test_project.id)
                if memories:
                    print(f"\n🧠 Project Memories ({len(memories)}):")
                    for memory in memories:
                        print(f"• [{memory.type}] {memory.title}")
                        print(f"  {memory.content[:100]}...")
                else:
                    print("\n🧠 No memories yet. Have some conversations first!")
                continue
            
            if user_input.lower() == 'show context':
                context = agent._get_conversation_context(test_project.id)
                if context:
                    print(f"\n💬 Conversation Context:")
                    print(context)
                else:
                    print("\n💬 No conversation context yet. Start chatting!")
                continue
            
            if user_input.lower() == 'show enhanced context':
                enhanced_context = agent._build_enhanced_context("test message", test_project.id, project_context)
                print(f"\n🧠 Enhanced Context:")
                print(f"Memory Context: {enhanced_context['memory_context']}")
                print(f"Task Context: {enhanced_context['task_context']}")
                continue
            
            if user_input.lower() == 'clear all':
                # Clear test data
                agent.file_service.save_tasks(test_project.id, [])
                agent.file_service.save_memories(test_project.id, [])
                
                # Clear chat history file
                import os
                chat_file = f"data/project-{test_project.id}-chat.json"
                if os.path.exists(chat_file):
                    os.remove(chat_file)
                
                print("🗑️ Cleared all test data:")
                print("  ✅ Tasks cleared")
                print("  ✅ Memories cleared")
                print("  ✅ Chat history cleared")
                print("  🔄 Ready for fresh testing!")
                continue
            
            if not user_input:
                continue
            
            print("\n🤔 Thinking...")
            
            # Process message with agent
            result = await agent.process_message(
                user_input, 
                test_project.id, 
                project_context
            )
            
            # Save chat message for context
            from models import ChatMessage
            chat_message = ChatMessage(
                id=str(uuid.uuid4()),
                project_id=test_project.id,
                message=user_input,
                response="",
                created_at=datetime.now()
            )
            agent.file_service.save_chat_message(test_project.id, chat_message)
            
            # Save agent response
            if result and result.get("response"):
                agent_response = ChatMessage(
                    id=str(uuid.uuid4()),
                    project_id=test_project.id,
                    message="",
                    response=result["response"],
                    created_at=datetime.now()
                )
                agent.file_service.save_chat_message(test_project.id, agent_response)
            
            # Display response
            print(f"\n🥷 Samurai Agent: {result['response']}")
            
            # Show tasks if any were created
            if result.get('tasks'):
                print(f"\n📋 Created {len(result['tasks'])} new tasks:")
                for i, task in enumerate(result['tasks'], 1):
                    print(f"  {i}. {task.title}")
            
            # Show response type
            response_type = result.get('type', 'unknown')
            type_emoji = {
                'feature_breakdown': '🔧',
                'clarification': '❓', 
                'task_update': '✅',
                'chat': '💬',
                'error': '❌'
            }
            print(f"\n{type_emoji.get(response_type, '🤖')} Response Type: {response_type}")
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


# Main CLI execution
if __name__ == "__main__":
    print("Starting Samurai Agent CLI...")
    asyncio.run(cli_test())


# Main CLI execution
if __name__ == "__main__":
    print("Starting Samurai Agent CLI...")
    asyncio.run(cli_test()) 