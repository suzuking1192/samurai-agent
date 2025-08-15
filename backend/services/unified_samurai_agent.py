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
    relevant_memories: List[Memory]
    project_context: dict
    vector_embedding: Optional[List[float]] = None
    task_context: Optional[Task] = None


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
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None,
        task_context: Optional[Any] = None
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
            task_context: Optional task context to provide focused assistance
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
                message, project_id, session_id, conversation_history, project_context,
                task_context=task_context
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
                message, conversation_context, progress_callback=progress_callback
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
            logger.info(f"Conversation context: {conversation_context}")
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
        Send immediate, non-blocking progress updates. Avoid LLM calls to preserve streaming responsiveness.
        """
        # Build a lightweight, human-friendly progress message instantly
        try:
            response_context = ResponseContext(
                project_name=project_context.get('name', 'Unknown'),
                tech_stack=project_context.get('tech_stack', 'Unknown'),
                project_detail=project_context.get('project_detail', ''),
                conversation_summary=f"Progress update: {stage}",
                relevant_tasks=[],
                relevant_memories=[],
                user_message="Progress update",
                intent_type="progress_update",
                confidence=1.0
            )

            # Generate a quick, templated message (non-blocking)
            dynamic_message = await self.response_generator.generate_progress_update(
                stage, message, details, response_context
            )

            await progress_callback(stage, dynamic_message, details, {})
        except Exception as e:
            logger.error(f"Error generating dynamic progress update: {e}")
            await progress_callback(stage, message, details, {})
    
    async def _load_comprehensive_context(
        self, 
        message: str, 
        project_id: str, 
        session_id: str, 
        conversation_history: List[ChatMessage], 
        project_context: dict,
        task_context: Optional[Any] = None
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
                message, project_id, session_messages, project_context, task_context
            )
            
            # Create conversation summary (without task_context injection)
            conversation_summary = self._create_conversation_summary(session_messages, message)
            
            # Get relevant memories from vector context
            relevant_memories = [memory for memory, _ in vector_context.get("relevant_memories_with_scores", [])]
            
            return ConversationContext(
                session_messages=session_messages,
                conversation_summary=conversation_summary,
                relevant_memories=relevant_memories,
                project_context=project_context,
                vector_embedding=vector_context.get("vector_embedding"),
                task_context=task_context if task_context else None
            )
            
        except Exception as e:
            logger.error(f"Error loading comprehensive context: {e}")
            return self._create_fallback_context(message, project_id, project_context)
    
    async def _analyze_user_intent(
        self, 
        message: str, 
        context: ConversationContext,
        progress_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None
    ) -> IntentAnalysis:
        """
        Analyze user intent with enhanced understanding using the Samurai Engine prompt.
        """
        try:
            # Check if Gemini API key is valid before proceeding
            if not self.gemini_service.is_api_key_valid():
                return IntentAnalysis(
                    intent_type="api_key_warning",
                    confidence=1.0,
                    reasoning="API key validation failed",
                    needs_clarification=False,
                    clarification_questions=[],
                    accumulated_specs={}
                )
            
            # Build enhanced context-aware prompt
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "## ACTIVE TASK (MANDATORY FOCUS)\n"
                    f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                    f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"Description: {getattr(context.task_context, 'description', '')}\n"
                    f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                    "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                    "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                    "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
                )
            # Guidance when there is no active task: infer target task from latest conversation
            no_active_task_inference = ""
            if not context.task_context:
                no_active_task_inference = (
                    "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                    "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                    "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                    "- Resolve pronouns like 'this'/'that'/'it' by linking them to the most recent concrete feature or change explicitly mentioned. If still ambiguous, include a final 'Clarify:' question and keep scope minimal.\n"
                    "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                    "- All subsequent items should be children of that root parent.\n"
                    "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
                )

            system_prompt = f"""You are Samurai Engine's intent analysis expert. Your role is to deeply understand developer conversations and classify user intent to enable the perfect "vibe coding partner" response.

CONVERSATION CONTEXT:
{active_task_header}{context.conversation_summary}

PROJECT CONTEXT:
- Project: {context.project_context.get('name', 'Unknown')}
- Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}
- Project Stage: {context.project_context.get('stage', 'Development')}

ACTIVE TASK:
{self._format_tasks_for_context([context.task_context] if context.task_context else [])}

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

        ### STRICT ACTION GATE
        - Only classify as **ready_for_action** if the user explicitly requests task creation or an implementation prompt.
        - Only classify as **direct_action** if the user explicitly issues a task management command (e.g., mark/complete/delete) referring to tasks.
        - If the user shares comprehensive specifications or details without explicitly asking to create tasks or generate a prompt, classify as **spec_clarification**.

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
        - Requires an explicit request to create tasks or generate an implementation prompt
        - Examples of explicit requests: "create tasks", "add this as tasks", "turn this into tasks", "break this down into tasks", "generate tasks", "make tasks", "please create a prompt", "give me the prompt", "draft the prompt"
        - If the message only provides detailed specifications without an explicit request above → classify as spec_clarification

**direct_action**: 
        - Requires explicit task management commands that reference tasks (e.g., "mark task X complete", "delete task Y", "update task Z")
        - Pure progress statements without commands remain discussion unless they ask to update tasks
        - Avoid inferring direct_action from generic verbs alone; prefer explicit "task" references

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

        **Message**: "Here's a complete spec for the new onboarding flow: steps A/B/C, validations, edge cases, and success criteria."
        **Context**: Providing detailed specs but no explicit task/prompt request
        **Analysis**: Comprehensive details for discussion/clarification; no explicit ask to create tasks
        **Classification**: spec_clarification

**Message**: "How does JWT authentication work?"
**Context**: General question, no project implementation context
**Analysis**: Educational question, seeking concept explanation
**Classification**: pure_discussion

**Message**: "I finished the login API endpoint task"
**Context**: Task was previously created and assigned
**Analysis**: Status update on existing task, direct project management
**Classification**: direct_action

