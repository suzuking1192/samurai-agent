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
        Analyze user intent with enhanced understanding using the Samurai Engine prompt.
        """
        try:
            # Build enhanced context-aware prompt
            system_prompt = f"""You are Samurai Engine's intent analysis expert. Your role is to deeply understand developer conversations and classify user intent to enable the perfect "vibe coding partner" response.

CONVERSATION CONTEXT:
{context.conversation_summary}

PROJECT CONTEXT:
- Project: {context.project_context.get('name', 'Unknown')}
- Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}
- Project Stage: {context.project_context.get('stage', 'Development')}

RELEVANT TASKS:
{self._format_tasks_for_context(context.relevant_tasks)}

RELEVANT MEMORIES:
{self._format_memories_for_context(context.relevant_memories)}

CURRENT MESSAGE: "{message}"

## CHAIN OF THOUGHT ANALYSIS

Perform this step-by-step analysis:

### Step 1: Context Understanding
First, understand the conversational context:
- What has been discussed in recent messages?
- What is the user's current focus or project state?
- Are they in the middle of implementing something?
- Is this a continuation of a previous discussion?
- What technical decisions have been made recently?

### Step 2: Message Analysis
Analyze the current message for:
- **Action indicators**: Words like "create", "implement", "add", "build", "delete", "mark as"
- **Question indicators**: Words like "how", "what", "why", "should I", "can you"
- **Exploration language**: Words like "thinking about", "maybe", "considering", "wondering"
- **Specification language**: Direct answers to previous questions, specific technical details
- **Completeness signals**: Detailed requirements, clear scope, implementation-ready descriptions

### Step 3: Intent Pattern Recognition
Look for these specific patterns:

**PURE_DISCUSSION patterns:**
- Theoretical questions about technology concepts
- Seeking explanations or learning
- Casual conversation without project context
- General acknowledgments ("thanks", "hello", "got it")
- Questions about how things work conceptually
- No reference to their specific project implementation

**FEATURE_EXPLORATION patterns:**
- Expressing interest in new capabilities ("I want to add...")
- Vague feature descriptions without specifics
- Asking about feasibility ("Should I implement...")
- Brainstorming language ("What if we...", "Maybe we could...")
- High-level feature ideas without implementation details
- Seeking validation for feature concepts

**SPEC_CLARIFICATION patterns:**
- Direct answers to agent's previous questions
- Adding specific details to previously mentioned features
- Responding with technical preferences when asked
- Providing missing pieces of information
- Clarifying requirements in response to follow-up questions
- Building on previous discussion with concrete details

**READY_FOR_ACTION patterns:**
- Complete feature descriptions with clear scope
- Explicit requests to create tasks or implementation plans
- Detailed requirements with technical specifications
- Clear acceptance criteria or success metrics
- Implementation-ready descriptions
- Direct requests like "break this down into tasks"

**DIRECT_ACTION patterns:**
- Task status updates ("completed", "done with", "finished")
- Explicit task management requests ("mark as", "delete", "update")
- Direct commands about existing tasks or project elements
- Progress reports on current implementation
- Requests to modify existing tasks or memories

### Step 4: Conversation Flow Analysis
Consider the conversation progression:
- If agent recently asked clarifying questions → likely spec_clarification
- If user just introduced a new idea → likely feature_exploration
- If agent provided task breakdown → user response likely direct_action or spec_clarification
- If user is asking conceptual questions → likely pure_discussion
- If user provides complete requirements → likely ready_for_action

### Step 5: Ambiguity Resolution
When intent is unclear, use these tie-breakers:

1. **Context Priority**: Recent conversation context takes precedence
2. **Specificity Indicator**: More specific technical details = closer to ready_for_action
3. **Question vs Statement**: Questions lean toward discussion/exploration, statements toward action
4. **Project Reference**: References to their specific project suggest action-oriented intent
5. **Implementation Language**: Technical implementation details suggest ready_for_action

### Step 6: Confidence Assessment
Rate your confidence (internal use):
- High: Clear patterns match, context supports classification
- Medium: Some ambiguity but patterns lean toward one category
- Low: Multiple possible interpretations, use conversation context to decide

### Step 7: Final Classification
Based on the chain of thought analysis above, classify into exactly ONE category:

## INTENT CATEGORIES

