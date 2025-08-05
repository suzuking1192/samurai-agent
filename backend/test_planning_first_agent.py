"""
Test suite for the Planning-First Samurai Agent

This test suite validates the new planning-first architecture implementation,
ensuring that the agent can properly analyze conversation context, generate
comprehensive plans, and execute them with conversation awareness.
"""

import asyncio
import json
import logging
import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

# Import the planning-first agent
from services.planning_first_agent import (
    PlanningFirstAgent, 
    PlanStep, 
    ExecutionPlan, 
    ConversationContext,
    planning_first_agent
)
from models import Task, Memory, Project, ChatMessage

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestPlanningFirstAgent:
    """Test suite for the PlanningFirstAgent class."""
    
    @pytest.fixture
    def agent(self):
        """Create a test instance of the planning-first agent."""
        return PlanningFirstAgent()
    
    @pytest.fixture
    def sample_project_context(self):
        """Sample project context for testing."""
        return {
            "name": "Test Todo App",
            "description": "A test todo application",
            "tech_stack": "React + FastAPI + PostgreSQL",
            "created_at": datetime.now()
        }
    
    @pytest.fixture
    def sample_conversation_history(self):
        """Sample conversation history for testing."""
        return [
            ChatMessage(
                id="msg1",
                project_id="test-project",
                session_id="test-session",
                message="I want to add user authentication to my app",
                response="I'll help you implement user authentication. Let me break this down into tasks.",
                created_at=datetime.now()
            ),
            ChatMessage(
                id="msg2", 
                project_id="test-project",
                session_id="test-session",
                message="I prefer using JWT tokens",
                response="Great choice! JWT tokens are a good option for authentication.",
                created_at=datetime.now()
            )
        ]
    
    @pytest.fixture
    def sample_tasks(self):
        """Sample tasks for testing."""
        return [
            Task(
                id="task1",
                project_id="test-project",
                title="Create user registration form",
                description="Build a React form for user registration",
                completed=False,
                created_at=datetime.now()
            ),
            Task(
                id="task2",
                project_id="test-project", 
                title="Implement JWT authentication",
                description="Add JWT token generation and validation",
                completed=True,
                created_at=datetime.now()
            )
        ]
    
    @pytest.fixture
    def sample_memories(self):
        """Sample memories for testing."""
        return [
            Memory(
                id="mem1",
                project_id="test-project",
                title="Authentication Decision",
                content="User chose JWT tokens for authentication",
                category="decision",
                type="decision",
                created_at=datetime.now()
            )
        ]

    def test_agent_initialization(self, agent):
        """Test that the agent initializes correctly."""
        assert agent is not None
        assert agent.gemini_service is not None
        assert agent.file_service is not None
        assert agent.tool_registry is not None
        assert agent.consolidated_memory_service is not None
        assert agent.max_plan_steps == 10
        assert agent.max_conversation_history == 20
        assert agent.plan_validation_threshold == 0.7

    @pytest.mark.asyncio
    async def test_gather_comprehensive_context(self, agent, sample_project_context, sample_conversation_history):
        """Test comprehensive context gathering."""
        with patch.object(agent, '_build_vector_enhanced_context') as mock_vector_context, \
             patch.object(agent, '_analyze_conversation_patterns') as mock_analysis:
            
            # Mock the context building methods
            mock_vector_context.return_value = {"context_embedding": [0.1, 0.2, 0.3]}
            mock_analysis.return_value = {
                "ongoing_discussions": ["authentication implementation"],
                "unresolved_questions": [],
                "user_preferences": {"auth_method": "JWT"},
                "technical_decisions": ["JWT tokens for auth"],
                "themes": ["authentication", "security"],
                "summary": "User wants to implement JWT authentication"
            }
            
            # Test context gathering
            context = await agent._gather_comprehensive_context(
                "I want to add password reset functionality",
                "test-project",
                "session1",
                sample_conversation_history,
                sample_project_context
            )
            
            assert isinstance(context, ConversationContext)
            assert len(context.session_messages) == 2
            assert "authentication implementation" in context.ongoing_discussions
            assert context.user_preferences["auth_method"] == "JWT"
            assert "JWT tokens for auth" in context.technical_decisions

    @pytest.mark.asyncio
    async def test_analyze_user_intent_with_context(self, agent, sample_project_context):
        """Test user intent analysis with conversation context."""
        # Create a conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="User is implementing authentication",
            ongoing_discussions=["JWT implementation"],
            unresolved_questions=[],
            user_preferences={"auth_method": "JWT"},
            technical_decisions=["JWT tokens for auth"],
            conversation_themes=["authentication"],
            context_embedding=None
        )
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            # Mock the LLM response
            mock_chat.return_value = json.dumps({
                "primary_intent": "feature_request",
                "secondary_intent": "continuation",
                "referenced_items": ["JWT authentication"],
                "required_actions": ["add password reset"],
                "context_dependencies": ["existing auth system"],
                "conversation_continuity": True,
                "complexity_level": "moderate",
                "confidence_score": 0.8,
                "clarification_needed": False,
                "clarification_questions": []
            })
            
            # Test intent analysis
            intent = await agent._analyze_user_intent_with_context(
                "I want to add password reset functionality",
                context,
                sample_project_context
            )
            
            assert intent["primary_intent"] == "feature_request"
            assert intent["secondary_intent"] == "continuation"
            assert intent["conversation_continuity"] is True
            assert intent["confidence_score"] == 0.8

    @pytest.mark.asyncio
    async def test_generate_comprehensive_plan(self, agent, sample_project_context):
        """Test comprehensive plan generation."""
        # Create intent analysis
        intent_analysis = {
            "primary_intent": "feature_request",
            "secondary_intent": "continuation",
            "referenced_items": ["JWT authentication"],
            "required_actions": ["add password reset"],
            "context_dependencies": ["existing auth system"],
            "conversation_continuity": True,
            "complexity_level": "moderate",
            "confidence_score": 0.8,
            "clarification_needed": False,
            "clarification_questions": []
        }
        
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="User is implementing authentication",
            ongoing_discussions=["JWT implementation"],
            unresolved_questions=[],
            user_preferences={"auth_method": "JWT"},
            technical_decisions=["JWT tokens for auth"],
            conversation_themes=["authentication"],
            context_embedding=None
        )
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt') as mock_chat, \
             patch.object(agent, '_get_available_tools_description') as mock_tools:
            
            # Mock the LLM response
            mock_chat.return_value = json.dumps({
                "plan_type": "multi_step",
                "estimated_duration": 30,
                "confidence_score": 0.85,
                "steps": [
                    {
                        "step_type": "tool_call",
                        "tool_name": "create_task",
                        "parameters": {"title": "Add password reset", "description": "Implement password reset functionality"},
                        "description": "Create task for password reset implementation",
                        "dependencies": [],
                        "estimated_duration": 5,
                        "priority": "high"
                    },
                    {
                        "step_type": "response_generation",
                        "tool_name": None,
                        "parameters": {},
                        "description": "Generate response to user",
                        "dependencies": ["step_1"],
                        "estimated_duration": 2,
                        "priority": "medium"
                    }
                ],
                "validation_requirements": ["check tool availability"],
                "error_handling": ["retry on failure"]
            })
            
            mock_tools.return_value = '{"create_task": "Create new tasks"}'
            
            # Test plan generation
            plan = await agent._generate_comprehensive_plan(
                "I want to add password reset functionality",
                intent_analysis,
                context,
                sample_project_context
            )
            
            assert isinstance(plan, ExecutionPlan)
            assert plan.plan_type == "multi_step"
            assert len(plan.steps) == 2
            assert plan.steps[0].step_type == "tool_call"
            assert plan.steps[0].tool_name == "create_task"
            assert plan.steps[1].step_type == "response_generation"
            assert plan.confidence_score == 0.85

    @pytest.mark.asyncio
    async def test_validate_and_optimize_plan(self, agent, sample_project_context):
        """Test plan validation and optimization."""
        # Create a test plan
        step1 = PlanStep(
            step_id="step_1",
            step_type="tool_call",
            tool_name="create_task",
            parameters={"title": "Test task"},
            description="Create a test task",
            dependencies=[],
            estimated_duration=5,
            priority="high"
        )
        
        step2 = PlanStep(
            step_id="step_2",
            step_type="response_generation",
            tool_name=None,
            parameters={},
            description="Generate response",
            dependencies=["step_1"],
            estimated_duration=2,
            priority="medium"
        )
        
        plan = ExecutionPlan(
            plan_id="test-plan",
            user_message="Create a test task",
            conversation_context={},
            steps=[step1, step2],
            estimated_total_duration=7,
            confidence_score=0.8,
            plan_type="multi_step",
            created_at=datetime.now()
        )
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            # Mock validation response
            mock_chat.return_value = json.dumps({
                "is_valid": True,
                "validation_errors": [],
                "optimization_suggestions": ["Combine similar steps"],
                "optimized_steps": [
                    {
                        "step_id": "step_1",
                        "optimizations": ["Add error handling"]
                    }
                ],
                "confidence_boost": 0.1,
                "estimated_improvement": "Better error handling"
            })
            
            # Test validation
            validation_result = await agent._validate_and_optimize_plan(plan, sample_project_context)
            
            assert validation_result["is_valid"] is True
            assert len(validation_result["validation_errors"]) == 0
            assert "Combine similar steps" in validation_result["optimization_suggestions"]
            assert validation_result["confidence_boost"] == 0.1

    @pytest.mark.asyncio
    async def test_execute_plan_with_context(self, agent):
        """Test plan execution with context."""
        # Create a test plan
        step1 = PlanStep(
            step_id="step_1",
            step_type="tool_call",
            tool_name="create_task",
            parameters={"title": "Test task"},
            description="Create a test task",
            dependencies=[],
            estimated_duration=5,
            priority="high"
        )
        
        step2 = PlanStep(
            step_id="step_2",
            step_type="response_generation",
            tool_name=None,
            parameters={},
            description="Generate response",
            dependencies=["step_1"],
            estimated_duration=2,
            priority="medium"
        )
        
        plan = ExecutionPlan(
            plan_id="test-plan",
            user_message="Create a test task",
            conversation_context={},
            steps=[step1, step2],
            estimated_total_duration=7,
            confidence_score=0.8,
            plan_type="multi_step",
            created_at=datetime.now()
        )
        
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="Test conversation",
            ongoing_discussions=[],
            unresolved_questions=[],
            user_preferences={},
            technical_decisions=[],
            conversation_themes=[],
            context_embedding=None
        )
        
        with patch.object(agent, '_execute_single_step') as mock_execute:
            # Mock step execution
            mock_execute.side_effect = [
                {"success": True, "result": "Task created"},
                {"success": True, "result": "Response generated"}
            ]
            
            # Test plan execution
            results = await agent._execute_plan_with_context(plan, "test-project", context)
            
            assert len(results["completed_steps"]) == 2
            assert len(results["failed_steps"]) == 0
            assert results["success_rate"] == 1.0
            assert results["execution_time"] > 0

    @pytest.mark.asyncio
    async def test_execute_single_step(self, agent):
        """Test single step execution."""
        # Create a test step
        step = PlanStep(
            step_id="step_1",
            step_type="tool_call",
            tool_name="create_task",
            parameters={"title": "Test task"},
            description="Create a test task",
            dependencies=[],
            estimated_duration=5,
            priority="high"
        )
        
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="Test conversation",
            ongoing_discussions=[],
            unresolved_questions=[],
            user_preferences={},
            technical_decisions=[],
            conversation_themes=[],
            context_embedding=None
        )
        
        with patch.object(agent, '_execute_tool_call') as mock_tool_call:
            # Mock tool execution
            mock_tool_call.return_value = {"success": True, "result": "Task created"}
            
            # Test step execution
            result = await agent._execute_single_step(step, "test-project", context, {})
            
            assert result["success"] is True
            assert result["result"] == "Task created"

    def test_enhance_tool_parameters_with_context(self, agent):
        """Test tool parameter enhancement with context."""
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="Test conversation",
            ongoing_discussions=["authentication"],
            unresolved_questions=[],
            user_preferences={"auth_method": "JWT"},
            technical_decisions=["JWT tokens"],
            conversation_themes=["security"],
            context_embedding=None
        )
        
        # Test parameters
        parameters = {"title": "Test task"}
        previous_results = {"step_1": {"success": True, "result": "Previous result"}}
        
        # Test enhancement
        enhanced = agent._enhance_tool_parameters_with_context(parameters, context, previous_results)
        
        assert enhanced["title"] == "Test task"
        assert "conversation_context" in enhanced
        assert enhanced["conversation_context"]["ongoing_discussions"] == ["authentication"]
        assert enhanced["conversation_context"]["user_preferences"]["auth_method"] == "JWT"
        assert "previous_results" in enhanced
        # Fix the assertion - previous_results should be a dict, not a string
        assert isinstance(enhanced["previous_results"], dict)
        assert "step_1" in enhanced["previous_results"]

    @pytest.mark.asyncio
    async def test_generate_contextual_response(self, agent, sample_project_context):
        """Test contextual response generation."""
        # Create execution results
        execution_results = {
            "completed_steps": [Mock(), Mock()],
            "failed_steps": [],
            "step_results": {"step_1": {"success": True}, "step_2": {"success": True}},
            "execution_time": 3.5,
            "success_rate": 1.0
        }
        
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="User requested task creation",
            ongoing_discussions=["task management"],
            unresolved_questions=[],
            user_preferences={},
            technical_decisions=[],
            conversation_themes=["productivity"],
            context_embedding=None
        )
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            # Mock response generation
            mock_chat.return_value = "I've successfully created the tasks you requested. The implementation is now ready for development."
            
            # Test response generation
            response = await agent._generate_contextual_response(
                "Create tasks for authentication",
                execution_results,
                context,
                sample_project_context
            )
            
            assert "successfully created" in response
            assert len(response) > 0

    @pytest.mark.asyncio
    async def test_full_message_processing(self, agent, sample_project_context, sample_conversation_history):
        """Test the complete message processing pipeline."""
        with patch.object(agent, '_gather_comprehensive_context') as mock_gather, \
             patch.object(agent, '_analyze_user_intent_with_context') as mock_analyze, \
             patch.object(agent, '_generate_comprehensive_plan') as mock_generate, \
             patch.object(agent, '_validate_and_optimize_plan') as mock_validate, \
             patch.object(agent, '_execute_plan_with_context') as mock_execute, \
             patch.object(agent, '_generate_contextual_response') as mock_response, \
             patch.object(agent, '_update_memory_from_execution') as mock_memory:
            
            # Mock all the pipeline steps
            mock_gather.return_value = ConversationContext(
                session_messages=sample_conversation_history,
                recent_conversation_summary="Test conversation",
                ongoing_discussions=[],
                unresolved_questions=[],
                user_preferences={},
                technical_decisions=[],
                conversation_themes=[],
                context_embedding=None
            )
            
            mock_analyze.return_value = {
                "primary_intent": "feature_request",
                "secondary_intent": "new_topic",
                "referenced_items": [],
                "required_actions": ["create task"],
                "context_dependencies": [],
                "conversation_continuity": False,
                "complexity_level": "simple",
                "confidence_score": 0.8,
                "clarification_needed": False,
                "clarification_questions": []
            }
            
            mock_generate.return_value = ExecutionPlan(
                plan_id="test-plan",
                user_message="Create a test task",
                conversation_context={},
                steps=[PlanStep(step_id="step_1", step_type="response_generation", description="Generate response")],
                estimated_total_duration=5,
                confidence_score=0.8,
                plan_type="single_step",
                created_at=datetime.now()
            )
            
            mock_validate.return_value = {"is_valid": True, "validation_errors": []}
            
            mock_execute.return_value = {
                "completed_steps": [Mock()],
                "failed_steps": [],
                "step_results": {},
                "execution_time": 2.0,
                "success_rate": 1.0
            }
            
            mock_response.return_value = "I've created the task for you."
            
            # Test full processing
            result = await agent.process_user_message(
                "Create a test task",
                "test-project",
                sample_project_context,
                "session1",
                sample_conversation_history
            )
            
            assert result["type"] == "planning_first_response"
            assert result["response"] == "I've created the task for you."
            assert result["steps_completed"] == 1
            assert result["total_steps"] == 1
            assert result["execution_time"] == 2.0
            assert result["plan_type"] == "single_step"
            assert result["confidence_score"] == 0.8

    def test_fallback_methods(self, agent, sample_project_context):
        """Test fallback methods for error handling."""
        # Test fallback context
        fallback_context = agent._create_fallback_context(
            "Test message", "test-project", sample_project_context
        )
        assert isinstance(fallback_context, ConversationContext)
        assert fallback_context.recent_conversation_summary == "Processing: Test message"
        
        # Test fallback intent analysis
        fallback_intent = agent._create_fallback_intent_analysis("Test message")
        assert fallback_intent["primary_intent"] == "general_chat"
        assert fallback_intent["confidence_score"] == 0.5
        
        # Test fallback plan
        fallback_plan = agent._create_fallback_plan("Test message", fallback_intent)
        assert isinstance(fallback_plan, ExecutionPlan)
        assert len(fallback_plan.steps) == 1
        assert fallback_plan.steps[0].step_type == "response_generation"
        
        # Test fallback conversation analysis
        fallback_analysis = agent._create_fallback_conversation_analysis()
        assert fallback_analysis["summary"] == "No recent conversation context available"

    @pytest.mark.asyncio
    async def test_error_handling(self, agent, sample_project_context):
        """Test error handling in the agent."""
        with patch.object(agent, '_gather_comprehensive_context') as mock_gather:
            # Mock an error in context gathering
            mock_gather.side_effect = Exception("Context gathering failed")
            
            # Test error handling
            result = await agent.process_user_message(
                "Test message",
                "test-project",
                sample_project_context
            )
            
            assert result["type"] == "error"
            assert "error processing your request" in result["response"]
            assert result["confidence_score"] == 0.0

    def test_conversation_text_building(self, agent, sample_conversation_history):
        """Test conversation text building."""
        conversation_text = agent._build_conversation_text(
            sample_conversation_history, "Current message"
        )
        
        assert "I want to add user authentication to my app" in conversation_text
        assert "I prefer using JWT tokens" in conversation_text
        assert "Current message" in conversation_text
        assert "User:" in conversation_text
        assert "Assistant:" in conversation_text

    @pytest.mark.asyncio
    async def test_plan_validation_failure_handling(self, agent, sample_project_context):
        """Test handling of plan validation failures."""
        # Create conversation context
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="Test conversation",
            ongoing_discussions=[],
            unresolved_questions=[],
            user_preferences={},
            technical_decisions=[],
            conversation_themes=[],
            context_embedding=None
        )
        
        # Test validation failure handling
        validation_result = {
            "is_valid": False,
            "validation_errors": ["Tool not available", "Invalid parameters"]
        }
        
        result = await agent._handle_plan_validation_failure(
            "Test message",
            validation_result,
            context,
            sample_project_context
        )
        
        assert result["type"] == "planning_error"
        assert "issues with the plan" in result["response"]
        assert "Tool not available" in result["response"]
        assert "Invalid parameters" in result["response"]