Use this framework to analyze the current message and provide the most accurate intent classification."""

            # Send progress update before AI call
            if progress_callback:
                await progress_callback("ai_call", "🤖 Calling AI service...", "Analyzing your intent with AI")
            
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
                "turn this into tasks": "ready_for_action",
                "add as tasks": "ready_for_action",
                "add this as tasks": "ready_for_action",
                "break this down into tasks": "ready_for_action",
                "generate tasks": "ready_for_action",
                "make tasks": "ready_for_action",
                "create a prompt": "ready_for_action",
                "generate a prompt": "ready_for_action",
                "give me the prompt": "ready_for_action",
                
                "direct_action": "direct_action",
                "direct action": "direct_action",
                "mark task": "direct_action",
                "delete task": "direct_action",
                "complete task": "direct_action",
                "update task": "direct_action"
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
                
                # Check for ready for action explicit phrases
                action_phrases = [
                    "create tasks",
                    "turn this into tasks",
                    "add as tasks",
                    "add this as tasks",
                    "break this down into tasks",
                    "generate tasks",
                    "make tasks",
                    "create a prompt",
                    "generate a prompt",
                    "give me the prompt"
                ]
                message_lower = message.lower()
                if any(phrase in message_lower for phrase in action_phrases):
                    detected_intent = "ready_for_action"
                
                # Check for direct action keywords
                direct_keywords = ["mark", "delete", "complete", "finish", "update", "close"]
                if any(keyword in message_lower for keyword in direct_keywords) and any(entity in message_lower for entity in ["task", "tasks", "issue", "ticket"]):
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
            if intent_analysis.intent_type == "api_key_warning":
                return {
                    "type": "api_key_warning",
                    "response": "Warning: Gemini API key not found or invalid. Please set your GEMINI_API_KEY in the .env file to enable full functionality.",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "intent_analysis": {
                        "intent_type": "api_key_warning",
                        "confidence": 1.0,
                        "reasoning": "API key validation failed",
                        "needs_clarification": False,
                        "clarification_questions": [],
                        "accumulated_specs": {}
                    }
                }
            
            if intent_analysis.intent_type == "pure_discussion":
                return await self._handle_pure_discussion(message, context, progress_callback)
            
            elif intent_analysis.intent_type == "feature_exploration":
                return await self._handle_feature_exploration(message, context, intent_analysis, progress_callback)
            
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
    
    async def _handle_pure_discussion(self, message: str, context: ConversationContext, progress_callback: Optional[Callable] = None) -> dict:
        """Handle pure discussion with comprehensive conversation context awareness."""
        try:
            # Build enhanced conversation context with 20 message history
            conversation_context = self._create_conversation_summary_with_smart_truncation(
                context.session_messages, message
            )
            
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "## ACTIVE TASK (MANDATORY FOCUS)\n"
                    f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                    f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"Description: {getattr(context.task_context, 'description', '')}\n"
                    f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                    "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                    "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                    "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
                )

            # Guidance when there is no active task: infer target task from latest conversation
            no_active_task_inference = ""
            if not context.task_context:
                no_active_task_inference = (
                    "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                    "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                    "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                    "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                    "- All subsequent items should be children of that root parent.\n"
                    "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
                )

            system_prompt = f"""
You are Samurai Engine, their vibe coding partner.

{active_task_header}{no_active_task_inference}

## COMPREHENSIVE CONVERSATION CONTEXT (READ THIS FIRST - CRITICAL)
{conversation_context}

## PROJECT CONTEXT
Project: {context.project_context.get('name', 'Unknown')} | Tech: {context.project_context.get('tech_stack', 'Unknown')}
\nPROJECT DETAIL SPEC (if available):\n{context.project_context.get('project_detail', '')}


## RELEVANT PROJECT KNOWLEDGE
{self._format_memories_for_context(context.relevant_memories)}

## CURRENT TASK
{self._format_tasks_for_context([context.task_context] if context.task_context else [])}

## RESPONSE REQUIREMENTS

1. **ALWAYS reference the conversation history above** - Show deep understanding of the ongoing discussion
2. **Build on multiple previous exchanges** - not just the last message
3. **Reference specific topics, decisions, or clarifications** mentioned earlier in the conversation
4. **Maintain conversation threads** - if discussing multiple topics, keep track of all of them
5. **Connect current message to broader conversation context**

## CONVERSATION CONTINUITY WITH EXTENDED CONTEXT
- Reference topics discussed several messages ago when relevant
- Build on decisions or clarifications made throughout the conversation
- Show awareness of the conversation's progression and evolution
- Connect current discussion to earlier exploration or planning

## EXAMPLES OF DEEP CONTEXT USAGE
- "This ties back to the authentication approach we discussed earlier..."
- "Building on the database structure we planned and the user flow we refined..."
- "I remember you mentioned concerns about [topic] a few messages back..."
- "This connects well with both the [feature A] we explored and [feature B] we specified..."

## YOUR RESPONSE GUIDELINES
- Show awareness of the full conversation arc, not just recent messages
- Reference multiple topics or threads when relevant
- Demonstrate understanding of how discussions have evolved
- Be their knowledgeable coding partner who remembers the entire conversation

Your response:
"""
            
            # Send progress update before AI call
            if progress_callback:
                await progress_callback("ai_call", "🤖 Calling AI service...", "Generating response with conversation context")
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            return {
                "type": "discussion_response",
                "response": response.strip(),
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": conversation_context,
                    "relevant_memories_count": len(context.relevant_memories),
                    "has_active_task": bool(context.task_context),
                    "conversation_depth": len(context.session_messages)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in pure discussion handling: {e}")
            return {
                "type": "discussion_response",
                "response": "I'm here to help with your project! What would you like to discuss?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_feature_exploration(self, message: str, context: ConversationContext, intent_analysis: IntentAnalysis, progress_callback: Optional[Callable] = None) -> dict:
        """Handle feature exploration with comprehensive conversation continuity."""
        try:
            # Build enhanced conversation context with extended history
            conversation_context = self._create_conversation_summary_with_smart_truncation(
                context.session_messages, message
            )
            
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "## ACTIVE TASK (MANDATORY FOCUS)\n"
                    f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                    f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"Description: {getattr(context.task_context, 'description', '')}\n"
                    f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                    "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                    "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                    "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
                )

            # Guidance when there is no active task: infer target task from latest conversation
            no_active_task_inference = ""
            if not context.task_context:
                no_active_task_inference = (
                    "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                    "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                    "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                    "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                    "- All subsequent items should be children of that root parent.\n"
                    "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
                )

            
            system_prompt = f"""
You are Samurai Engine, helping developers explore feature ideas with deep conversation awareness.

{active_task_header}{no_active_task_inference}

## COMPREHENSIVE CONVERSATION CONTEXT (ESSENTIAL - READ FIRST)
{conversation_context}

## PROJECT CONTEXT
Project: {context.project_context.get('name', 'Unknown')} | Tech: {context.project_context.get('tech_stack', 'Unknown')}
\nPROJECT DETAIL SPEC (if available):\n{context.project_context.get('project_detail', '')}


## RELEVANT PROJECT KNOWLEDGE
{self._format_memories_for_context(context.relevant_memories)}

## CURRENT TASK
{self._format_tasks_for_context([context.task_context] if context.task_context else [])}

## YOUR RESPONSE APPROACH WITH EXTENDED CONTEXT

