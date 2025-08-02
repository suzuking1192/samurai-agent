import uuid
import re
from datetime import datetime
from typing import List, Dict, Optional
import logging
import asyncio
import sys

try:
    from .gemini_service import GeminiService
    from .file_service import FileService
    from models import Task, Memory, Project
except ImportError:
    # Fallback for when running the file directly
    import sys
    import os
    # Add parent directory to path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from file_service import FileService
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class SamuraiAgent:
    """Enhanced AI agent with intelligent decision-making, feature clarification, and task management"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.file_service = FileService()
    
    async def process_message(self, message: str, project_id: str, project_context: dict) -> dict:
        """Enhanced message processing with conversation context"""
        
        try:
            # Get conversation context
            conversation_context = self._get_conversation_context(project_id)
            
            # Determine if this is a continuation
            is_continuation = self._is_conversation_continuation(message, conversation_context)
            
            if is_continuation and conversation_context:
                # Use smart context analysis for continuation
                analysis = await self._smart_context_analysis(message, conversation_context, project_context)
                
                if analysis["ready_for_tasks"]:
                    # We have enough context, create tasks
                    combined_request = f"{analysis['accumulated_info']} {message}"
                    result = await self._handle_feature_request(combined_request, project_context, project_id)
                    
                    if result["type"] == "feature_breakdown" and result["tasks"]:
                        # Update prompts and save tasks
                        for task in result["tasks"]:
                            task.prompt = self._generate_cursor_prompt(
                                task.title, task.description, project_context
                            )
                        self.file_service.save_tasks(project_id, result["tasks"])
                    
                    # Update memory with important information from this conversation
                    if result and result.get("response"):
                        await self._update_memory_from_conversation(
                            message, result["response"], project_id, project_context
                        )
                    
                    return result
                
                elif analysis["context_status"] == "needs_clarification":
                    # Continue clarification process
                    result = await self._ask_clarifying_questions(message, project_context)
                    
                    # Update memory
                    if result and result.get("response"):
                        await self._update_memory_from_conversation(
                            message, result["response"], project_id, project_context
                        )
                    
                    return result
                
                else:
                    # Handle based on detected intent
                    if "task_management" in analysis["intent"]:
                        result = await self._handle_task_management(message, project_id)
                    else:
                        result = await self._handle_regular_chat(message, project_context, project_id)
                    
                    # Update memory
                    if result and result.get("response"):
                        await self._update_memory_from_conversation(
                            message, result["response"], project_id, project_context
                        )
                    
                    return result
            
            else:
                # New conversation or no context - use original logic
                intent = await self._analyze_intent(message)
                result = None
                
                if intent == "feature_request":
                    clarity = await self._evaluate_clarity(message, project_context)
                    
                    if clarity["clear"]:
                        result = await self._handle_feature_request(message, project_context, project_id)
                        if result["type"] == "feature_breakdown" and result["tasks"]:
                            for task in result["tasks"]:
                                task.prompt = self._generate_cursor_prompt(
                                    task.title, task.description, project_context
                                )
                            self.file_service.save_tasks(project_id, result["tasks"])
                        return result
                    else:
                        result = await self._ask_clarifying_questions(message, project_context)
                        return result
                
                elif intent == "task_management":
                    result = await self._handle_task_management(message, project_id)
                    return result
                
                else:
                    result = await self._handle_regular_chat(message, project_context, project_id)
                    return result
            
            # Update memory with important information from this conversation
            if result and result.get("response"):
                await self._update_memory_from_conversation(
                    message, 
                    result["response"], 
                    project_id, 
                    project_context
                )
            
            return result
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "type": "error",
                "response": "I encountered an error processing your message. Please try again.",
                "tasks": []
            }
    
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
        - "Add email/password authentication with user registration, login, logout, and password reset functionality"
        - "Create a todo list with add, edit, delete, mark complete, and filter by status"
        - "Implement real-time chat with message history, user typing indicators, and emoji support"

        TOO VAGUE examples (need more details):
        - "Add user authentication" (What type? What features?)
        - "Add notifications" (What triggers them? How displayed?)
        - "Make it real-time" (What specifically should be real-time?)
        - "Add search functionality" (Search what? How should results display?)

        Feature request: "{message}"

        Return only: CLEAR or VAGUE
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt.format(message=message))
            is_clear = "CLEAR" in response.upper()
            
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
            task_objects = self._create_task_objects(parsed_tasks)
            
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
        
        current_task = {}
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('TASK:'):
                # Save previous task if exists
                if current_task and 'title' in current_task:
                    tasks.append(current_task)
                
                # Start new task
                current_task = {
                    'title': line.replace('TASK:', '').strip(),
                    'description': '',
                    'priority': 'MEDIUM'
                }
            
            elif line.startswith('DESCRIPTION:'):
                if current_task:
                    current_task['description'] = line.replace('DESCRIPTION:', '').strip()
            
            elif line.startswith('PRIORITY:'):
                if current_task:
                    current_task['priority'] = line.replace('PRIORITY:', '').strip()
        
        # Add last task
        if current_task and 'title' in current_task:
            tasks.append(current_task)
        
        return tasks
    
    def _create_task_objects(self, parsed_tasks: List[dict]) -> List[Task]:
        """Create Task objects from parsed task data"""
        tasks = []
        
        for task_data in parsed_tasks:
            task = Task(
                id=str(uuid.uuid4()),
                title=task_data.get('title', 'Untitled Task'),
                description=task_data.get('description', ''),
                priority=task_data.get('priority', 'MEDIUM'),
                completed=False,
                created_at=datetime.now(),
                prompt=''  # Will be set later
            )
            tasks.append(task)
        
        return tasks
    
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
        """Extract and save important decisions/information from conversation"""
        
        conversation = f"User: {message}\nAssistant: {response}"
        
        try:
            # Extract important decisions or information
            important_info = await self._extract_important_decisions(conversation, project_context)
            
            if important_info:
                # Load existing memories
                existing_memories = self.file_service.load_memories(project_id)
                
                for info in important_info:
                    # Check if similar memory already exists
                    similar_memory = self._find_similar_memory(info, existing_memories)
                    
                    if similar_memory:
                        # Update existing memory
                        similar_memory.content = f"{similar_memory.content}\n\nUpdate: {info['content']}"
                        similar_memory.created_at = datetime.now()
                    else:
                        # Create new memory
                        memory = Memory(
                            id=str(uuid.uuid4()),
                            title=info['title'],
                            content=info['content'],
                            type=info['type'],
                            created_at=datetime.now()
                        )
                        existing_memories.append(memory)
                
                # Save updated memories
                self.file_service.save_memories(project_id, existing_memories)
                logger.info(f"Updated memories for project {project_id}")
                
        except Exception as e:
            logger.error(f"Error updating memory: {e}")

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
        1. "feature" - New features decided or specified
        2. "decision" - Technical decisions made (database choice, architecture, etc.)
        3. "spec" - Detailed specifications or requirements
        4. "note" - Important implementation notes or constraints

        Return in this format if there's important information:
        MEMORY_ITEMS:
        [Title] | [Type] | [Content]

        Example:
        MEMORY_ITEMS:
        User Authentication Method | decision | Decided to use JWT tokens with email/password, including email verification
        Notification System | feature | In-app notifications as top-right popups with sound alerts for task assignments

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
            existing_words = set(memory.title.lower().split())
            
            # If 50% or more words overlap, consider it similar
            overlap = len(new_title_words.intersection(existing_words))
            total_unique_words = len(new_title_words.union(existing_words))
            
            if total_unique_words > 0 and overlap / total_unique_words >= 0.5:
                return memory
        
        return None

    # Context Management Methods
    def _get_conversation_context(self, project_id: str, max_messages: int = 10) -> str:
        """Get recent conversation context with smart truncation"""
        
        try:
            chat_history = self.file_service.load_chat_history(project_id)
            
            if not chat_history:
                return ""
            
            # Get recent messages (last N messages)
            recent_messages = chat_history[-max_messages:]
            
            # Format for context
            context_parts = []
            for msg in recent_messages:
                role_prefix = "User" if msg.role == "user" else "Agent"
                context_parts.append(f"{role_prefix}: {msg.content}")
            
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
            return "\n".join([f"{msg.role}: {msg.content}" for msg in messages])
        
        # Extract key information
        user_messages = [msg.content for msg in messages if msg.role == "user"]
        agent_responses = [msg.content for msg in messages if msg.role == "assistant"]
        
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
        """Retrieve memories relevant to the current message"""
        
        try:
            all_memories = self.file_service.load_memories(project_id)
            
            if not all_memories:
                return []
            
            # Simple keyword matching for relevance
            message_words = set(message.lower().split())
            relevant_memories = []
            
            for memory in all_memories:
                # Check title and content for relevance
                memory_words = set((memory.title + " " + memory.content).lower().split())
                
                # Calculate relevance score
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
- Clear data: "clear all"
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
                print("🗑️ Cleared all test data")
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
                role="user",
                content=user_input,
                created_at=datetime.now()
            )
            agent.file_service.save_chat_message(test_project.id, chat_message)
            
            # Save agent response
            if result and result.get("response"):
                agent_response = ChatMessage(
                    id=str(uuid.uuid4()),
                    role="assistant", 
                    content=result["response"],
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