**pure_discussion**: 
- Theoretical/educational questions
- General technology discussions
- Casual conversation
- Concept explanations
- No project-specific action implied

**feature_exploration**: 
- Vague feature ideas needing clarification
- Brainstorming new capabilities
- Seeking feasibility advice
- High-level feature concepts
- Requires agent to ask clarifying questions

**spec_clarification**: 
- Answering agent's previous questions
- Adding details to existing discussions
- Providing technical preferences
- Building on previous feature exploration
- Part of ongoing specification gathering

**ready_for_action**: 
- Complete feature specifications
- Clear implementation requirements
- Explicit task creation requests
- Detailed scope with acceptance criteria
- Ready for task breakdown

**direct_action**: 
- Task status updates
- Explicit task management commands
- Progress reports
- Requests to modify existing tasks
- Direct project management actions

## REFLECTION CHECK

Before finalizing, ask yourself:
1. Does this classification align with the conversation flow?
2. Would this classification lead to the most helpful agent response?
3. Is the user expecting clarifying questions or action?
4. Does the classification match the user's apparent readiness level?
5. Is there any conversation context that suggests a different intent?

If any reflection questions suggest a different classification, reconsider your analysis.

## OUTPUT FORMAT

Return ONLY the category name: pure_discussion, feature_exploration, spec_clarification, ready_for_action, or direct_action

## EXAMPLES FOR CALIBRATION

**Message**: "I'm thinking about adding user authentication"
**Context**: New topic, no recent auth discussion
**Analysis**: Vague feature idea, needs clarification about auth type, requirements
**Classification**: feature_exploration

**Message**: "Yes, with JWT tokens and email/password login"
**Context**: Agent just asked about auth preferences
**Analysis**: Direct answer to agent question, adding specific technical details
**Classification**: spec_clarification

**Message**: "Create tasks for JWT authentication with email/password, including signup, login, and password reset flows with proper validation"
**Context**: Feature has been discussed and specified
**Analysis**: Complete requirements, explicit task request, implementation-ready
**Classification**: ready_for_action

**Message**: "How does JWT authentication work?"
**Context**: General question, no project implementation context
**Analysis**: Educational question, seeking concept explanation
**Classification**: pure_discussion

**Message**: "I finished the login API endpoint task"
**Context**: Task was previously created and assigned
**Analysis**: Status update on existing task, direct project management
**Classification**: direct_action

Use this framework to analyze the current message and provide the most accurate intent classification."""

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
                reasoning=f"Detected intent: {detected_intent} based on enhanced analysis",
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
        """Generate task breakdown from user request using enhanced AI-optimized prompt."""
        try:
            system_prompt = f"""
# Enhanced AI-Optimized Task Breakdown Prompt for Samurai Engine

You are Samurai Engine's task breakdown specialist. Your role is to analyze feature requests and create the optimal number of AI-friendly implementation tasks that can be effectively handled by coding agents like Cursor.

## PROJECT CONTEXT
**Project:** {context.project_context.get('name', 'Unknown')}
**Tech Stack:** {context.project_context.get('tech_stack', 'Unknown')}


## FEATURE REQUEST TO ANALYZE
**User Request:** "{message}"

## CONVERSATION CONTEXT
**Discussion History:**
{context.conversation_summary}

**Relevant Project Knowledge:**
{self._format_memories_for_context(context.relevant_memories)}

**Related Existing Tasks:**
{self._format_tasks_for_context(context.relevant_tasks)}

---

## CHAIN OF THOUGHT TASK BREAKDOWN ANALYSIS

### Step 1: Feature Complexity Assessment

**Analyze the feature request across these dimensions:**

**A. Technical Complexity Score (1-10):**
- Database schema changes needed?
- API endpoints required?
- Frontend components complexity?
- Integration with existing systems?
- Third-party service dependencies?

**B. Feature Scope Score (1-10):**
- Single component vs multi-component feature?
- Affects one user flow vs multiple flows?
- Standalone vs deeply integrated feature?
- Number of distinct functionalities involved?

**C. AI Implementation Difficulty (1-10):**
- Are tasks clearly definable with specific inputs/outputs?
- Can each piece be implemented independently?
- Are requirements concrete enough for AI coding agents?
- How much existing code context is needed?

**Calculate Overall Complexity:** (A + B + C) / 3

