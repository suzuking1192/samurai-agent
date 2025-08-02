import pytest
import asyncio
import uuid
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_agent import SamuraiAgent
from services.file_service import FileService
from models import Project, Task, Memory, ChatMessage


class TestMemoryGeneration:
    """Test suite for memory generation from chat conversations"""
    
    @pytest.fixture
    def samurai_agent(self):
        """Create a SamuraiAgent instance for testing"""
        return SamuraiAgent()
    
    @pytest.fixture
    def sample_project(self):
        """Create a sample project for testing"""
        return {
            'id': str(uuid.uuid4()),
            'name': 'Test E-commerce App',
            'description': 'A modern e-commerce platform',
            'tech_stack': 'React, Node.js, PostgreSQL'
        }
    
    @pytest.fixture
    def mock_file_service(self):
        """Mock file service for testing"""
        mock_service = Mock(spec=FileService)
        mock_service.load_memories.return_value = []
        mock_service.save_memories.return_value = None
        mock_service.load_chat_history.return_value = []
        mock_service.load_tasks.return_value = []
        return mock_service
    
    @pytest.mark.asyncio
    async def test_basic_memory_creation(self, samurai_agent, sample_project, mock_file_service):
        """Test that chat messages generate relevant memories"""
        # Mock the file service
        samurai_agent.file_service = mock_file_service
        
        # Mock the Gemini service response for memory extraction
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            MEMORY_ITEMS:
            Authentication System | decision | Decided to use JWT tokens with email/password authentication
            """
            
            # Test memory creation from conversation
            message = "I want to add user authentication to my app"
            response = "Great! What framework are you using?"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            # Verify that save_memories was called
            mock_file_service.save_memories.assert_called_once()
            
            # Verify the memory content
            call_args = mock_file_service.save_memories.call_args
            saved_memories = call_args[0][1]  # Second argument is the memories list
            
            assert len(saved_memories) == 1
            assert "JWT tokens" in saved_memories[0].content
            assert saved_memories[0].type == "decision"
            assert saved_memories[0].project_id == sample_project['id']
    
    @pytest.mark.asyncio
    async def test_memory_association_with_project(self, samurai_agent, sample_project, mock_file_service):
        """Test that memories are stored with correct project association"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            MEMORY_ITEMS:
            Database Choice | decision | Selected PostgreSQL for data persistence
            """
            
            message = "I need to choose a database for my app"
            response = "PostgreSQL would be a great choice for your use case"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            call_args = mock_file_service.save_memories.call_args
            saved_memories = call_args[0][1]
            
            assert saved_memories[0].project_id == sample_project['id']
    
    @pytest.mark.asyncio
    async def test_memory_content_quality(self, samurai_agent, sample_project, mock_file_service):
        """Test that important conversation points are extracted"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            MEMORY_ITEMS:
            Payment Integration | note | User wants to integrate Stripe for payment processing
            UI Framework | decision | Decided to use Material-UI for consistent design
            """
            
            message = "I need to add payment processing and want a consistent UI"
            response = "I recommend Stripe for payments and Material-UI for the interface"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            call_args = mock_file_service.save_memories.call_args
            saved_memories = call_args[0][1]
            
            assert len(saved_memories) == 2
            
            # Check that both important points were captured
            memory_contents = [m.content for m in saved_memories]
            assert any("Stripe" in content for content in memory_contents)
            assert any("Material-UI" in content for content in memory_contents)
    
    @pytest.mark.asyncio
    async def test_no_memory_for_small_talk(self, samurai_agent, sample_project, mock_file_service):
        """Test that irrelevant chat doesn't create unnecessary memories"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "NO_MEMORY_ITEMS"
            
            message = "Hello, how are you today?"
            response = "I'm doing well, thank you for asking!"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            # Verify that save_memories was not called (no memories to save)
            mock_file_service.save_memories.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_memory_persistence(self, samurai_agent, sample_project, mock_file_service):
        """Test that generated memories are saved to database"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            MEMORY_ITEMS:
            API Design | note | RESTful API with JSON responses and proper error handling
            """
            
            message = "How should I design my API?"
            response = "I recommend a RESTful design with JSON responses"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            # Verify save_memories was called
            mock_file_service.save_memories.assert_called_once()
            
            # Verify the memory has proper metadata
            call_args = mock_file_service.save_memories.call_args
            saved_memories = call_args[0][1]
            
            memory = saved_memories[0]
            assert memory.id is not None
            assert memory.created_at is not None
            assert isinstance(memory.created_at, datetime)