class TestPlanStep:
    """Test suite for the PlanStep dataclass."""
    
    def test_plan_step_creation(self):
        """Test PlanStep creation and initialization."""
        step = PlanStep(
            step_id="test_step",
            step_type="tool_call",
            tool_name="create_task",
            parameters={"title": "Test task"},
            description="Create a test task",
            dependencies=["step_1"],
            estimated_duration=10,
            priority="high"
        )
        
        assert step.step_id == "test_step"
        assert step.step_type == "tool_call"
        assert step.tool_name == "create_task"
        assert step.parameters["title"] == "Test task"
        assert step.description == "Create a test task"
        assert step.dependencies == ["step_1"]
        assert step.estimated_duration == 10
        assert step.priority == "high"
    
    def test_plan_step_defaults(self):
        """Test PlanStep with default values."""
        step = PlanStep(
            step_id="test_step",
            step_type="response_generation"
        )
        
        assert step.parameters == {}
        assert step.dependencies == []
        assert step.description == ""
        assert step.estimated_duration == 0
        assert step.priority == "medium"


class TestExecutionPlan:
    """Test suite for the ExecutionPlan dataclass."""
    
    def test_execution_plan_creation(self):
        """Test ExecutionPlan creation and initialization."""
        step = PlanStep(step_id="step_1", step_type="response_generation")
        
        plan = ExecutionPlan(
            plan_id="test_plan",
            user_message="Test message",
            conversation_context={"test": "context"},
            steps=[step],
            estimated_total_duration=15,
            confidence_score=0.9,
            plan_type="multi_step",
            created_at=datetime.now()
        )
        
        assert plan.plan_id == "test_plan"
        assert plan.user_message == "Test message"
        assert plan.conversation_context["test"] == "context"
        assert len(plan.steps) == 1
        assert plan.estimated_total_duration == 15
        assert plan.confidence_score == 0.9
        assert plan.plan_type == "multi_step"
        assert plan.validation_status == "pending"
        assert plan.validation_errors == []
    
    def test_execution_plan_defaults(self):
        """Test ExecutionPlan with default values."""
        step = PlanStep(step_id="step_1", step_type="response_generation")
        
        plan = ExecutionPlan(
            plan_id="test_plan",
            user_message="Test message",
            conversation_context={},
            steps=[step],
            estimated_total_duration=10,
            confidence_score=0.5,
            plan_type="single_step",
            created_at=datetime.now()
        )
        
        assert plan.validation_status == "pending"
        assert plan.validation_errors == []


