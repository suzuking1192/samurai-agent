import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from .progress_tracker import ProgressTracker, PlanningStep
from .tool_calling_agent import EnhancedSamuraiAgent
from .agent_tools import AgentToolRegistry
from .gemini_service import GeminiService
from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class TransparentPlanningAgent:
    """
    Enhanced agent that provides real-time transparency into its planning and execution process
    """
    
    def __init__(self, progress_tracker: ProgressTracker):
        self.progress = progress_tracker
        self.tool_registry = AgentToolRegistry()
        self.gemini_service = GeminiService()
        self.enhanced_agent = EnhancedSamuraiAgent()
    
    async def process_user_message_with_progress(self, user_message: str, project_id: str,
                                               conversation_history: List[Dict],
                                               project_memories: List[Dict],
                                               tasks: List[Dict],
                                               project_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process user message with detailed progress tracking
        """
        try:
            # Step 1: Analyze Request
            await self.progress.update_progress(
                PlanningStep.ANALYZING_REQUEST,
                "🧠 Analyzing your request...",
                {"input_length": len(user_message)}
            )
            
            request_analysis = await self.analyze_user_request(user_message)
            
            # Step 2: Detect Intent
            await self.progress.update_progress(
                PlanningStep.DETECTING_INTENT,
                f"🎯 Detected intent: {request_analysis['intent']}",
                {"intent": request_analysis['intent'], "confidence": request_analysis['confidence']}
            )
            
            # Step 3: Gather Context
            await self.progress.update_progress(
                PlanningStep.GATHERING_CONTEXT,
                "📚 Gathering relevant context...",
                {"memories": len(project_memories), "tasks": len(tasks)}
            )
            
            relevant_context = await self.gather_relevant_context(
                request_analysis, project_memories, tasks
            )
            
            # Step 4: Plan Actions
            await self.progress.update_progress(
                PlanningStep.PLANNING_ACTIONS,
                "📋 Planning required actions...",
                {"context_items": len(relevant_context)}
            )
            
            action_plan = await self.create_detailed_action_plan(
                user_message, request_analysis, relevant_context, project_id, project_context
            )
            
            if action_plan.get("requires_tools", False):
                tool_count = len(action_plan.get("tool_calls", []))
                tool_names = [tc['tool'] for tc in action_plan['tool_calls']]
                await self.progress.update_progress(
                    PlanningStep.PLANNING_ACTIONS,
                    f"🛠️ Planning {tool_count} action(s): {', '.join(tool_names)}",
                    {"tool_count": tool_count, "tools": tool_names}
                )
            
            # Step 5: Execute Tools (if needed)
            tool_results = []
            if action_plan.get("requires_tools", False):
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    "⚙️ Executing planned actions...",
                    {"tools_to_execute": len(action_plan['tool_calls'])}
                )
                
                tool_results = await self.execute_tools_with_progress(
                    action_plan['tool_calls'], project_id
                )
            
            # Step 6: Generate Response
            await self.progress.update_progress(
                PlanningStep.GENERATING_RESPONSE,
                "💬 Generating response...",
                {"tool_results": len(tool_results)}
            )
            
            response = await self.generate_final_response(
                user_message, action_plan, tool_results, relevant_context, project_context
            )
            
            # Step 7: Complete
            await self.progress.update_progress(
                PlanningStep.COMPLETE,
                "✅ Response ready!",
                {"response_length": len(response), "actions_taken": len(tool_results)}
            )
            
            return {
                "response": response,
                "tool_results": tool_results,
                "progress_summary": self.progress.get_progress_summary(),
                "action_plan": action_plan
            }
            
        except Exception as e:
            await self.progress.update_progress(
                PlanningStep.ERROR,
                f"❌ Error: {str(e)}",
                {"error": str(e)}
            )
            raise e
    
    async def analyze_user_request(self, user_message: str) -> Dict[str, Any]:
        """Analyze the user's request to understand intent and requirements"""
        
        system_prompt = """
        Analyze this user request and determine:
        1. The primary intent (feature_request, task_management, question, general_chat)
        2. Confidence level (0-1)
        3. Key requirements or specifications mentioned
        4. Whether tools will likely be needed
        
        User request: "{message}"
        
        Return in JSON format:
        {{
            "intent": "feature_request|task_management|question|general_chat",
            "confidence": 0.85,
            "requirements": ["user auth", "login form"],
            "needs_tools": true,
            "analysis": "User wants to add user authentication with login functionality"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                user_message, 
                system_prompt.format(message=user_message)
            )
            
            # Parse JSON response - handle potential formatting issues
            import json
            import re
            
            # Clean up the response to extract JSON
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                analysis = json.loads(json_str)
            else:
                # Fallback: try to parse the entire response
                analysis = json.loads(response)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing user request: {e}")
            # Fallback analysis
            return {
                "intent": "general_chat",
                "confidence": 0.5,
                "requirements": [],
                "needs_tools": False,
                "analysis": "Could not analyze request"
            }
    
    async def gather_relevant_context(self, request_analysis: Dict, 
                                    project_memories: List[Dict], 
                                    tasks: List[Dict]) -> List[Dict]:
        """Gather relevant context based on the request analysis"""
        
        relevant_context = []
        
        # Search for relevant memories
        if project_memories:
            search_terms = request_analysis.get("requirements", [])
            for memory in project_memories:
                memory_text = f"{memory.get('title', '')} {memory.get('content', '')}"
                if any(term.lower() in memory_text.lower() for term in search_terms):
                    relevant_context.append({
                        "type": "memory",
                        "content": memory,
                        "relevance": "high"
                    })
        
        # Search for relevant tasks
        if tasks:
            search_terms = request_analysis.get("requirements", [])
            for task in tasks:
                task_text = f"{task.get('title', '')} {task.get('description', '')}"
                if any(term.lower() in task_text.lower() for term in search_terms):
                    relevant_context.append({
                        "type": "task",
                        "content": task,
                        "relevance": "high"
                    })
        
        return relevant_context
    
    async def create_detailed_action_plan(self, user_message: str, 
                                        request_analysis: Dict,
                                        relevant_context: List[Dict],
                                        project_id: str,
                                        project_context: Dict[str, Any]) -> Dict[str, Any]:
        """Create a detailed action plan with tool calls if needed"""
        
        # Use the tool calling agent's planning capabilities
        try:
            plan = await self.enhanced_agent.tool_calling_agent.create_action_plan(
                user_message, project_id, [], [], [], project_context
            )
            return plan
        except Exception as e:
            logger.error(f"Error creating action plan: {e}")
            return {
                "requires_tools": False,
                "tool_calls": [],
                "plan_type": "fallback"
            }
    
    async def execute_tools_with_progress(self, tool_calls: List[Dict], project_id: str) -> List[Dict]:
        """
        Execute tools with individual progress updates
        """
        results = []
        
        for i, tool_call in enumerate(tool_calls, 1):
            tool_name = tool_call['tool']
            tool_params = tool_call['parameters']
            
            # Update progress for each tool
            await self.progress.update_progress(
                PlanningStep.EXECUTING_TOOLS,
                f"🔧 Executing {tool_name} ({i}/{len(tool_calls)})...",
                {"tool": tool_name, "step": i, "total": len(tool_calls)}
            )
            
            # Special progress messages for different tools
            if tool_name == "search_tasks":
                await self.progress.update_progress(
                    PlanningStep.SEARCHING_DATA,
                    f"🔍 Searching for tasks matching '{tool_params.get('query', '')}'...",
                    {"search_query": tool_params.get('query', '')}
                )
            elif tool_name == "create_task":
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    f"📝 Creating task: '{tool_params.get('title', '')}'...",
                    {"task_title": tool_params.get('title', '')}
                )
            elif tool_name == "change_task_status":
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    f"✏️ Updating task status to '{tool_params.get('new_status', '')}'...",
                    {"new_status": tool_params.get('new_status', '')}
                )
            elif tool_name == "create_memory":
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    f"💡 Saving memory: '{tool_params.get('title', '')}'...",
                    {"memory_title": tool_params.get('title', '')}
                )
            
            # Execute the tool
            result = self.tool_registry.execute_tool(
                tool_name,
                project_id=project_id,
                **tool_params
            )
            
            results.append({
                "tool": tool_name,
                "parameters": tool_params,
                "result": result
            })
            
            # Show result
            if result.get("success"):
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    f"✅ {result.get('message', 'Action completed')}",
                    {"tool": tool_name, "success": True}
                )
            else:
                await self.progress.update_progress(
                    PlanningStep.EXECUTING_TOOLS,
                    f"❌ {result.get('message', 'Action failed')}",
                    {"tool": tool_name, "success": False, "error": result.get('error')}
                )
        
        return results
    
    async def generate_final_response(self, user_message: str, 
                                   action_plan: Dict[str, Any],
                                   tool_results: List[Dict],
                                   relevant_context: List[Dict],
                                   project_context: Dict[str, Any]) -> str:
        """Generate the final response incorporating all results"""
        
        try:
            # Use the tool calling agent's response generation
            response = await self.enhanced_agent.tool_calling_agent.generate_response_with_tool_results(
                user_message, action_plan, tool_results, project_context
            )
            return response
        except Exception as e:
            logger.error(f"Error generating final response: {e}")
            return "I've processed your request. Let me know if you need anything else!" 