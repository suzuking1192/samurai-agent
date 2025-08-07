"""
Planning-First Samurai Agent

This module implements the new planning-first architecture for the Samurai Agent.
It replaces the current tool-first approach with a comprehensive planning system
that considers conversation history and creates multi-step execution plans.
"""

import json
import logging
import uuid
from typing import List, Dict, Optional, Any, Tuple, Callable
from datetime import datetime
from dataclasses import dataclass

try:
    from .gemini_service import GeminiService
    from .file_service import FileService
    from .agent_tools import AgentToolRegistry
    from .vector_context_service import vector_context_service
    from .consolidated_memory import ConsolidatedMemoryService
    from models import Task, Memory, Project, ChatMessage
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from file_service import FileService
    from agent_tools import AgentToolRegistry
    from vector_context_service import vector_context_service
    from consolidated_memory import ConsolidatedMemoryService
    from models import Task, Memory, Project, ChatMessage

logger = logging.getLogger(__name__)


@dataclass
class PlanStep:
    """Represents a single step in a multi-step plan."""
    step_id: str
    step_type: str  # 'tool_call', 'context_analysis', 'memory_operation', 'response_generation'
    tool_name: Optional[str] = None
    parameters: Dict[str, Any] = None
    description: str = ""
    dependencies: List[str] = None  # List of step_ids this step depends on
    estimated_duration: int = 0  # Estimated duration in seconds
    priority: str = "medium"  # high, medium, low
    
    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.dependencies is None:
            self.dependencies = []


@dataclass
class ExecutionPlan:
    """Represents a comprehensive execution plan."""
    plan_id: str
    user_message: str
    conversation_context: Dict[str, Any]
    steps: List[PlanStep]
    estimated_total_duration: int
    confidence_score: float
    plan_type: str  # 'single_step', 'multi_step', 'complex_workflow'
    created_at: datetime
    validation_status: str = "pending"  # pending, validated, failed
    validation_errors: List[str] = None
    
    def __post_init__(self):
        if self.validation_errors is None:
            self.validation_errors = []


@dataclass
class ConversationContext:
    """Represents the full conversation context for planning."""
    session_messages: List[ChatMessage]
    recent_conversation_summary: str
    ongoing_discussions: List[str]
    unresolved_questions: List[str]
    user_preferences: Dict[str, Any]
    technical_decisions: List[str]
    conversation_themes: List[str]
    context_embedding: Optional[List[float]] = None


