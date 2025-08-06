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
        IMPORTANT: Instead of immediately creating tasks, SUGGEST tasks and ask for user confirmation.
        
        Create an action plan based on this analysis:
        
        STAGE ANALYSIS: {json.dumps(stage_analysis, indent=2)}
        CLARIFICATION STRATEGY: {json.dumps(clarification_strategy, indent=2)}
        
        When the user has clear specifications, create a plan that:
        1. Suggests specific tasks they might want
        2. Asks for confirmation before creating anything
        3. Gives them control over what gets created
        
        Create an action plan with:
        1. **Response Type**: What type of response to provide
        2. **Task Suggestions**: What tasks should be suggested (not immediately created)?
        3. **Memory Storage**: What concrete decisions/information should be stored?
        4. **Next Steps**: What should happen after this interaction?
        
        TASK DESCRIPTION REQUIREMENTS:
        Each task description should be detailed enough for an AI coding tool (like Cursor) to implement directly.
        
        1. **Implementation-Ready**: Include technical details, file names, specific frameworks
        2. **Context-Aware**: Reference the project's tech stack and existing structure  
        3. **Actionable**: Clear step-by-step guidance for what to build
        4. **Complete**: Include error handling, validation, and integration details
        
        EXAMPLES OF GOOD DESCRIPTIONS:
        
        For "JWT authentication":
        ❌ Bad: "Add JWT authentication"
        ✅ Good: "Create JWT middleware for Express.js that validates Bearer tokens from Authorization headers. Extract user ID from token payload, attach user object to req.user, handle expired/invalid tokens with 401 responses. Integrate with existing User model and protect /api/protected routes."
        
        For "Hide memory tab":  
        ❌ Bad: "Update UI"
        ✅ Good: "Modify the main navigation component to hide the memory tab. Update CSS/styling to make the task tab take full width. Ensure responsive design works on mobile. Update any related navigation logic and maintain accessibility standards."
        
        For "User dashboard":
        ❌ Bad: "Create dashboard"  
        ✅ Good: "Build a React dashboard component with user stats, recent activity feed, and quick actions. Fetch data from /api/user/dashboard endpoint. Include loading states, error handling, and responsive grid layout. Add charts using Chart.js for data visualization."
        
        USER MESSAGE: "{self.user_message}"
        PROJECT TECH STACK: {self.project_context.get('tech_stack', 'Unknown')}
        
        Return JSON with task suggestions (not immediate creation):
        {{
            "response_type": "task_suggestion|vague_discussion_pushback|specification_pushback|testing_strategy|memory_storage",
            "response_content": {{
                "understanding_statement": "I understand you want to...",
                "main_guidance": "specific guidance or questions",
                "context_integration": "how to reference project context",
                "next_steps": "what happens next"
            }},
            "task_suggestions": {{
                "suggested_tasks": [
                    {{
                        "title": "Specific task title",
                        "description": "Detailed, implementation-ready description with technical specifics, frameworks, file details, and step-by-step guidance",
                        "priority": "high|medium|low"
                    }}
                ],
                "should_suggest_tasks": true/false,
                "confirmation_message": "Would you like me to create these tasks for you?"
            }},
            "task_management": {{
                "should_create_tasks": false  // Never immediately create
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
                "should_generate": false,
                "prompt_content": "",
                "implementation_context": ""
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
        Create fallback action plan with task suggestions instead of immediate creation
        """
        stage = stage_analysis.get("conversation_stage", "vague_discussion")
        user_message = getattr(self, 'user_message', '')
        tech_stack = self.project_context.get('tech_stack', 'Unknown')
        memory_opportunities = stage_analysis.get("memory_opportunities", [])
        
        # Determine response type based on stage
        if stage == "vague_discussion":
            response_type = "vague_discussion_pushback"
            guidance = "Let me help you clarify your requirements. Could you provide more specific details?"
        elif stage == "clear_intent":
            response_type = "specification_pushback"
            guidance = "Let me help you specify the implementation details. What are your technical preferences?"
        elif stage == "detailed_specification":
            response_type = "task_suggestion"
            guidance = "Great! I'll help you break this down into implementable tasks."
        elif stage == "post_implementation":
            response_type = "testing_strategy"
            guidance = "Let me help you plan the testing strategy for your implementation."
        else:
            response_type = "vague_discussion_pushback"
            guidance = "Let me help you clarify your requirements. Could you provide more specific details?"
        
        # Generate task suggestions for detailed specifications
        suggested_tasks = []
        should_suggest_tasks = False
        
        if stage == "detailed_specification":
            should_suggest_tasks = True
            
            if 'authentication' in user_message.lower() or 'auth' in user_message.lower():
                suggested_tasks = [
                    {
                        "title": "Setup authentication middleware",
                        "description": f"Create authentication middleware for {tech_stack}. Implement token validation, user session management, and route protection. Based on user request: '{user_message}'. Include error handling for invalid credentials and integration with existing user model.",
                        "priority": "high"
                    },
                    {
                        "title": "Build authentication UI components", 
                        "description": f"Create login/registration forms using {tech_stack} frontend framework. Include form validation, loading states, error messaging, and responsive design. Connect to authentication API endpoints and handle success/error responses.",
                        "priority": "high"
                    },
                    {
                        "title": "Add protected route system",
                        "description": f"Implement route protection system that checks authentication status. Redirect unauthenticated users to login page. Create higher-order components or guards for protecting sensitive routes in {tech_stack}.",
                        "priority": "medium"
                    }
                ]
            elif 'ui' in user_message.lower() or 'interface' in user_message.lower() or 'tab' in user_message.lower():
                suggested_tasks = [
                    {
                        "title": "Modify UI layout and navigation",
                        "description": f"Update the main navigation component based on request: '{user_message}'. Modify CSS/styling, adjust responsive breakpoints, and ensure accessibility standards. Update any related navigation logic and maintain consistent design system.",
                        "priority": "medium"
                    },
                    {
                        "title": "Test UI changes across devices",
                        "description": f"Test UI modifications on desktop, tablet, and mobile devices. Verify responsive design, accessibility compliance, and cross-browser compatibility. Check navigation flow and user experience impacts.",
                        "priority": "low"
                    }
                ]
            elif 'api' in user_message.lower() or 'endpoint' in user_message.lower():
                suggested_tasks = [
                    {
                        "title": "Create API endpoints",
                        "description": f"Build REST API endpoints using {tech_stack} backend framework. Based on request: '{user_message}'. Include request validation, error handling, proper HTTP status codes, and API documentation. Connect to database models and implement business logic.",
                        "priority": "high"
                    }
                ]
            else:
                # Generic but implementation-ready fallback
                feature_name = user_message[:50] + "..." if len(user_message) > 50 else user_message
                suggested_tasks = [
                    {
                        "title": f"Implement {feature_name}",
                        "description": f"Implement the requested feature using {tech_stack}. User request: '{user_message}'. Break down into specific components, include error handling, ensure integration with existing codebase, and follow project coding standards.",
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
            "task_suggestions": {
                "suggested_tasks": suggested_tasks,
                "should_suggest_tasks": should_suggest_tasks,
                "confirmation_message": "Would you like me to create these tasks for you?"
            },
            "task_management": {
                "should_create_tasks": False  # NEVER immediately create in fallback
            },
            "memory_storage": {
                "memories_to_create": [],
                "should_store_memories": len(memory_opportunities) > 0
            },
            "cursor_prompt": {
                "should_generate": False,  # No separate prompt needed - description IS the prompt
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
        Process message with confirmation-based task creation
        """
        # FIRST: Check if this is a response to previous task suggestions
        if self._is_task_confirmation(user_message, conversation_history):
            return await self._handle_task_confirmation(
                user_message, conversation_history, project_memories, tasks, project_context
            )
        
        # REGULAR: Normal planning for new requests
        self.planning_phase = SpecificationPlanningPhase(
            user_message, conversation_history, project_memories, tasks, project_context
        )
        
        plan = await self.planning_phase.analyze_and_plan()
        
        # Generate response based on plan type
        if plan["response_type"] == "task_suggestion":
            return await self._provide_task_suggestions(plan)
        elif plan["response_type"] == "vague_discussion_pushback":
            return await self._provide_vague_discussion_pushback(plan)
        elif plan["response_type"] == "specification_pushback":
            return await self._provide_specification_pushback(plan)
        elif plan["response_type"] == "testing_strategy":
            return await self._provide_testing_strategy(plan)
        else:
            return await self._provide_memory_storage(plan)
    
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
                
                # 🔍 DEBUG: Log what tasks the planning phase created
                logger.info(f"Planning phase wants to create {len(tasks_to_create)} tasks:")
                for i, task_data in enumerate(tasks_to_create):
                    logger.info(f"Task {i+1}: {json.dumps(task_data, indent=2)}")
                
                for task_data in tasks_to_create:
                    try:
                        # 🔍 DEBUG: Log parameters being passed to tool
                        params = {
                            "title": task_data.get("title", "Untitled Task"),
                            "description": task_data.get("description", ""),  # This should be implementation-ready
                            "priority": task_data.get("priority", "medium"),
                            "project_id": project_id
                        }
                        logger.info(f"Calling create_task with params: {params}")
                        
                        result = self.tool_registry.execute_tool(
                            "create_task",
                            **params
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
            "Reply with 'yes' to create them" in msg.get("content", "")
            for msg in recent_messages
        )
        
        is_confirmation = any(phrase in message_lower for phrase in confirmation_indicators)
        is_decline = any(phrase in message_lower for phrase in decline_indicators)
        
        return has_task_suggestions and (is_confirmation or is_decline)

    async def _handle_task_confirmation(self, user_message: str, conversation_history: List[Dict], 
                                      project_memories: List[Memory], tasks: List[Task], 
                                      project_context: Dict[str, Any]) -> str:
        """
        Handle user's response to task suggestions
        """
        message_lower = user_message.lower().strip()
        
        # Check if user declined
        decline_indicators = ["no", "nope", "not yet", "modify", "change", "different"]
        if any(word in message_lower for word in decline_indicators):
            return """I understand you'd like to modify the suggestions. 

What would you like to change? For example:
• Different task breakdown or organization
• More specific or detailed descriptions  
• Different priorities or scope
• Additional technical requirements

Just let me know what adjustments you'd like!"""
        
        # User confirmed - extract suggested tasks from conversation history
        suggested_tasks = self._extract_suggested_tasks_from_history(conversation_history)
        
        if not suggested_tasks:
            return "I don't see any previously suggested tasks to create. Could you clarify what you'd like me to create?"
        
        # Now actually create the tasks using the existing planning system
        # Create a plan that will execute task creation
        execution_plan = {
            "task_management": {
                "tasks_to_create": suggested_tasks,
                "should_create_tasks": True
            },
            "memory_storage": {
                "should_store_memories": False
            }
        }
        
        # Execute the plan to create tasks
        project_id = project_context.get("id", "default")
        execution_results = await self._execute_plan_actions(execution_plan, project_id)
        
        # Generate success response
        return await self._generate_task_creation_confirmation(execution_results)

    def _extract_suggested_tasks_from_history(self, conversation_history: List[Dict]) -> List[Dict]:
        """
        Extract the tasks that were previously suggested from conversation history
        """
        # Look through recent conversation for suggested tasks
        # In a real implementation, you'd want to store suggested tasks in session state
        # For now, return a simple structure that can be expanded
        
        for msg in reversed(conversation_history[-3:]):
            content = msg.get("content", "")
            if "I can break this down into" in content and "implementation tasks" in content:
                # Parse the suggested tasks from the message
                # This is a simplified parser - you'd want more robust parsing
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

    async def _generate_task_creation_confirmation(self, execution_results: Dict[str, Any]) -> str:
        """
        Generate confirmation message after tasks are created following Samurai Agent protocol
        """
        tasks_created = execution_results.get("tasks_created", [])
        errors = execution_results.get("errors", [])
        
        if not tasks_created:
            if errors:
                return f"❌ I encountered issues creating the tasks: {'; '.join(errors[:2])}"
            else:
                return "❌ No tasks were created. Please try again."
        
        response_parts = []
        
        # Check if this is a single task with exact user wording
        if len(tasks_created) == 1:
            task = tasks_created[0]
            task_message = task.get('message', 'Task created')
            
            response_parts.append("Perfect! I've created a new task:")
            
            # Extract task title from the message
            if "Created task:" in task_message:
                title = task_message.split("Created task:")[1].strip().strip("'")
                response_parts.append(f"Title: \"{title}\"")
            elif "Created task" in task_message:
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
        else:
            # Multiple tasks
            response_parts.append(f"✅ Perfect! I've created {len(tasks_created)} tasks for you:\n")
            
            for task in tasks_created:
                response_parts.append(task.get('message', 'Task created'))
            
            response_parts.append(f"\n🎉 All {len(tasks_created)} tasks are now in your project and ready for implementation!")
            
            if len(tasks_created) > 1:
                response_parts.append("\n💡 *You can now work on these tasks individually or ask me to help enhance any specific task descriptions.*")
        
        if errors:
            response_parts.append(f"\n⚠️ Note: {len(errors)} tasks could not be created due to errors.")
        
        return "\n".join(response_parts)

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
    
    async def _provide_task_suggestions(self, plan: Dict[str, Any]) -> str:
        """
        Show suggested tasks and ask user for confirmation before creating
        Following Samurai Agent protocol for exact user wording
        """
        task_suggestions = plan.get("task_suggestions", {})
        suggested_tasks = task_suggestions.get("suggested_tasks", [])
        
        if not suggested_tasks:
            return f"{plan['response_content']['understanding_statement']}. {plan['response_content']['main_guidance']}"
        
        # Build suggestion response
        response_parts = []
        response_parts.append(f"{plan['response_content']['understanding_statement']}.")
        
        # Check if this is a single task with exact user wording
        if len(suggested_tasks) == 1:
            task = suggested_tasks[0]
            title = task.get("title", "Untitled Task")
            
            # If the title looks like exact user wording (not a generic task)
            if not any(generic_word in title.lower() for generic_word in ["setup", "implement", "create", "build", "add"]):
                response_parts.append(f"\nI can create a task with your exact wording:")
                response_parts.append(f"**Task Title:** \"{title}\"")
                
                description = task.get("description", "")
                if description and description != f"Task created from user request":
                    response_parts.append(f"**Description:** {description}")
                
                # Ask for confirmation with exact wording
                confirmation_msg = task_suggestions.get("confirmation_message", f"Just to confirm, you want me to create a task titled '{title}' - is that right?")
                response_parts.append(f"\n**{confirmation_msg}**")
                response_parts.append("💡 *Reply with 'yes' to create it, or ask me to modify it first.*")
            else:
                # Multiple tasks or generic task - use original format
                response_parts.append(f"\nI can break this down into {len(suggested_tasks)} implementation tasks:\n")
                
                # Show each suggested task
                for i, task in enumerate(suggested_tasks, 1):
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
        else:
            # Multiple tasks - use original format
            response_parts.append(f"\nI can break this down into {len(suggested_tasks)} implementation tasks:\n")
            
            # Show each suggested task
            for i, task in enumerate(suggested_tasks, 1):
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

    async def _provide_task_breakdown_and_prompt(self, plan: Dict[str, Any], execution_results: Dict[str, Any] = None) -> str:
        """
        Break down complete specifications into tasks with implementation-ready descriptions
        """
        if execution_results is None:
            execution_results = {"tasks_created": [], "memories_created": [], "errors": []}
        
        tasks_created = execution_results.get("tasks_created", [])
        
        if tasks_created:
            task_confirmations = [f"✅ {task.get('message', 'Task created')}" for task in tasks_created]
            confirmation_text = "\n".join(task_confirmations)
            
            response = f"""Perfect! I've analyzed your complete specification and created implementation-ready tasks:

{confirmation_text}

You now have {len(tasks_created)} concrete tasks with detailed implementation guidance. Each task description includes:
• Technical specifications and frameworks to use
• Step-by-step implementation details  
• Error handling and integration requirements
• Context from your project's tech stack

These descriptions are ready to copy directly into Cursor or other AI coding tools for implementation.

{plan['response_content']['main_guidance']}"""
            
            return response
        else:
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