1. **Analyze the full conversation arc** - understand how this feature idea relates to everything discussed
2. **Reference multiple conversation threads** - connect to various topics explored earlier
3. **Show awareness of conversation evolution** - how ideas have developed over multiple exchanges
4. **Connect to earlier planning or decisions** made in the conversation
5. **Ask questions that build on the comprehensive context**

## FEATURE EXPLORATION WITH CONVERSATION DEPTH
- Reference features or approaches discussed earlier in the conversation
- Build on clarifications or decisions made several messages ago
- Show understanding of how this new idea fits into the broader conversation
- Connect to multiple aspects of their project discussed over time

## QUESTION STRATEGY WITH EXTENDED CONTEXT
- Reference specific technical discussions from earlier in the conversation
- Build questions on decisions or preferences mentioned previously
- Show awareness of constraints or requirements established earlier
- Connect to multiple features or systems discussed throughout the conversation

## EXAMPLES OF DEEP CONTEXT INTEGRATION
- "This new feature idea connects interesting with both the [system A] we discussed earlier and the [approach B] you mentioned for [previous topic]..."
- "Given the conversation we've had about [multiple topics], I'm curious how this would integrate with..."
- "Building on the [technical decision] we established and the [user flow] we explored..."

Your response should demonstrate deep understanding of the entire conversation, not just recent exchanges.
"""
            
            # Send progress update before AI call
            if progress_callback:
                await progress_callback("ai_call", "🤖 Calling AI service...", "Exploring feature ideas with AI")
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            return {
                "type": "clarification_request",
                "response": response.strip(),
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": conversation_context,
                    "conversation_depth": len(context.session_messages),
                    "clarification_questions": intent_analysis.clarification_questions
                }
            }
            
        except Exception as e:
            logger.error(f"Error in feature exploration handling: {e}")
            return {
                "type": "clarification_request",
                "response": "That's an interesting idea! Could you tell me more about what you want to build?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_spec_clarification(self, message: str, context: ConversationContext, intent_analysis: IntentAnalysis) -> dict:
        """Handle specification clarification with comprehensive conversation awareness."""
        try:
            # Build enhanced conversation context with full history
            conversation_context = self._create_conversation_summary_with_smart_truncation(
                context.session_messages, message
            )
            
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "## ACTIVE TASK (MANDATORY FOCUS)\n"
                    f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                    f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"Description: {getattr(context.task_context, 'description', '')}\n"
                    f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                    "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                    "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                    "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
                )

            # Guidance when there is no active task: infer target task from latest conversation
            no_active_task_inference = ""
            if not context.task_context:
                no_active_task_inference = (
                    "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                    "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                    "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                    "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                    "- All subsequent items should be children of that root parent.\n"
                    "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
                )
            
            system_prompt = f"""
You are Samurai Engine, gathering complete feature specifications through extended conversation tracking.

{active_task_header}{no_active_task_inference}

## COMPREHENSIVE CONVERSATION CONTEXT (CRITICAL FOR SPECIFICATION BUILDING)
{conversation_context}

## PROJECT CONTEXT
Project: {context.project_context.get('name', 'Unknown')} | Tech: {context.project_context.get('tech_stack', 'Unknown')}
\nPROJECT DETAIL SPEC (if available):\n{context.project_context.get('project_detail', '')}

## RELEVANT PROJECT KNOWLEDGE
{self._format_memories_for_context(context.relevant_memories)}

## CURRENT TASK
{self._format_tasks_for_context([context.task_context] if context.task_context else [])}

## SPECIFICATION GATHERING WITH EXTENDED CONTEXT

1. **Track specification evolution** throughout the entire conversation
2. **Reference all clarifications made** across multiple exchanges
3. **Build comprehensive understanding** from the full discussion arc
4. **Connect current clarification** to broader specification context
5. **Assess completeness** based on entire conversation history

## CRITICAL SCOPE CHECK AND NARROWING
- Before diving into details, evaluate whether the user's ask is too broad to specify precisely now.
- If the scope is broad (e.g., "I want to build test management software"), recommend choosing a smaller, actionable focus first.
- Offer 2–4 concrete narrower-scope options tailored to the conversation, such as:
  - Backend MVP: one core entity and CRUD with one non-trivial business rule
  - One core workflow end-to-end (happy path only)
  - Single page/screen UI skeleton with primary interactions
  - One API endpoint with request/response schema and validations
- Ask the user to choose one option or propose an alternative narrow scope before proceeding with deeper spec questions.

## SPECIFICATION ASSESSMENT WITH CONVERSATION DEPTH
Based on the comprehensive conversation history above:
- What aspects have been clarified across multiple exchanges?
- How have requirements evolved throughout the discussion?
- What patterns or themes emerge from the extended conversation?
- Which specifications are now complete vs. still need clarification?

## PRECISION CLARIFICATION CHECKLIST (ASK TARGETED QUESTIONS)
- Code change type
  - Is this a NEW function/method, or an UPDATE to an existing one?
  - If updating: which file/module, class, and exact function/method name?
  - If adding: which file/module and class should it live in?
  - Inputs and outputs (names, types), return values, and side effects
  - Error cases, validations, and expected exceptions
- Database schema
  - Create vs modify vs delete schema elements
  - Exact table/collection name(s); fields with types, nullability, defaults
  - Indexes, constraints, FKs, and migration/backfill plan
- API surface (if applicable)
  - Endpoint path, method, authentication/authorization
  - Request/response schema, status codes, idempotency
- Frontend scope (if applicable)
  - Which page/route/screen and component(s) are affected? Provide names/paths
  - Data flow and state management; which API endpoints are used
  - Empty/loading/error states; accessibility and responsiveness
- Tests and acceptance
  - Unit/integration/e2e tests to write or update; key scenarios
  - Clear acceptance criteria in Given/When/Then form
- Non-functional constraints
  - Performance, security, compatibility, rollout/feature flag, and out-of-scope areas

## RESPONSE STYLE WITH EXTENDED CONTEXT
- "Excellent! This clarifies [specific aspect]. Combined with what we established earlier about [previous topic] and the [decisions made] throughout our conversation..."
- "Perfect! Now I have a comprehensive picture: [summary of multiple conversation elements]..."
- "That completes the picture nicely. From our entire discussion, I understand [comprehensive summary]..."

## QUESTION FORMAT AND NEXT STEPS
- If scope is broad: first present 2–4 narrower-scope options and ask the user to choose.
- Otherwise, ask a concise, numbered list of targeted questions from the Precision Checklist above.
- Keep questions specific and answerable; prefer yes/no or enumerated options when possible.
- Do not proceed to task creation or implementation details until scope is narrowed and required details are confirmed.