### Step 2: Task Granularity Strategy Selection

**Based on complexity analysis, select task breakdown strategy:**

**MICRO TASKS (Complexity 1-3):**
- Feature is already appropriately sized for AI agents
- Single, focused functionality
- **Strategy:** Create 1-2 tasks maximum, or recommend no breakdown
- **AI Agent Focus:** Complete small features in single implementations

**BALANCED TASKS (Complexity 4-6):**
- Feature needs moderate breakdown
- Multiple related components
- **Strategy:** Create 2-5 tasks based on logical separation
- **AI Agent Focus:** Each task = one complete, testable functionality

**STRUCTURED BREAKDOWN (Complexity 7-10):**
- Complex feature requiring systematic breakdown
- Multiple systems, components, or workflows
- **Strategy:** Create 4-8 tasks with clear dependencies
- **AI Agent Focus:** Each task = one architectural layer or component

### Step 3: AI Agent Task Optimization

**For each potential task, ensure it meets AI coding agent requirements:**

**AI-Friendly Task Characteristics:**
- **Single, clear objective** - one main thing to build/modify
- **Concrete inputs/outputs** - specific files, functions, or components
- **Minimal context switching** - focuses on one part of the codebase
- **Testable outcome** - can verify completion independently
- **Self-contained scope** - doesn't require understanding entire system

**Task Sizing Principles:**
- **Not time-based** (ignore 30-60 minute guideline)
- **Functionality-based** - complete one logical piece
- **AI-completion-sized** - what an AI can handle in one focused session
- **Dependency-aware** - clear prerequisites and follow-ups

### Step 4: Logical Development Sequence Analysis

**Determine optimal task order based on:**

**Technical Dependencies:**
- Database schema before API endpoints
- API endpoints before frontend integration
- Core functionality before UI enhancements
- Authentication before protected features

**Risk Mitigation:**
- Highest-risk/most-complex tasks early
- Core functionality before optional features
- Integration points identified and planned

**Testing and Validation:**
- Each task produces testable output
- Progressive building allows validation at each step
- Early tasks establish foundation for later ones

### Step 5: Project Context Integration

**Leverage existing project patterns:**

**Code Pattern Consistency:**
- How do they typically structure similar features?
- What naming conventions and file organizations do they use?
- What testing patterns are established?
- What error handling approaches do they prefer?

**Architecture Alignment:**
- How does this feature fit their existing architecture?
- What existing components/utilities can be leveraged?
- What integration points with current features exist?
- What data flow patterns should be maintained?

### Step 6: Task Breakdown Decision & Self-Reflection

**Decision Framework:**

**SINGLE TASK (No breakdown needed):**
- Feature request is already AI-agent sized
- Single component or simple modification
- Adding one clear piece of functionality
- **Example:** "Add email validation to existing form"

**MINIMAL BREAKDOWN (2-3 tasks):**
- Feature has 2-3 distinct components
- Clear separation between backend/frontend
- Simple linear dependency chain
- **Example:** "Add user profile: API + UI + Integration"

**STRUCTURED BREAKDOWN (4-8 tasks):**
- Complex feature with multiple systems
- Multiple user flows or components
- Complex dependency relationships
- **Example:** "Full authentication system with multiple flows"

**Self-Reflection Quality Check:**
1. **AI Feasibility:** Can each task be completed by an AI coding agent independently?
2. **Completeness:** Do tasks cover all aspects of the feature request?
3. **Logical Flow:** Is the development sequence logical and dependency-aware?
4. **Project Fit:** Do tasks align with existing code patterns and architecture?
5. **Right-Sized:** Are tasks neither too trivial nor too complex for AI agents?

### Step 7: Task Specification Generation

**For each task, create complete Task model data:**

**Task Structure (matching Task model):**
```json
{{
    "title": "Concise, action-oriented title (max 200 chars)",
    "description": "Complete, copy-paste ready implementation guide (max 1000 chars)",
    "priority": "high|medium|low",
    "order": 0
}}
```

**Task Title Guidelines:**
- Action verb + specific component/feature
- Reference existing code patterns when relevant
- Clear enough to understand scope immediately
- Keep under 200 characters

