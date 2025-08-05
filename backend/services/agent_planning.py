import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

try:
    from .gemini_service import GeminiService
    from .agent_tools import AgentToolRegistry
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from agent_tools import AgentToolRegistry
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class SpecificationPlanningPhase:
    """Intelligent planning phase for development specification and implementation guidance"""
    
    def __init__(self, user_message: str, conversation_history: List[Dict], 
                 project_memories: List[Memory], tasks: List[Task], project_context: Dict):
        self.user_message = user_message
        self.conversation_history = conversation_history
        self.project_memories = project_memories
        self.tasks = tasks
        self.project_context = project_context
        self.gemini_service = GeminiService()
        self.plan = None
    
    async def analyze_and_plan(self) -> Dict[str, Any]:
        """
        Analyze the user's message and create a comprehensive development response plan
        """
        try:
            # Step 1: Conversation Stage Detection
            stage_analysis = await self.detect_conversation_stage()
            logger.info(f"Conversation stage: {stage_analysis}")
            
            # Step 2: Clarification Strategy Planning
            clarification_strategy = await self.plan_clarification_strategy(stage_analysis)
            logger.info(f"Clarification strategy: {clarification_strategy}")
            
            # Step 3: Action Planning
            action_plan = await self.create_action_plan(stage_analysis, clarification_strategy)
            logger.info(f"Action plan: {action_plan}")
            
            self.plan = action_plan
            return action_plan
            
        except Exception as e:
            logger.error(f"Error in specification planning phase: {e}")
            return self._create_fallback_plan()
    
    async def detect_conversation_stage(self) -> Dict[str, Any]:
        """
        Detect what stage of development clarity the user is at
        """
        stage_detection_prompt = f"""
        Analyze this user message to determine their development conversation stage:
        
        USER MESSAGE: "{self.user_message}"
        
        RECENT CONVERSATION:
        {self._get_recent_conversation_context()}
        
        PROJECT CONTEXT:
        - Project: {self.project_context.get('name', 'Unknown')}
        - Tech Stack: {self.project_context.get('tech_stack', 'Unknown')}
        
        Determine the conversation stage:
        1. **Conversation Stage**: vague_discussion | clear_intent | detailed_specification | ready_for_implementation | post_implementation
        2. **Clarity Level**: How well-defined is their request (1-10 scale)
        3. **Decision Readiness**: Are they ready to make technical decisions?
        4. **Specification Completeness**: What level of detail do they have?
        5. **Next Action Needed**: What type of push-back or guidance is required?
        6. **Memory Opportunities**: What concrete information should be stored?
        
        Return a JSON object with:
        {{
            "conversation_stage": "vague_discussion|clear_intent|detailed_specification|ready_for_implementation|post_implementation",
            "clarity_level": 1-10,
            "decision_readiness": true/false,
            "specification_completeness": "low|medium|high|complete",
            "next_action_needed": "pushback_questions|detailed_clarification|task_breakdown|cursor_prompt|testing_strategy",
            "memory_opportunities": ["list", "of", "concrete", "information", "to", "store"],
            "confidence_level": 0.8,
            "development_focus": "feature_request|improvement|new_implementation|testing|refactoring"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                self.user_message, 
                stage_detection_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in stage detection, using fallback")
                return self._create_fallback_stage_analysis()
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_stage_analysis()
                
        except Exception as e:
            logger.error(f"Error in conversation stage detection: {e}")
            return self._create_fallback_stage_analysis()
    
    async def plan_clarification_strategy(self, stage_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Plan what clarification questions or guidance to provide
        """
        clarification_prompt = f"""
        Based on this conversation stage analysis, plan the clarification strategy:
        
        STAGE ANALYSIS: {json.dumps(stage_analysis, indent=2)}
        
        Plan the clarification strategy:
        1. **Question Generation**: What specific questions will move them to the next stage?
        2. **Decision Points**: What concrete decisions need to be made?
        3. **Information Gaps**: What critical details are missing?
        4. **Memory Opportunities**: What concrete information should be stored?
        5. **Progression Path**: How to guide them toward implementable specifications?
        
        Return JSON:
        {{
            "question_strategy": {{
                "primary_questions": ["list", "of", "key", "questions"],
                "follow_up_questions": ["list", "of", "follow", "up", "questions"],
                "technical_decisions": ["list", "of", "technical", "choices", "needed"]
            }},
            "decision_points": ["list", "of", "concrete", "decisions"],
            "information_gaps": ["list", "of", "missing", "details"],
            "memory_opportunities": ["list", "of", "concrete", "info", "to", "store"],
            "progression_guidance": "how to move to next stage",
            "response_type": "vague_discussion_pushback|specification_pushback|task_breakdown_and_prompt|testing_strategy|memory_storage"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Plan clarification strategy", 
                clarification_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in clarification planning, using fallback")
                return self._create_fallback_clarification_strategy(stage_analysis)
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_clarification_strategy(stage_analysis)
                
        except Exception as e:
            logger.error(f"Error in clarification strategy planning: {e}")
            return self._create_fallback_clarification_strategy(stage_analysis)
    
    async def create_action_plan(self, stage_analysis: Dict[str, Any], clarification_strategy: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create specific action plan for response and task/memory management
        """
        action_planning_prompt = f"""
        Create an action plan based on this analysis:
        
        STAGE ANALYSIS: {json.dumps(stage_analysis, indent=2)}
        CLARIFICATION STRATEGY: {json.dumps(clarification_strategy, indent=2)}
        
        Create an action plan with:
        1. **Response Type**: What type of response to provide
        2. **Task Management**: What tasks need to be created and added to the system?
        3. **Memory Storage**: What concrete decisions/information should be stored?
        4. **Cursor Prompt Preparation**: Is specification complete enough for implementation prompts?
        5. **Next Steps**: What should happen after this interaction?
        
        Return JSON:
        {{
            "response_type": "vague_discussion_pushback|specification_pushback|task_breakdown_and_prompt|testing_strategy|memory_storage",
            "response_content": {{
                "understanding_statement": "I understand you want to...",
                "main_guidance": "specific guidance or questions",
                "context_integration": "how to reference project context",
                "next_steps": "what happens next"
            }},
            "task_management": {{
                "tasks_to_create": [
                    {{
                        "title": "task title",
                        "description": "task description",
                        "priority": "high|medium|low"
                    }}
                ],
                "should_create_tasks": true/false
            }},
            "memory_storage": {{
                "memories_to_create": [
                    {{
                        "title": "memory title",
                        "content": "memory content",
                        "category": "technical_decision|requirement|specification"
                    }}
                ],
                "should_store_memories": true/false
            }},
            "cursor_prompt": {{
                "should_generate": true/false,
                "prompt_content": "full cursor prompt if ready",
                "implementation_context": "technical context for implementation"
            }},
            "confidence": 0.8,
            "progression_ready": true/false
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Create action plan", 
                action_planning_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in action planning, using fallback")
                return self._create_fallback_action_plan(stage_analysis)
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_action_plan(stage_analysis)
                
        except Exception as e:
            logger.error(f"Error in action planning: {e}")
            return self._create_fallback_action_plan(stage_analysis)
    
    def _get_recent_conversation_context(self) -> str:
        """
        Get recent conversation context for analysis
        """
        if not self.conversation_history:
            return "No recent conversation history."
        
        # Get last 5 messages
        recent_messages = self.conversation_history[-5:]
        
        context_parts = []
        for msg in recent_messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            context_parts.append(f"{role}: {content}")
        
        return "\n".join(context_parts)
    
    def _create_fallback_stage_analysis(self) -> Dict[str, Any]:
        """
        Create fallback stage analysis when LLM fails
        """
        message_lower = self.user_message.lower()
        
        # Check for detailed specifications (multiple technical details)
        detailed_spec_indicators = [
            "jwt", "oauth", "google", "facebook", "github", "role-based", "permissions", 
            "password reset", "email verification", "two-factor", "2fa", "sso",
            "dashboard", "charts", "filters", "real-time", "websockets", "api",
            "database", "postgresql", "mongodb", "redis", "elasticsearch",
            "docker", "kubernetes", "aws", "azure", "gcp", "deployment"
        ]
        
        detailed_count = sum(1 for indicator in detailed_spec_indicators if indicator in message_lower)
        
        # Check for post-implementation indicators
        post_impl_indicators = [
            "implemented", "done", "finished", "completed", "built", "created",
            "what should i test", "testing", "test", "deployed", "live"
        ]
        
        # Check for memory opportunities (concrete decisions)
        memory_indicators = [
            "decided", "chose", "selected", "using", "will use", "going with",
            "prefer", "preference", "choice", "decision", "architecture"
        ]
        
        memory_opportunities = []
        if any(indicator in message_lower for indicator in memory_indicators):
            memory_opportunities = ["technical_decision"]
        
        if any(indicator in message_lower for indicator in post_impl_indicators):
            stage = "post_implementation"
            clarity = 9
            completeness = "complete"
        elif detailed_count >= 3:  # Multiple technical details indicate detailed specification
            stage = "detailed_specification"
            clarity = 8
            completeness = "high"
        elif any(word in message_lower for word in ["somehow", "maybe", "thinking", "improve", "better"]):
            stage = "vague_discussion"
            clarity = 3
            completeness = "low"
        elif any(word in message_lower for word in ["add", "create", "build", "implement", "want"]):
            stage = "clear_intent"
            clarity = 6
            completeness = "medium"
        else:
            stage = "vague_discussion"
            clarity = 4
            completeness = "low"
        
        return {
            "conversation_stage": stage,
            "clarity_level": clarity,
            "decision_readiness": clarity > 5,
            "specification_completeness": completeness,
            "next_action_needed": "pushback_questions" if clarity < 5 else "detailed_clarification" if clarity < 8 else "task_breakdown",
            "memory_opportunities": memory_opportunities,
            "confidence_level": 0.5,
            "development_focus": "feature_request"
        }
    
    def _create_fallback_clarification_strategy(self, stage_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create fallback clarification strategy when LLM fails
        """
        stage = stage_analysis.get("conversation_stage", "vague_discussion")
        memory_opportunities = stage_analysis.get("memory_opportunities", [])
        
        if stage == "vague_discussion":
            questions = ["What specific problems do your users face?", "What features do you feel are missing?"]
            response_type = "vague_discussion_pushback"
        elif stage == "clear_intent":
            questions = ["What specific implementation details do you need?", "What are your technical preferences?"]
            response_type = "specification_pushback"
        elif stage == "detailed_specification":
            questions = ["What specific implementation details do you need?"]
            response_type = "task_breakdown_and_prompt"
        elif stage == "post_implementation":
            questions = ["What specific testing do you need?"]
            response_type = "testing_strategy"
        else:
            questions = ["What specific details do you need help with?"]
            response_type = "specification_pushback"
        
        return {
            "question_strategy": {
                "primary_questions": questions,
                "follow_up_questions": [],
                "technical_decisions": []
            },
            "decision_points": [],
            "information_gaps": [],
            "memory_opportunities": memory_opportunities,
            "progression_guidance": "Ask clarifying questions to move forward",
            "response_type": response_type
        }
    
    def _create_fallback_action_plan(self, stage_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create fallback action plan when LLM fails
        """
        stage = stage_analysis.get("conversation_stage", "vague_discussion")
        memory_opportunities = stage_analysis.get("memory_opportunities", [])
        
        # Determine response type based on stage
        if stage == "vague_discussion":
            response_type = "vague_discussion_pushback"
            guidance = "Let me help you clarify your requirements. Could you provide more specific details?"
        elif stage == "clear_intent":
            response_type = "specification_pushback"
            guidance = "Let me help you specify the implementation details. What are your technical preferences?"
        elif stage == "detailed_specification":
            response_type = "task_breakdown_and_prompt"
            guidance = "Great! I'll help you break this down into implementable tasks."
        elif stage == "post_implementation":
            response_type = "testing_strategy"
            guidance = "Let me help you plan the testing strategy for your implementation."
        else:
            response_type = "vague_discussion_pushback"
            guidance = "Let me help you clarify your requirements. Could you provide more specific details?"
        
        # Generate sample tasks for detailed specifications
        tasks_to_create = []
        if stage == "detailed_specification":
            tasks_to_create = [
                {
                    "title": "Setup project structure",
                    "description": "Create the basic project structure and configuration",
                    "priority": "high"
                },
                {
                    "title": "Implement core functionality",
                    "description": "Build the main feature components",
                    "priority": "high"
                },
                {
                    "title": "Add tests",
                    "description": "Create comprehensive test coverage",
                    "priority": "medium"
                }
            ]
        
        return {
            "response_type": response_type,
            "response_content": {
                "understanding_statement": f"I understand you're at the {stage} stage",
                "main_guidance": guidance,
                "context_integration": "I'll consider your project context when helping",
                "next_steps": "We'll work through the details step by step"
            },
            "task_management": {
                "tasks_to_create": tasks_to_create,
                "should_create_tasks": stage == "detailed_specification"
            },
            "memory_storage": {
                "memories_to_create": [],
                "should_store_memories": len(memory_opportunities) > 0
            },
            "cursor_prompt": {
                "should_generate": stage == "detailed_specification",
                "prompt_content": "",
                "implementation_context": ""
            },
            "confidence": 0.6,
            "progression_ready": stage in ["detailed_specification", "post_implementation"]
        }
    
    def _create_fallback_plan(self) -> Dict[str, Any]:
        """
        Create complete fallback plan when planning phase fails
        """
        return {
            "response_type": "vague_discussion_pushback",
            "response_content": {
                "understanding_statement": "I understand you need help with development",
                "main_guidance": "Let me help you clarify your requirements and move toward implementation",
                "context_integration": "I'll use your project context to provide relevant guidance",
                "next_steps": "We'll work through this step by step"
            },
            "task_management": {
                "tasks_to_create": [],
                "should_create_tasks": False
            },
            "memory_storage": {
                "memories_to_create": [],
                "should_store_memories": False
            },
            "cursor_prompt": {
                "should_generate": False,
                "prompt_content": "",
                "implementation_context": ""
            },
            "confidence": 0.5,
            "progression_ready": False
        }


class DevelopmentAgent:
    """
    Enhanced agent focused on development workflow and specification guidance with tool execution
    """
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.planning_phase = None
        self.tool_registry = AgentToolRegistry()
    
    async def process_user_message(self, user_message: str, conversation_history: List[Dict], 
                                 project_memories: List[Memory], tasks: List[Task], 
                                 project_context: Dict[str, Any]) -> str:
        """
        Main agent processing with development-focused planning phase and tool execution
        """
        try:
            # Use development-focused planning with tool execution
            return await self._process_with_planning(user_message, conversation_history, 
                                                  project_memories, tasks, project_context)
                
        except Exception as e:
            logger.error(f"Error in development agent processing: {e}")
            return "I encountered an issue processing your request. Could you try rephrasing your question?"
    
    async def _process_with_planning(self, user_message: str, conversation_history: List[Dict],
                                   project_memories: List[Memory], tasks: List[Task], 
                                   project_context: Dict[str, Any]) -> str:
        """
        Process message with development-focused planning phase and tool execution
        """
        # Phase 1: Planning
        self.planning_phase = SpecificationPlanningPhase(
            user_message, conversation_history, project_memories, tasks, project_context
        )
        
        plan = await self.planning_phase.analyze_and_plan()
        
        # Phase 2: Execute plan actions (ACTUALLY CREATE TASKS/MEMORIES)
        project_id = project_context.get("id", "default")
        execution_results = await self._execute_plan_actions(plan, project_id)
        
        # Phase 3: Generate response based on plan AND execution results
        if plan["response_type"] == "vague_discussion_pushback":
            response = await self._provide_vague_discussion_pushback(plan)
        elif plan["response_type"] == "specification_pushback":
            response = await self._provide_specification_pushback(plan)
        elif plan["response_type"] == "task_breakdown_and_prompt":
            response = await self._provide_task_breakdown_and_prompt(plan, execution_results)
        elif plan["response_type"] == "testing_strategy":
            response = await self._provide_testing_strategy(plan, execution_results)
        else:
            response = await self._provide_memory_storage(plan, execution_results)
        
        return response
    
    async def _execute_plan_actions(self, plan: Dict[str, Any], project_id: str) -> Dict[str, Any]:
        """
        Execute the actions specified in the plan using tool registry
        """
        execution_results = {
            "tasks_created": [],
            "memories_created": [],
            "errors": []
        }
        
        try:
            # Execute task creation
            task_management = plan.get("task_management", {})
            if task_management.get("should_create_tasks", False):
                tasks_to_create = task_management.get("tasks_to_create", [])
                
                for task_data in tasks_to_create:
                    try:
                        result = self.tool_registry.execute_tool(
                            "create_task",
                            title=task_data.get("title", "Untitled Task"),
                            description=task_data.get("description", ""),
                            priority=task_data.get("priority", "medium"),
                            project_id=project_id
                        )
                        
                        if result.get("success"):
                            execution_results["tasks_created"].append(result)
                        else:
                            execution_results["errors"].append(f"Task creation failed: {result.get('message', 'Unknown error')}")
                            
                    except Exception as e:
                        execution_results["errors"].append(f"Task creation error: {str(e)}")
            
            # Execute memory storage
            memory_storage = plan.get("memory_storage", {})
            if memory_storage.get("should_store_memories", False):
                memories_to_create = memory_storage.get("memories_to_create", [])
                
                for memory_data in memories_to_create:
                    try:
                        result = self.tool_registry.execute_tool(
                            "create_memory",
                            title=memory_data.get("title", "Untitled Memory"),
                            content=memory_data.get("content", ""),
                            category=memory_data.get("category", "general"),
                            project_id=project_id
                        )
                        
                        if result.get("success"):
                            execution_results["memories_created"].append(result)
                        else:
                            execution_results["errors"].append(f"Memory creation failed: {result.get('message', 'Unknown error')}")
                            
                    except Exception as e:
                        execution_results["errors"].append(f"Memory creation error: {str(e)}")
            
            return execution_results
            
        except Exception as e:
            logger.error(f"Error executing plan actions: {e}")
            execution_results["errors"].append(f"Plan execution error: {str(e)}")
            return execution_results
    
    async def _provide_vague_discussion_pushback(self, plan: Dict[str, Any]) -> str:
        """
        Provide push-back questions for vague discussions
        """
        pushback_prompt = f"""
        The user is in the vague discussion stage: {plan["response_content"]["understanding_statement"]}
        
        Create push-back questions that:
        1. Show understanding of their general interest
        2. Ask open-ended questions about their goals and pain points
        3. Help them identify specific problems or opportunities
        4. Guide them toward concrete feature ideas
        5. Store any concrete insights as memories
        
        Main guidance: {plan["response_content"]["main_guidance"]}
        Context integration: {plan["response_content"]["context_integration"]}
        
        Write helpful push-back questions that move them from vague to clear intent:
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Provide push-back questions", 
                pushback_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
            
            return response
            
        except Exception as e:
            logger.error(f"Error providing vague discussion pushback: {e}")
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
    
    async def _provide_specification_pushback(self, plan: Dict[str, Any]) -> str:
        """
        Provide detailed specification push-back questions
        """
        specification_prompt = f"""
        The user has clear intent but needs specification details: {plan["response_content"]["understanding_statement"]}
        
        Create detailed specification questions that:
        1. Ask specific technical questions (authentication method, data structure, UI requirements)
        2. Explore implementation preferences and constraints
        3. Gather all details needed for implementation
        4. Store all technical decisions as memories
        
        Main guidance: {plan["response_content"]["main_guidance"]}
        Context integration: {plan["response_content"]["context_integration"]}
        
        Write detailed specification questions that move them to complete specifications:
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Provide specification questions", 
                specification_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
            
            return response
            
        except Exception as e:
            logger.error(f"Error providing specification pushback: {e}")
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
    
    async def _provide_task_breakdown_and_prompt(self, plan: Dict[str, Any], execution_results: Dict[str, Any] = None) -> str:
        """
        Break down complete specifications into tasks and generate Cursor prompt with actual results
        """
        if execution_results is None:
            execution_results = {"tasks_created": [], "memories_created": [], "errors": []}
        
        tasks_created = execution_results.get("tasks_created", [])
        memories_created = execution_results.get("memories_created", [])
        errors = execution_results.get("errors", [])
        
        # If tasks were actually created, confirm it in the response
        if tasks_created:
            task_confirmations = [f"✅ {task.get('message', 'Task created')}" for task in tasks_created]
            confirmation_text = "\n".join(task_confirmations)
            
            response = f"""Perfect! I've analyzed your complete specification and created the implementation tasks:

{confirmation_text}

You now have {len(tasks_created)} concrete tasks ready for implementation. Each task is designed to be completed in 30-60 minutes and is suitable for AI coding tools like Cursor.

{plan['response_content']['main_guidance']}"""
            
            return response
        else:
            # Fallback if no tasks were created
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
    
    async def _provide_testing_strategy(self, plan: Dict[str, Any], execution_results: Dict[str, Any] = None) -> str:
        """
        Provide testing strategy after implementation with execution results
        """
        if execution_results is None:
            execution_results = {"tasks_created": [], "memories_created": [], "errors": []}
        
        tasks_created = execution_results.get("tasks_created", [])
        memories_created = execution_results.get("memories_created", [])
        errors = execution_results.get("errors", [])
        
        # If testing tasks were created, confirm them
        if tasks_created:
            task_confirmations = [f"✅ {task.get('message', 'Testing task created')}" for task in tasks_created]
            confirmation_text = "\n".join(task_confirmations)
            
            response = f"""Great! I've analyzed your implemented feature and created a comprehensive testing strategy:

{confirmation_text}

{plan['response_content']['main_guidance']}"""
            
            return response
        else:
            # Fallback if no tasks were created
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
    
    async def _provide_memory_storage(self, plan: Dict[str, Any], execution_results: Dict[str, Any] = None) -> str:
        """
        Store concrete decisions and information as memories with execution results
        """
        if execution_results is None:
            execution_results = {"tasks_created": [], "memories_created": [], "errors": []}
        
        tasks_created = execution_results.get("tasks_created", [])
        memories_created = execution_results.get("memories_created", [])
        errors = execution_results.get("errors", [])
        
        # If memories were created, confirm them
        if memories_created:
            memory_confirmations = [f"💡 {memory.get('message', 'Memory stored')}" for memory in memories_created]
            confirmation_text = "\n".join(memory_confirmations)
            
            response = f"""Perfect! I've captured the important decisions and information:

{confirmation_text}

{plan['response_content']['main_guidance']}"""
            
            return response
        else:
            # Fallback if no memories were created
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}" 