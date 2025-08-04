"""
Enhanced Contextual Agent with improved context understanding and tool calling.

This agent addresses the critical issues:
1. Missing Context Understanding: Agent doesn't understand references like "those tasks" from previous conversation
2. Broken Tool Calling: Agent explains instead of using create_task tool when explicitly asked
3. Generic Responses: Agent gives explanatory text instead of taking action
"""

import json
import logging
import uuid
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from .agent_tools import AgentToolRegistry
    from .gemini_service import GeminiService
    from .context_service import ContextSelectionService
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from agent_tools import AgentToolRegistry
    from gemini_service import GeminiService
    from context_service import ContextSelectionService
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class ContextUnderstandingService:
    """Service for extracting and understanding conversation context"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
    
    async def extract_conversation_context(self, conversation_history: List[Dict]) -> Dict:
        """
        Extract actionable context from recent conversation
        """
        if not conversation_history:
            return {
                "referenced_items": [], 
                "user_intent": "unknown", 
                "context_clarity": "low",
                "action_items": []
            }
        
        # Get last few messages for context (focus on recent conversation)
        recent_messages = conversation_history[-5:]
        conversation_text = "\n".join([
            f"{msg.get('role', 'unknown')}: {msg.get('content', '')}" 
            for msg in recent_messages
        ])
        
        context_prompt = f"""
        Analyze this conversation to understand references and context:
        
        CONVERSATION:
        {conversation_text}
        
        Focus on:
        1. What specific items were mentioned that user might reference?
        2. What does the user want to do with these items?
        3. Are there clear action items or tasks mentioned?
        4. When user says "those", "these", "them", what are they referring to?
        
        Extract specific items that were mentioned (tasks, features, components, etc.)
        and determine the user's intent.
        
        Return JSON:
        {{
            "referenced_items": ["specific item 1", "specific item 2"],
            "user_intent": "create_tasks|update_tasks|create_memory|general_question|clarification_needed",
            "context_clarity": "high|medium|low",
            "action_items": ["actionable item 1", "actionable item 2"],
            "confidence": 0.8
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(context_prompt, "You are a context analysis assistant. Return only valid JSON.")
            return json.loads(response)
        except Exception as e:
            logger.error(f"Context extraction error: {e}")
            return {
                "referenced_items": [], 
                "user_intent": "unknown", 
                "context_clarity": "low",
                "action_items": [],
                "confidence": 0.0
            }
    
    async def detect_tool_usage_intent(self, user_message: str, context_info: Dict) -> Dict:
        """
        Detect if user message requires tool usage with context awareness
        """
        available_tools = [
            "create_task - Create new tasks",
            "update_task - Modify existing tasks", 
            "change_task_status - Update task status",
            "create_memory - Store new memories",
            "search_tasks - Find specific tasks"
        ]
        
        # Enhance user message with context
        enhanced_message = user_message
        if context_info.get("referenced_items"):
            enhanced_message += f"\n\nContext: User is referring to: {', '.join(context_info['referenced_items'])}"
        
        detection_prompt = f"""
        Analyze this user message and determine if it requires using tools:
        
        USER MESSAGE: "{enhanced_message}"
        
        AVAILABLE TOOLS:
        {chr(10).join(available_tools)}
        
        Examples that need tools:
        - "Create a task to implement authentication" → create_task
        - "Mark the login task as completed" → change_task_status
        - "Add a memory about database choice" → create_memory
        - "Can you create those tasks?" (when context has tasks) → create_task for each referenced task
        
        Examples that don't need tools:
        - "How do I implement authentication?" → No tools needed
        - "What's the best database?" → No tools needed
        
        IMPORTANT: If user says "create those tasks" and context has referenced items, 
        use create_task tool for each referenced item.
        
        Return JSON:
        {{
            "requires_tools": true/false,
            "tool_calls": [
                {{
                    "tool": "tool_name",
                    "parameters": {{"param1": "value1"}},
                    "reasoning": "why this tool is needed"
                }}
            ],
            "confidence": 0.8
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(detection_prompt, "You are a tool detection assistant. Return only valid JSON.")
            return json.loads(response)
        except Exception as e:
            logger.error(f"Tool detection error: {e}")
            return {"requires_tools": False, "tool_calls": [], "confidence": 0.0}


class EnhancedContextualAgent:
    """
    Agent with improved context understanding and tool calling
    """
    
    def __init__(self):
        self.tool_registry = AgentToolRegistry()
        self.context_service = ContextUnderstandingService()
        self.gemini_service = GeminiService()
    
    async def process_message_with_context(self, user_message: str, conversation_history: List[Dict], 
                                         project_id: str, memories: List[Dict], tasks: List[Dict]) -> Dict:
        """
        Process message with enhanced context understanding and tool calling
        """
        try:
            # Step 1: Extract context from recent conversation
            context_info = await self.context_service.extract_conversation_context(conversation_history)
            logger.info(f"Context extracted: {context_info}")
            
            # Step 2: Create enhanced prompt with context
            enhanced_prompt = self.create_context_aware_prompt(user_message, context_info, memories, tasks)
            
            # Step 3: Detect tool usage with context
            tool_plan = await self.context_service.detect_tool_usage_intent(enhanced_prompt, context_info)
            logger.info(f"Tool plan: {tool_plan}")
            
            # Step 4: Execute tools if needed
            tool_results = []
            if tool_plan.get("requires_tools", False):
                tool_results = await self.execute_tools_with_context(
                    tool_plan['tool_calls'], context_info, project_id
                )
                logger.info(f"Tool results: {tool_results}")
            
            # Step 5: Generate contextual response
            response = await self.generate_contextual_response(
                user_message, context_info, tool_results
            )
            
            return {
                "response": response,
                "tool_results": tool_results,
                "context_used": context_info,
                "tool_calls_made": len(tool_results)
            }
            
        except Exception as e:
            logger.error(f"Context processing error: {e}")
            return {
                "response": f"I encountered an error processing your request: {str(e)}",
                "tool_results": [],
                "context_used": {},
                "tool_calls_made": 0
            }
    
    def create_context_aware_prompt(self, user_message: str, context_info: Dict, 
                                   memories: List[Dict], tasks: List[Dict]) -> str:
        """
        Create enhanced prompt with context information
        """
        context_section = ""
        if context_info.get("referenced_items"):
            context_section = f"""
CONVERSATION CONTEXT:
The user is referring to these items from our recent conversation:
{chr(10).join(f"- {item}" for item in context_info['referenced_items'])}

User intent appears to be: {context_info.get('user_intent', 'unknown')}
Context clarity: {context_info.get('context_clarity', 'low')}
"""
        
        enhanced_prompt = f"""
USER MESSAGE: {user_message}

{context_section}

CURRENT PROJECT STATE:
- Active tasks: {len(tasks)}
- Stored memories: {len(memories)}

INSTRUCTIONS:
- If the user is asking to create tasks and referenced specific items, use the create_task tool for each item
- If the user wants to update existing tasks, use appropriate task management tools
- If the user wants to create memories, use the create_memory tool
- Always take action when possible rather than asking for clarification
- When context is clear, execute tools immediately
"""
        
        return enhanced_prompt
    
    async def execute_tools_with_context(self, tool_calls: List[Dict], context_info: Dict, project_id: str) -> List[Dict]:
        """
        Execute tools based on context information
        """
        tool_results = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("tool")
            parameters = tool_call.get("parameters", {})
            
            try:
                if tool_name == "create_task":
                    # Handle task creation with context
                    if context_info.get("referenced_items"):
                        # Create tasks for each referenced item
                        for item in context_info["referenced_items"]:
                            result = await self.execute_create_task_tool(
                                title=item,
                                description=f"Task created from conversation context: {item}",
                                project_id=project_id
                            )
                            tool_results.append(result)
                    else:
                        # Use parameters from tool call
                        result = await self.execute_create_task_tool(
                            title=parameters.get("title", "New task"),
                            description=parameters.get("description", ""),
                            project_id=project_id
                        )
                        tool_results.append(result)
                
                elif tool_name == "create_memory":
                    # Handle memory creation
                    if context_info.get("referenced_items"):
                        # Create memory for referenced items
                        content = f"Context from conversation: {', '.join(context_info['referenced_items'])}"
                        result = await self.execute_create_memory_tool(
                            title=parameters.get("title", "Conversation context"),
                            content=content,
                            project_id=project_id
                        )
                        tool_results.append(result)
                    else:
                        # Use parameters from tool call
                        result = await self.execute_create_memory_tool(
                            title=parameters.get("title", "New memory"),
                            content=parameters.get("content", ""),
                            project_id=project_id
                        )
                        tool_results.append(result)
                
                elif tool_name == "change_task_status":
                    # Handle task status changes
                    result = await self.execute_change_task_status_tool(
                        task_id=parameters.get("task_id"),
                        new_status=parameters.get("new_status", "completed"),
                        project_id=project_id
                    )
                    tool_results.append(result)
                
                else:
                    # Try to execute through tool registry
                    result = self.tool_registry.execute_tool(
                        tool_name, 
                        project_id=project_id,
                        **parameters
                    )
                    tool_results.append(result)
                    
            except Exception as e:
                logger.error(f"Tool execution error for {tool_name}: {e}")
                tool_results.append({
                    "success": False,
                    "message": f"Error executing {tool_name}: {str(e)}"
                })
        
        return tool_results
    
    async def execute_create_task_tool(self, title: str, description: str, project_id: str) -> Dict:
        """
        Execute create task tool
        """
        try:
            # Use the actual tool registry
            result = self.tool_registry.execute_tool(
                "create_task",
                project_id=project_id,
                title=title,
                description=description
            )
            return result
        except Exception as e:
            logger.error(f"Create task error: {e}")
            return {
                "success": False,
                "message": f"Error creating task: {str(e)}"
            }
    
    async def execute_create_memory_tool(self, title: str, content: str, project_id: str) -> Dict:
        """
        Execute create memory tool
        """
        try:
            # Use the actual tool registry
            result = self.tool_registry.execute_tool(
                "create_memory",
                project_id=project_id,
                title=title,
                content=content
            )
            return result
        except Exception as e:
            logger.error(f"Create memory error: {e}")
            return {
                "success": False,
                "message": f"Error creating memory: {str(e)}"
            }
    
    async def execute_change_task_status_tool(self, task_id: str, new_status: str, project_id: str) -> Dict:
        """
        Execute change task status tool
        """
        try:
            # Use the actual tool registry
            result = self.tool_registry.execute_tool(
                "change_task_status",
                project_id=project_id,
                task_id=task_id,
                new_status=new_status
            )
            return result
        except Exception as e:
            logger.error(f"Change task status error: {e}")
            return {
                "success": False,
                "message": f"Error changing task status: {str(e)}"
            }
    
    async def generate_contextual_response(self, user_message: str, context_info: Dict, tool_results: List[Dict]) -> str:
        """
        Generate response incorporating tool results and context
        """
        if not tool_results:
            # No tools were executed
            if context_info.get("context_clarity") == "low":
                return "I couldn't determine what action to take. Could you be more specific about what you'd like me to do?"
            else:
                return "I understood your request but couldn't execute the necessary actions. Please try again."
        
        # Count successful operations
        successful_tasks = [r for r in tool_results if r.get("success") and "task" in str(r).lower()]
        successful_memories = [r for r in tool_results if r.get("success") and "memory" in str(r).lower()]
        
        response_parts = []
        
        if successful_tasks:
            response_parts.append(f"✅ I've created {len(successful_tasks)} tasks for you:")
            response_parts.append("")
            
            for i, result in enumerate(successful_tasks, 1):
                title = result.get("title", f"Task {i}")
                response_parts.append(f"{i}. {title}")
            
            response_parts.append("")
            response_parts.append("These tasks are now available in your task panel.")
        
        if successful_memories:
            response_parts.append(f"✅ I've created {len(successful_memories)} memories for you.")
            response_parts.append("")
            
            for i, result in enumerate(successful_memories, 1):
                title = result.get("title", f"Memory {i}")
                response_parts.append(f"{i}. {title}")
        
        # Handle failed operations
        failed_operations = [r for r in tool_results if not r.get("success")]
        if failed_operations:
            response_parts.append("")
            response_parts.append("⚠️ Some operations couldn't be completed. Please try again.")
        
        if not response_parts:
            response_parts.append("I attempted to take action but encountered some issues. Please try again.")
        
        return "\n".join(response_parts)


# Integration with existing agent system
class EnhancedSamuraiAgentWithContext:
    """
    Enhanced Samurai Agent that integrates context understanding with existing functionality
    """
    
    def __init__(self):
        self.contextual_agent = EnhancedContextualAgent()
        self.original_agent = None  # Will be set to existing agent instance
    
    def set_original_agent(self, original_agent):
        """Set the original agent for fallback functionality"""
        self.original_agent = original_agent
    
    async def process_message(self, message: str, project_id: str, project_context: dict) -> dict:
        """
        Process message with enhanced context understanding
        """
        try:
            # Get conversation history
            conversation_history = self._get_conversation_history_for_planning(project_id, max_messages=10)
            
            # Get project state
            memories = self._get_project_memories(project_id)
            tasks = self._get_project_tasks(project_id)
            
            # Use enhanced contextual agent
            result = await self.contextual_agent.process_message_with_context(
                user_message=message,
                conversation_history=conversation_history,
                project_id=project_id,
                memories=memories,
                tasks=tasks
            )
            
            # If no tools were used and we have an original agent, try fallback
            if result["tool_calls_made"] == 0 and self.original_agent:
                logger.info("No tools used, falling back to original agent")
                return await self.original_agent.process_message(message, project_id, project_context)
            
            return {
                "type": "response",
                "response": result["response"],
                "tool_calls_made": result["tool_calls_made"],
                "tool_results": result["tool_results"]
            }
            
        except Exception as e:
            logger.error(f"Enhanced agent error: {e}")
            # Fallback to original agent
            if self.original_agent:
                return await self.original_agent.process_message(message, project_id, project_context)
            else:
                return {
                    "type": "error",
                    "response": "I encountered an error processing your message. Please try again."
                }
    
    def _get_conversation_history_for_planning(self, project_id: str, max_messages: int = 10) -> List[Dict]:
        """Get recent conversation history for context"""
        # This would integrate with your existing conversation storage
        # For now, return empty list - implement based on your storage system
        return []
    
    def _get_project_memories(self, project_id: str) -> List[Dict]:
        """Get project memories"""
        # This would integrate with your existing memory storage
        # For now, return empty list - implement based on your storage system
        return []
    
    def _get_project_tasks(self, project_id: str) -> List[Dict]:
        """Get project tasks"""
        # This would integrate with your existing task storage
        # For now, return empty list - implement based on your storage system
        return [] 