class TestConversationContext:
    """Test suite for the ConversationContext dataclass."""
    
    def test_conversation_context_creation(self):
        """Test ConversationContext creation."""
        context = ConversationContext(
            session_messages=[],
            recent_conversation_summary="Test summary",
            ongoing_discussions=["topic1", "topic2"],
            unresolved_questions=["question1"],
            user_preferences={"pref1": "value1"},
            technical_decisions=["decision1"],
            conversation_themes=["theme1"],
            context_embedding=[0.1, 0.2, 0.3]
        )
        
        assert context.recent_conversation_summary == "Test summary"
        assert context.ongoing_discussions == ["topic1", "topic2"]
        assert context.unresolved_questions == ["question1"]
        assert context.user_preferences["pref1"] == "value1"
        assert context.technical_decisions == ["decision1"]
        assert context.conversation_themes == ["theme1"]
        assert context.context_embedding == [0.1, 0.2, 0.3]


# Integration tests
class TestPlanningFirstAgentIntegration:
    """Integration tests for the planning-first agent."""
    
    @pytest.mark.asyncio
    async def test_singleton_instance(self):
        """Test that the singleton instance works correctly."""
        assert planning_first_agent is not None
        assert isinstance(planning_first_agent, PlanningFirstAgent)
        
        # Test that it's the same instance
        from services.planning_first_agent import planning_first_agent as instance2
        assert planning_first_agent is instance2


