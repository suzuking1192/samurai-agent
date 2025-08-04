import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

try:
    from .gemini_service import GeminiService
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from gemini_service import GeminiService
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class AgentPlanningPhase:
    """Intelligent planning phase for agent responses with context understanding"""
    
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
        Analyze the user's message and create a comprehensive response plan
        """
        try:
            # Step 1: Situation Analysis
            situation = await self.analyze_situation()
            logger.info(f"Situation analysis: {situation}")
            
            # Step 2: Context Integration
            relevant_context = await self.gather_relevant_context(situation)
            logger.info(f"Relevant context gathered: {len(relevant_context['relevant_memories'])} memories, {len(relevant_context['related_tasks'])} tasks")
            
            # Step 3: Response Planning
            response_plan = await self.create_response_plan(situation, relevant_context)
            logger.info(f"Response plan created: {response_plan['response_type']}")
            
            self.plan = response_plan
            return response_plan
            
        except Exception as e:
            logger.error(f"Error in planning phase: {e}")
            return self._create_fallback_plan()
    
    async def analyze_situation(self) -> Dict[str, Any]:
        """
        Understand what the user is actually asking about
        """
        # Check for common issue patterns first
        common_issue = self._detect_common_issue_patterns()
        if common_issue:
            return common_issue
        
        # Use LLM for sophisticated analysis
        analysis_prompt = f"""
        Analyze this user message and determine what they're asking about:
        
        USER MESSAGE: "{self.user_message}"
        
        RECENT CONVERSATION:
        {self._get_recent_conversation_context()}
        
        PROJECT CONTEXT:
        - Project: {self.project_context.get('name', 'Unknown')}
        - Tech Stack: {self.project_context.get('tech_stack', 'Unknown')}
        
        Determine:
        1. What is the user's main concern or problem?
        2. What type of help do they need? (technical_issue, feature_request, bug_report, general_question, task_management)
        3. Is this referring to something mentioned before in the conversation?
        4. What specific area of the system/project are they talking about?
        5. Are there any error messages or specific symptoms mentioned?
        6. What is their emotional state or urgency level?
        
        Return a JSON object with:
        {{
            "main_concern": "brief description",
            "help_type": "technical_issue|feature_request|bug_report|general_question|task_management",
            "references_previous": true/false,
            "system_area": "backend|frontend|ui|agent_responses|task_management|memory|deployment|testing|etc",
            "error_indicators": ["list", "of", "error", "symptoms"],
            "urgency_level": "low|medium|high",
            "confidence_level": 0.8,
            "specific_issue": "detailed description of the specific problem"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                self.user_message, 
                analysis_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in situation analysis, using fallback")
                return self._create_fallback_situation_analysis()
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_situation_analysis()
                
        except Exception as e:
            logger.error(f"Error in situation analysis: {e}")
            return self._create_fallback_situation_analysis()
    
    def _detect_common_issue_patterns(self) -> Optional[Dict[str, Any]]:
        """
        Detect common issue patterns before using LLM
        """
        message_lower = self.user_message.lower()
        
        # Response length issues
        response_length_indicators = [
            "response was very detailed", "exceeded our limits", 
            "processing a shorter version", "response too long",
            "this shows up every time", "truncation message"
        ]
        if any(indicator in message_lower for indicator in response_length_indicators):
            return {
                "main_concern": "Response length limits causing truncation messages",
                "help_type": "technical_issue",
                "references_previous": True,
                "system_area": "agent_responses",
                "error_indicators": ["truncation message", "response limits"],
                "urgency_level": "medium",
                "confidence_level": 0.9,
                "specific_issue": "Agent responses are being truncated due to length limits, causing repeated error messages"
            }
        
        # UI issues
        ui_indicators = [
            "can't see", "not showing", "white space", "overlapping", "broken layout",
            "button not working", "click doesn't work", "interface issues"
        ]
        if any(indicator in message_lower for indicator in ui_indicators):
            return {
                "main_concern": "User interface display or interaction problems",
                "help_type": "bug_report",
                "references_previous": False,
                "system_area": "frontend",
                "error_indicators": ["display issues", "interaction problems"],
                "urgency_level": "high",
                "confidence_level": 0.8,
                "specific_issue": "UI elements not displaying or functioning correctly"
            }
        
        # Task management issues
        task_indicators = [
            "task not", "doesn't work", "can't complete", "task management",
            "tasks not showing", "can't see tasks"
        ]
        if any(indicator in message_lower for indicator in task_indicators):
            return {
                "main_concern": "Task management functionality problems",
                "help_type": "technical_issue",
                "references_previous": False,
                "system_area": "task_management",
                "error_indicators": ["task functionality issues"],
                "urgency_level": "medium",
                "confidence_level": 0.8,
                "specific_issue": "Task management features not working as expected"
            }
        
        # Memory issues
        memory_indicators = [
            "memory not", "can't remember", "forgot", "not saving",
            "memories not showing", "can't see memories"
        ]
        if any(indicator in message_lower for indicator in memory_indicators):
            return {
                "main_concern": "Memory storage or retrieval problems",
                "help_type": "technical_issue",
                "references_previous": False,
                "system_area": "memory",
                "error_indicators": ["memory functionality issues"],
                "urgency_level": "medium",
                "confidence_level": 0.8,
                "specific_issue": "Memory features not working as expected"
            }
        
        return None
    
    async def gather_relevant_context(self, situation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gather relevant memories, tasks, and conversation history
        """
        context = {
            "relevant_memories": [],
            "related_tasks": [],
            "conversation_patterns": [],
            "similar_issues": []
        }
        
        # Find relevant memories based on situation
        if situation.get("system_area"):
            context["relevant_memories"] = await self._find_memories_by_topic(
                situation["system_area"], situation.get("main_concern", "")
            )
        
        # Find related tasks
        if situation.get("help_type") in ["technical_issue", "bug_report", "task_management"]:
            context["related_tasks"] = await self._find_tasks_by_keywords(
                situation.get("main_concern", "")
            )
        
        # Look for conversation patterns (recurring issues)
        context["conversation_patterns"] = self._find_recurring_patterns()
        
        # Find similar issues from memories
        context["similar_issues"] = await self._find_similar_issues(situation)
        
        return context
    
    async def _find_memories_by_topic(self, system_area: str, main_concern: str) -> List[Memory]:
        """
        Find memories relevant to the system area and concern
        """
        relevant_memories = []
        
        for memory in self.project_memories:
            # Check if memory is relevant to the system area
            memory_text = f"{memory.title} {memory.content}".lower()
            system_area_lower = system_area.lower()
            
            # Direct area matching
            if system_area_lower in memory_text:
                relevant_memories.append(memory)
                continue
            
            # Keyword matching for main concern
            if main_concern:
                concern_words = main_concern.lower().split()
                memory_words = memory_text.split()
                overlap = len(set(concern_words).intersection(set(memory_words)))
                
                if overlap > 0:
                    relevant_memories.append(memory)
        
        return relevant_memories[:3]  # Limit to top 3
    
    async def _find_tasks_by_keywords(self, main_concern: str) -> List[Task]:
        """
        Find tasks related to the main concern
        """
        relevant_tasks = []
        
        if not main_concern:
            return relevant_tasks
        
        concern_words = set(main_concern.lower().split())
        
        for task in self.tasks:
            task_text = f"{task.title} {task.description}".lower()
            task_words = set(task_text.split())
            
            # Calculate relevance score
            overlap = len(concern_words.intersection(task_words))
            
            if overlap > 0:
                relevant_tasks.append((task, overlap))
        
        # Sort by relevance and return top 3
        relevant_tasks.sort(key=lambda x: x[1], reverse=True)
        return [task for task, score in relevant_tasks[:3]]
    
    def _find_recurring_patterns(self) -> List[Dict[str, Any]]:
        """
        Identify if this is a recurring issue
        """
        patterns = []
        
        # Look for repeated error messages
        error_messages = []
        for msg in self.conversation_history[-10:]:  # Last 10 messages
            content = msg.get("content", "").lower()
            if any(word in content for word in ["error", "issue", "problem", "bug", "broken"]):
                error_messages.append(content)
        
        # Look for repeated phrases
        if len(error_messages) > 1:
            patterns.append({
                "type": "recurring_error",
                "count": len(error_messages),
                "description": "User has mentioned similar issues before"
            })
        
        # Look for repeated system areas
        system_areas = []
        for msg in self.conversation_history[-5:]:
            content = msg.get("content", "").lower()
            if any(area in content for area in ["ui", "frontend", "backend", "api", "database"]):
                system_areas.append(content)
        
        if len(system_areas) > 1:
            patterns.append({
                "type": "recurring_system_area",
                "count": len(system_areas),
                "description": "User has mentioned similar system areas before"
            })
        
        return patterns
    
    async def _find_similar_issues(self, situation: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Find similar issues from memories
        """
        similar_issues = []
        
        for memory in self.project_memories:
            memory_text = f"{memory.title} {memory.content}".lower()
            
            # Check if memory is about similar issues
            if any(word in memory_text for word in ["issue", "problem", "bug", "error", "fix"]):
                # Calculate similarity to current situation
                situation_text = f"{situation.get('main_concern', '')} {situation.get('system_area', '')}".lower()
                
                situation_words = set(situation_text.split())
                memory_words = set(memory_text.split())
                
                overlap = len(situation_words.intersection(memory_words))
                
                if overlap > 0:
                    similar_issues.append({
                        "memory": memory,
                        "similarity_score": overlap,
                        "description": f"Similar issue found in memory: {memory.title}"
                    })
        
        # Sort by similarity and return top 2
        similar_issues.sort(key=lambda x: x["similarity_score"], reverse=True)
        return similar_issues[:2]
    
    async def create_response_plan(self, situation: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a specific plan for how to respond
        """
        planning_prompt = f"""
        Create a response plan based on this analysis:
        
        SITUATION: {json.dumps(situation, indent=2)}
        CONTEXT: {json.dumps({
            "relevant_memories_count": len(context["relevant_memories"]),
            "related_tasks_count": len(context["related_tasks"]),
            "conversation_patterns": context["conversation_patterns"],
            "similar_issues_count": len(context["similar_issues"])
        }, indent=2)}
        
        Create a response plan with:
        1. UNDERSTANDING: Show you understand the specific issue
        2. SOLUTION: Provide specific, actionable help
        3. CONTEXT_USE: How to use the gathered context
        4. FOLLOW_UP: What questions to ask if needed
        
        Return JSON:
        {{
            "response_type": "direct_solution|guided_help|clarifying_questions",
            "understanding_statement": "I understand you're experiencing...",
            "main_solution": "specific solution or help",
            "context_integration": "how to reference memories/tasks/history",
            "follow_up_actions": ["action1", "action2"],
            "confidence": 0.8,
            "urgency_handling": "immediate|deferred|escalated"
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                self.user_message, 
                planning_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                logger.warning("LLM API error in response planning, using fallback")
                return self._create_fallback_response_plan(situation)
            
            # Parse JSON response
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON from LLM response, using fallback")
                return self._create_fallback_response_plan(situation)
                
        except Exception as e:
            logger.error(f"Error in response planning: {e}")
            return self._create_fallback_response_plan(situation)
    
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
    
    def _create_fallback_situation_analysis(self) -> Dict[str, Any]:
        """
        Create fallback situation analysis when LLM fails
        """
        message_lower = self.user_message.lower()
        
        # Simple keyword-based analysis
        if any(word in message_lower for word in ["add", "create", "build", "implement"]):
            help_type = "feature_request"
        elif any(word in message_lower for word in ["done", "complete", "finish", "delete"]):
            help_type = "task_management"
        elif any(word in message_lower for word in ["what", "how", "why", "explain"]):
            help_type = "general_question"
        else:
            help_type = "general_chat"
        
        return {
            "main_concern": "User needs assistance",
            "help_type": help_type,
            "references_previous": False,
            "system_area": "general",
            "error_indicators": [],
            "urgency_level": "low",
            "confidence_level": 0.5,
            "specific_issue": "General assistance needed"
        }
    
    def _create_fallback_response_plan(self, situation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create fallback response plan when LLM fails
        """
        return {
            "response_type": "direct_solution",
            "understanding_statement": f"I understand you're asking about {situation.get('main_concern', 'your request')}",
            "main_solution": "Let me help you with that. Could you provide more specific details?",
            "context_integration": "I'll consider your project context when helping",
            "follow_up_actions": ["Ask for more details", "Provide general guidance"],
            "confidence": 0.6,
            "urgency_handling": "deferred"
        }
    
    def _create_fallback_plan(self) -> Dict[str, Any]:
        """
        Create complete fallback plan when planning phase fails
        """
        return {
            "response_type": "direct_solution",
            "understanding_statement": "I understand you need help",
            "main_solution": "Let me assist you with your request",
            "context_integration": "I'll use available context to help",
            "follow_up_actions": ["Ask for clarification if needed"],
            "confidence": 0.5,
            "urgency_handling": "deferred"
        }


class CommonIssuePatterns:
    """
    Recognize and handle common user issues
    """
    
    PATTERNS = {
        "response_length": {
            "indicators": ["exceeded limits", "processing shorter", "response too long", "truncation", "response was very detailed"],
            "handler": "ResponseLengthHandler",
            "priority": "high"
        },
        "ui_issues": {
            "indicators": ["can't see", "not showing", "white space", "overlapping", "broken layout"],
            "handler": "UIIssueHandler", 
            "priority": "high"
        },
        "task_problems": {
            "indicators": ["task not", "doesn't work", "button not working", "can't complete"],
            "handler": "TaskIssueHandler",
            "priority": "medium"
        },
        "memory_issues": {
            "indicators": ["memory not", "can't remember", "forgot", "not saving"],
            "handler": "MemoryIssueHandler",
            "priority": "medium"
        },
        "api_errors": {
            "indicators": ["api error", "endpoint", "server error", "connection"],
            "handler": "APIErrorHandler",
            "priority": "high"
        }
    }
    
    @classmethod
    def detect_issue_type(cls, user_message: str) -> Dict[str, Any]:
        """
        Detect what type of issue user is describing
        """
        message_lower = user_message.lower()
        
        for issue_type, config in cls.PATTERNS.items():
            if any(indicator in message_lower for indicator in config["indicators"]):
                return {
                    "type": issue_type,
                    "handler": config["handler"],
                    "priority": config["priority"],
                    "confidence": 0.8
                }
        
        return {"type": "general", "handler": "GeneralHandler", "priority": "low", "confidence": 0.3}


class ResponseLengthHandler:
    """
    Specific handler for the response length limit issue
    """
    
    @staticmethod
    def detect_response_length_issue(user_message: str) -> bool:
        """
        Detect if user is talking about response length limits
        """
        indicators = [
            "response was very detailed",
            "exceeded our limits", 
            "processing a shorter version",
            "response too long",
            "this shows up every time",
            "truncation message"
        ]
        
        message_lower = user_message.lower()
        return any(indicator in message_lower for indicator in indicators)
    
    @staticmethod
    async def handle_response_length_issue(context: Dict[str, Any]) -> str:
        """
        Provide specific solution for response length issues
        """
        return f"""
I understand you're experiencing the "response exceeded limits" error repeatedly. This is a known issue with our response length handling. Here's how to fix it:

## The Problem
The agent is generating responses longer than our 5000 character limit, causing the truncation message to appear.

## Immediate Solutions

### 1. Backend Fix (Recommended)
```python
# In your chat handler, increase the response limit:
MAX_RESPONSE_LENGTH = 15000  # Increase from 5000

# Or implement smart truncation:
def handle_long_response(response):
    if len(response) <= 5000:
        return response
    
    # Find last complete sentence within limit
    truncated = response[:4800]
    last_period = truncated.rfind('.')
    if last_period > 0:
        return response[:last_period + 1] + "\\n\\n[Continue this topic if you need more details]"
    
    return truncated + "..."
```

### 2. Response Chunking
Break long responses into multiple shorter messages automatically.

### 3. Smarter Agent Prompting
Modify agent prompts to be more concise while maintaining helpfulness.

## Next Steps
1. Which solution would you prefer to implement first?
2. Do you want help with the specific code changes?
3. Are you seeing this error in specific situations (like task generation, memory creation)?

This should eliminate the truncation message and provide better user experience.
"""


class IntelligentAgent:
    """
    Enhanced agent with planning phase for intelligent responses
    """
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.planning_phase = None
    
    async def process_user_message(self, user_message: str, conversation_history: List[Dict], 
                                 project_memories: List[Memory], tasks: List[Task], 
                                 project_context: Dict[str, Any]) -> str:
        """
        Main agent processing with planning phase
        """
        try:
            # Check for common patterns first
            issue_pattern = CommonIssuePatterns.detect_issue_type(user_message)
            
            if issue_pattern["confidence"] > 0.7:
                # Handle known patterns directly
                if issue_pattern["type"] == "response_length":
                    return await ResponseLengthHandler.handle_response_length_issue({
                        "message": user_message,
                        "history": conversation_history
                    })
                else:
                    # Use intelligent agent with planning for other patterns
                    return await self._process_with_planning(user_message, conversation_history, 
                                                          project_memories, tasks, project_context)
            else:
                # Use intelligent agent with planning
                return await self._process_with_planning(user_message, conversation_history, 
                                                      project_memories, tasks, project_context)
                
        except Exception as e:
            logger.error(f"Error in intelligent agent processing: {e}")
            return "I encountered an issue processing your request. Could you try rephrasing your question?"
    
    async def _process_with_planning(self, user_message: str, conversation_history: List[Dict],
                                   project_memories: List[Memory], tasks: List[Task], 
                                   project_context: Dict[str, Any]) -> str:
        """
        Process message with planning phase
        """
        # Phase 1: Planning
        self.planning_phase = AgentPlanningPhase(
            user_message, conversation_history, project_memories, tasks, project_context
        )
        
        plan = await self.planning_phase.analyze_and_plan()
        
        # Phase 2: Execution based on plan
        if plan["response_type"] == "direct_solution":
            return await self._provide_direct_solution(plan)
        elif plan["response_type"] == "guided_help":
            return await self._provide_guided_help(plan)
        else:
            return await self._ask_clarifying_questions(plan)
    
    async def _provide_direct_solution(self, plan: Dict[str, Any]) -> str:
        """
        Provide specific solution when we understand the issue
        """
        solution_prompt = f"""
        The user has this issue: {plan["understanding_statement"]}
        
        Provide a specific, actionable solution that:
        1. Acknowledges their specific problem
        2. Gives step-by-step solution
        3. References relevant context if helpful
        4. Offers follow-up assistance
        
        Main solution approach: {plan["main_solution"]}
        Context to integrate: {plan["context_integration"]}
        
        Write a helpful, specific response (not generic):
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Provide solution", 
                solution_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return f"I understand {plan['understanding_statement']}. {plan['main_solution']}"
            
            return response
            
        except Exception as e:
            logger.error(f"Error providing direct solution: {e}")
            return f"I understand {plan['understanding_statement']}. {plan['main_solution']}"
    
    async def _provide_guided_help(self, plan: Dict[str, Any]) -> str:
        """
        Guide user through solution when issue is complex
        """
        guidance_prompt = f"""
        The user needs guided help with: {plan["understanding_statement"]}
        
        Create a step-by-step guidance response that:
        1. Shows understanding of their situation
        2. Breaks down the solution into steps
        3. Asks for specific information needed
        4. Provides context from their project
        
        Solution approach: {plan["main_solution"]}
        Follow-up actions: {plan["follow_up_actions"]}
        
        Write a structured, helpful response:
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Provide guidance", 
                guidance_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return f"I understand {plan['understanding_statement']}. Let me guide you through this step by step: {plan['main_solution']}"
            
            return response
            
        except Exception as e:
            logger.error(f"Error providing guided help: {e}")
            return f"I understand {plan['understanding_statement']}. Let me guide you through this step by step: {plan['main_solution']}"
    
    async def _ask_clarifying_questions(self, plan: Dict[str, Any]) -> str:
        """
        Ask clarifying questions when we need more information
        """
        clarification_prompt = f"""
        The user needs clarification for: {plan["understanding_statement"]}
        
        Create clarifying questions that:
        1. Show you understand their general concern
        2. Ask specific questions to get needed details
        3. Help them provide the right information
        4. Guide them toward a solution
        
        Main issue: {plan["main_solution"]}
        Context: {plan["context_integration"]}
        
        Write helpful clarifying questions:
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(
                "Ask clarifying questions", 
                clarification_prompt
            )
            
            # Check for API errors
            if "I'm having trouble processing that request" in response or "Error:" in response:
                return f"I understand you're asking about {plan['understanding_statement']}. Could you provide more specific details about what you need help with?"
            
            return response
            
        except Exception as e:
            logger.error(f"Error asking clarifying questions: {e}")
            return f"I understand you're asking about {plan['understanding_statement']}. Could you provide more specific details about what you need help with?" 