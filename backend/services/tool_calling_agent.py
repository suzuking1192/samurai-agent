import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from .agent_tools import AgentToolRegistry
    from .agent_planning import SpecificationPlanningPhase, DevelopmentAgent
    from .gemini_service import GeminiService
    from models import Task, Memory, Project
    from services.intelligent_memory_manager import IntelligentMemoryManager
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from agent_tools import AgentToolRegistry
    from agent_planning import SpecificationPlanningPhase, DevelopmentAgent
    from gemini_service import GeminiService
    from models import Task, Memory, Project
    from services.intelligent_memory_manager import IntelligentMemoryManager

logger = logging.getLogger(__name__)


class ToolCallingSamuraiAgent:
    """
    Enhanced agent with tool calling capabilities and session state management
    """
    
    def __init__(self):
        self.tool_registry = AgentToolRegistry()
        self.gemini_service = GeminiService()
        self.pending_task_suggestions = {}  # Store by session/project_id
        self.memory_manager = IntelligentMemoryManager()  # Intelligent memory management
        
        # Validate tool registry is working
        self._validate_tool_registry()
    
    def _validate_tool_registry(self):
        """Ensure tool registry is properly initialized"""
        try:
            available_tools = self.tool_registry.get_tool_descriptions()
            required_tools = ["create_task", "create_memory", "search_tasks", "change_task_status"]
            
            for tool in required_tools:
                if tool not in available_tools:
                    logger.error(f"Required tool '{tool}' not found in registry")
                    raise Exception(f"Tool registry missing required tool: {tool}")
            
            logger.info(f"Tool registry validated with {len(available_tools)} tools")
        except Exception as e:
            logger.error(f"Tool registry validation failed: {e}")
            raise
    
    async def process_user_message(self, user_message: str, project_id: str, 
                                 conversation_history: List[Dict], 
                                 project_memories: List[Memory], 
                                 tasks: List[Task],
                                 project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simplified main processing flow with reliable task creation and intelligent memory management
        """
        try:
            # 1. Check for task confirmation FIRST
            if self._is_task_confirmation(user_message, conversation_history):
                return await self._handle_task_confirmation_with_stored_tasks(
                    user_message, project_id, conversation_history, project_memories, tasks, project_context
                )
            
            # 2. Create action plan
            plan = await self.create_action_plan(
                user_message, project_id, conversation_history, project_memories, tasks, project_context
            )
            
            logger.info(f"Action plan: {plan}")
            
            # 3. Intelligent Memory Analysis (NEW)
            memory_actions = await self._analyze_and_manage_memories(
                conversation_history, project_memories, project_id
            )
            
            # 4. Handle based on plan type
            if plan.get("action_type") == "task_suggestion":
                # Store suggestions and show to user
                logger.info("Handling task suggestion - storing suggestions and generating response")
                self.pending_task_suggestions[project_id] = plan.get("task_suggestions", {})
                response = self._generate_task_suggestion_response(plan)
                
                # Include memory actions in response if any
                if memory_actions:
                    response = self._integrate_memory_actions(response, memory_actions)
                
                return {
                    "response": response,
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "plan": plan
                }
            
            elif plan.get("action_type") == "clarification_request":
                # Handle clarification requests - don't store suggestions, just ask for clarification
                logger.info("Handling clarification request - asking user for more specific information")
                response = self._generate_task_suggestion_response(plan)
                
                # Include memory actions in response if any
                if memory_actions:
                    response = self._integrate_memory_actions(response, memory_actions)
                
                return {
                    "response": response,
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "plan": plan
                }
            
            elif plan.get("requires_tools", False):
                # Execute tools immediately (for non-task-creation actions)
                logger.info("Handling immediate tool execution")
                tool_results = await self._execute_tools(plan, project_id)
                response = await self._generate_tool_response(tool_results, plan, project_context)
                
                # Include memory actions in response if any
                if memory_actions:
                    response = self._integrate_memory_actions(response, memory_actions)
                
                return {
                    "response": response,
                    "tool_calls_made": len(tool_results),
                    "tool_results": tool_results,
                    "plan": plan
                }
            
            else:
                # Regular conversational response
                logger.info("Handling regular conversational response")
                response = await self._generate_conversational_response(user_message, plan, project_context)
                
                # Include memory actions in response if any
                if memory_actions:
                    response = self._integrate_memory_actions(response, memory_actions)
                
                return {
                    "response": response,
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "plan": plan
                }
                
        except Exception as e:
            logger.error(f"Error in process_user_message: {e}")
            return self._generate_error_response()
    
    async def create_action_plan(self, user_message: str, project_id: str,
                               conversation_history: List[Dict],
                               project_memories: List[Memory], 
                               tasks: List[Task],
                               project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine if the user's request requires tool usage with confirmation-based task creation
        """
        available_tools = self.tool_registry.get_tool_descriptions()
        
        # Convert objects to dicts for JSON serialization
        recent_tasks = []
        for task in tasks[:5]:
            recent_tasks.append({
                "title": task.title,
                "status": getattr(task, 'status', 'pending'),
                "priority": getattr(task, 'priority', 'medium'),
                "completed": task.completed
            })
        
        recent_memories = []
        for memory in project_memories[:5]:
            recent_memories.append({
                "title": memory.title,
                "category": memory.category
            })
        
        planning_prompt = f"""
        IMPORTANT: For task creation requests, SUGGEST tasks and ask for confirmation instead of immediately creating them.
        
        SAMURAI AGENT TASK CREATION PROTOCOL:
        - Extract the EXACT content the user wants as the task from conversation context
        - Use their words as the task title/description, don't genericize it
        - Confirm what you understood before creating
        - Preserve technical terminology and exact wording
        
        Analyze this user message and decide if it requires using tools to take action:
        
        USER MESSAGE: "{user_message}"
        
        CONVERSATION HISTORY (for context extraction):
        {json.dumps(conversation_history[-3:], indent=2)}
        
        AVAILABLE TOOLS:
        {available_tools}
        
        CURRENT PROJECT CONTEXT:
        Project: {project_context.get('name', 'Unknown')}
        Tech Stack: {project_context.get('tech_stack', 'Unknown')}
        Recent Tasks: {recent_tasks}
        Recent Memories: {recent_memories}
        
        Determine:
        1. Does this request require taking action (creating, updating, or searching tasks/memories)?
        2. Which specific tools should be used?
        3. What parameters are needed for each tool?
        
        For task creation requests:
        - Instead of immediately creating tasks, suggest them and ask for confirmation
        - Use the user's EXACT wording for task titles
        - Preserve technical terminology (e.g., "delete generate prompt button" not "remove button")
        - Ask for clarification if unclear: "Just to confirm, you want me to create a task titled '[exact wording]' - is that right?"
        
        CRITICAL: When user says "add this as a task" or similar, look at the conversation history to find what "this" refers to.
        - Extract the most recent user message that contains the actual task content
        - Use that exact content as the task title
        - Do NOT create the task immediately - suggest it and ask for confirmation
        
        Examples of requests that need tools:
        - "Add this as a task" → Extract exact content from context, suggest with user's wording
        - "Create a task for delete generate prompt button" → Suggest task titled "delete generate prompt button"
        - "Mark the login task as completed" → Execute immediately (no confirmation needed)
        - "Add a memory about our database decision" → Execute immediately
        - "Find all tasks related to frontend" → Execute immediately
        - "Update the API task description" → Execute immediately
        - "Delete the old authentication task" → Execute immediately
        - "Search for memories about database" → Execute immediately
        
        Examples that don't need tools:
        - "How do I implement authentication?"
        - "What's the best database for my project?"
        - "Explain how JWT works"
        - "What should I work on next?"
        
        Return JSON:
        {{
            "requires_tools": true/false,
            "reasoning": "explanation of why tools are/aren't needed",
            "action_type": "task_suggestion|immediate_execution|no_action",
            "tool_calls": [
                {{
                    "tool": "tool_name",
                    "parameters": {{"param1": "value1", "param2": "value2"}},
                    "reasoning": "why this tool call is needed"
                }}
            ],
            "task_suggestions": {{
                "suggested_tasks": [
                    {{
                        "title": "exact user wording for task title",
                        "description": "detailed implementation description",
                        "priority": "high|medium|low"
                    }}
                ],
                "confirmation_message": "Just to confirm, you want me to create a task titled '[exact wording]' - is that right?"
            }},
            "expected_outcome": "what the user should expect to happen"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                user_message, 
                planning_prompt
            )
            
            logger.info(f"LLM response for action plan: {response[:200]}...")
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in action planning, using fallback")
                return self._create_fallback_plan(user_message, conversation_history)
            
            # Parse JSON response
            try:
                parsed_response = json.loads(response)
                logger.info(f"Parsed LLM response: {json.dumps(parsed_response, indent=2)}")
                return parsed_response
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                logger.warning(f"Raw LLM response: {response}")
                return self._create_fallback_plan(user_message, conversation_history)
                
        except Exception as e:
            logger.error(f"Error in action planning: {e}")
            return self._create_fallback_plan(user_message, conversation_history)
    
    def _create_fallback_plan(self, user_message: str, conversation_history: List[Dict] = None) -> Dict[str, Any]:
        """
        Create fallback plan with exact user wording for task creation
        NEVER creates generic tasks - always asks for clarification if context extraction fails
        """
        message_lower = user_message.lower()
        
        # Check for task creation requests with exact user wording
        task_creation_indicators = [
            "add this as a task", "add as a task", "create a task for", "make this a task",
            "add task", "create task", "make task", "new task"
        ]
        
        if any(indicator in message_lower for indicator in task_creation_indicators):
            # Extract the exact content the user wants as a task
            # Use conversation history if available for better context extraction
            task_content = ""
            if conversation_history:
                # Try context extraction first
                task_content = self._extract_task_from_context(user_message, conversation_history)
                if not task_content:
                    # Fall back to exact wording extraction
                    task_content = self._extract_exact_user_wording(user_message, conversation_history)
            else:
                # Fall back to message-only extraction
                task_content = self._extract_task_content_from_message(user_message)
            
            # Validate that we have meaningful content
            if task_content and task_content.strip() and len(task_content.strip()) > 5:
                # Use their exact wording for the task
                suggested_tasks = [
                    {
                        "title": task_content,
                        "description": f"Task created from user request: {user_message}",
                        "priority": "medium"
                    }
                ]
                
                return {
                    "requires_tools": False,  # Don't immediately execute tools
                    "reasoning": "User wants to create a task with their exact wording",
                    "action_type": "task_suggestion",
                    "tool_calls": [],
                    "task_suggestions": {
                        "suggested_tasks": suggested_tasks,
                        "confirmation_message": f"Just to confirm, you want me to create a task titled '{task_content}' - is that right?"
                    },
                    "expected_outcome": "User will confirm the exact task they want created"
                }
            else:
                # If we can't extract meaningful content, ask for clarification
                # Look for potential context in conversation history
                potential_context = ""
                if conversation_history:
                    # Look for the most recent user message that might be the task content
                    for msg in reversed(conversation_history[-3:]):
                        if msg.get("role") == "user" and msg.get("content") != user_message:
                            content = msg.get("content", "").strip()
                            if content and not any(word in content.lower() for word in ["add", "create", "task", "make"]):
                                potential_context = content
                                break
                
                if potential_context:
                    clarification_message = f"I'd like to create a task for you, but I need clarification. You mentioned '{potential_context}' earlier. Should I create a task titled '{potential_context}'?"
                else:
                    clarification_message = "I'd like to create a task for you, but I need clarification. What specifically would you like me to create a task for?"
                
                return {
                    "requires_tools": False,
                    "reasoning": "User wants to create a task but context is unclear - asking for clarification",
                    "action_type": "clarification_request",
                    "tool_calls": [],
                    "task_suggestions": {
                        "suggested_tasks": [],
                        "confirmation_message": clarification_message
                    },
                    "expected_outcome": "User will provide specific task content or confirm the suggested task"
                }
        
        # Handle other types of requests (authentication, UI, API, etc.)
        if any(word in message_lower for word in ["create", "add", "make", "new"]) and any(word in message_lower for word in ["task", "todo"]):
            # Ask for clarification instead of creating generic tasks
            return {
                "requires_tools": False,
                "reasoning": "User wants to create tasks but hasn't specified what - asking for clarification",
                "action_type": "clarification_request",
                "tool_calls": [],
                "task_suggestions": {
                    "suggested_tasks": [],
                    "confirmation_message": "I'd like to help you create a task. What specifically would you like the task to be about?"
                },
                "expected_outcome": "User will provide specific task content"
            }
        
        elif any(word in message_lower for word in ["complete", "done", "finished", "mark"]) and any(word in message_lower for word in ["task", "todo"]):
            return {
                "requires_tools": True,
                "reasoning": "User wants to mark a task as completed",
                "action_type": "immediate_execution",
                "tool_calls": [
                    {
                        "tool": "change_task_status",
                        "parameters": {"task_identifier": "task", "new_status": "completed"},
                        "reasoning": "User requested task completion"
                    }
                ],
                "task_suggestions": {"suggested_tasks": []},
                "expected_outcome": "A task will be marked as completed"
            }
        
        elif any(word in message_lower for word in ["memory", "remember", "save"]) and any(word in message_lower for word in ["add", "create", "store"]):
            return {
                "requires_tools": True,
                "reasoning": "User wants to create a memory",
                "action_type": "immediate_execution",
                "tool_calls": [
                    {
                        "tool": "create_memory",
                        "parameters": {"title": "New Memory", "content": "Memory created from user request"},
                        "reasoning": "User requested memory creation"
                    }
                ],
                "task_suggestions": {"suggested_tasks": []},
                "expected_outcome": "A new memory will be created"
            }
        
        else:
            return {
                "requires_tools": False,
                "reasoning": "No specific action required",
                "action_type": "no_action",
                "tool_calls": [],
                "task_suggestions": {"suggested_tasks": []},
                "expected_outcome": "Provide helpful information or guidance"
            }

    def _extract_task_content_from_message(self, user_message: str) -> str:
        """
        Extract the exact content the user wants as a task from their message
        NEVER returns generic placeholders - returns empty string if context extraction is needed
        """
        message_lower = user_message.lower()
        
        # Common patterns for task creation requests
        patterns = [
            r"add this as a task",
            r"add as a task",
            r"create a task for (.+)",
            r"make this a task",
            r"add (.+) as a task",
            r"create task for (.+)",
            r"make (.+) a task"
        ]
        
        import re
        
        for pattern in patterns:
            match = re.search(pattern, message_lower)
            if match:
                if len(match.groups()) > 0:
                    # Extract the specific content they mentioned
                    content = match.group(1).strip()
                    # Convert back to original case from user message
                    original_content = self._find_original_case(user_message, content)
                    return original_content
                else:
                    # "this" refers to previous context - return empty string to force context extraction
                    return ""
        
        # If no pattern matches, check if this is a task creation request without specific content
        task_creation_words = ["add", "create", "make", "task", "new", "this", "as", "for", "can", "you", "a"]
        words = user_message.split()
        content_words = [word for word in words if word.lower() not in task_creation_words]
        
        # If most words are task creation words, return empty string
        if len(content_words) <= 2:
            return ""
        
        # If we have meaningful content, return it
        if content_words:
            return " ".join(content_words)
        
        return ""

    def _extract_task_from_context(self, user_message: str, conversation_history: List[Dict]) -> str:
        """Extract task content from conversation context"""
        
        # If user says "add this as a task", look for the "this" in recent context
        if any(phrase in user_message.lower() for phrase in ["add this", "make this", "create this"]):
            
            # Look through recent conversation for the subject they're referring to
            for msg in reversed(conversation_history[-5:]):  # Last 5 messages
                if msg.get("role") == "user":
                    content = msg.get("content", "").strip()
                    
                    # Skip the current message and task creation requests
                    if content != user_message and not any(word in content.lower() for word in ["add", "create", "task", "make"]):
                        
                        # Validate that the content is meaningful
                        if content and len(content.strip()) > 5:
                            # This is likely what they want as a task
                            return content
            
            # If no clear context found, return empty string to force clarification
            return ""
        
        return ""

    def _extract_exact_user_wording(self, user_message: str, conversation_history: List[Dict]) -> str:
        """Extract the exact content user wants as a task"""
        message_lower = user_message.lower()
        
        # Pattern: "Can you add this as a new task?" - "this" refers to previous message
        if "add this as" in message_lower or "make this a" in message_lower:
            # Look at the previous user message for context
            for msg in reversed(conversation_history[-3:]):
                if msg.get("role") == "user" and msg.get("content") != user_message:
                    prev_content = msg.get("content", "").strip()
                    if prev_content and not any(word in prev_content.lower() for word in ["add", "create", "task"]) and len(prev_content.strip()) > 5:
                        return prev_content
        
        # Pattern: "I want to delete generate prompt button" -> "Can you add this as a task?"
        # In this case, extract from current context or previous message
        
        # Pattern: Direct task content in message
        patterns = [
            r"add \"(.+)\" as a task",
            r"create a task for \"(.+)\"",
            r"make \"(.+)\" a task",
            r"add (.+) as a task",
            r"create task for (.+)"
        ]
        
        import re
        for pattern in patterns:
            match = re.search(pattern, user_message, re.IGNORECASE)
            if match:
                content = match.group(1).strip()
                if content and len(content) > 5:
                    return content
        
        return ""

    def _find_original_case(self, original_message: str, lowercase_content: str) -> str:
        """
        Find the original case of content in the user's message
        """
        # Simple approach: find the content in the original message
        original_lower = original_message.lower()
        start_idx = original_lower.find(lowercase_content)
        if start_idx != -1:
            end_idx = start_idx + len(lowercase_content)
            return original_message[start_idx:end_idx]
        
        return lowercase_content
    
    async def generate_response_with_tool_results(self, user_message: str, 
                                                plan: Dict[str, Any], 
                                                tool_results: List[Dict[str, Any]],
                                                project_context: Dict[str, Any]) -> str:
        """
        Generate final response incorporating tool execution results
        """
        if not tool_results:
            # No tools used, generate regular response
            return await self.generate_regular_response(user_message, plan, project_context)
        
        # Generate response that incorporates tool results
        response_prompt = f"""
        The user requested: "{user_message}"
        
        I planned to: {plan.get("reasoning", "")}
        Expected outcome: {plan.get("expected_outcome", "")}
        
        Tool execution results:
        {json.dumps(tool_results, indent=2)}
        
        Generate a helpful response that:
        1. Confirms what actions were taken
        2. Shows the results of those actions
        3. Provides any additional helpful information
        4. Offers follow-up assistance if appropriate
        
        Be conversational and helpful. Use emojis from the tool results.
        If any tools failed, acknowledge the issue and suggest alternatives.
        If all tools succeeded, be enthusiastic about the results.
        
        Keep the response concise but informative.
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Generate response with tool results", 
                response_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return self._generate_fallback_response_with_tools(tool_results, plan)
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response with tool results: {e}")
            return self._generate_fallback_response_with_tools(tool_results, plan)
    
    def _generate_fallback_response_with_tools(self, tool_results: List[Dict[str, Any]], 
                                            plan: Dict[str, Any]) -> str:
        """
        Generate fallback response when LLM fails
        """
        if not tool_results:
            return "I understand your request. Let me help you with that."
        
        # Build response from tool results
        response_parts = []
        
        for result in tool_results:
            if result.get("success", False):
                response_parts.append(result.get("message", "Action completed successfully."))
            else:
                response_parts.append(f"❌ {result.get('message', 'Action failed.')}")
        
        if response_parts:
            return " ".join(response_parts)
        else:
            return "I've processed your request. Let me know if you need anything else!"
    
    async def generate_regular_response(self, user_message: str, plan: Dict[str, Any],
                                      project_context: Dict[str, Any]) -> str:
        """
        Generate regular response when no tools are needed
        """
        response_prompt = f"""
        The user said: "{user_message}"
        
        This doesn't require any specific actions, so provide helpful information or guidance.
        
        Project Context:
        - Project: {project_context.get('name', 'Unknown')}
        - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
        
        Provide a helpful, informative response that:
        1. Addresses their question or concern
        2. Offers useful guidance or information
        3. Is conversational and friendly
        4. Suggests next steps if appropriate
        
        Keep the response concise but helpful.
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                user_message, 
                response_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return "I understand your request. Let me help you with that. Could you provide more specific details about what you need?"
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating regular response: {e}")
            return "I understand your request. Let me help you with that. Could you provide more specific details about what you need?"

    async def _handle_task_confirmation_with_stored_tasks(self, user_message: str, project_id: str, 
                                                        conversation_history: List[Dict], 
                                                        project_memories: List[Memory], 
                                                        tasks: List[Task], 
                                                        project_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle task confirmation using stored suggestions"""
        message_lower = user_message.lower().strip()
        
        # Check if user declined
        if any(word in message_lower for word in ["no", "nope", "not yet", "modify", "change"]):
            # Clear stored suggestions
            self.pending_task_suggestions.pop(project_id, None)
            return {
                "response": "No problem! What would you like to change about the task suggestions?",
                "tool_calls_made": 0,
                "tool_results": [],
                "plan": {"requires_tools": False}
            }
        
        # Get stored task suggestions for this specific project
        stored_suggestions = self.pending_task_suggestions.get(project_id, {})
        suggested_tasks = stored_suggestions.get("suggested_tasks", [])
        
        if not suggested_tasks:
            return {
                "response": "I don't have any pending task suggestions. Could you clarify what you'd like me to create?",
                "tool_calls_made": 0,
                "tool_results": [],
                "plan": {"requires_tools": False}
            }
        
        # Actually create the tasks
        tool_results = []
        for task in suggested_tasks:
            try:
                # Validate task title before creation - never create generic tasks
                task_title = task.get("title", "").strip()
                if not task_title or len(task_title) < 5 or any(generic_word in task_title.lower() for generic_word in ["untitled", "new task", "please specify", "task created from"]):
                    logger.warning(f"Rejecting generic task title: '{task_title}'")
                    tool_results.append({
                        "success": False, 
                        "message": f"❌ Cannot create task with generic title: '{task_title}'. Please provide a specific task title."
                    })
                    continue
                
                result = self.tool_registry.execute_tool(
                    "create_task",
                    title=task_title,
                    description=task.get("description", ""),
                    priority=task.get("priority", "medium"),
                    project_id=project_id
                )
                tool_results.append(result)
                logger.info(f"Created task: {result}")
            except Exception as e:
                logger.error(f"Error creating task: {e}")
                tool_results.append({"success": False, "message": f"Error: {str(e)}"})
        
        # Clear stored suggestions for this project
        self.pending_task_suggestions.pop(project_id, None)
        
        # Generate confirmation response
        response = self._generate_task_creation_confirmation(tool_results)
        
        return {
            "response": response,
            "tool_calls_made": len(tool_results),
            "tool_results": tool_results,
            "plan": {"requires_tools": True, "action_type": "task_creation"}
        }

    def _generate_task_suggestion_response(self, plan: Dict[str, Any]) -> str:
        """Generate response showing task suggestions or clarification requests"""
        task_suggestions = plan.get("task_suggestions", {})
        suggested_tasks = task_suggestions.get("suggested_tasks", [])
        action_type = plan.get("action_type", "task_suggestion")
        
        # Handle clarification requests
        if action_type == "clarification_request":
            confirmation_msg = task_suggestions.get("confirmation_message", "I need clarification about what task you'd like me to create.")
            return f"**{confirmation_msg}**\n\n💡 *Please provide the specific content for the task you want me to create.*"
        
        if not suggested_tasks:
            return "I understand your request. Let me help you with that."
        
        # Check if this is a single task with exact user wording
        if len(suggested_tasks) == 1:
            task = suggested_tasks[0]
            title = task.get("title", "").strip()
            
            # Validate that the title is meaningful and not generic
            if not title or len(title) < 5 or any(generic_word in title.lower() for generic_word in ["untitled", "new task", "please specify", "task created from"]):
                return "I'd like to create a task for you, but I need clarification. What specifically would you like the task to be about?"
            
            # If the title looks like exact user wording (not a generic task)
            if not any(generic_word in title.lower() for generic_word in ["setup", "implement", "create", "build", "add"]):
                response_parts = []
                response_parts.append("I can create a task with your exact wording:")
                response_parts.append(f"**Task Title:** \"{title}\"")
                
                description = task.get("description", "")
                if description and description != f"Task created from user request":
                    response_parts.append(f"**Description:** {description}")
                
                # Ask for confirmation with exact wording
                confirmation_msg = task_suggestions.get("confirmation_message", f"Just to confirm, you want me to create a task titled '{title}' - is that right?")
                response_parts.append(f"\n**{confirmation_msg}**")
                response_parts.append("💡 *Reply with 'yes' to create it, or ask me to modify it first.*")
                
                return "\n".join(response_parts)
        
        # Multiple tasks - validate each one
        valid_tasks = []
        for task in suggested_tasks:
            title = task.get("title", "").strip()
            if title and len(title) >= 5 and not any(generic_word in title.lower() for generic_word in ["untitled", "new task", "please specify", "task created from"]):
                valid_tasks.append(task)
        
        if not valid_tasks:
            return "I'd like to create tasks for you, but I need clarification. What specifically would you like the tasks to be about?"
        
        # Show each suggested task
        response_parts = []
        response_parts.append(f"I can break this down into {len(valid_tasks)} implementation tasks:\n")
        
        for i, task in enumerate(valid_tasks, 1):
            response_parts.append(f"**{i}. {task.get('title', 'Untitled Task')}**")
            description = task.get("description", "")
            # Show preview of description (first 100 chars)
            preview = description[:100] + "..." if len(description) > 100 else description
            response_parts.append(f"   {preview}")
            response_parts.append("")  # Empty line
        
        # Ask for confirmation
        confirmation_msg = task_suggestions.get("confirmation_message", "Would you like me to create these tasks for you?")
        response_parts.append(f"**{confirmation_msg}**")
        response_parts.append("💡 *Reply with 'yes' to create them, or ask me to modify them first.*")
        
        return "\n".join(response_parts)

    async def _execute_tools(self, plan: Dict[str, Any], project_id: str) -> List[Dict[str, Any]]:
        """Execute tools from the plan"""
        tool_results = []
        for tool_call in plan.get("tool_calls", []):
            logger.info(f"Executing tool: {tool_call['tool']} with params: {tool_call['parameters']}")
            
            try:
                result = self.tool_registry.execute_tool(
                    tool_call["tool"], 
                    project_id=project_id,
                    **tool_call["parameters"]
                )
                tool_results.append(result)
                logger.info(f"Tool result: {result}")
            except Exception as e:
                logger.error(f"Error executing tool {tool_call['tool']}: {e}")
                tool_results.append({"success": False, "message": f"Error: {str(e)}"})
        
        return tool_results

    async def _generate_tool_response(self, tool_results: List[Dict[str, Any]], plan: Dict[str, Any], project_context: Dict[str, Any]) -> str:
        """Generate response incorporating tool results"""
        if not tool_results:
            return await self._generate_conversational_response("", plan, project_context)
        
        # Generate response that incorporates tool results
        response_prompt = f"""
        The user requested: "{plan.get('reasoning', '')}"
        Expected outcome: {plan.get('expected_outcome', '')}
        
        Tool execution results:
        {json.dumps(tool_results, indent=2)}
        
        Generate a helpful response that:
        1. Confirms what actions were taken
        2. Shows the results of those actions
        3. Provides any additional helpful information
        4. Offers follow-up assistance if appropriate
        
        Be conversational and helpful. Use emojis from the tool results.
        If any tools failed, acknowledge the issue and suggest alternatives.
        If all tools succeeded, be enthusiastic about the results.
        
        Keep the response concise but informative.
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Generate response with tool results", 
                response_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return self._generate_fallback_response_with_tools(tool_results, plan)
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating tool response: {e}")
            return self._generate_fallback_response_with_tools(tool_results, plan)

    async def _generate_conversational_response(self, user_message: str, plan: Dict[str, Any], project_context: Dict[str, Any]) -> str:
        """Generate regular conversational response"""
        response_prompt = f"""
        The user said: "{user_message}"
        
        This doesn't require any specific actions, so provide helpful information or guidance.
        
        Project Context:
        - Project: {project_context.get('name', 'Unknown')}
        - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
        
        Provide a helpful, informative response that:
        1. Addresses their question or concern
        2. Offers useful guidance or information
        3. Is conversational and friendly
        4. Suggests next steps if appropriate
        
        Keep the response concise but helpful.
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                user_message, 
                response_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return "I understand your request. Let me help you with that. Could you provide more specific details about what you need?"
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating conversational response: {e}")
            return "I understand your request. Let me help you with that. Could you provide more specific details about what you need?"

    def _generate_error_response(self) -> Dict[str, Any]:
        """Generate error response when processing fails"""
        return {
            "response": "I encountered an issue processing your request. Could you try rephrasing it?",
            "tool_calls_made": 0,
            "tool_results": [],
            "plan": {"requires_tools": False}
        }

    def _is_task_confirmation(self, user_message: str, conversation_history: List[Dict]) -> bool:
        """
        Detect if user is responding to a task creation suggestion
        """
        message_lower = user_message.lower().strip()
        
        # Look for confirmation words
        confirmation_indicators = [
            "yes", "y", "yeah", "yep", "sure", "ok", "okay", 
            "create them", "go ahead", "do it", "make them", "add them"
        ]
        
        decline_indicators = [
            "no", "nope", "not yet", "modify", "change", "different"
        ]
        
        # Check if recent conversation included task suggestions
        recent_messages = conversation_history[-2:] if conversation_history else []
        has_task_suggestions = any(
            "Would you like me to create these tasks" in msg.get("content", "") or
            "Reply with 'yes' to create them" in msg.get("content", "") or
            "Just to confirm, you want me to create a task titled" in msg.get("content", "")
            for msg in recent_messages
        )
        
        # Also check if we have stored suggestions for this project
        # This is more reliable than parsing conversation history
        has_stored_suggestions = any(
            len(suggestions.get("suggested_tasks", [])) > 0 
            for suggestions in self.pending_task_suggestions.values()
        )
        
        is_confirmation = any(phrase in message_lower for phrase in confirmation_indicators)
        is_decline = any(phrase in message_lower for phrase in decline_indicators)
        
        # Return true if we have suggestions and user is confirming/declining
        return (has_task_suggestions or has_stored_suggestions) and (is_confirmation or is_decline)

    def _extract_suggested_tasks_from_history(self, conversation_history: List[Dict]) -> List[Dict]:
        """
        Extract the tasks that were previously suggested from conversation history
        """
        # Look through recent conversation for suggested tasks
        for msg in reversed(conversation_history[-3:]):
            content = msg.get("content", "")
            if "I can break this down into" in content and "implementation tasks" in content:
                # Parse the suggested tasks from the message
                tasks = []
                lines = content.split('\n')
                current_task = None
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('**') and '. ' in line and line.endswith('**'):
                        # Extract task title
                        title_part = line.replace('**', '')
                        if '. ' in title_part:
                            title = title_part.split('. ', 1)[1]
                            current_task = {
                                "title": title,
                                "description": "",
                                "priority": "medium"
                            }
                    elif current_task and line and not line.startswith('*'):
                        # This might be task description
                        current_task["description"] = line
                        tasks.append(current_task)
                        current_task = None
                
                return tasks
        
        return []

    def _generate_task_creation_confirmation(self, tool_results: List[Dict[str, Any]]) -> str:
        """
        Generate confirmation message after tasks are created following Samurai Agent protocol
        """
        successful_tasks = [result for result in tool_results if result.get("success", False)]
        failed_tasks = [result for result in tool_results if not result.get("success", False)]
        
        if not successful_tasks:
            if failed_tasks:
                return f"❌ I encountered issues creating the tasks: {'; '.join([task.get('message', 'Unknown error') for task in failed_tasks[:2]])}"
            else:
                return "❌ No tasks were created. Please try again."
        
        response_parts = []
        response_parts.append(f"Perfect! I've created a new task:")
        
        for task in successful_tasks:
            # Extract task details from the result
            task_message = task.get('message', 'Task created')
            
            # Try to extract title from the message
            if "Created task:" in task_message:
                title = task_message.split("Created task:")[1].strip().strip("'")
                response_parts.append(f"Title: \"{title}\"")
            elif "Created task" in task_message:
                # Extract title from different message formats
                title_match = task_message.split("Created task")[1].strip()
                if title_match.startswith("'") and title_match.endswith("'"):
                    title = title_match[1:-1]
                    response_parts.append(f"Title: \"{title}\"")
                else:
                    response_parts.append(f"Title: \"{title_match}\"")
            else:
                response_parts.append(f"Title: \"{task_message}\"")
            
            # Add description if available
            if 'description' in task:
                response_parts.append(f"Description: \"{task['description']}\"")
        
        response_parts.append("Status: ✅ Created!")
        
        if len(successful_tasks) > 1:
            response_parts.append(f"\n🎉 All {len(successful_tasks)} tasks are now in your project and ready for implementation!")
            response_parts.append("\n💡 *You can now work on these tasks individually or ask me to help enhance any specific task descriptions.*")
        
        if failed_tasks:
            response_parts.append(f"\n⚠️ Note: {len(failed_tasks)} tasks could not be created due to errors.")
        
        return "\n".join(response_parts)

    async def _analyze_and_manage_memories(self, conversation_history: List[Dict], project_memories: List[Memory], project_id: str) -> List[Dict]:
        """
        Analyze conversation for memory opportunities using intelligent memory manager
        """
        try:
            # Use intelligent memory manager to analyze conversation
            triggers = await self.memory_manager.analyze_conversation_for_memory_opportunities(
                conversation_history, project_memories, project_id
            )
            
            if not triggers:
                return []
            
            # Find consolidation opportunities
            consolidation_opportunities = await self.memory_manager.find_consolidation_opportunities(
                triggers, project_memories
            )
            
            memory_actions = []
            
            # Process consolidation opportunities
            for opportunity in consolidation_opportunities:
                try:
                    updated_memory = await self.memory_manager.consolidate_memory(opportunity, project_id)
                    memory_actions.append({
                        "action": "consolidated_memory",
                        "memory_title": updated_memory.title,
                        "consolidation_type": opportunity.consolidation_type,
                        "message": f"Updated '{updated_memory.title}' with new insights"
                    })
                    logger.info(f"Consolidated memory: {updated_memory.title}")
                except Exception as e:
                    logger.error(f"Error consolidating memory: {e}")
            
            # Create new memories for triggers without consolidation opportunities
            processed_triggers = {opp.new_content for opp in consolidation_opportunities}
            new_triggers = [t for t in triggers if t.content not in processed_triggers]
            
            for trigger in new_triggers:
                try:
                    new_memory = await self.memory_manager.create_new_memory(trigger, project_id)
                    memory_actions.append({
                        "action": "created_memory",
                        "memory_title": new_memory.title,
                        "category": trigger.category.value,
                        "message": f"Created new memory: '{new_memory.title}'"
                    })
                    logger.info(f"Created new memory: {new_memory.title}")
                except Exception as e:
                    logger.error(f"Error creating new memory: {e}")
            
            return memory_actions
            
        except Exception as e:
            logger.error(f"Error in intelligent memory analysis: {e}")
            return []

    def _integrate_memory_actions(self, response: str, memory_actions: List[Dict]) -> str:
        """
        Integrate memory consolidation actions into the response.
        """
        if not memory_actions:
            return response
        
        response_parts = response.split('\n')
        memory_action_parts = []
        
        for action in memory_actions:
            if action.get("action") == "consolidated_memory":
                memory_title = action.get("memory_title")
                consolidation_type = action.get("consolidation_type")
                message = action.get("message")
                
                if memory_title and consolidation_type and message:
                    memory_action_parts.append(f"🔄 Consolidated memory: \"{memory_title}\" ({consolidation_type}) - {message}")
                elif memory_title and consolidation_type:
                    memory_action_parts.append(f"🔄 Consolidated memory: \"{memory_title}\" ({consolidation_type})")
                elif memory_title:
                    memory_action_parts.append(f"🔄 Consolidated memory: \"{memory_title}\"")
                else:
                    memory_action_parts.append(f"🔄 Consolidated memory: (unknown memory consolidation)")
            elif action.get("action") == "created_memory":
                memory_title = action.get("memory_title")
                category = action.get("category")
                message = action.get("message")
                
                if memory_title and category and message:
                    memory_action_parts.append(f"✨ Created new memory: \"{memory_title}\" ({category}) - {message}")
                elif memory_title and category:
                    memory_action_parts.append(f"✨ Created new memory: \"{memory_title}\" ({category})")
                elif memory_title:
                    memory_action_parts.append(f"✨ Created new memory: \"{memory_title}\"")
                else:
                    memory_action_parts.append(f"✨ Created new memory: (unknown memory creation)")
            elif action.get("action") == "delete_memory":
                memory_title = action.get("memory_title")
                if memory_title:
                    memory_action_parts.append(f"🗑️ Deleted memory: \"{memory_title}\"")
                else:
                    memory_action_parts.append(f"🗑️ Deleted memory: (unknown memory title)")
        
        if memory_action_parts:
            response_parts.append("\n--- Memory Consolidation Actions ---")
            response_parts.extend(memory_action_parts)
            response_parts.append("-----------------------------------")
        
        return "\n".join(response_parts)


class EnhancedSamuraiAgent:
    """
    Enhanced SamuraiAgent that integrates tool calling capabilities
    """
    
    def __init__(self):
        self.tool_calling_agent = ToolCallingSamuraiAgent()
        self.file_service = None  # Will be initialized when needed
    
    async def process_message(self, message: str, project_id: str, project_context: dict) -> dict:
        """
        Enhanced message processing with tool calling capabilities
        """
        try:
            # Initialize file service if needed
            if not self.file_service:
                from .file_service import FileService
                self.file_service = FileService()
            
            # Get conversation context and project data
            conversation_history = self._get_conversation_history_for_planning(project_id)
            project_memories = self.file_service.load_memories(project_id)
            tasks = self.file_service.load_tasks(project_id)
            
            # Check for common issue patterns first (like response length issues)
            from .agent_planning import CommonIssuePatterns, ResponseLengthHandler
            issue_pattern = CommonIssuePatterns.detect_issue_type(message)
            
            if issue_pattern["confidence"] > 0.7 and issue_pattern["type"] == "response_length":
                # Handle response length issues directly
                response = await ResponseLengthHandler.handle_response_length_issue({
                    "message": message,
                    "history": conversation_history
                })
                
                # Update memory
                await self._update_memory_from_conversation(
                    message, response, project_id, project_context
                )
                
                return {
                    "type": "direct_solution",
                    "response": response,
                    "tasks": []
                }
            
            # Use tool calling agent for all other cases
            result = await self.tool_calling_agent.process_user_message(
                message, project_id, conversation_history, project_memories, tasks, project_context
            )
            
            # Determine response type based on content and tool usage
            response_type = self._determine_response_type(result["response"], message, result["tool_calls_made"])
            
            # Update memory with important information from this conversation
            await self._update_memory_from_conversation(
                message, result["response"], project_id, project_context
            )
            
            return {
                "type": response_type,
                "response": result["response"],
                "tasks": [],
                "tool_calls_made": result["tool_calls_made"],
                "tool_results": result["tool_results"]
            }
                
        except Exception as e:
            logger.error(f"Error in enhanced agent processing: {e}")
            return {
                "type": "error",
                "response": "I encountered an issue processing your request. Could you try rephrasing your question?",
                "tasks": []
            }
    
    def _get_conversation_history_for_planning(self, project_id: str, max_messages: int = 10) -> List[Dict]:
        """
        Get recent conversation history for planning phase
        """
        try:
            chat_history = self.file_service.load_chat_history(project_id)
            
            if not chat_history:
                return []
            
            # Get recent messages (last N messages)
            recent_messages = chat_history[-max_messages:]
            
            # Convert to planning format
            planning_history = []
            for msg in recent_messages:
                planning_history.append({
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.created_at.isoformat() if hasattr(msg, 'created_at') else None
                })
            
            return planning_history
            
        except Exception as e:
            logger.error(f"Error getting conversation history for planning: {e}")
            return []
    
    def _determine_response_type(self, response: str, original_message: str, tool_calls_made: int) -> str:
        """
        Determine the type of response based on content, original message, and tool usage
        """
        if tool_calls_made > 0:
            return "tool_action"
        
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
    
    async def _update_memory_from_conversation(self, message: str, response: str, project_id: str, project_context: dict) -> None:
        """
        Extract and save important decisions/information from conversation
        """
        try:
            # Only create memory if tools were used or important information was shared
            if "tool_action" in response or any(word in message.lower() for word in ["decision", "chose", "decided", "important", "remember"]):
                conversation = f"User: {message}\nAssistant: {response}"
                
                # Create memory about the action taken
                memory_title = f"Tool Action: {message[:50]}..."
                memory_content = f"User requested: {message}\n\nAction taken: {response}"
                
                memory = Memory(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    title=memory_title,
                    content=memory_content,
                    category="action",
                    type="action",
                    created_at=datetime.now()
                )
                
                # Load existing memories and add new one
                existing_memories = self.file_service.load_memories(project_id)
                existing_memories.append(memory)
                
                # Save updated memories
                self.file_service.save_memories(project_id, existing_memories)
                logger.info(f"Created action memory: {memory.title}")
                
        except Exception as e:
            logger.error(f"Error updating memory: {e}") 