## SPECIFICATION COMPLETENESS CHECK
Consider the full conversation arc:
- Are all major aspects covered across the discussion?
- Do you have enough information from the extended conversation for task creation?
- Are there any gaps that need addressing despite the comprehensive discussion?

Show deep understanding of how the specification has evolved throughout the entire conversation.
"""
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            return {
                "type": "spec_clarification_response",
                "response": response.strip(),
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {
                    "conversation_summary": conversation_context,
                    "conversation_depth": len(context.session_messages),
                    "accumulated_specs": intent_analysis.accumulated_specs
                }
            }
            
        except Exception as e:
            logger.error(f"Error in spec clarification handling: {e}")
            return {
                "type": "spec_clarification_response",
                "response": "Thanks for those details! Would you like me to create tasks for this feature?",
                "tool_calls_made": 0,
                "tool_results": [],
                "context_used": {}
            }
    
    async def _handle_ready_for_action(self, message: str, context: ConversationContext, project_id: str, progress_callback: Optional[Callable] = None) -> dict:
        """Handle ready for action with comprehensive conversation context for task creation."""
        try:
            # Build enhanced conversation context for comprehensive task generation
            conversation_context = self._create_conversation_summary_with_smart_truncation(
                context.session_messages, message
            )
            
            if progress_callback:
                await progress_callback("planning", "📋 Creating task breakdown...", "Analyzing comprehensive conversation context and requirements")
            
            # Generate task breakdown with full conversation context
            task_breakdown = await self._generate_task_breakdown_with_extended_context(message, context, conversation_context)
            
            if progress_callback:
                await progress_callback("execution", "⚙️ Creating tasks...", "Executing task creation with conversation insights")
            
            # Execute task creation
            parent_override = None
            if context.task_context and getattr(context.task_context, 'id', None):
                # Force all created tasks to be children of the active task
                parent_override = getattr(context.task_context, 'id')

            tool_results = await self._execute_task_creation(
                task_breakdown,
                project_id,
                parent_task_id_override=parent_override,
            )
            
            if progress_callback:
                await progress_callback("execution", "✅ Tasks created", f"Successfully created {len(tool_results)} tasks from comprehensive discussion")
            
            # Generate response with comprehensive conversation awareness
            response = self._generate_comprehensive_task_creation_response(tool_results, task_breakdown, conversation_context)
            
            return {
                "type": "task_creation_response",
                "response": response,
                "tool_calls_made": len(tool_results),
                "tool_results": tool_results,
                "context_used": {
                    "conversation_summary": conversation_context,
                    "conversation_depth": len(context.session_messages),
                    "task_breakdown": task_breakdown
                }
            }
            
        except Exception as e:
            logger.error(f"Error in ready for action handling: {e}")
            return await self._handle_pure_discussion(message, context)
    
    async def _handle_direct_action(self, message: str, context: ConversationContext, project_id: str, progress_callback: Optional[Callable] = None) -> dict:
        """Handle direct action with comprehensive conversation context awareness."""
        try:
            # Build enhanced conversation context with extended history
            conversation_context = self._create_conversation_summary_with_smart_truncation(
                context.session_messages, message
            )
            
            if progress_callback:
                await progress_callback("execution", "⚙️ Executing action...", "Processing your request with comprehensive conversation context")
            
            # Execute action with extended conversation context
            action_result = await self._execute_direct_action_with_extended_context(message, context, project_id, conversation_context)
            
            if progress_callback:
                await progress_callback("execution", "✅ Action completed", "Successfully executed your request with full context awareness")
            
            return {
                "type": "direct_action_response",
                "response": action_result.get("response", "Action completed successfully with conversation context."),
                "tool_calls_made": action_result.get("tool_calls_made", 0),
                "tool_results": action_result.get("tool_results", []),
                "context_used": {
                    "conversation_summary": conversation_context,
                    "conversation_depth": len(context.session_messages),
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
    async def _build_vector_enhanced_context(self, message: str, project_id: str, session_messages: List[ChatMessage], project_context: dict, task_context: Optional[Any] = None) -> dict:
        """Build vector-enhanced context using existing vector context service."""
        try:
            # Generate conversation embedding
            conversation_embedding = vector_context_service.get_conversation_context_embedding(
                session_messages, message
            )
            
            if not conversation_embedding:
                return self._create_fallback_vector_context(message, project_id, session_messages, project_context, task_context)
            
            # Load memories and compute relevant memories only
            all_memories = self.file_service.load_memories(project_id)
            relevant_memories = vector_context_service.find_relevant_memories(
                conversation_embedding, all_memories, project_id
            )

            # Keep only the active task context as task context
            relevant_tasks = []
            if task_context:
                relevant_tasks = [{
                    "task": task_context,
                    "score": 1.0,
                    "reason": "Active task context - primary focus for this conversation"
                }]
                logger.info(f"Prioritized task context: {task_context.title}")

            return {
                "relevant_tasks_with_scores": relevant_tasks,
                "relevant_memories_with_scores": relevant_memories,
                "vector_embedding": conversation_embedding
            }
            
        except Exception as e:
            logger.error(f"Error building vector-enhanced context: {e}")
            return self._create_fallback_vector_context(message, project_id, session_messages, project_context, task_context)
    
    def _create_conversation_summary(self, session_messages: List[ChatMessage], current_message: str) -> str:
        """Create enhanced conversation summary that emphasizes recent context with extended history."""
        
        if not session_messages:
            return f"This is the start of a new conversation. User just said: '{current_message}'"
        
        # Get last 20 messages for comprehensive context (10 full exchanges)
        recent_messages = session_messages[-20:]
        
        summary_parts = ["CONVERSATION HISTORY (Most Recent Context):"]
        
        # Build conversation flow with clear markers
        for i, msg in enumerate(recent_messages):
            # Handle messages with both user message and assistant response
            if msg.message:
                summary_parts.append(f"User: {msg.message}")
            if msg.response:
                summary_parts.append(f"You (Samurai): {msg.response}")
            
            # Add separator every few exchanges for readability
            if i > 0 and i % 6 == 0 and i < len(recent_messages) - 1:
                summary_parts.append("---")
        
        summary_parts.append(f"\nCURRENT MESSAGE: {current_message}")
        summary_parts.append("↑ CRITICAL: Continue this conversation naturally, building on the full context above. Reference specific topics, decisions, or clarifications from the conversation history.")
        
        return "\n".join(summary_parts)

    def _create_conversation_summary_with_smart_truncation(self, session_messages: List[ChatMessage], current_message: str, max_chars: int = 4000) -> str:
        """Create conversation summary with intelligent truncation to fit token limits."""
        
        if not session_messages:
            return f"This is the start of a new conversation. User just said: '{current_message}'"
        
        # Start with last 20 messages for maximum context
        recent_messages = session_messages[-20:]
        
        summary_parts = ["CONVERSATION HISTORY:"]
        
        for msg in recent_messages:
            if msg.message:
                summary_parts.append(f"User: {msg.message}")
            if msg.response:
                # Truncate very long responses to save space
                response_text = msg.response
                if len(response_text) > 300:
                    response_text = response_text[:300] + "..."
                summary_parts.append(f"You (Samurai): {response_text}")
        
        summary_parts.append(f"\nCURRENT MESSAGE: {current_message}")
        summary_parts.append("↑ Continue this conversation naturally, referencing the context above.")
        
        full_summary = "\n".join(summary_parts)
        
        # If too long, progressively reduce context while keeping most recent
        if len(full_summary) > max_chars:
            # Try with last 15 messages
            recent_messages = session_messages[-15:]
            summary_parts = ["CONVERSATION HISTORY:"]
            
            for msg in recent_messages:
                if msg.message:
                    summary_parts.append(f"User: {msg.message}")
                if msg.response:
                    response_text = msg.response[:200] + "..." if len(msg.response) > 200 else msg.response
                    summary_parts.append(f"You (Samurai): {response_text}")
            
            summary_parts.append(f"\nCURRENT MESSAGE: {current_message}")
            summary_parts.append("↑ Continue this conversation naturally.")
            
            full_summary = "\n".join(summary_parts)
            
            # If still too long, try with last 10 messages
            if len(full_summary) > max_chars:
                recent_messages = session_messages[-10:]
                summary_parts = ["RECENT CONVERSATION:"]
                
                for msg in recent_messages:
                    if msg.message:
                        summary_parts.append(f"User: {msg.message}")
                    if msg.response:
                        response_text = msg.response[:150] + "..." if len(msg.response) > 150 else msg.response
                        summary_parts.append(f"You (Samurai): {response_text}")
                
                summary_parts.append(f"\nCURRENT MESSAGE: {current_message}")
                summary_parts.append("↑ Continue this conversation.")
                
                full_summary = "\n".join(summary_parts)
        
        return full_summary
    
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
    
    def _create_fallback_vector_context(self, message: str, project_id: str, session_messages: List[ChatMessage], project_context: dict, task_context: Optional[Any] = None) -> dict:
        """Create fallback vector context."""
        relevant_tasks = []

        # Include task context even in fallback mode
        if task_context:
            relevant_tasks = [{
                "task": task_context,
                "score": 1.0,
                "reason": "Active task context - primary focus for this conversation"
            }]

        return {
            "relevant_tasks_with_scores": relevant_tasks,
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
                project_detail=project_context.get('project_detail', ''),
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

    def _parse_task_breakdown_response(self, response: str, original_message: str, context: ConversationContext) -> List[dict]:
        """Enhanced JSON parsing with multiple fallback strategies."""
        try:
            # Strategy 1: Direct JSON parsing
            cleaned_response = response.strip()
            
            # Remove markdown code blocks
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            # Try direct parsing
            parsed_response = json.loads(cleaned_response)
            
            # Handle special cases from enhanced prompt
            if isinstance(parsed_response, dict):
                if parsed_response.get("breakdown_needed") == False:
                    if "single_task" in parsed_response:
                        return [parsed_response["single_task"]]
                    else:
                        return [self._create_fallback_task(original_message, context)]
                else:
                    # If it's a dict but not a special case, try to extract tasks
                    return [parsed_response]
            
            # Handle normal array response
            if isinstance(parsed_response, list):
                return parsed_response
            
            # Fallback for unexpected response format
            logger.warning("Unexpected response format from task breakdown, using fallback")
            return [self._create_fallback_task(original_message, context)]
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse task breakdown JSON: {e}")
            
            # Strategy 2: Extract JSON using regex patterns
            import re
            
            # Try to find JSON array pattern
            json_patterns = [
                r'\[.*?\]',  # Basic array pattern
                r'\[\s*\{.*?\}\s*\]',  # Array with objects
                r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]',  # Array with multiple objects
            ]
            
            for pattern in json_patterns:
                matches = re.findall(pattern, response, re.DOTALL)
                for match in matches:
                    try:
                        parsed_response = json.loads(match)
                        if isinstance(parsed_response, list) and len(parsed_response) > 0:
                            # Validate that each item has required fields
                            valid_tasks = []
                            for task in parsed_response:
                                if isinstance(task, dict) and task.get('title'):
                                    valid_tasks.append(task)
                            
                            if valid_tasks:
                                logger.info(f"Successfully extracted {len(valid_tasks)} tasks using regex pattern")
                                return valid_tasks
                    except:
                        continue
            
            # Strategy 3: Try to extract individual task objects
            task_patterns = [
                r'\{[^}]*"title"[^}]*\}',  # Object with title field
                r'\{[^}]*"description"[^}]*\}',  # Object with description field
            ]
            
            for pattern in task_patterns:
                matches = re.findall(pattern, response, re.DOTALL)
                tasks = []
                for match in matches:
                    try:
                        task = json.loads(match)
                        if isinstance(task, dict) and task.get('title'):
                            tasks.append(task)
                    except:
                        continue
                
                if tasks:
                    logger.info(f"Successfully extracted {len(tasks)} individual tasks")
                    return tasks
            
            # Strategy 4: Create task from response content
            logger.warning("All JSON parsing strategies failed, creating task from response content")
            return [self._create_task_from_response_content(response, original_message, context)]

    def _create_fallback_task(self, message: str, context: ConversationContext) -> dict:
        """Create a fallback task when parsing fails."""
        return {
            "title": "Implement feature request",
            "description": f"PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}\n\nTASK: {message}\n\nFILES: To be determined based on implementation\n\nREQUIREMENTS:\n- Implement the requested feature\n- Follow existing code patterns\n\nACCEPTANCE: Feature works as requested",
            "priority": "medium",
            "order": 0
        }

    def _create_task_from_response_content(self, response: str, original_message: str, context: ConversationContext) -> dict:
        """Create a task by extracting useful information from the AI response."""
        # Try to extract meaningful content from the response
        lines = response.split('\n')
        title = "Implement feature request"
        description_parts = []
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('```') and not line.startswith('{') and not line.startswith('['):
                # Skip markdown headers, code blocks, and JSON syntax
                if len(line) > 10:  # Only include substantial lines
                    description_parts.append(line)
        
        if description_parts:
            # Use the first few meaningful lines as description
            description = '\n'.join(description_parts[:5])  # Limit to first 5 lines
        else:
            description = f"Implement the requested feature: {original_message}"
        
        return {
            "title": title,
            "description": f"PROJECT: {context.project_context.get('name', 'Unknown')} | TECH: {context.project_context.get('tech_stack', 'Unknown')}\n\nTASK: {original_message}\n\nAI ANALYSIS:\n{description}\n\nREQUIREMENTS:\n- Implement the requested feature\n- Follow existing code patterns\n\nACCEPTANCE: Feature works as requested",
            "priority": "medium",
            "order": 0
        }

    async def _generate_task_breakdown_with_extended_context(self, message: str, context: ConversationContext, conversation_context: str) -> List[dict]:
        """Generate task breakdown with comprehensive conversation context."""
        try:
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "## ACTIVE TASK (MANDATORY FOCUS)\n"
                    f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                    f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"Description: {getattr(context.task_context, 'description', '')}\n"
                    f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                    "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                    "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                    "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
                )
            # When there is no active task, prepare guidance to infer a target task from the latest conversation
            no_active_task_inference = ""
            if not context.task_context:
                no_active_task_inference = (
                    "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                    "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                    "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                    "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                    "- All subsequent items should be children of that root parent.\n"
                    "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
                )

            system_prompt = f"""
