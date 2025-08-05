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
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from agent_tools import AgentToolRegistry
    from agent_planning import SpecificationPlanningPhase, DevelopmentAgent
    from gemini_service import GeminiService
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class ToolCallingSamuraiAgent:
    """
    Enhanced agent with tool calling capabilities
    """
    
    def __init__(self):
        self.tool_registry = AgentToolRegistry()
        self.gemini_service = GeminiService()
        self.planning_phase = None
    
    async def process_user_message(self, user_message: str, project_id: str, 
                                 conversation_history: List[Dict], 
                                 project_memories: List[Memory], 
                                 tasks: List[Task],
                                 project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process user message with tool calling capability
        """
        try:
            # Phase 1: Planning (determine if tools are needed)
            plan = await self.create_action_plan(
                user_message, project_id, conversation_history, project_memories, tasks, project_context
            )
            
            logger.info(f"Action plan: {plan}")
            
            # Phase 2: Tool execution (if needed)
            tool_results = []
            if plan.get("requires_tools", False):
                for tool_call in plan.get("tool_calls", []):
                    logger.info(f"Executing tool: {tool_call['tool']} with params: {tool_call['parameters']}")
                    
                    result = self.tool_registry.execute_tool(
                        tool_call["tool"], 
                        project_id=project_id,
                        **tool_call["parameters"]
                    )
                    tool_results.append(result)
                    logger.info(f"Tool result: {result}")
            
            # Phase 3: Generate response incorporating tool results
            response = await self.generate_response_with_tool_results(
                user_message, plan, tool_results, project_context
            )
            
            return {
                "response": response,
                "tool_calls_made": len(tool_results),
                "tool_results": tool_results,
                "plan": plan
            }
            
        except Exception as e:
            logger.error(f"Error in tool calling agent: {e}")
            return {
                "response": "I encountered an issue processing your request. Could you try rephrasing it?",
                "tool_calls_made": 0,
                "tool_results": [],
                "plan": {"requires_tools": False}
            }
    
    async def create_action_plan(self, user_message: str, project_id: str,
                               conversation_history: List[Dict],
                               project_memories: List[Memory], 
                               tasks: List[Task],
                               project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine if the user's request requires tool usage
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
        Analyze this user message and decide if it requires using tools to take action:
        
        USER MESSAGE: "{user_message}"
        
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
        
        Examples of requests that need tools:
        - "Create a task to implement user authentication"
        - "Mark the login task as completed" 
        - "Add a memory about our database decision"
        - "Find all tasks related to frontend"
        - "Update the API task description"
        - "Delete the old authentication task"
        - "Search for memories about database"
        
        Examples that don't need tools:
        - "How do I implement authentication?"
        - "What's the best database for my project?"
        - "Explain how JWT works"
        - "What should I work on next?"
        
        Return JSON:
        {{
            "requires_tools": true/false,
            "reasoning": "explanation of why tools are/aren't needed",
            "tool_calls": [
                {{
                    "tool": "tool_name",
                    "parameters": {{"param1": "value1", "param2": "value2"}},
                    "reasoning": "why this tool call is needed"
                }}
            ],
            "expected_outcome": "what the user should expect to happen"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                user_message, 
                planning_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in action planning, using fallback")
                return self._create_fallback_plan(user_message)
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_plan(user_message)
                
        except Exception as e:
            logger.error(f"Error in action planning: {e}")
            return self._create_fallback_plan(user_message)
    
    def _create_fallback_plan(self, user_message: str) -> Dict[str, Any]:
        """
        Create fallback plan when LLM fails
        """
        message_lower = user_message.lower()
        
        # Simple keyword-based fallback
        if any(word in message_lower for word in ["create", "add", "make", "new"]) and any(word in message_lower for word in ["task", "todo"]):
            return {
                "requires_tools": True,
                "reasoning": "User wants to create a task",
                "tool_calls": [
                    {
                        "tool": "create_task",
                        "parameters": {"title": "New Task", "description": "Task created from user request"},
                        "reasoning": "User requested task creation"
                    }
                ],
                "expected_outcome": "A new task will be created"
            }
        
        elif any(word in message_lower for word in ["complete", "done", "finished", "mark"]) and any(word in message_lower for word in ["task", "todo"]):
            return {
                "requires_tools": True,
                "reasoning": "User wants to mark a task as completed",
                "tool_calls": [
                    {
                        "tool": "change_task_status",
                        "parameters": {"task_identifier": "task", "new_status": "completed"},
                        "reasoning": "User requested task completion"
                    }
                ],
                "expected_outcome": "A task will be marked as completed"
            }
        
        elif any(word in message_lower for word in ["memory", "remember", "save"]) and any(word in message_lower for word in ["add", "create", "store"]):
            return {
                "requires_tools": True,
                "reasoning": "User wants to create a memory",
                "tool_calls": [
                    {
                        "tool": "create_memory",
                        "parameters": {"title": "New Memory", "content": "Memory created from user request"},
                        "reasoning": "User requested memory creation"
                    }
                ],
                "expected_outcome": "A new memory will be created"
            }
        
        else:
            return {
                "requires_tools": False,
                "reasoning": "No specific action required",
                "tool_calls": [],
                "expected_outcome": "Provide helpful information or guidance"
            }
    
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


class EnhancedSamuraiAgent:
    """
    Enhanced SamuraiAgent that integrates tool calling capabilities
    """
    
    def __init__(self):
        self.tool_calling_agent = ToolCallingSamuraiAgent()
        self.intelligent_agent = IntelligentAgent()
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