**Task Description Guidelines (Most Critical - Serves as Cursor Prompt):**
- Complete, standalone implementation instructions
- Include full project context and tech stack
- Reference existing code patterns and file structure
- Specify exact files to create/modify
- Include acceptance criteria and testing guidance
- Must be copy-paste ready for Cursor
- Keep under 1000 characters while being comprehensive

**Priority Assignment Logic:**
- **High:** Core functionality, blocking dependencies, critical path items
- **Medium:** Important features, standard functionality, non-blocking work
- **Low:** Nice-to-have features, optimizations, polish items

**Order Assignment:**
- Sequential numbers (0, 1, 2, ...) based on dependency order
- Tasks with no dependencies get lower numbers
- Dependent tasks get higher numbers
- Ensures logical development progression

---

## CURSOR-READY DESCRIPTION FRAMEWORK

**Each task's description field must be a complete, standalone implementation guide:**

### Description Template Structure (under 1000 chars):
```
PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}

CONTEXT: [Brief existing patterns context]

TASK: [Specific implementation requirements]

FILES: [Files to create/modify]

REQUIREMENTS:
- [Key requirement 1]
- [Key requirement 2]
- [Key requirement 3]

ACCEPTANCE: [How to verify completion]

Follow existing code patterns and maintain consistency.
```

### Description Quality Standards:
- **Self-contained:** AI agent needs no additional context
- **Specific:** Exact files, functions, and implementations specified
- **Context-aware:** References existing project patterns
- **Actionable:** Clear steps and deliverables
- **Testable:** Includes validation criteria
- **Consistent:** Maintains project coding standards
- **Concise:** Maximum impact within 1000 character limit

---

## TASK BREAKDOWN EXECUTION

**Based on your analysis above, execute the task breakdown:**

### Complexity Assessment Results:
- Technical Complexity: [Score]
- Feature Scope: [Score] 
- AI Implementation Difficulty: [Score]
- **Overall Complexity:** [Score]

### Breakdown Strategy Selected:
[MICRO TASKS | BALANCED TASKS | STRUCTURED BREAKDOWN]

### Reasoning:
[2-3 sentences explaining why this breakdown approach fits the feature request]

### Generated Tasks:

```json
[
    {{
        "title": "Task title following guidelines above",
        "description": "PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}\\n\\nCONTEXT: Brief existing patterns context\\n\\nTASK: Specific implementation requirements\\n\\nFILES: Files to create/modify\\n\\nREQUIREMENTS:\\n- Key requirement 1\\n- Key requirement 2\\n\\nACCEPTANCE: Verification criteria\\n\\nFollow existing code patterns and maintain consistency.",
        "priority": "high|medium|low",
        "order": 0
    }},
    {{
        "title": "Second task title",
        "description": "Complete second task description following same template structure under 1000 chars",
        "priority": "medium",
        "order": 1
    }}
]
```

---

## SPECIAL CASES & ADAPTATIONS

**If Feature Request is Already AI-Sized:**
```json
{{
    "breakdown_needed": false,
    "reason": "Feature request is already appropriately sized for AI implementation",
    "recommendation": "Implement as single focused task",
    "single_task": {{
        "title": "Enhanced title based on original request",
        "description": "PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}\\n\\nCONTEXT: Brief existing patterns context\\n\\nTASK: Complete implementation requirements\\n\\nFILES: Files to modify\\n\\nREQUIREMENTS:\\n- Key deliverables\\n\\nACCEPTANCE: Success criteria",
        "priority": "medium",
        "order": 0
    }}
}}
```

**If Feature Request is Unclear/Incomplete:**
```json
{{
    "breakdown_needed": false,
    "reason": "Feature request needs more specification before task breakdown",
    "missing_details": ["specific", "aspects", "needing", "clarification"],
    "recommendation": "Gather more detailed requirements before creating implementation tasks"
}}
```

---

## QUALITY STANDARDS FOR FINAL OUTPUT

**Each task must:**
- Have title under 200 characters
- Have description under 1000 characters serving as complete Cursor prompt
- Include appropriate priority based on dependency and importance
- Have correct order number for development sequence
- Be implementable by Cursor using only the description field

**Each task description must:**
- Be completely self-contained with full context
- Reference specific existing files and patterns
- Include exact deliverables and acceptance criteria
- Maintain consistency with project architecture
- Enable successful AI implementation without additional questions
- Fit within 1000 character limit while remaining comprehensive