Break down this feature request into implementable SOFTWARE ENGINEERING tasks only.

## LATEST USER MESSAGE (most recent intent signal)
{message}

{active_task_header if context.task_context else ''}{no_active_task_inference}

## COMPREHENSIVE CONVERSATION CONTEXT (prioritize recency)
{conversation_context}

## PROJECT CONTEXT
Project: {context.project_context.get('name', 'Unknown')}
Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}
\nPROJECT DETAIL SPEC (if available):\n{context.project_context.get('project_detail', '')}


## RELEVANT PROJECT KNOWLEDGE
{self._format_memories_for_context(context.relevant_memories)}

## SCOPE: SOFTWARE ENGINEERING TASKS ONLY
- Include only tasks that produce concrete changes to: application code, tests, configuration, CI/CD pipelines, infrastructure-as-code, database schemas/migrations, APIs, security/hardening, performance tuning, or developer documentation inside the repository that is directly tied to code changes (e.g., updating `README.md` after implementing a feature).
- Each task must be actionable within the repository and lead to a verifiable code change.
- When an ACTIVE TASK exists, strictly scope all tasks to advancing that task; do NOT introduce unrelated tasks.

## OUT OF SCOPE (EXCLUDE COMPLETELY)
- Workshops, meetings, trainings, demos, presentations, slide decks
- Interviews, surveys, user research without code changes
- Planning/roadmapping, stakeholder communications, marketing or support tasks
- Generic brainstorming or open-ended research with no concrete code deliverable

