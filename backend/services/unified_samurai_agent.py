"""
Unified Samurai Agent with Smart Memory Management

This module implements a unified agent that combines the best features of both
SamuraiAgent and PlanningFirstAgent with intelligent memory management that
only updates memories at session boundaries or explicit user requests.
"""

import uuid
import re
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass

try:
    from .gemini_service import GeminiService
    from .file_service import FileService
    from .memory_categorization import detect_memory_category, generate_category_specific_title
    from .consolidated_memory import ConsolidatedMemoryService
    from .vector_context_service import vector_context_service
    from .agent_tools import AgentToolRegistry
    from .response_generator import ResponseGenerator, ResponseContext
    from models import Task, Memory, Project, MemoryCategory, ChatMessage
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from file_service import FileService
    from memory_categorization import detect_memory_category, generate_category_specific_title
    from consolidated_memory import ConsolidatedMemoryService
    from vector_context_service import vector_context_service
    from agent_tools import AgentToolRegistry
    from response_generator import ResponseGenerator, ResponseContext
    from models import Task, Memory, Project, MemoryCategory, ChatMessage

logger = logging.getLogger(__name__)


@dataclass
class IntentAnalysis:
    """Represents the analysis of user intent."""
    intent_type: str  # pure_discussion, feature_exploration, spec_clarification, ready_for_action, direct_action
    confidence: float
    reasoning: str
    needs_clarification: bool
    clarification_questions: List[str]
    accumulated_specs: Dict[str, Any]


@dataclass
class ConversationContext:
    """Represents the full conversation context."""
    session_messages: List[ChatMessage]
    conversation_summary: str
    relevant_tasks: List[Task]
    relevant_memories: List[Memory]
    project_context: dict
    vector_embedding: Optional[List[float]] = None