**Overall breakdown must:**
- Cover complete feature request scope
- Maintain logical development sequence through order field
- Optimize for Cursor implementation success
- Balance task granularity (not too many, not too few)
- Generate production-ready, copy-paste descriptions

Remember: The description field is now the complete implementation guide - it must contain everything an AI coding agent needs to successfully implement the task without additional context or clarification, all within the 1000 character limit.

---

## QUALITY STANDARDS FOR FINAL OUTPUT

**Each task must:**
- Be implementable by AI coding agent independently
- Have clear, specific deliverables
- Reference existing project patterns and files
- Include validation criteria
- Maintain logical development sequence
- Align with project architecture and conventions

**Overall breakdown must:**
- Cover complete feature request
- Minimize unnecessary task proliferation
- Optimize for AI agent implementation success
- Maintain project consistency and quality
- Enable progressive development and testing

Remember: The goal is creating the optimal number of AI-friendly tasks that enable successful feature implementation, not adhering to arbitrary task count limits.
"""
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            try:
                # Clean the response to handle markdown code blocks
                cleaned_response = response.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response[7:]  # Remove ```json
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[3:]  # Remove ```
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:-3]  # Remove ```
                cleaned_response = cleaned_response.strip()
                
                parsed_response = json.loads(cleaned_response)
                
                # Handle special cases from enhanced prompt
                if isinstance(parsed_response, dict):
                    if parsed_response.get("breakdown_needed") == False:
                        if "single_task" in parsed_response:
                            return [parsed_response["single_task"]]
                        else:
                            # Return a single task with the original message
                            return [{
                                "title": "Implement feature request",
                                "description": f"PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}\n\nTASK: {message}\n\nFILES: To be determined based on implementation\n\nREQUIREMENTS:\n- Implement the requested feature\n- Follow existing code patterns\n\nACCEPTANCE: Feature works as requested",
                                "priority": "medium",
                                "order": 0
                            }]
                    else:
                        # If it's a dict but not a special case, try to extract tasks
                        return [parsed_response]
                
                # Handle normal array response
                if isinstance(parsed_response, list):
                    return parsed_response
                
                # Fallback for unexpected response format
                logger.warning("Unexpected response format from task breakdown, using fallback")
                return [{"title": "Implement feature", "description": message}]
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse task breakdown JSON: {e}")
                # Try to extract JSON from the response using regex
                import re
                json_pattern = r'\[.*\]'
                matches = re.findall(json_pattern, response, re.DOTALL)
                if matches:
                    try:
                        parsed_response = json.loads(matches[0])
                        if isinstance(parsed_response, list):
                            return parsed_response
                    except:
                        pass
                
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
        """Execute direct actions using LLM detection and comprehensive tool access."""
        
        # Step 1: Use LLM to detect actions
        action_analysis_prompt = f"""
You are Samurai Engine's action detection expert. Analyze the user's message to identify specific actions they want to perform.

PROJECT CONTEXT:
- Project: {context.project_context.get('name', 'Unknown')}
- Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}

CONVERSATION CONTEXT:
{context.conversation_summary}

CURRENT TASKS:
{self._format_tasks_for_context(context.relevant_tasks)}

RELEVANT MEMORIES:
{self._format_memories_for_context(context.relevant_memories)}

USER MESSAGE: "{message}"

AVAILABLE TOOLS:
- create_task: Create a new task in the project
- update_task: Update an existing task's details
- change_task_status: Change the status of a task (pending, in_progress, completed, blocked)
- search_tasks: Search for tasks by title, description, or status
- delete_task: Delete a task from the project
- create_memory: Create a new memory entry
- update_memory: Update an existing memory
- search_memories: Search for memories by title or content
- delete_memory: Delete a memory from the project

CHAIN OF THOUGHT ANALYSIS:

### Step 1: Intent Recognition
Analyze what the user wants to accomplish:
- Are they updating task status? (words: done, completed, finished, mark as)
- Are they modifying existing items? (words: update, change, edit, modify)
- Are they deleting items? (words: delete, remove, cancel)
- Are they creating new items? (words: add, create, make)
- Are they searching for items? (words: find, show, search, list)
- Are they performing multiple actions in sequence?