If the request is not about software engineering implementation, return an empty JSON array [] without commentary.

## RECENCY AND DEDUPLICATION RULES
- Treat the most recent conversation segment as authoritative. If the topic shifts mid-thread, IGNORE earlier topics unless the user explicitly ties them to the current request.
- Focus only on new work not already implied as completed or previously created. If a subtask appears to duplicate a previously discussed/created item, SKIP it.
- Avoid repeating tasks from older context. Prefer the newest interpretation of the user's intent.

## STRICT GROUNDEDNESS (NO ASSUMPTIONS)
- Use only information explicitly present in the latest user message and the recent portion of the conversation context above. Do NOT invent component names, file paths, database tables/columns, API endpoints, libraries, configuration keys, or external services.
- If a specific artifact is required but not named, use clear placeholders wrapped in braces to mark missing details, e.g., {{method_name}}, {{ClassName}}, {{package_name}}, {{schema}}.{{table}}, {{column_name}}, {{route_path}}, {{component_name}}.
- If critical details are missing, include at the end of the description a "Clarify:" section that lists precise, concrete questions needed to proceed. Do not output separate non-engineering tasks.

## DESCRIPTION FORMAT (STRUCTURED, PRECISE, AND COMPREHENSIVE)
Each task's description MUST be a single string that follows this structure and uses placeholders {{like_this}} for any unknown specifics. Be precise and detailed while remaining strictly grounded in the recent conversation (no assumptions):
- Context: one sentence tying the task to the latest conversation and, if present, the active task.
- Implementation Steps:
  - Step 1: ...
  - Step 2: ...
  - Step 3: ... (2–6 steps total)
- Backend Feature Spec (if applicable):
  - Feature/Behavior: concise definition of what capability is implemented and when it triggers.
  - Inputs: {{input_sources}} and parameters with types and validation rules.
  - Processing/Algorithms: describe calculations/transformations/flows; include formulas, branching, retries, idempotency as applicable.
  - Outputs/Side Effects: returned values, persisted records, emitted events, external calls.
  - Error Handling: validation failures, exceptions, fallbacks, retry/backoff.
  - Performance: complexity/latency/throughput constraints if stated; memory limits.
  - Security: authn/authz constraints, PII handling, logging/redaction.
  - Edge Cases: enumerate known edge conditions from the conversation.
- Frontend UI Spec (if applicable):
  - Screens/Components: exact names if stated, otherwise placeholders e.g., {{component_name}}.
  - States & Data: loading/empty/error/success; data fields and bindings.
  - User Flows & Interactions: clicks, keyboard, gestures; navigation and modals.
  - Layout & Responsive: breakpoints, alignment, spacing, scroll behavior.
  - Visual Spec: labels, copy, icons, colors, sizes; reference design tokens if stated.
  - Accessibility: roles, labels, focus order, keyboard support, contrast.
  - Error/Empty/Edge: messaging and recovery per state.
- Code Changes:
  - Backend: specify exact methods/classes/modules when explicitly stated; otherwise use placeholders e.g., {{method_name}} in {{ClassName}} within {{module_path}}
  - Database: specify schema/migration details when known; otherwise placeholders e.g., {{schema}}.{{table}} add column {{column_name}} {{type}}
  - API: specify endpoints/handlers only if named; otherwise placeholders e.g., {{HTTP_method}} {{route_path}}
  - Frontend: specify pages/components/files if named; otherwise placeholders e.g., {{component_name}} in {{path}}
- Tests: specify unit/integration/e2e to add or update tied to the above changes.
- Acceptance Criteria: bullet list of verifiable checks.
- Clarify: only if needed, list missing names/paths/schemas that must be confirmed.

## TASK CONTEXT INTEGRATION
- Reference specific technical decisions made during the conversation where applicable.
- Include UX considerations, architectural choices, and non-functional requirements (performance, security) if relevant and explicitly stated.