# Performance tests
class TestPlanningFirstAgentPerformance:
    """Performance tests for the planning-first agent."""
    
    @pytest.mark.asyncio
    async def test_large_conversation_history(self):
        """Test performance with large conversation history."""
        agent = PlanningFirstAgent()
        
        # Create large conversation history
        large_history = []
        for i in range(100):
            large_history.append(ChatMessage(
                id=f"msg_{i}",
                project_id="test-project",
                session_id="test-session",
                message=f"Message {i}",
                response=f"Response {i}",
                created_at=datetime.now()
            ))
        
        # Test context gathering with large history
        with patch.object(agent, '_build_vector_enhanced_context') as mock_vector, \
             patch.object(agent, '_analyze_conversation_patterns') as mock_analysis:
            
            mock_vector.return_value = {"context_embedding": None}
            mock_analysis.return_value = {
                "ongoing_discussions": [],
                "unresolved_questions": [],
                "user_preferences": {},
                "technical_decisions": [],
                "themes": [],
                "summary": "Large conversation"
            }
            
            context = await agent._gather_comprehensive_context(
                "Test message",
                "test-project",
                "session1",
                large_history,
                {"name": "Test Project"}
            )
            
            assert len(context.session_messages) == 100
            assert context.recent_conversation_summary == "Large conversation"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"]) 