### Step 2: Entity Identification
Identify what items they're referring to:
- Specific task titles or descriptions mentioned
- Memory titles or topics referenced
- Generic references requiring search (e.g., "the login task", "authentication memory")

### Step 3: Action Sequencing
Determine if actions need to be performed in sequence:
- Do they need to search before updating/deleting?
- Are there multiple independent actions?
- What's the logical order of operations?

### Step 4: Parameter Extraction
Extract specific parameters for each action:
- Task/memory identifiers (titles, partial titles, descriptions)
- New values for updates (status, priority, content)
- Search criteria and filters

## OUTPUT FORMAT

Return JSON with detected actions in execution order:

{{
    "actions_detected": true/false,
    "action_count": number,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of what was detected",
    "actions": [
        {{
            "tool_name": "tool_to_execute",
            "parameters": {{
                "param1": "value1",
                "param2": "value2"
            }},
            "requires_search_first": true/false,
            "search_tool": "search_tasks|search_memories",
            "search_query": "search terms if needed",
            "description": "Human readable description of this action"
        }}
    ]
}}

## EXAMPLES FOR CALIBRATION

**User**: "Mark the login task as completed"
**Analysis**: Single action, status update, specific task reference
**Output**: 
{{
    "actions_detected": true,
    "action_count": 1,
    "confidence": 0.9,
    "reasoning": "User wants to mark a specific task as completed",
    "actions": [{{
        "tool_name": "change_task_status",
        "parameters": {{"task_identifier": "login", "new_status": "completed", "project_id": "{project_id}"}},
        "requires_search_first": false,
        "description": "Mark login task as completed"
    }}]
}}

**User**: "Delete the old authentication tasks and create a new one for JWT implementation"
**Analysis**: Multiple actions - delete (requires search) + create
**Output**:
{{
    "actions_detected": true,
    "action_count": 2,
    "confidence": 0.8,
    "reasoning": "User wants to delete old tasks and create a new one",
    "actions": [
        {{
            "tool_name": "search_tasks",
            "parameters": {{"query": "authentication", "project_id": "{project_id}"}},
            "requires_search_first": false,
            "description": "Search for authentication tasks to delete"
        }},
        {{
            "tool_name": "create_task",
            "parameters": {{"title": "JWT Implementation", "description": "Implement JWT authentication system", "project_id": "{project_id}"}},
            "requires_search_first": false,
            "description": "Create new JWT implementation task"
        }}
    ]
}}

**User**: "Update the database memory with the new PostgreSQL configuration details"
**Analysis**: Update action requiring search first to find the memory
**Output**:
{{
    "actions_detected": true,
    "action_count": 1,
    "confidence": 0.8,
    "reasoning": "User wants to update a specific memory with new content",
    "actions": [{{
        "tool_name": "update_memory",
        "parameters": {{"memory_identifier": "database", "content": "new PostgreSQL configuration details", "project_id": "{project_id}"}},
        "requires_search_first": true,
        "search_tool": "search_memories",
        "search_query": "database PostgreSQL",
        "description": "Update database memory with new PostgreSQL configuration"
    }}]
}}