## TASK COUNT AND GRANULARITY
- Keep the breakdown compact so we can iteratively refine later as the user continues chatting.
- If there is an ACTIVE TASK: return at most 5 items (all are subtasks of the active task), and only if they strictly advance the active task.
- If there is NO ACTIVE TASK: return exactly 1 root parent (parent_task_id = null) plus up to 5 child subtasks.
- Prefer the most critical and unblocking subtasks first. Defer deeper decomposition to future iterations.

## OUTPUT FORMAT (STRICT HIERARCHY-AWARE)
Return a pure JSON array of tasks. Each task MUST include these fields:
- title: string
- description: string (following the Description Format above; include placeholders for missing specifics; include optional Clarify section when needed)
- parent_task_id: string | null

Rules for parent_task_id assignment:
- If there is an ACTIVE TASK (see header above), ALL returned tasks must set parent_task_id to this exact value: {getattr(context.task_context, 'id', 'UNKNOWN')} and NONE may have parent_task_id = null.
- If there is NO ACTIVE TASK: the FIRST item must be a ROOT PARENT task (parent_task_id = null). For ALL subsequent items, do NOT provide any non-null parent_task_id. Either omit the parent_task_id field entirely or set it explicitly to null. Do NOT invent or include any IDs.

IMPORTANT:
- Return JSON only. No markdown, code fences, or extra commentary.
"""
            
            response = await self.gemini_service.chat_with_system_prompt(message, system_prompt)
            
            # Use the same robust parsing method
            parsed_response = self._parse_task_breakdown_response(response, message, context)
            return parsed_response
                
        except Exception as e:
            logger.error(f"Error generating task breakdown: {e}")
            return [{"title": "Implement feature", "description": f"Implement the feature discussed: {message}"}]

    def _generate_comprehensive_task_creation_response(self, tool_results: List[dict], task_breakdown: List[dict], conversation_context: str) -> str:
        """Generate response that references the comprehensive conversation context."""
        successful_results = [r for r in tool_results if r.get("success", False)]
        
        if not successful_results:
            return "I encountered some issues creating the tasks. Please try again."
        
        # Reference comprehensive conversation in response
        response_parts = [f"Perfect! Based on our comprehensive discussion, I've created {len(successful_results)} tasks that capture everything we've explored:"]
        
        for i, task_data in enumerate(task_breakdown, 1):
            response_parts.append(f"{i}. {task_data['title']}")
        
        response_parts.append("\nThese tasks incorporate all the decisions, clarifications, and technical choices we've discussed throughout our conversation. They're ready to copy to Cursor with complete context!")
        
        return "\n".join(response_parts)
    
    async def _execute_task_creation(self, task_breakdown: List[dict], project_id: str, parent_task_id_override: Optional[str] = None) -> List[dict]:
        """Execute task creation using tool registry."""
        results = []
        root_created_id: Optional[str] = None
        
        for index, task_data in enumerate(task_breakdown):
            try:
                # Create task using tool registry
                # Extract optional parameters
                params = {
                    "title": task_data["title"],
                    "description": task_data["description"],
                    "project_id": project_id
                }
                
                # Add optional parameters if they exist
                if "status" in task_data:
                    params["status"] = task_data["status"]
                if "priority" in task_data:
                    params["priority"] = task_data["priority"]
                if "due_date" in task_data:
                    params["due_date"] = task_data["due_date"]
                # Parent assignment logic
                if parent_task_id_override:
                    # Force all tasks to be children of the active task
                    params["parent_task_id"] = parent_task_id_override
                else:
                    # No active task; enforce root-first then attach children to created root
                    if index == 0:
                        # Ensure root is created without any parent assignment regardless of provided ptid
                        pass
                    else:
                        # For subtasks, ignore any provided parent_task_id and attach to created root
                        if root_created_id:
                            params["parent_task_id"] = root_created_id
                
                result = await self.tool_registry.execute_tool(
                    "create_task",
                    **params
                )
                results.append(result)

                # Capture root id if this is the first created task and we are in the root-parent flow
                if (parent_task_id_override is None) and (index == 0):
                    if result.get("success") and result.get("task_id"):
                        root_created_id = result["task_id"]
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
                relevant_tasks=[context.task_context] if context.task_context else [],
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
        active_task_header = ""
        if context.task_context:
            active_task_header = (
                "## ACTIVE TASK (MANDATORY FOCUS)\n"
                f"ID: {getattr(context.task_context, 'id', 'UNKNOWN')}\n"
                f"Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                f"Description: {getattr(context.task_context, 'description', '')}\n"
                f"Status: {getattr(context.task_context, 'status', 'pending')}\n"
                f"Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                "IMPORTANT NOTE: The user explicitly selected this active task. ALL generated tasks must strictly advance THIS task.\n"
                "- Create ONLY subtasks for this active task. Do NOT create a new root task.\n"
                "- Use conversation history only insofar as it informs or unblocks this active task.\n"
                "- Ignore unrelated conversation topics unless the user explicitly asked to expand scope.\n\n"
            )
        # When there is no active task, prepare guidance to infer a target task from the latest conversation
        no_active_task_inference = ""
        if not context.task_context:
            no_active_task_inference = (
                "## TARGET TASK INFERENCE (NO ACTIVE TASK)\n"
                "- Infer the single most relevant task to break down from the latest user message and the most recent portion of the conversation history.\n"
                "- Prioritize the latest user intent. If multiple features are mentioned, choose the one most recently requested or clarified.\n"
                "- The FIRST item must be a ROOT PARENT task (parent_task_id = null) that crisply summarizes this feature.\n"
                "- All subsequent items should be children of that root parent.\n"
                "- Do not blend unrelated topics; prefer a narrow, implementable scope.\n\n"
            )

        # Step 1: Use LLM to detect actions
        action_analysis_prompt = f"""
You are Samurai Engine's action detection expert. Analyze the user's message to identify specific actions they want to perform.

{active_task_header}{no_active_task_inference}

PROJECT CONTEXT:
- Project: {context.project_context.get('name', 'Unknown')}
- Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}

CONVERSATION CONTEXT:
{context.conversation_summary}