class UnifiedSamuraiAgent:
    """
    Unified Samurai Agent with intelligent memory management.
    
    This agent combines:
    - Planning-first architecture from PlanningFirstAgent
    - Context loading and vector similarity from SamuraiAgent
    - Tool calling capabilities from both agents
    - Smart memory management that only updates at session boundaries or explicit requests
    """
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.file_service = FileService()
        self.tool_registry = AgentToolRegistry()
        self.consolidated_memory_service = ConsolidatedMemoryService()
        self.response_generator = ResponseGenerator()
        
        # Memory management configuration
        self.memory_update_triggers = [
            "remember this", "save this", "update memory", "don't forget", 
            "store this decision", "keep this in mind", "note this"
        ]
        
        # Intent analysis configuration
        self.intent_confidence_threshold = 0.7
        self.max_clarification_rounds = 3
        
        logger.info("UnifiedSamuraiAgent initialized with smart memory management and dynamic response generation")
    
    async def process_message(
        self, 
        message: str, 
        project_id: str, 
        project_context: dict, 
        session_id: str = None, 
        conversation_history: List[ChatMessage] = None,
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None
    ) -> dict:
        """
        Process user message with unified architecture and smart memory management.
        
        Args:
            message: User's message
            project_id: Project identifier
            project_context: Project context information
            session_id: Session identifier
            conversation_history: Conversation history
            progress_callback: Optional callback for progress updates
        """
        
        try:
            logger.info(f"Processing message with unified architecture: {message[:100]}...")
            
            # Step 1: Start processing
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "start", "🧠 Starting to process your request...", 
                    "Initializing unified agent", project_context
                )
            
            # Step 2: Load comprehensive context
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "context", "📚 Loading conversation context...", 
                    "Gathering conversation history and project context", project_context
                )
            
            conversation_context = await self._load_comprehensive_context(
                message, project_id, session_id, conversation_history, project_context
            )
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "context", "✅ Context loaded successfully", 
                    "Loaded conversation history and project context", project_context
                )
            
            # Step 3: Analyze user intent
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "analyzing", "🧠 Analyzing your intent...", 
                    "Understanding what you want to accomplish", project_context
                )
            
            intent_analysis = await self._analyze_user_intent(
                message, conversation_context
            )
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "analyzing", "✅ Intent analysis complete", 
                    f"Identified intent: {intent_analysis.intent_type}", project_context
                )
            
            # Step 4: Select response path based on intent
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "processing", "🔄 Processing your request...", 
                    "Executing the appropriate response path", project_context
                )
            
            response_result = await self._select_and_execute_response_path(
                message, intent_analysis, conversation_context, project_id, progress_callback
            )
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "processing", "✅ Processing complete", 
                    "Response generated successfully", project_context
                )
            
            # Step 5: Check for explicit memory update requests
            if self._is_explicit_memory_request(message):
                if progress_callback:
                    await self._send_dynamic_progress_update(
                        progress_callback, "memory", "💾 Updating memory...", 
                        "Processing explicit memory update request", project_context
                    )
                
                await self._handle_explicit_memory_update(
                    message, response_result.get("response", ""), conversation_context, project_id
                )
                
                if progress_callback:
                    await self._send_dynamic_progress_update(
                        progress_callback, "memory", "✅ Memory updated", 
                        "Explicit memory update completed", project_context
                    )
            
            # Step 6: Return unified response
            return {
                "type": response_result.get("type", "unified_response"),
                "response": response_result.get("response", "I've processed your request."),
                "tool_calls_made": response_result.get("tool_calls_made", 0),
                "tool_results": response_result.get("tool_results", []),
                "context_used": response_result.get("context_used", {}),
                "intent_analysis": {
                    "intent_type": intent_analysis.intent_type,
                    "confidence": intent_analysis.confidence,
                    "needs_clarification": intent_analysis.needs_clarification
                },
                "memory_updated": self._is_explicit_memory_request(message)
            }
                
        except Exception as e:
            logger.error(f"Error processing message with unified architecture: {e}")
            return await self._handle_processing_error(message, e, project_context)
    
    async def _send_dynamic_progress_update(
        self, 
        progress_callback: Callable[[str, str, str, Dict[str, Any]], None],
        stage: str, 
        message: str, 
        details: str, 
        project_context: dict
    ) -> None:
        """
        Send dynamic progress updates using the ResponseGenerator.
        """
        try:
            # Create response context for progress update
            response_context = ResponseContext(
                project_name=project_context.get('name', 'Unknown'),
                tech_stack=project_context.get('tech_stack', 'Unknown'),
                conversation_summary=f"Progress update: {stage}",
                relevant_tasks=[],
                relevant_memories=[],
                user_message="Progress update",
                intent_type="progress_update",
                confidence=1.0
            )
            
            # Generate dynamic progress message
            dynamic_message = await self.response_generator.generate_progress_update(
                stage, message, details, response_context
            )
            
            # Send the dynamic progress update
            await progress_callback(stage, dynamic_message, details, {})
            
        except Exception as e:
            logger.error(f"Error generating dynamic progress update: {e}")
            # Fallback to original message
            await progress_callback(stage, message, details, {})
    
    async def _load_comprehensive_context(
        self, 
        message: str, 
        project_id: str, 
        session_id: str, 
        conversation_history: List[ChatMessage], 
        project_context: dict
    ) -> ConversationContext:
        """
        Load comprehensive context including conversation history, vector-similar tasks/memories, and project context.
        """
        try:
            # Get session messages
            if conversation_history is not None:
                session_messages = conversation_history
                logger.info(f"Using provided conversation history with {len(session_messages)} messages")
            else:
                session_messages = self._get_session_messages(project_id, session_id)
                logger.info(f"Loaded {len(session_messages)} messages from file service")
            
            # Generate vector-enhanced context
            vector_context = await self._build_vector_enhanced_context(
                message, project_id, session_messages, project_context
            )
            
            # Create conversation summary
            conversation_summary = self._create_conversation_summary(session_messages, message)
            
            # Get relevant tasks and memories from vector context
            relevant_tasks = [task for task, _ in vector_context.get("relevant_tasks_with_scores", [])]
            relevant_memories = [memory for memory, _ in vector_context.get("relevant_memories_with_scores", [])]
            
            return ConversationContext(
                session_messages=session_messages,
                conversation_summary=conversation_summary,
                relevant_tasks=relevant_tasks,
                relevant_memories=relevant_memories,
                project_context=project_context,
                vector_embedding=vector_context.get("vector_embedding")
            )
            
        except Exception as e:
            logger.error(f"Error loading comprehensive context: {e}")
            return self._create_fallback_context(message, project_id, project_context)
    
    async def _analyze_user_intent(self, message: str, context: ConversationContext) -> IntentAnalysis:
        """
        Analyze user intent with sophisticated understanding of conversation context.
        """
        try:
            # Build context-aware prompt
            system_prompt = f"""
            You are an expert at understanding developer intent within conversation context.
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            PROJECT CONTEXT:
            - Project: {context.project_context.get('name', 'Unknown')}
            - Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}
            
            RELEVANT TASKS:
            {self._format_tasks_for_context(context.relevant_tasks)}
            
            RELEVANT MEMORIES:
            {self._format_memories_for_context(context.relevant_memories)}
            
            CURRENT MESSAGE: "{message}"
            
            Analyze the user's intent and classify it into exactly one of these categories:
            
            1. **pure_discussion** - Questions, explanations, general chat without action needed
               Examples: "What is JWT?", "How does authentication work?", "Hello", "Thanks"
            
            2. **feature_exploration** - User thinking about adding features, needs clarification
               Examples: "I'm thinking about adding authentication", "Maybe we should add a search feature"
            
            3. **spec_clarification** - User providing more details in response to agent questions
               Examples: "Yes, with email/password", "I want real-time notifications", "Include user profiles"
            
            4. **ready_for_action** - Complete specifications, ready to create tasks
               Examples: "Create tasks for JWT authentication with email/password", "Add user registration with email verification"
            
            5. **direct_action** - Immediate action requests
               Examples: "Mark login task as completed", "Delete that task", "Update the authentication method"
            
            Return ONLY the category name: pure_discussion, feature_exploration, spec_clarification, ready_for_action, or direct_action
            """
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            # Clean and parse response
            response_clean = response.strip().lower()
            
            # Map possible variations to standard intents
            intent_mapping = {
                "pure_discussion": "pure_discussion",
                "pure discussion": "pure_discussion",
                "discussion": "pure_discussion",
                "question": "pure_discussion",
                
                "feature_exploration": "feature_exploration",
                "feature exploration": "feature_exploration",
                "exploration": "feature_exploration",
                "thinking about": "feature_exploration",
                "maybe": "feature_exploration",
                
                "spec_clarification": "spec_clarification",
                "spec clarification": "spec_clarification",
                "clarification": "spec_clarification",
                "details": "spec_clarification",
                
                "ready_for_action": "ready_for_action",
                "ready for action": "ready_for_action",
                "create tasks": "ready_for_action",
                "add": "ready_for_action",
                "implement": "ready_for_action",
                
                "direct_action": "direct_action",
                "direct action": "direct_action",
                "mark": "direct_action",
                "delete": "direct_action",
                "complete": "direct_action"
            }
            
            # Find matching intent
            detected_intent = "pure_discussion"  # Default fallback
            for key, intent in intent_mapping.items():
                if key in response_clean:
                    detected_intent = intent
                    break
            
            # Additional keyword-based detection if LLM didn't provide clear intent
            if detected_intent == "pure_discussion":
                # Check for feature exploration keywords
                exploration_keywords = ["thinking about", "maybe", "considering", "wondering"]
                if any(keyword in message.lower() for keyword in exploration_keywords):
                    detected_intent = "feature_exploration"
                
                # Check for ready for action keywords
                action_keywords = ["create tasks", "add", "implement", "build"]
                if any(keyword in message.lower() for keyword in action_keywords):
                    detected_intent = "ready_for_action"
                
                # Check for direct action keywords
                direct_keywords = ["mark", "delete", "complete", "finish"]
                if any(keyword in message.lower() for keyword in direct_keywords):
                    detected_intent = "direct_action"
            
            return IntentAnalysis(
                intent_type=detected_intent,
                confidence=0.8 if detected_intent != "pure_discussion" else 0.6,
                reasoning=f"Detected intent: {detected_intent} based on message content",
                needs_clarification=detected_intent == "feature_exploration",
                clarification_questions=[],
                accumulated_specs={}
            )
                
        except Exception as e:
            logger.error(f"Error analyzing user intent: {e}")
            return self._create_fallback_intent_analysis(message)
    
    async def _select_and_execute_response_path(
        self, 
        message: str, 
        intent_analysis: IntentAnalysis, 
        context: ConversationContext, 
        project_id: str,
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None
    ) -> dict:
        """
        Select and execute the appropriate response path based on intent analysis.
        """
        try:
            if intent_analysis.intent_type == "pure_discussion":
                return await self._handle_pure_discussion(message, context)
            
            elif intent_analysis.intent_type == "feature_exploration":
                return await self._handle_feature_exploration(message, context, intent_analysis)
            
            elif intent_analysis.intent_type == "spec_clarification":
                return await self._handle_spec_clarification(message, context, intent_analysis)
            
            elif intent_analysis.intent_type == "ready_for_action":
                return await self._handle_ready_for_action(message, context, project_id, progress_callback)
            
            elif intent_analysis.intent_type == "direct_action":
                return await self._handle_direct_action(message, context, project_id, progress_callback)
            
            else:
                # Fallback to pure discussion
                return await self._handle_pure_discussion(message, context)
                
        except Exception as e:
            logger.error(f"Error in response path execution: {e}")
            return await self._handle_pure_discussion(message, context)
    
    async def _handle_pure_discussion(self, message: str, context: ConversationContext) -> dict:
        """
        Handle pure discussion - generate contextual response without tool calling.
        """
        try:
            # Create response context for the generator
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message=message,
                intent_type="pure_discussion",
                confidence=0.8
            )
            
            # Generate dynamic response
            response = await self.response_generator.generate_discussion_response(response_context)
            
            return {
                "type": "discussion_response",
                "response": response,
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": context.conversation_summary,
                    "relevant_memories_count": len(context.relevant_memories),
                    "relevant_tasks_count": len(context.relevant_tasks)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in pure discussion handling: {e}")
            return {
                "type": "discussion_response",
                "response": "I'm here to help with your project! What would you like to know about?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_feature_exploration(self, message: str, context: ConversationContext, intent_analysis: IntentAnalysis) -> dict:
        """
        Handle feature exploration - ask clarifying questions to gather complete specifications.
        """
        try:
            # Create response context for the generator
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message=message,
                intent_type="feature_exploration",
                confidence=intent_analysis.confidence
            )
            
            # Generate dynamic clarification questions
            response = await self.response_generator.generate_clarification_questions(response_context)
            
            return {
                "type": "clarification_request",
                "response": response,
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": context.conversation_summary,
                    "clarification_questions": intent_analysis.clarification_questions
                }
            }
            
        except Exception as e:
            logger.error(f"Error in feature exploration handling: {e}")
            return {
                "type": "clarification_request",
                "response": "That's an interesting idea! Could you provide more specific details about what you want to build?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_spec_clarification(self, message: str, context: ConversationContext, intent_analysis: IntentAnalysis) -> dict:
        """
        Handle specification clarification - acknowledge the details and check if ready for action.
        """
        try:
            # Create response context for the generator
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message=message,
                intent_type="spec_clarification",
                confidence=intent_analysis.confidence
            )
            
            # Generate dynamic spec clarification response
            response = await self.response_generator.generate_spec_clarification_response(
                response_context, intent_analysis.accumulated_specs
            )
            
            return {
                "type": "spec_clarification_response",
                "response": response,
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": context.conversation_summary,
                    "accumulated_specs": intent_analysis.accumulated_specs
                }
            }
            
        except Exception as e:
            logger.error(f"Error in spec clarification handling: {e}")
            return {
                "type": "spec_clarification_response",
                "response": "Thanks for those details! I'm getting a clearer picture. Would you like me to create tasks for this feature?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_ready_for_action(self, message: str, context: ConversationContext, project_id: str, progress_callback: Optional[Callable] = None) -> dict:
        """
        Handle ready for action - create comprehensive task breakdown and execute tool calls.
        """
        try:
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "planning", "📋 Creating task breakdown...", 
                    "Analyzing requirements and creating tasks", context.project_context
                )
            
            # Generate task breakdown
            task_breakdown = await self._generate_task_breakdown(message, context)
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "execution", "⚙️ Creating tasks...", 
                    "Executing task creation", context.project_context
                )
            
            # Execute task creation
            tool_results = await self._execute_task_creation(task_breakdown, project_id)
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "execution", "✅ Tasks created", 
                    f"Successfully created {len(tool_results)} tasks", context.project_context
                )
            
            # Generate response
            response = await self._generate_task_creation_response(tool_results, task_breakdown, context)
            
            return {
                "type": "task_creation_response",
                "response": response,
                "tool_calls_made": len(tool_results),
                "tool_results": tool_results,
                "context_used": {
                    "conversation_summary": context.conversation_summary,
                    "task_breakdown": task_breakdown
                }
            }
            
        except Exception as e:
            logger.error(f"Error in ready for action handling: {e}")
            return await self._handle_pure_discussion(message, context)
    
    async def _handle_direct_action(self, message: str, context: ConversationContext, project_id: str, progress_callback: Optional[Callable] = None) -> dict:
        """
        Handle direct action - execute immediate tool calls for task management.
        """
        try:
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "execution", "⚙️ Executing action...", 
                    "Processing your direct request", context.project_context
                )
            
            # Detect action type and execute
            action_result = await self._execute_direct_action(message, context, project_id)
            
            if progress_callback:
                await self._send_dynamic_progress_update(
                    progress_callback, "execution", "✅ Action completed", 
                    "Successfully executed your request", context.project_context
                )
            
            return {
                "type": "direct_action_response",
                "response": action_result.get("response", "Action completed successfully."),
                "tool_calls_made": action_result.get("tool_calls_made", 0),
                "tool_results": action_result.get("tool_results", []),
                "context_used": {
                    "conversation_summary": context.conversation_summary,
                    "action_type": action_result.get("action_type", "unknown")
                }
            }
            
        except Exception as e:
            logger.error(f"Error in direct action handling: {e}")
            return {
                "type": "direct_action_response",
                "response": "I encountered an issue processing your request. Could you try again?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    def _is_explicit_memory_request(self, message: str) -> bool:
        """
        Check if the message contains explicit memory update triggers.
        """
        message_lower = message.lower()
        return any(trigger in message_lower for trigger in self.memory_update_triggers)
    
    async def _handle_explicit_memory_update(self, message: str, response: str, context: ConversationContext, project_id: str) -> None:
        """
        Handle explicit memory update requests immediately.
        """
        try:
            conversation = f"User: {message}\nAssistant: {response}"
            
            # Extract important information
            important_info = await self._extract_important_information(conversation, context.project_context)
            
            if important_info:
                for info in important_info:
                    # Detect category and add to consolidated memory
                    category = detect_memory_category(info['content'])
                    
                    result = self.consolidated_memory_service.add_information_to_consolidated_memory(
                        category.value,
                        project_id,
                        info['content'],
                        info['title']
                    )
                    
                    logger.info(f"Explicit memory update: {result.get('message', 'No update')}")
            
        except Exception as e:
            logger.error(f"Error in explicit memory update: {e}")
    
    async def complete_session(self, session_id: str, project_id: str, project_context: dict) -> dict:
        """
        Complete a session and perform session-wide memory analysis.
        This is called when user clicks "start new conversation".
        """
        try:
            logger.info(f"Completing session {session_id} for project {project_id}")
            
            # Get all messages from the session
            session_messages = self._get_session_messages(project_id, session_id)
            
            if not session_messages:
                return {"status": "no_messages", "memories_created": 0}
            
            # Perform session-wide analysis
            session_analysis = await self._analyze_session_for_memories(session_messages, project_context)
            
            # Create memories from session insights
            memories_created = 0
            for insight in session_analysis.get("insights", []):
                if insight.get("importance_score", 0) > 0.7:  # Only high-importance insights
                    category = detect_memory_category(insight['content'])
                    
                    result = self.consolidated_memory_service.add_information_to_consolidated_memory(
                        category.value,
                        project_id,
                        insight['content'],
                        insight['title']
                    )
                    
                    if result.get("status") == "created" or result.get("status") == "updated":
                        memories_created += 1
            
            logger.info(f"Session completion: Created {memories_created} memories from session analysis")
            
            # Generate dynamic session completion response
            try:
                # Create response context for session completion
                response_context = ResponseContext(
                    project_name=project_context.get('name', 'Unknown'),
                    tech_stack=project_context.get('tech_stack', 'Unknown'),
                    conversation_summary=self._build_session_text(session_messages),
                    relevant_tasks=[],
                    relevant_memories=[],
                    user_message="Session completion",
                    intent_type="session_completion",
                    confidence=1.0
                )
                
                session_summary = {
                    "session_messages_count": len(session_messages),
                    "memories_created": memories_created,
                    "insights_analyzed": len(session_analysis.get("insights", []))
                }
                
                completion_response = await self.response_generator.generate_session_completion_response(
                    session_summary, response_context
                )
                
                return {
                    "status": "completed",
                    "memories_created": memories_created,
                    "session_messages_count": len(session_messages),
                    "insights_analyzed": len(session_analysis.get("insights", [])),
                    "completion_message": completion_response
                }
                
            except Exception as e:
                logger.error(f"Error generating session completion response: {e}")
                return {
                    "status": "completed",
                    "memories_created": memories_created,
                    "session_messages_count": len(session_messages),
                    "insights_analyzed": len(session_analysis.get("insights", []))
                }
            
        except Exception as e:
            logger.error(f"Error completing session: {e}")
            return {"status": "error", "error": str(e)}
    
    # Helper methods for context and processing
    async def _build_vector_enhanced_context(self, message: str, project_id: str, session_messages: List[ChatMessage], project_context: dict) -> dict:
        """Build vector-enhanced context using existing vector context service."""
        try:
            # Generate conversation embedding
            conversation_embedding = vector_context_service.get_conversation_context_embedding(
                session_messages, message
            )
            
            if not conversation_embedding:
                return self._create_fallback_vector_context(message, project_id, session_messages, project_context)
            
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
            
            # Assemble context
            assembled_context = vector_context_service.assemble_vector_context(
                session_messages, relevant_tasks, relevant_memories, message
            )
            
            return {
                "assembled_context": assembled_context,
                "relevant_tasks_with_scores": relevant_tasks,
                "relevant_memories_with_scores": relevant_memories,
                "vector_embedding": conversation_embedding
            }
            
        except Exception as e:
            logger.error(f"Error building vector-enhanced context: {e}")
            return self._create_fallback_vector_context(message, project_id, session_messages, project_context)
    
    def _create_conversation_summary(self, session_messages: List[ChatMessage], current_message: str) -> str:
        """Create a summary of the conversation context."""
        if not session_messages:
            return f"Current request: {current_message}"
        
        # Get last 5 messages for context
        recent_messages = session_messages[-5:]
        
        summary_parts = []
        for msg in recent_messages:
            if msg.message and not msg.response:
                summary_parts.append(f"User: {msg.message}")
            elif msg.response and not msg.message:
                summary_parts.append(f"Assistant: {msg.response}")
        
        summary_parts.append(f"Current: {current_message}")
        
        return "\n".join(summary_parts)
    
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
    
    def _get_session_messages(self, project_id: str, session_id: str = None) -> List[ChatMessage]:
        """Get session messages from file service."""
        try:
            if session_id:
                return self.file_service.load_chat_messages_by_session(project_id, session_id)
            else:
                return self.file_service.load_chat_history(project_id)
        except Exception as e:
            logger.error(f"Error getting session messages: {e}")
            return []
    
    # Fallback methods
    def _create_fallback_context(self, message: str, project_id: str, project_context: dict) -> ConversationContext:
        """Create fallback context when loading fails."""
        return ConversationContext(
            session_messages=[],
            conversation_summary=f"Current request: {message}",
            relevant_tasks=[],
            relevant_memories=[],
            project_context=project_context
        )
    
    def _create_fallback_intent_analysis(self, message: str) -> IntentAnalysis:
        """Create fallback intent analysis."""
        return IntentAnalysis(
            intent_type="pure_discussion",
            confidence=0.5,
            reasoning="Fallback analysis due to processing error",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={}
        )
    
    def _create_fallback_vector_context(self, message: str, project_id: str, session_messages: List[ChatMessage], project_context: dict) -> dict:
        """Create fallback vector context."""
        return {
            "assembled_context": f"Current request: {message}",
            "relevant_tasks_with_scores": [],
            "relevant_memories_with_scores": [],
            "vector_embedding": None
        }
    
    async def _handle_processing_error(self, message: str, error: Exception, project_context: dict) -> dict:
        """Handle processing errors gracefully with dynamic responses."""
        logger.error(f"Processing error: {error}")
        
        try:
            # Create response context for error handling
            response_context = ResponseContext(
                project_name=project_context.get('name', 'Unknown'),
                tech_stack=project_context.get('tech_stack', 'Unknown'),
                conversation_summary=f"Error occurred while processing: {message}",
                relevant_tasks=[],
                relevant_memories=[],
                user_message=message,
                intent_type="error",
                confidence=0.0
            )
            
            # Generate dynamic error response
            response = await self.response_generator.generate_error_response(error, response_context)
            
            return {
                "type": "error",
                "response": response,
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {},
                "error": str(error)
            }
            
        except Exception as e:
            logger.error(f"Error generating error response: {e}")
            return {
                "type": "error",
                "response": "I encountered an error processing your request. Please try again.",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {},
                "error": str(error)
            }
    
    # Task creation and execution methods
    async def _generate_task_breakdown(self, message: str, context: ConversationContext) -> List[dict]:
        """Generate task breakdown from user request."""
        try:
            system_prompt = f"""
            Break down this feature request into 3-7 specific, actionable tasks.
            
            PROJECT: {context.project_context.get('name', 'Unknown')}
            TECH STACK: {context.project_context.get('tech_stack', 'Unknown')}
            
            REQUEST: {message}
            
            CONVERSATION CONTEXT:
            {context.conversation_summary}
            
            RELEVANT PROJECT KNOWLEDGE:
            {self._format_memories_for_context(context.relevant_memories)}
            
            Create tasks that:
            1. Take 30-60 minutes each to complete
            2. Are in logical development order
            3. Are specific and actionable
            4. Consider existing project context
            
            Return JSON array:
            [
                {{"title": "Task Title", "description": "Detailed description"}},
                ...
            ]
            """
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse task breakdown JSON, using fallback")
                return [{"title": "Implement feature", "description": message}]
                
        except Exception as e:
            logger.error(f"Error generating task breakdown: {e}")
            return [{"title": "Implement feature", "description": message}]
    
    async def _execute_task_creation(self, task_breakdown: List[dict], project_id: str) -> List[dict]:
        """Execute task creation using tool registry."""
        results = []
        
        for task_data in task_breakdown:
            try:
                # Create task using tool registry
                result = await self.tool_registry.execute_tool(
                    "create_task",
                    title=task_data["title"],
                    description=task_data["description"],
                    project_id=project_id
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Error creating task: {e}")
                results.append({
                    "success": False,
                    "error": str(e),
                    "task_title": task_data.get("title", "Unknown")
                })
        
        return results
    
    async def _generate_task_creation_response(self, tool_results: List[dict], task_breakdown: List[dict], context: ConversationContext) -> str:
        """Generate dynamic response for task creation results."""
        try:
            # Create response context for the generator
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message="Task creation completed",
                intent_type="ready_for_action",
                confidence=0.9
            )
            
            # Generate dynamic task creation response
            response = await self.response_generator.generate_task_creation_response(
                tool_results, task_breakdown, response_context
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating task creation response: {e}")
            # Fallback to simple response
            successful_results = [r for r in tool_results if r.get("success", False)]
            if not successful_results:
                return "I encountered some issues creating the tasks. Please try again."
            
            response_parts = [f"✅ I've created {len(successful_results)} tasks for you:"]
            for i, task_data in enumerate(task_breakdown, 1):
                response_parts.append(f"{i}. {task_data['title']}")
            response_parts.append("\nYou can now work on these tasks one by one. Let me know when you complete any of them!")
            return "\n".join(response_parts)
    
    async def _execute_direct_action(self, message: str, context: ConversationContext, project_id: str) -> dict:
        """Execute direct actions like task completion, deletion, etc."""
        try:
            # Detect action type
            action_type = self._detect_action_type(message)
            
            if action_type == "task_completion":
                return await self._execute_task_completion(message, context, project_id)
            elif action_type == "task_deletion":
                return await self._execute_task_deletion(message, context, project_id)
            else:
                return {
                    "response": "I'm not sure what action you want me to take. Could you be more specific?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "unknown"
                }
                
        except Exception as e:
            logger.error(f"Error executing direct action: {e}")
            return {
                "response": "I encountered an issue processing your request. Please try again.",
                "tool_calls_made": 0,
                "tool_results": [],
                "action_type": "error"
            }
    
    def _detect_action_type(self, message: str) -> str:
        """Detect the type of direct action requested."""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["done", "complete", "finished", "completed"]):
            return "task_completion"
        elif any(word in message_lower for word in ["delete", "remove", "cancel"]):
            return "task_deletion"
        else:
            return "unknown"
    
    async def _execute_task_completion(self, message: str, context: ConversationContext, project_id: str) -> dict:
        """Execute task completion action."""
        try:
            # Find matching task
            matching_task = self._find_matching_task(message, context.relevant_tasks)
            
            if not matching_task:
                return {
                    "response": "I couldn't find a matching task. Could you be more specific?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "task_completion"
                }
            
            # Execute completion
            result = await self.tool_registry.execute_tool(
                "update_task_status",
                task_id=matching_task.id,
                status="completed",
                project_id=project_id
            )
            
            # Generate dynamic completion response
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message=message,
                intent_type="direct_action",
                confidence=0.9
            )
            
            response = await self.response_generator.generate_task_completion_response(matching_task, response_context)
            
            return {
                "response": response,
                "tool_calls_made": 1,
                "tool_results": [result],
                "action_type": "task_completion"
            }
            
        except Exception as e:
            logger.error(f"Error executing task completion: {e}")
            return {
                "response": "I encountered an issue completing the task. Please try again.",
                "tool_calls_made": 0,
                "tool_results": [],
                "action_type": "task_completion"
            }
    
    async def _execute_task_deletion(self, message: str, context: ConversationContext, project_id: str) -> dict:
        """Execute task deletion action."""
        try:
            # Find matching task
            matching_task = self._find_matching_task(message, context.relevant_tasks)
            
            if not matching_task:
                return {
                    "response": "I couldn't find a matching task. Could you be more specific?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "task_deletion"
                }
            
            # Execute deletion
            result = await self.tool_registry.execute_tool(
                "delete_task",
                task_id=matching_task.id,
                project_id=project_id
            )
            
            # Generate dynamic deletion response
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=context.relevant_tasks,
                relevant_memories=context.relevant_memories,
                user_message=message,
                intent_type="direct_action",
                confidence=0.9
            )
            
            response = await self.response_generator.generate_task_deletion_response(matching_task, response_context)
            
            return {
                "response": response,
                "tool_calls_made": 1,
                "tool_results": [result],
                "action_type": "task_deletion"
            }
            
        except Exception as e:
            logger.error(f"Error executing task deletion: {e}")
            return {
                "response": "I encountered an issue deleting the task. Please try again.",
                "tool_calls_made": 0,
                "tool_results": [],
                "action_type": "task_deletion"
            }
    
    def _find_matching_task(self, message: str, tasks: List[Task]) -> Optional[Task]:
        """Find a task that matches the message content."""
        message_words = set(message.lower().split())
        
        best_match = None
        best_score = 0
        
        for task in tasks:
            task_words = set((task.title + " " + task.description).lower().split())
            overlap = len(message_words.intersection(task_words))
            
            if overlap > best_score:
                best_score = overlap
                best_match = task
        
        return best_match if best_score > 0 else None
    
    async def _extract_important_information(self, conversation: str, project_context: dict) -> List[dict]:
        """Extract important information from conversation for memory storage."""
        try:
            system_prompt = f"""
            Analyze this conversation and extract any important technical decisions, feature specifications, or architectural choices that should be remembered.
            
            PROJECT: {project_context.get('name', 'Unknown')}
            TECH STACK: {project_context.get('tech_stack', 'Unknown')}
            
            CONVERSATION:
            {conversation}
            
            Extract information that falls into these categories:
            1. "decision" - Technical decisions made (database choice, architecture, etc.)
            2. "specification" - Feature specifications or requirements
            3. "note" - Important implementation notes or constraints
            
            Return JSON array:
            [
                {{"title": "Title", "content": "Content", "type": "decision|specification|note"}},
                ...
            ]
            
            Only include information that is substantial and worth remembering.
            """
            
            response = await self.gemini_service.chat_with_system_prompt(conversation, system_prompt)
            
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return []
                
        except Exception as e:
            logger.error(f"Error extracting important information: {e}")
            return []
    
    async def _analyze_session_for_memories(self, session_messages: List[ChatMessage], project_context: dict) -> dict:
        """Analyze entire session for memory creation."""
        try:
            # Build session text
            session_text = self._build_session_text(session_messages)
            
            system_prompt = f"""
            Analyze this entire conversation session and extract key insights that should be remembered for the project.
            
            PROJECT: {project_context.get('name', 'Unknown')}
            TECH STACK: {project_context.get('tech_stack', 'Unknown')}
            
            SESSION CONVERSATION:
            {session_text}
            
            Look for:
            1. Technical decisions that evolved during the conversation
            2. Complete feature specifications that developed over multiple messages
            3. User preferences that emerged during discussion
            4. Architectural decisions with reasoning
            5. Implementation patterns or approaches discussed
            
            Return JSON:
            {{
                "insights": [
                    {{
                        "title": "Insight Title",
                        "content": "Detailed insight content",
                        "type": "decision|specification|preference|pattern",
                        "importance_score": 0.0-1.0,
                        "reasoning": "Why this is important"
                    }}
                ]
            }}
            
            Only include insights with importance_score > 0.5.
            """
            
            response = await self.gemini_service.chat_with_system_prompt(session_text, system_prompt)
            
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return {"insights": []}
                
        except Exception as e:
            logger.error(f"Error analyzing session for memories: {e}")
            return {"insights": []}
    
    def _build_session_text(self, session_messages: List[ChatMessage]) -> str:
        """Build text representation of entire session."""
        if not session_messages:
            return ""
        
        session_parts = []
        for msg in session_messages:
            if msg.message and not msg.response:
                session_parts.append(f"User: {msg.message}")
            elif msg.response and not msg.message:
                session_parts.append(f"Assistant: {msg.response}")
            elif msg.message and msg.response:
                session_parts.append(f"User: {msg.message}")
                session_parts.append(f"Assistant: {msg.response}")
        
        return "\n".join(session_parts)


# Create singleton instance
unified_samurai_agent = UnifiedSamuraiAgent() 