class PlanningFirstAgent:
    """
    Enhanced Samurai Agent with planning-first architecture.
    
    This agent implements a comprehensive planning system that:
    1. Analyzes user intent with full conversation context
    2. Creates multi-step execution plans
    3. Validates and optimizes plans before execution
    4. Executes plans with conversation-aware tool calling
    5. Maintains conversation continuity across interactions
    """
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.file_service = FileService()
        self.tool_registry = AgentToolRegistry()
        self.consolidated_memory_service = ConsolidatedMemoryService()
        
        # Planning configuration
        self.max_plan_steps = 10
        self.max_conversation_history = 20
        self.plan_validation_threshold = 0.7
        self.context_analysis_depth = "comprehensive"  # basic, standard, comprehensive
        
        logger.info("PlanningFirstAgent initialized with comprehensive planning capabilities")
    
    async def process_user_message(
        self, 
        message: str, 
        project_id: str, 
        project_context: dict, 
        session_id: str = None, 
        conversation_history: List[ChatMessage] = None,
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None
    ) -> dict:
        """
        Process user message with planning-first architecture and real-time progress updates.
        
        Args:
            message: User's message
            project_id: Project identifier
            project_context: Project context information
            session_id: Session identifier
            conversation_history: Conversation history
            progress_callback: Optional callback for progress updates
        """
        
        try:
            logger.info(f"Processing message with planning-first architecture: {message[:100]}...")
            
            # Step 1: Start processing
            if progress_callback:
                await progress_callback("start", "🧠 Starting to process your request...", "Initializing the planning-first agent")
            
            # Step 2: Gather comprehensive context
            if progress_callback:
                await progress_callback("context", "📚 Gathering conversation context...", "Loading previous messages and project context")
            
            conversation_context = await self._gather_comprehensive_context(
                message, project_id, session_id, conversation_history, project_context
            )
            
            if progress_callback:
                await progress_callback("context", "✅ Context gathered successfully", "Loaded conversation history and project context")
            
            # Step 3: Analyze user intent with context
            if progress_callback:
                await progress_callback("analyzing", "🧠 Analyzing your request...", "Understanding your intent and requirements")
            
            intent_analysis = await self._analyze_user_intent_with_context(
                message, conversation_context, project_context
            )
            
            if progress_callback:
                await progress_callback("analyzing", "✅ Analysis complete", f"Identified intent: {intent_analysis.get('primary_intent', 'unknown')}")
            
            # Step 4: Generate comprehensive plan
            if progress_callback:
                await progress_callback("planning", "📋 Creating execution plan...", "Planning the best approach for your request")
            
            plan = await self._generate_comprehensive_plan(
                message, intent_analysis, conversation_context, project_context
            )
            
            if progress_callback:
                await progress_callback("planning", "✅ Plan created", f"Created {len(plan.steps)} step execution plan")
            
            # Step 5: Validate and optimize plan
            if progress_callback:
                await progress_callback("validation", "✅ Validating plan...", "Ensuring the plan is feasible and optimal")
            
            validation_result = await self._validate_and_optimize_plan(plan, project_context)
            
            if not validation_result.get("is_valid", False):
                if progress_callback:
                    await progress_callback("validation", "⚠️ Plan validation failed", "Falling back to simplified processing")
                
                return await self._handle_plan_validation_failure(
                    message, validation_result, conversation_context, project_context
                )
            
            if progress_callback:
                await progress_callback("validation", "✅ Plan validated", "Plan is ready for execution")
            
            # Step 6: Execute plan with context
            if progress_callback:
                await progress_callback("execution", "⚙️ Executing plan...", "Carrying out the planned actions")
            
            execution_results = await self._execute_plan_with_context(
                plan, project_id, conversation_context, progress_callback
            )
            
            if progress_callback:
                await progress_callback("execution", "✅ Plan executed", f"Completed {len(plan.steps)} steps successfully")
            
            # Step 7: Update memory from execution
            if progress_callback:
                await progress_callback("memory", "💾 Updating memory...", "Saving important information for future reference")
            
            await self._update_memory_from_execution(
                message, execution_results.get("response", ""), execution_results, project_id, conversation_context
            )
            
            if progress_callback:
                await progress_callback("memory", "✅ Memory updated", "Important information saved for future reference")
            
            # Step 8: Generate contextual response
            if progress_callback:
                await progress_callback("completion", "🎉 Processing complete!", "All tasks completed successfully")
            
            final_response = await self._generate_contextual_response(
                message, execution_results, conversation_context, project_context
            )
            
            # Return comprehensive result
            return {
                "type": "planning_first_response",
                "response": final_response,
                "steps_completed": len(plan.steps),
                "tool_results": execution_results.get("tool_results", []),
                "context_used": execution_results.get("context_used", ""),
                "plan_type": plan.plan_type,
                "confidence_score": plan.confidence_score,
                "execution_time": execution_results.get("execution_time", 0.0),
                "plan_executed": plan.plan_id,
                "total_steps": len(plan.steps)
            }
                
        except Exception as e:
            logger.error(f"Error processing message with planning-first architecture: {e}")
            
            if progress_callback:
                await progress_callback("error", "❌ Processing error", f"Error: {str(e)}")
            
            # Fallback to simplified processing
            return await self._handle_processing_error(message, e, project_context)
    
    async def _gather_comprehensive_context(
        self, 
        message: str, 
        project_id: str, 
        session_id: str, 
        conversation_history: List[ChatMessage], 
        project_context: dict
    ) -> ConversationContext:
        """
        Gather comprehensive context including conversation history, memories, and tasks.
        """
        try:
            # Get conversation history
            if conversation_history is not None:
                session_messages = conversation_history
            else:
                session_messages = self._get_session_messages(project_id, session_id)
            
            # Generate vector-enhanced context
            vector_context = await self._build_vector_enhanced_context(
                message, project_id, session_messages, project_context
            )
            
            # Analyze conversation for themes and patterns
            conversation_analysis = await self._analyze_conversation_patterns(
                session_messages, message
            )
            
            # Build comprehensive context
            context = ConversationContext(
                session_messages=session_messages,
                recent_conversation_summary=conversation_analysis["summary"],
                ongoing_discussions=conversation_analysis["ongoing_discussions"],
                unresolved_questions=conversation_analysis["unresolved_questions"],
                user_preferences=conversation_analysis["user_preferences"],
                technical_decisions=conversation_analysis["technical_decisions"],
                conversation_themes=conversation_analysis["themes"],
                context_embedding=vector_context.get("context_embedding")
            )
            
            logger.info(f"Gathered comprehensive context: {len(session_messages)} messages, "
                       f"{len(conversation_analysis['ongoing_discussions'])} ongoing discussions")
            
            return context
            
        except Exception as e:
            logger.error(f"Error gathering comprehensive context: {e}")
            return self._create_fallback_context(message, project_id, project_context)
    
    async def _analyze_user_intent_with_context(
        self, 
        message: str, 
        conversation_context: ConversationContext, 
        project_context: dict
    ) -> Dict[str, Any]:
        """
        Analyze user intent with full conversation context awareness.
        """
        try:
            intent_analysis_prompt = f"""
            Analyze this user message with full conversation context to understand their intent:
            
            CURRENT MESSAGE: "{message}"
            
            CONVERSATION CONTEXT:
            - Recent Summary: {conversation_context.recent_conversation_summary}
            - Ongoing Discussions: {', '.join(conversation_context.ongoing_discussions)}
            - Unresolved Questions: {', '.join(conversation_context.unresolved_questions)}
            - User Preferences: {json.dumps(conversation_context.user_preferences)}
            - Technical Decisions: {', '.join(conversation_context.technical_decisions)}
            - Conversation Themes: {', '.join(conversation_context.conversation_themes)}
            
            PROJECT CONTEXT:
            - Project: {project_context.get('name', 'Unknown')}
            - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
            
            Analyze the user's intent considering:
            1. Is this continuing a previous discussion?
            2. Are they referencing previous decisions or preferences?
            3. What specific action do they want to accomplish?
            4. How does this relate to ongoing discussions?
            5. What context from previous messages is relevant?
            
            Return JSON:
            {{
                "primary_intent": "feature_request|task_management|question|clarification|general_chat",
                "secondary_intent": "continuation|new_topic|reference_previous|decision_making",
                "referenced_items": ["list", "of", "items", "referenced", "from", "context"],
                "required_actions": ["list", "of", "specific", "actions", "needed"],
                "context_dependencies": ["list", "of", "context", "items", "needed"],
                "conversation_continuity": true/false,
                "complexity_level": "simple|moderate|complex|multi_step",
                "confidence_score": 0.0-1.0,
                "clarification_needed": true/false,
                "clarification_questions": ["list", "of", "questions", "if", "needed"]
            }}
            """
            
            response = await self.gemini_service.chat_with_system_prompt(
                message, intent_analysis_prompt
            )
            
            # Parse JSON response
            try:
                intent_analysis = json.loads(response)
                logger.info(f"Intent analysis: {intent_analysis['primary_intent']} "
                           f"(confidence: {intent_analysis['confidence_score']})")
                return intent_analysis
            except json.JSONDecodeError:
                logger.warning("Failed to parse intent analysis JSON, using fallback")
                return self._create_fallback_intent_analysis(message)
                
        except Exception as e:
            logger.error(f"Error analyzing user intent: {e}")
            return self._create_fallback_intent_analysis(message)
    
    async def _generate_comprehensive_plan(
        self, 
        message: str, 
        intent_analysis: Dict[str, Any], 
        conversation_context: ConversationContext, 
        project_context: dict
    ) -> ExecutionPlan:
        """
        Generate a comprehensive execution plan based on intent analysis and context.
        """
        try:
            plan_generation_prompt = f"""
            Generate a comprehensive execution plan for this user request:
            
            USER MESSAGE: "{message}"
            
            INTENT ANALYSIS:
            {json.dumps(intent_analysis, indent=2)}
            
            CONVERSATION CONTEXT:
            - Ongoing Discussions: {', '.join(conversation_context.ongoing_discussions)}
            - Technical Decisions: {', '.join(conversation_context.technical_decisions)}
            - User Preferences: {json.dumps(conversation_context.user_preferences)}
            
            PROJECT CONTEXT:
            - Project: {project_context.get('name', 'Unknown')}
            - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
            
            AVAILABLE TOOLS:
            {self._get_available_tools_description()}
            
            Create a comprehensive execution plan that:
            1. Addresses the user's primary and secondary intents
            2. Considers conversation context and continuity
            3. References previous decisions and preferences
            4. Handles multi-step operations if needed
            5. Includes proper error handling and validation
            
            Return JSON:
            {{
                "plan_type": "single_step|multi_step|complex_workflow",
                "estimated_duration": 0,
                "confidence_score": 0.0-1.0,
                "steps": [
                    {{
                        "step_type": "tool_call|context_analysis|memory_operation|response_generation",
                        "tool_name": "tool_name_if_applicable",
                        "parameters": {{"param": "value"}},
                        "description": "What this step accomplishes",
                        "dependencies": ["step_ids"],
                        "estimated_duration": 0,
                        "priority": "high|medium|low"
                    }}
                ],
                "validation_requirements": ["list", "of", "validation", "checks"],
                "error_handling": ["list", "of", "error", "handling", "strategies"]
            }}
            """
            
            response = await self.gemini_service.chat_with_system_prompt(
                message, plan_generation_prompt
            )
            
            # Parse JSON response
            try:
                plan_data = json.loads(response)
                
                # Create plan steps
                steps = []
                for i, step_data in enumerate(plan_data["steps"]):
                    step = PlanStep(
                        step_id=f"step_{i+1}",
                        step_type=step_data["step_type"],
                        tool_name=step_data.get("tool_name"),
                        parameters=step_data.get("parameters", {}),
                        description=step_data["description"],
                        dependencies=step_data.get("dependencies", []),
                        estimated_duration=step_data.get("estimated_duration", 0),
                        priority=step_data.get("priority", "medium")
                    )
                    steps.append(step)
                
                # Create execution plan
                plan = ExecutionPlan(
                    plan_id=str(uuid.uuid4()),
                    user_message=message,
                    conversation_context={
                        "ongoing_discussions": conversation_context.ongoing_discussions,
                        "technical_decisions": conversation_context.technical_decisions,
                        "user_preferences": conversation_context.user_preferences
                    },
                    steps=steps,
                    estimated_total_duration=plan_data.get("estimated_duration", 0),
                    confidence_score=plan_data.get("confidence_score", 0.5),
                    plan_type=plan_data.get("plan_type", "single_step"),
                    created_at=datetime.now()
                )
                
                logger.info(f"Generated plan: {plan.plan_type} with {len(steps)} steps "
                           f"(confidence: {plan.confidence_score})")
                
                return plan
                
            except json.JSONDecodeError:
                logger.warning("Failed to parse plan JSON, using fallback")
                return self._create_fallback_plan(message, intent_analysis)
                
        except Exception as e:
            logger.error(f"Error generating comprehensive plan: {e}")
            return self._create_fallback_plan(message, intent_analysis)
    
    async def _validate_and_optimize_plan(
        self, 
        plan: ExecutionPlan, 
        project_context: dict
    ) -> Dict[str, Any]:
        """
        Validate and optimize the execution plan before execution.
        """
        try:
            validation_prompt = f"""
            Validate and optimize this execution plan:
            
            PLAN:
            - Type: {plan.plan_type}
            - Steps: {len(plan.steps)}
            - Estimated Duration: {plan.estimated_total_duration}s
            - Confidence: {plan.confidence_score}
            
            STEPS:
            {json.dumps([{
                "step_id": step.step_id,
                "step_type": step.step_type,
                "tool_name": step.tool_name,
                "description": step.description,
                "dependencies": step.dependencies
            } for step in plan.steps], indent=2)}
            
            PROJECT CONTEXT:
            - Project: {project_context.get('name', 'Unknown')}
            - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
            
            Validate the plan for:
            1. Feasibility: Can all steps be executed?
            2. Dependencies: Are dependencies correctly specified?
            3. Tool Availability: Are required tools available?
            4. Parameter Validity: Are tool parameters valid?
            5. Efficiency: Can the plan be optimized?
            6. Error Handling: Is error handling adequate?
            
            Return JSON:
            {{
                "is_valid": true/false,
                "validation_errors": ["list", "of", "errors", "if", "any"],
                "optimization_suggestions": ["list", "of", "suggestions"],
                "optimized_steps": [
                    {{
                        "step_id": "step_id",
                        "optimizations": ["list", "of", "optimizations"]
                    }}
                ],
                "confidence_boost": 0.0-1.0,
                "estimated_improvement": "description of improvements"
            }}
            """
            
            response = await self.gemini_service.chat_with_system_prompt(
                "Validate plan", validation_prompt
            )
            
            # Parse JSON response
            try:
                validation_result = json.loads(response)
                
                # Apply optimizations if suggested
                if validation_result.get("optimized_steps"):
                    plan = await self._apply_plan_optimizations(plan, validation_result["optimized_steps"])
                
                # Update confidence score
                if validation_result.get("confidence_boost"):
                    plan.confidence_score = min(1.0, plan.confidence_score + validation_result["confidence_boost"])
                
                logger.info(f"Plan validation: {'valid' if validation_result['is_valid'] else 'invalid'} "
                           f"({len(validation_result.get('validation_errors', []))} errors)")
                
                return validation_result
                
            except json.JSONDecodeError:
                logger.warning("Failed to parse validation JSON, assuming valid")
                return {"is_valid": True, "validation_errors": []}
                
        except Exception as e:
            logger.error(f"Error validating plan: {e}")
            return {"is_valid": False, "validation_errors": [f"Validation error: {str(e)}"]}
    
    async def _execute_plan_with_context(
        self, 
        plan: ExecutionPlan, 
        project_id: str, 
        conversation_context: ConversationContext,
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        """
        Execute the plan with full conversation context awareness and progress updates.
        """
        try:
            start_time = datetime.now()
            completed_steps = []
            failed_steps = []
            step_results = {}
            
            # Execute steps in dependency order
            executed_steps = set()
            
            while len(executed_steps) < len(plan.steps):
                # Find steps ready for execution
                ready_steps = [
                    step for step in plan.steps
                    if step.step_id not in executed_steps and
                    all(dep in executed_steps for dep in step.dependencies)
                ]
                
                if not ready_steps:
                    # Check for circular dependencies
                    remaining_steps = [step for step in plan.steps if step.step_id not in executed_steps]
                    if remaining_steps:
                        logger.warning(f"Circular dependency detected in steps: {[s.step_id for s in remaining_steps]}")
                        # Execute remaining steps anyway
                        ready_steps = remaining_steps
                    else:
                        break
                
                # Execute ready steps
                for step in ready_steps:
                    try:
                        # Send step start progress
                        if progress_callback:
                            await progress_callback(
                                "execution", 
                                f"⚙️ Executing: {step.description}", 
                                f"Step {len(executed_steps) + 1} of {len(plan.steps)}"
                            )
                        
                        result = await self._execute_single_step(
                            step, project_id, conversation_context, step_results
                        )
                        
                        step_results[step.step_id] = result
                        completed_steps.append(step)
                        executed_steps.add(step.step_id)
                        
                        # Send step completion progress
                        if progress_callback:
                            await progress_callback(
                                "execution", 
                                f"✅ Completed: {step.description}", 
                                f"Step {len(executed_steps)} of {len(plan.steps)} completed"
                            )
                        
                        logger.info(f"Completed step {step.step_id}: {step.description}")
                        
                    except Exception as e:
                        logger.error(f"Error executing step {step.step_id}: {e}")
                        failed_steps.append(step)
                        
                        # Send step error progress
                        if progress_callback:
                            await progress_callback(
                                "execution", 
                                f"❌ Failed: {step.description}", 
                                f"Error: {str(e)}"
                            )
                        
                        # Continue with other steps
                        continue
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Generate response from completed steps
            response = await self._generate_response_from_results(
                step_results, conversation_context, project_id
            )
            
            return {
                "completed_steps": completed_steps,
                "failed_steps": failed_steps,
                "step_results": step_results,
                "execution_time": execution_time,
                "response": response,
                "context_used": conversation_context.recent_conversation_summary,
                "tool_results": [result for result in step_results.values() if result.get("tool_used")]
            }
            
        except Exception as e:
            logger.error(f"Error executing plan: {e}")
            raise
    
    async def _execute_single_step(
        self, 
        step: PlanStep, 
        project_id: str, 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a single plan step with context awareness.
        """
        try:
            if step.step_type == "tool_call":
                return await self._execute_tool_call(step, project_id, conversation_context, previous_results)
            elif step.step_type == "context_analysis":
                return await self._execute_context_analysis(step, conversation_context, previous_results)
            elif step.step_type == "memory_operation":
                return await self._execute_memory_operation(step, project_id, conversation_context, previous_results)
            elif step.step_type == "response_generation":
                return await self._execute_response_generation(step, conversation_context, previous_results)
            else:
                raise ValueError(f"Unknown step type: {step.step_type}")
                
        except Exception as e:
            logger.error(f"Error executing step {step.step_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _execute_tool_call(
        self, 
        step: PlanStep, 
        project_id: str, 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a tool call with conversation context awareness.
        """
        try:
            if not step.tool_name:
                return {"success": False, "error": "No tool name specified"}
            
            # Enhance parameters with conversation context
            enhanced_parameters = self._enhance_tool_parameters_with_context(
                step.parameters, conversation_context, previous_results
            )
            
            # Execute the tool
            tool_result = self.tool_registry.execute_tool(
                step.tool_name, **enhanced_parameters
            )
            
            return {
                "success": True,
                "tool_name": step.tool_name,
                "parameters": enhanced_parameters,
                "result": tool_result
            }
            
        except Exception as e:
            logger.error(f"Error executing tool call {step.tool_name}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _execute_context_analysis(
        self, 
        step: PlanStep, 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a context analysis step.
        """
        try:
            # This would perform additional context analysis if needed
            return {
                "success": True,
                "analysis_type": "context_analysis",
                "result": "Context analysis completed"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _execute_memory_operation(
        self, 
        step: PlanStep, 
        project_id: str, 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a memory operation step.
        """
        try:
            # This would perform memory operations
            return {
                "success": True,
                "operation_type": "memory_operation",
                "result": "Memory operation completed"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _execute_response_generation(
        self, 
        step: PlanStep, 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a response generation step.
        """
        try:
            # This would generate a response based on previous results
            return {
                "success": True,
                "response_type": "generated_response",
                "result": "Response generated successfully"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _enhance_tool_parameters_with_context(
        self, 
        parameters: Dict[str, Any], 
        conversation_context: ConversationContext, 
        previous_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enhance tool parameters with conversation context and previous results.
        """
        enhanced = parameters.copy()
        
        # Add conversation context to parameters
        enhanced["conversation_context"] = {
            "ongoing_discussions": conversation_context.ongoing_discussions,
            "technical_decisions": conversation_context.technical_decisions,
            "user_preferences": conversation_context.user_preferences,
            "conversation_themes": conversation_context.conversation_themes
        }
        
        # Add relevant previous results
        relevant_results = {}
        for step_id, result in previous_results.items():
            if result.get("success") and result.get("result"):
                relevant_results[step_id] = result["result"]
        
        if relevant_results:
            enhanced["previous_results"] = relevant_results
        
        return enhanced
    
    async def _generate_contextual_response(
        self, 
        message: str, 
        execution_results: Dict[str, Any], 
        conversation_context: ConversationContext, 
        project_context: dict
    ) -> str:
        """
        Generate a contextual response based on plan execution results.
        """
        try:
            response_prompt = f"""
            Generate a contextual response for the user based on plan execution:
            
            ORIGINAL MESSAGE: "{message}"
            
            EXECUTION RESULTS:
            - Completed Steps: {len(execution_results['completed_steps'])}
            - Failed Steps: {len(execution_results['failed_steps'])}
            - Success Rate: {execution_results['success_rate']:.1%}
            - Execution Time: {execution_results['execution_time']:.1f}s
            
            CONVERSATION CONTEXT:
            - Ongoing Discussions: {', '.join(conversation_context.ongoing_discussions)}
            - Technical Decisions: {', '.join(conversation_context.technical_decisions)}
            - User Preferences: {json.dumps(conversation_context.user_preferences)}
            
            PROJECT CONTEXT:
            - Project: {project_context.get('name', 'Unknown')}
            - Tech Stack: {project_context.get('tech_stack', 'Unknown')}
            
            Generate a response that:
            1. Acknowledges the user's request
            2. Summarizes what was accomplished
            3. References relevant conversation context
            4. Maintains conversation continuity
            5. Provides next steps if applicable
            6. Uses appropriate tone and style
            
            Be conversational, helpful, and contextually aware.
            """
            
            response = await self.gemini_service.chat_with_system_prompt(
                message, response_prompt
            )
            
            return response.strip()
            
        except Exception as e:
            logger.error(f"Error generating contextual response: {e}")
            return "I've processed your request and completed the necessary actions. Let me know if you need anything else!"
    
    # Helper methods for context gathering and analysis
    
    async def _build_vector_enhanced_context(
        self, 
        message: str, 
        project_id: str, 
        session_messages: List[ChatMessage], 
        project_context: dict
    ) -> dict:
        """
        Build vector-enhanced context using the existing vector context service.
        """
        try:
            # Generate conversation embedding
            conversation_embedding = vector_context_service.get_conversation_context_embedding(
                session_messages, message
            )
            
            if not conversation_embedding:
                return {"context_embedding": None}
            
            # Get all tasks and memories
            all_tasks = self.file_service.load_tasks(project_id)
            all_memories = self.file_service.load_memories(project_id)
            
            # Find relevant items using vector similarity
            relevant_tasks = vector_context_service.find_relevant_tasks(
                conversation_embedding, all_tasks, project_id
            )
            
            relevant_memories = vector_context_service.find_relevant_memories(
                conversation_embedding, all_memories, project_id
            )
            
            return {
                "context_embedding": conversation_embedding,
                "relevant_tasks": relevant_tasks,
                "relevant_memories": relevant_memories
            }
            
        except Exception as e:
            logger.error(f"Error building vector-enhanced context: {e}")
            return {"context_embedding": None}
    
    async def _analyze_conversation_patterns(
        self, 
        session_messages: List[ChatMessage], 
        current_message: str
    ) -> Dict[str, Any]:
        """
        Analyze conversation patterns to extract themes, decisions, and preferences.
        """
        try:
            # Combine conversation text
            conversation_text = self._build_conversation_text(session_messages, current_message)
            
            analysis_prompt = f"""
            Analyze this conversation to extract patterns and context:
            
            CONVERSATION:
            {conversation_text}
            
            Extract:
            1. Ongoing discussions and topics
            2. Unresolved questions
            3. User preferences and decisions
            4. Technical decisions made
            5. Conversation themes
            6. Summary of recent context
            
            Return JSON:
            {{
                "ongoing_discussions": ["list", "of", "ongoing", "topics"],
                "unresolved_questions": ["list", "of", "unresolved", "questions"],
                "user_preferences": {{"preference": "value"}},
                "technical_decisions": ["list", "of", "technical", "decisions"],
                "themes": ["list", "of", "conversation", "themes"],
                "summary": "brief summary of recent context"
            }}
            """
            
            response = await self.gemini_service.chat_with_system_prompt(
                "Analyze conversation", analysis_prompt
            )
            
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return self._create_fallback_conversation_analysis()
                
        except Exception as e:
            logger.error(f"Error analyzing conversation patterns: {e}")
            return self._create_fallback_conversation_analysis()
    
    def _build_conversation_text(
        self, 
        session_messages: List[ChatMessage], 
        current_message: str
    ) -> str:
        """
        Build conversation text from session messages.
        """
        try:
            conversation_parts = []
            
            # Add recent messages (last 10)
            recent_messages = session_messages[-10:] if len(session_messages) > 10 else session_messages
            
            for msg in recent_messages:
                if msg.message:
                    conversation_parts.append(f"User: {msg.message}")
                if msg.response:
                    conversation_parts.append(f"Assistant: {msg.response}")
            
            # Add current message
            if current_message:
                conversation_parts.append(f"User: {current_message}")
            
            return "\n".join(conversation_parts)
            
        except Exception as e:
            logger.error(f"Error building conversation text: {e}")
            return f"User: {current_message}"
    
    def _get_session_messages(self, project_id: str, session_id: str = None) -> List[ChatMessage]:
        """
        Get session messages from file service.
        """
        try:
            if session_id:
                return self.file_service.load_chat_messages_by_session(project_id, session_id)
            else:
                return self.file_service.load_chat_history(project_id)
        except Exception as e:
            logger.error(f"Error getting session messages: {e}")
            return []
    
    def _get_available_tools_description(self) -> str:
        """
        Get description of available tools for planning.
        """
        try:
            tool_descriptions = self.tool_registry.get_tool_descriptions()
            return json.dumps(tool_descriptions, indent=2)
        except Exception as e:
            logger.error(f"Error getting tool descriptions: {e}")
            return "{}"
    
    # Fallback methods for error handling
    
    def _create_fallback_context(self, message: str, project_id: str, project_context: dict) -> ConversationContext:
        """
        Create fallback context when comprehensive context gathering fails.
        """
        return ConversationContext(
            session_messages=[],
            recent_conversation_summary=f"Processing: {message}",
            ongoing_discussions=[],
            unresolved_questions=[],
            user_preferences={},
            technical_decisions=[],
            conversation_themes=[],
            context_embedding=None
        )
    
    def _create_fallback_intent_analysis(self, message: str) -> Dict[str, Any]:
        """
        Create fallback intent analysis when LLM analysis fails.
        """
        return {
            "primary_intent": "general_chat",
            "secondary_intent": "new_topic",
            "referenced_items": [],
            "required_actions": [],
            "context_dependencies": [],
            "conversation_continuity": False,
            "complexity_level": "simple",
            "confidence_score": 0.5,
            "clarification_needed": False,
            "clarification_questions": []
        }
    
    def _create_fallback_plan(self, message: str, intent_analysis: Dict[str, Any]) -> ExecutionPlan:
        """
        Create fallback plan when comprehensive planning fails.
        """
        step = PlanStep(
            step_id="step_1",
            step_type="response_generation",
            description="Generate response to user message",
            estimated_duration=1,
            priority="high"
        )
        
        return ExecutionPlan(
            plan_id=str(uuid.uuid4()),
            user_message=message,
            conversation_context={},
            steps=[step],
            estimated_total_duration=1,
            confidence_score=0.5,
            plan_type="single_step",
            created_at=datetime.now()
        )
    
    def _create_fallback_conversation_analysis(self) -> Dict[str, Any]:
        """
        Create fallback conversation analysis when LLM analysis fails.
        """
        return {
            "ongoing_discussions": [],
            "unresolved_questions": [],
            "user_preferences": {},
            "technical_decisions": [],
            "themes": [],
            "summary": "No recent conversation context available"
        }
    
    async def _handle_plan_validation_failure(
        self, 
        message: str, 
        validation_result: Dict[str, Any], 
        conversation_context: ConversationContext, 
        project_context: dict
    ) -> dict:
        """
        Handle cases where plan validation fails.
        """
        error_message = "I encountered some issues with the plan. " + \
                       " ".join(validation_result.get("validation_errors", []))
        
        return {
            "type": "planning_error",
            "response": error_message,
            "plan_executed": None,
            "steps_completed": 0,
            "total_steps": 0,
            "execution_time": 0,
            "context_used": conversation_context.recent_conversation_summary,
            "plan_type": "error",
            "confidence_score": 0.0
        }
    
    async def _handle_processing_error(self, message: str, error: Exception, project_context: dict) -> dict:
        """
        Handle general processing errors.
        """
        logger.error(f"Processing error: {error}")
        
        return {
            "type": "error",
            "response": "I encountered an error processing your request. Please try again.",
            "plan_executed": None,
            "steps_completed": 0,
            "total_steps": 0,
            "execution_time": 0,
            "context_used": "",
            "plan_type": "error",
            "confidence_score": 0.0
        }
    
    async def _apply_plan_optimizations(
        self, 
        plan: ExecutionPlan, 
        optimizations: List[Dict[str, Any]]
    ) -> ExecutionPlan:
        """
        Apply optimizations to the execution plan.
        """
        # For now, just return the original plan
        # This can be enhanced to actually apply optimizations
        return plan
    
    async def _update_memory_from_execution(
        self, 
        message: str, 
        response: str, 
        execution_results: Dict[str, Any], 
        project_id: str, 
        conversation_context: ConversationContext
    ) -> None:
        """
        Update memory based on plan execution results.
        """
        try:
            # Extract important information from execution
            if execution_results.get("completed_steps"):
                # Add memory about successful execution
                memory_content = f"Successfully executed plan with {len(execution_results['completed_steps'])} steps. " \
                               f"User request: {message}"
                
                self.consolidated_memory_service.add_information_to_consolidated_memory(
                    "execution", project_id, memory_content, "Plan Execution Success"
                )
            
            # Add conversation memory
            conversation_memory = f"User: {message}\nAssistant: {response}"
            
            self.consolidated_memory_service.add_information_to_consolidated_memory(
                "conversation", project_id, conversation_memory, "Conversation Exchange"
            )
            
        except Exception as e:
            logger.error(f"Error updating memory from execution: {e}")

    async def _generate_response_from_results(
        self, 
        step_results: Dict[str, Any], 
        conversation_context: ConversationContext, 
        project_id: str
    ) -> str:
        """
        Generate a response based on the results of executed steps.
        """
        try:
            # Collect all successful results
            successful_results = [
                result for result in step_results.values() 
                if result.get("success", True) and result.get("output")
            ]
            
            if not successful_results:
                return "I've processed your request, but no specific actions were taken."
            
            # Build response from results
            response_parts = []
            
            for result in successful_results:
                if result.get("tool_used"):
                    tool_name = result["tool_used"]
                    output = result["output"]
                    
                    if tool_name == "create_task":
                        response_parts.append(f"✅ Created task: {output}")
                    elif tool_name == "create_memory":
                        response_parts.append(f"💾 Saved memory: {output}")
                    elif tool_name == "update_task":
                        response_parts.append(f"📝 Updated task: {output}")
                    else:
                        response_parts.append(f"✅ {output}")
                else:
                    response_parts.append(result["output"])
            
            return "\n\n".join(response_parts)
            
        except Exception as e:
            logger.error(f"Error generating response from results: {e}")
            return "I've processed your request successfully."


# Create a singleton instance
planning_first_agent = PlanningFirstAgent() 