Analyze the user's message and return the appropriate JSON structure for detected actions.
"""
        
        # Get LLM analysis
        try:
            analysis_response = await self.gemini_service.chat_with_system_prompt(
                "Analyze the user's message for direct actions",
                action_analysis_prompt
            )
            
            action_analysis = self._parse_action_analysis(analysis_response)
            
            if not action_analysis.get("actions_detected", False):
                return {
                    "response": "I'm not sure what specific action you want me to take. Could you be more explicit about what you'd like me to do?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "no_actions_detected"
                }
            
            # Step 2: Execute detected actions
            return await self._execute_detected_actions(action_analysis, project_id, context)
            
        except Exception as e:
            logger.error(f"Error in LLM action detection: {e}")
            return await self._fallback_action_detection(message, context, project_id)
    
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

    async def _execute_detected_actions(self, action_analysis: dict, project_id: str, context: ConversationContext) -> dict:
        """Execute the actions detected by LLM analysis."""
        
        actions = action_analysis.get("actions", [])
        tool_results = []
        total_tool_calls = 0
        response_parts = []
        
        try:
            for action in actions:
                # Handle search-first requirement
                if action.get("requires_search_first", False):
                    search_results = await self._execute_search_before_action(action, project_id)
                    if search_results:
                        # Update action parameters with search results
                        action = await self._refine_action_with_search_results(action, search_results)
                        total_tool_calls += 1
                    else:
                        response_parts.append(f"❌ Could not find items for: {action.get('description', 'unknown action')}")
                        continue
                
                # Execute the main action
                tool_name = action.get("tool_name")
                parameters = action.get("parameters", {})
                
                if tool_name in self.tool_registry.get_available_tools():
                    result = self.tool_registry.execute_tool(tool_name, **parameters)
                    tool_results.append(result)
                    total_tool_calls += 1
                    
                    if result.get("success", False):
                        response_parts.append(result.get("message", f"✅ Completed: {action.get('description')}"))
                    else:
                        response_parts.append(result.get("message", f"❌ Failed: {action.get('description')}"))
                else:
                    response_parts.append(f"❌ Unknown action: {tool_name}")
            
            # Generate comprehensive response
            if response_parts:
                response = "\n".join(response_parts)
            else:
                response = "I completed the requested actions."
            
            return {
                "response": response,
                "tool_calls_made": total_tool_calls,
                "tool_results": tool_results,
                "action_type": "multiple_actions" if len(actions) > 1 else "single_action",
                "actions_executed": len([r for r in tool_results if r.get("success", False)]),
                "actions_failed": len([r for r in tool_results if not r.get("success", True)])
            }
            
        except Exception as e:
            logger.error(f"Error executing detected actions: {e}")
            return {
                "response": "I encountered an error while executing your requests. Some actions may have been completed.",
                "tool_calls_made": total_tool_calls,
                "tool_results": tool_results,
                "action_type": "error"
            }

    async def _execute_search_before_action(self, action: dict, project_id: str) -> list:
        """Execute search before the main action to find target items."""
        
        search_tool = action.get("search_tool", "search_tasks")
        search_query = action.get("search_query", "")
        
        if not search_query:
            return []
        
        try:
            search_result = self.tool_registry.execute_tool(
                search_tool,
                query=search_query,
                project_id=project_id
            )
            
            if search_result.get("success", False):
                return search_result.get("tasks", []) or search_result.get("memories", [])
            
            return []
            
        except Exception as e:
            logger.error(f"Error in search before action: {e}")
            return []

    async def _refine_action_with_search_results(self, action: dict, search_results: list) -> dict:
        """Refine action parameters based on search results."""
        
        if not search_results:
            return action
        
        # For single result, use the exact ID
        if len(search_results) == 1:
            if action["tool_name"] in ["update_task", "delete_task", "change_task_status"]:
                action["parameters"]["task_identifier"] = search_results[0]["id"]
            elif action["tool_name"] in ["update_memory", "delete_memory"]:
                action["parameters"]["memory_identifier"] = search_results[0]["id"]
        
        # For multiple results, use the most relevant one (first result from search ranking)
        elif len(search_results) > 1:
            best_match = search_results[0]  # Search tools should return most relevant first
            
            if action["tool_name"] in ["update_task", "delete_task", "change_task_status"]:
                action["parameters"]["task_identifier"] = best_match["id"]
            elif action["tool_name"] in ["update_memory", "delete_memory"]:
                action["parameters"]["memory_identifier"] = best_match["id"]
        
        return action

    def _parse_action_analysis(self, response: str) -> dict:
        """Parse LLM response for action analysis."""
        
        try:
            # Find JSON in response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                return json.loads(json_str)
            else:
                logger.warning("No JSON found in action analysis response")
                return {"actions_detected": False}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse action analysis JSON: {e}")
            return {"actions_detected": False}

    async def _fallback_action_detection(self, message: str, context: ConversationContext, project_id: str) -> dict:
        """Fallback to simple heuristic-based action detection if LLM fails."""
        
        # Simple keyword-based detection as backup
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["done", "complete", "finished"]):
            return await self._execute_task_completion(message, context, project_id)
        elif any(word in message_lower for word in ["delete", "remove"]):
            return await self._execute_task_deletion(message, context, project_id)
        else:
            return {
                "response": "I'm having trouble understanding what you want me to do. Could you be more specific?",
                "tool_calls_made": 0,
                "tool_results": [],
                "action_type": "fallback_unclear"
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