class TestTaskGeneration:
    """Test suite for task generation from chat conversations"""
    
    @pytest.fixture
    def samurai_agent(self):
        """Create a SamuraiAgent instance for testing"""
        return SamuraiAgent()
    
    @pytest.fixture
    def sample_project(self):
        """Create a sample project for testing"""
        return {
            'id': str(uuid.uuid4()),
            'name': 'Test E-commerce App',
            'description': 'A modern e-commerce platform',
            'tech_stack': 'React, Node.js, PostgreSQL'
        }
    
    @pytest.mark.asyncio
    async def test_task_creation_from_chat(self, samurai_agent, sample_project):
        """Test that action items mentioned in chat become tasks"""
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            TASKS:
            1. Create user registration form - Build a React form with email, password fields and validation
            2. Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
            3. Implement JWT token generation - Add JWT creation and validation logic in backend
            """
            
            message = "I need to implement user authentication"
            
            result = await samurai_agent._handle_feature_request(message, sample_project, sample_project['id'])
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            # Verify task properties
            task = result["tasks"][0]
            assert task.title == "Create user registration form"
            assert "React form" in task.description
            assert task.project_id == sample_project['id']
            assert task.status == "pending"
    
    @pytest.mark.asyncio
    async def test_task_content_extraction(self, samurai_agent, sample_project):
        """Test that 'I need to...' statements become tasks"""
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            TASKS:
            1. Build shopping cart functionality - Create cart component with add/remove items
            2. Integrate payment system - Set up Stripe payment processing
            3. Create product catalog - Build product listing with search and filters
            """
            
            message = "I need a shopping cart, payment integration, and product catalog"
            
            result = await samurai_agent._handle_feature_request(message, sample_project, sample_project['id'])
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            # Verify all requested features became tasks
            task_titles = [task.title for task in result["tasks"]]
            assert "shopping cart" in task_titles[0].lower()
            assert "payment" in task_titles[1].lower()
            assert "product catalog" in task_titles[2].lower()
    
    @pytest.mark.asyncio
    async def test_task_management(self, samurai_agent, sample_project):
        """Test that generated tasks are properly managed"""
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            TASKS:
            1. Fix submit button crash bug - Debug and resolve undefined property error
            2. Improve form validation logic - Add proper validation and error handling
            3. Add better error handling - Implement comprehensive error handling system
            """
            
            message = "My React app is crashing when users click the submit button"
            
            result = await samurai_agent._handle_feature_request(message, sample_project, sample_project['id'])
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            # Verify task management properties
            for task in result["tasks"]:
                assert task.id is not None
                assert task.project_id == sample_project['id']
                assert task.status == "pending"
                assert task.priority == "medium"
                assert task.created_at is not None
                assert task.updated_at is not None
    
    def test_parse_tasks_from_response(self, samurai_agent):
        """Test parsing tasks from AI response"""
        ai_response = """
        TASKS:
        1. Create user registration form - Build a React form with email, password fields and validation
        2. Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
        3. Implement JWT token generation - Add JWT creation and validation logic in backend
        """
        
        parsed_tasks = samurai_agent._parse_tasks_from_response(ai_response)
        
        assert len(parsed_tasks) == 3
        assert parsed_tasks[0]['title'] == "Create user registration form"
        assert "React form" in parsed_tasks[0]['description']
        assert parsed_tasks[1]['title'] == "Set up password hashing endpoint"
        assert parsed_tasks[2]['title'] == "Implement JWT token generation"
    
    def test_parse_tasks_with_bullet_points(self, samurai_agent):
        """Test parsing tasks with bullet point format"""
        ai_response = """
        TASKS:
        • Create user registration form - Build a React form with email, password fields and validation
        • Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
        """
        
        parsed_tasks = samurai_agent._parse_tasks_from_response(ai_response)
        
        assert len(parsed_tasks) == 2
        assert parsed_tasks[0]['title'] == "Create user registration form"
        assert parsed_tasks[1]['title'] == "Set up password hashing endpoint"


class TestChatToMemoryTaskIntegration:
    """Integration tests for chat to memory/task workflow"""
    
    @pytest.fixture
    def samurai_agent(self):
        """Create a SamuraiAgent instance for testing"""
        return SamuraiAgent()
    
    @pytest.fixture
    def sample_project(self):
        """Create a sample project for testing"""
        return {
            'id': str(uuid.uuid4()),
            'name': 'Test E-commerce App',
            'description': 'A modern e-commerce platform',
            'tech_stack': 'React, Node.js, PostgreSQL'
        }
    
    @pytest.fixture
    def mock_file_service(self):
        """Mock file service for integration testing"""
        mock_service = Mock(spec=FileService)
        mock_service.load_memories.return_value = []
        mock_service.save_memories.return_value = None
        mock_service.load_chat_history.return_value = []
        mock_service.load_tasks.return_value = []
        mock_service.save_tasks.return_value = None
        return mock_service
    
    @pytest.mark.asyncio
    async def test_complete_chat_workflow(self, samurai_agent, sample_project, mock_file_service):
        """Test end-to-end chat workflow with memory and task generation"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            # Mock responses for different parts of the workflow
            mock_chat.side_effect = [
                "feature_request",  # Intent analysis
                "clear",  # Clarity evaluation
                """
                TASKS:
                1. Create user registration form - Build a React form with email, password fields and validation
                2. Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
                3. Implement JWT token generation - Add JWT creation and validation logic in backend
                """,  # Feature breakdown
                """
                MEMORY_ITEMS:
                Authentication System | decision | Decided to implement JWT-based authentication with email/password
                """  # Memory extraction
            ]
            
            message = "I want to add user authentication to my app"
            
            result = await samurai_agent.process_message(message, sample_project['id'], sample_project)
            
            # Verify the complete workflow
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            # Verify tasks were saved
            mock_file_service.save_tasks.assert_called_once()
            
            # Verify memories were saved
            mock_file_service.save_memories.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_existing_memories(self, samurai_agent, sample_project, mock_file_service):
        """Test that existing memories are updated when relevant"""
        # Create existing memory
        existing_memory = Memory(
            id=str(uuid.uuid4()),
            project_id=sample_project['id'],
            content="Initial authentication plan",
            type="decision",
            created_at=datetime.now()
        )
        
        mock_file_service.load_memories.return_value = [existing_memory]
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = """
            MEMORY_ITEMS:
            Authentication System | decision | Updated to use JWT tokens with refresh tokens
            """
            
            message = "I want to update the authentication to use refresh tokens"
            response = "Great idea! Refresh tokens will improve security"
            
            await samurai_agent._update_memory_from_conversation(
                message, response, sample_project['id'], sample_project
            )
            
            # Verify that save_memories was called
            mock_file_service.save_memories.assert_called_once()
            
            # Verify the memory was updated
            call_args = mock_file_service.save_memories.call_args
            saved_memories = call_args[0][1]
            
            assert len(saved_memories) == 2  # Existing memory + new memory
            # Check that the new memory contains the update
            new_memory = saved_memories[1]  # The new memory should be the second one
            assert "refresh tokens" in new_memory.content
    
    @pytest.mark.asyncio
    async def test_link_related_tasks_and_memories(self, samurai_agent, sample_project, mock_file_service):
        """Test that related tasks and memories are linked"""
        samurai_agent.file_service = mock_file_service
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.side_effect = [
                "feature_request",
                "clear",
                """
                TASKS:
                1. Create user registration form - Build a React form with email, password fields and validation
                2. Set up password hashing endpoint - Create FastAPI endpoint that hashes passwords using bcrypt
                """,
                """
                MEMORY_ITEMS:
                Authentication System | decision | Decided to use bcrypt for password hashing and JWT for tokens
                """
            ]
            
            message = "I need to implement user authentication with secure password handling"
            
            result = await samurai_agent.process_message(message, sample_project['id'], sample_project)
            
            # Verify both tasks and memories were created
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 2
            
            # Verify the relationship through project_id
            for task in result["tasks"]:
                assert task.project_id == sample_project['id']
            
            # Verify memories were also created for the same project
            mock_file_service.save_memories.assert_called_once()