CURRENT TASK:
{self._format_tasks_for_context([context.task_context] if context.task_context else [])}

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

    async def _execute_direct_action_with_extended_context(self, message: str, context: ConversationContext, project_id: str, conversation_context: str) -> dict:
        """Execute direct action considering comprehensive conversation context."""
        try:
            active_task_header = ""
            if context.task_context:
                active_task_header = (
                    "ACTIVE TASK SELECTED BY USER (Primary Focus)\n"
                    f"- Title: {getattr(context.task_context, 'title', 'Untitled')}\n"
                    f"- Description: {getattr(context.task_context, 'description', '')}\n"
                    f"- Status: {getattr(context.task_context, 'status', 'pending')}\n"
                    f"- Priority: {getattr(context.task_context, 'priority', 'medium')}\n\n"
                    "INTENT: The user is focusing on this task now and likely wants to ask questions, update details, or make progress on it. Prioritize actions and guidance about this task unless the user clearly asks otherwise.\n\n"
                )

            # Use LLM to detect actions with comprehensive conversation context
            action_analysis_prompt = f"""
Analyze the user's direct action request considering the comprehensive conversation history.

## COMPREHENSIVE CONVERSATION CONTEXT (CRITICAL FOR ACCURATE ACTION DETECTION)
{active_task_header}{conversation_context}

PROJECT CONTEXT:
- Project: {context.project_context.get('name', 'Unknown')}
- Tech Stack: {context.project_context.get('tech_stack', 'Unknown')}
\nPROJECT DETAIL SPEC (if available):\n{context.project_context.get('project_detail', '')}

## CURRENT REQUEST
"{message}"

## AVAILABLE TOOLS
- create_task: Create a new task in the project (parameters: title, description, priority, status, due_date, parent_task_id)
- update_task: Update an existing task's details (parameters: task_identifier, title, description, priority, status, due_date)
- change_task_status: Change the status of a task (pending, in_progress, completed, blocked) (parameters: task_identifier, new_status)
- search_tasks: Search for tasks by title, description, or status (parameters: query, status_filter)
- delete_task: Delete a task from the project (parameters: task_identifier)
- create_memory: Create a new memory entry (parameters: title, content, category)
- update_memory: Update an existing memory (parameters: memory_identifier, title, content, category)
- search_memories: Search for memories by title or content (parameters: query)
- delete_memory: Delete a memory from the project (parameters: memory_identifier)

## EXTENDED CONTEXT ACTION ANALYSIS

Based on the comprehensive conversation context above:
- What tasks, features, or topics have been discussed throughout the conversation?
- Are they referring to something specific mentioned earlier in the extended discussion?
- What is the most logical action given the full conversation arc?
- How does this request relate to decisions or plans made earlier in the conversation?

## ACTION DETECTION WITH CONVERSATION DEPTH
Consider:
- Tasks or features discussed across multiple conversation turns
- Technical decisions made throughout the extended discussion
- User preferences expressed at various points in the conversation
- Previous action requests or task management discussions

Return JSON with the detected action and context-specific parameters informed by the comprehensive conversation:
{{
    "actions_detected": true/false,
    "action_count": number,
    "confidence": 0.0-1.0,
    "reasoning": "Analysis based on comprehensive conversation context",
    "actions": [
        {{
            "tool_name": "tool_to_execute",
            "parameters": {{
                "param1": "value1",
                "param2": "value2",
                "project_id": "{project_id}"
            }},
            "requires_search_first": true/false,
            "search_tool": "search_tasks|search_memories",
            "search_query": "search terms if needed",
            "description": "Action description with conversation context"
        }}
    ]
}}
"""
            
            # Get LLM analysis
            response = await self.gemini_service.chat_with_system_prompt(message, action_analysis_prompt)
            
            # Parse the LLM response
            action_analysis = self._parse_action_analysis(response)
            
            if not action_analysis.get("actions_detected", False):
                return {
                    "response": "I'm not sure what specific action you want me to take. Could you be more explicit about what you'd like me to do?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "no_actions_detected"
                }
            
            # Execute the detected actions
            return await self._execute_detected_actions(action_analysis, project_id, context)
            
        except Exception as e:
            logger.error(f"Error executing direct action with extended context: {e}")
            return {
                "response": "I encountered an issue processing your request with conversation context.",
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
            # Find matching task (prefer active task)
            candidate_tasks = [context.task_context] if context.task_context else []
            matching_task = self._find_matching_task(message, candidate_tasks)
            
            if not matching_task:
                return {
                    "response": "I couldn't find a matching task. Could you be more specific?",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "action_type": "task_completion"
                }
            
            # Execute completion
            result = await self.tool_registry.execute_tool(
                "change_task_status",
                task_identifier=matching_task.id,
                new_status="completed",
                project_id=project_id
            )
            
            # Generate dynamic completion response
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=[context.task_context] if context.task_context else [],
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
            # Find matching task (prefer active task)
            candidate_tasks = [context.task_context] if context.task_context else []
            matching_task = self._find_matching_task(message, candidate_tasks)
            
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
                task_identifier=matching_task.id,
                project_id=project_id
            )
            
            # Generate dynamic deletion response
            response_context = ResponseContext(
                project_name=context.project_context.get('name', 'Unknown'),
                tech_stack=context.project_context.get('tech_stack', 'Unknown'),
                conversation_summary=context.conversation_summary,
                relevant_tasks=[context.task_context] if context.task_context else [],
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
                
                # Execute the main action using AgentToolRegistry
                tool_name = action.get("tool_name")
                parameters = action.get("parameters", {})
                
                # Ensure project_id is in parameters
                if "project_id" not in parameters:
                    parameters["project_id"] = project_id
                
                if tool_name in self.tool_registry.get_available_tools():
                    try:
                        # Actually execute the tool through the registry
                        result = await self.tool_registry.execute_tool(tool_name, **parameters)
                        tool_results.append(result)
                        total_tool_calls += 1
                        
                        if result.get("success", False):
                            response_parts.append(result.get("message", f"✅ Completed: {action.get('description')}"))
                        else:
                            response_parts.append(result.get("message", f"❌ Failed: {action.get('description')}"))
                            
                    except Exception as tool_error:
                        logger.error(f"Tool execution error for {tool_name}: {tool_error}")
                        response_parts.append(f"❌ Error executing {tool_name}: {str(tool_error)}")
                        tool_results.append({
                            "success": False,
                            "error": str(tool_error),
                            "tool_name": tool_name
                        })
                else:
                    response_parts.append(f"❌ Unknown tool: {tool_name}")
                    tool_results.append({
                        "success": False,
                        "error": f"Unknown tool: {tool_name}",
                        "tool_name": tool_name
                    })
            
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
            search_result = await self.tool_registry.execute_tool(
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
                parsed = json.loads(json_str)
                
                # Validate the parsed response has required fields
                if "actions_detected" in parsed and "actions" in parsed:
                    return parsed
                else:
                    logger.warning("Parsed JSON missing required fields")
                    return {"actions_detected": False}
                    
            else:
                logger.warning("No JSON found in action analysis response")
                return {"actions_detected": False}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse action analysis JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return {"actions_detected": False}
        except Exception as e:
            logger.error(f"Unexpected error parsing action analysis: {e}")
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