class TestSpecificScenarios:
    """Test specific scenarios from the requirements"""
    
    @pytest.fixture
    def samurai_agent(self):
        """Create a SamuraiAgent instance for testing"""
        return SamuraiAgent()
    
    @pytest.fixture
    def sample_project(self):
        """Create a sample project for testing"""
        return {
            'id': str(uuid.uuid4()),
            'name': 'Test E-commerce App',
            'description': 'A modern e-commerce platform',
            'tech_stack': 'React, Node.js, PostgreSQL'
        }
    
    @pytest.mark.asyncio
    async def test_scenario_1_technical_discussion(self, samurai_agent, sample_project):
        """Test Scenario 1: Technical Discussion"""
        test_chat = [
            {"user": "I want to add user authentication to my app"},
            {"agent": "Great! What framework are you using?"},
            {"user": "I'm using React with Node.js backend. I need to implement login, signup, and password reset"},
            {"agent": "Perfect. Here's what you'll need to do..."}
        ]
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.side_effect = [
                "feature_request",
                "clear",
                """
                TASKS:
                1. Implement user login functionality - Create login form and authentication endpoint
                2. Implement user signup functionality - Create registration form and user creation endpoint
                3. Implement password reset feature - Create password reset flow with email verification
                """,
                """
                MEMORY_ITEMS:
                Authentication Stack | decision | Using React frontend with Node.js backend for authentication
                """
            ]
            
            # Process the final message that should trigger task generation
            message = "I'm using React with Node.js backend. I need to implement login, signup, and password reset"
            
            result = await samurai_agent.process_message(message, sample_project['id'], sample_project)
            
            # Expected Results:
            # Memory: "User wants to implement authentication system with React/Node.js stack"
            # Tasks: 
            # - "Implement user login functionality"
            # - "Implement user signup functionality" 
            # - "Implement password reset feature"
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            task_titles = [task.title.lower() for task in result["tasks"]]
            assert any("login" in title for title in task_titles)
            assert any("signup" in title for title in task_titles)
            assert any("password reset" in title for title in task_titles)
    
    @pytest.mark.asyncio
    async def test_scenario_2_project_planning(self, samurai_agent, sample_project):
        """Test Scenario 2: Project Planning"""
        test_chat = [
            {"user": "I'm planning a new e-commerce website"},
            {"agent": "Exciting! What features do you want to include?"},
            {"user": "I need a shopping cart, payment integration, and product catalog. I should also add user reviews and wishlist functionality"}
        ]
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.side_effect = [
                "feature_request",
                "clear",
                """
                TASKS:
                1. Build shopping cart functionality - Create cart component with add/remove items
                2. Integrate payment system - Set up Stripe payment processing
                3. Create product catalog - Build product listing with search and filters
                4. Add user review system - Create review component and backend API
                5. Implement wishlist feature - Build wishlist functionality with save/remove items
                """,
                """
                MEMORY_ITEMS:
                E-commerce Features | note | Planning to include shopping cart, payments, catalog, reviews, and wishlist
                """
            ]
            
            message = "I need a shopping cart, payment integration, and product catalog. I should also add user reviews and wishlist functionality"
            
            result = await samurai_agent.process_message(message, sample_project['id'], sample_project)
            
            # Expected Results:
            # Memory: "User planning e-commerce website with shopping cart, payments, catalog, reviews, wishlist"
            # Tasks:
            # - "Build shopping cart functionality"
            # - "Integrate payment system"
            # - "Create product catalog"
            # - "Add user review system"
            # - "Implement wishlist feature"
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 5
            
            task_titles = [task.title.lower() for task in result["tasks"]]
            assert any("shopping cart" in title for title in task_titles)
            assert any("payment" in title for title in task_titles)
            assert any("product catalog" in title for title in task_titles)
            assert any("review" in title for title in task_titles)
            assert any("wishlist" in title for title in task_titles)
    
    @pytest.mark.asyncio
    async def test_scenario_3_bug_fix_discussion(self, samurai_agent, sample_project):
        """Test Scenario 3: Bug Fix Discussion"""
        test_chat = [
            {"user": "My React app is crashing when users click the submit button"},
            {"agent": "Let's debug this. Can you share the error message?"},
            {"user": "It says 'Cannot read property of undefined'. I think it's in the form validation logic. I need to fix this ASAP and also add better error handling"}
        ]
        
        with patch.object(samurai_agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.side_effect = [
                "feature_request",
                "clear",
                """
                TASKS:
                1. Fix submit button crash bug - Debug and resolve undefined property error in form validation
                2. Improve form validation logic - Add proper validation and error handling
                3. Add better error handling - Implement comprehensive error handling system
                """,
                """
                MEMORY_ITEMS:
                Bug Report | note | React app crashing on submit button with undefined property error in form validation
                """
            ]
            
            message = "It says 'Cannot read property of undefined'. I think it's in the form validation logic. I need to fix this ASAP and also add better error handling"
            
            result = await samurai_agent.process_message(message, sample_project['id'], sample_project)
            
            # Expected Results:
            # Memory: "User experiencing React app crash on submit button - undefined property error in form validation"
            # Tasks:
            # - "Fix submit button crash bug"
            # - "Improve form validation logic"
            # - "Add better error handling"
            
            assert result["type"] == "feature_breakdown"
            assert len(result["tasks"]) == 3
            
            task_titles = [task.title.lower() for task in result["tasks"]]
            assert any("crash" in title or "bug" in title for title in task_titles)
            assert any("validation" in title for title in task_titles)
            assert any("error handling" in title for title in task_titles)


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"]) 