import pytest
import os
import tempfile
import shutil
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock
import sys

# Add the backend directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models import LLMCallRecord, Project, ChatRequest
from services.gemini_service import GeminiService
from services.file_service import FileService


class TestLLMCostIntegration:
    """Integration tests for the complete LLM cost tracking flow."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService(data_dir=self.temp_dir)
        
        # Create a test project
        self.test_project = Project(
            id="test-project-integration",
            name="Test Project Integration",
            description="A test project for integration testing",
            tech_stack="Python, FastAPI",
            created_at=datetime.now()
        )
        self.file_service.save_project(self.test_project)
    
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    @patch('backend.services.agent_core.unified_samurai_agent.unified_samurai_agent')
    @patch('main.file_service')
    @patch('backend.services.llm_providers.gemini_service.GeminiService')
    @pytest.mark.asyncio
    async def test_complete_llm_cost_tracking_flow(self, mock_gemini_service_class, mock_file_service, mock_unified_agent):
        """Test that GeminiService automatically tracks costs during chat flow."""
        from main import chat
        
        # Mock the file service methods
        mock_file_service.get_project_by_id.return_value = self.test_project
        mock_file_service.load_project_detail.return_value = "Test project detail"
        mock_file_service.get_latest_session.return_value = MagicMock(id="test-session")
        mock_file_service.load_chat_messages_by_session.return_value = []
        mock_file_service.save_chat_message = MagicMock()
        mock_file_service.update_session_activity = MagicMock()
        
        # Mock the GeminiService instance
        mock_gemini_instance = MagicMock()
        mock_gemini_service_class.return_value = mock_gemini_instance
        mock_gemini_instance.chat_with_system_prompt = AsyncMock(return_value="This is a test response")
        mock_gemini_instance._save_llm_call_record = MagicMock()
        
        # Mock the unified agent response (no longer includes llm_usage)
        mock_unified_agent.process_message = AsyncMock(return_value={
            "type": "chat_response",
            "response": "This is a test response"
        })
        
        # Create a chat request
        chat_request = ChatRequest(message="Hello, this is a test message")
        
        # Call the chat endpoint
        response = await chat("test-project-integration", chat_request)
        
        # Verify the response
        assert response.response == "This is a test response"
        
        # Verify that the unified agent was called with the project_id
        mock_unified_agent.process_message.assert_called_once()
        call_args = mock_unified_agent.process_message.call_args
        assert call_args[1]["project_id"] == "test-project-integration"
    
    @patch('services.file_service.file_service')
    @pytest.mark.asyncio
    async def test_gemini_service_automatic_cost_tracking(self, mock_file_service):
        """Test that GeminiService automatically saves cost records when making LLM calls."""
        from services.gemini_service import GeminiService
        from unittest.mock import MagicMock
        
        # Create a real GeminiService instance
        gemini_service = GeminiService()
        
        # Mock the model to return a response with usage metadata
        mock_response = MagicMock()
        mock_response.text = "This is a test response"
        mock_response.usage_metadata = MagicMock()
        mock_response.usage_metadata.prompt_token_count = 1500
        mock_response.usage_metadata.candidates_token_count = 750
        
        # Mock the model.generate_content method
        with patch.object(gemini_service.model, 'generate_content', return_value=mock_response):
            # Mock the save method
            mock_file_service.save_llm_call_record = MagicMock()
            
            # Make a chat call with project_id
            response = await gemini_service.chat_with_system_prompt(
                "Test message", 
                "Test system prompt", 
                project_id="test-project"
            )
            
            # Verify the response is correct
            assert response == "This is a test response"
            
            # Verify that save_llm_call_record was called
            mock_file_service.save_llm_call_record.assert_called_once()
            
            # Verify the saved record has correct data
            saved_call = mock_file_service.save_llm_call_record.call_args[0][0]
            assert saved_call.project_id == "test-project"
            assert saved_call.input_tokens == 1500
            assert saved_call.output_tokens == 750
            assert saved_call.model_name == "gemini-2.5-flash"
            assert saved_call.cost > 0  # Should have calculated a cost
    
    @patch('main.file_service')
    @pytest.mark.asyncio
    async def test_monthly_cost_aggregation(self, mock_file_service):
        """Test monthly cost aggregation with multiple records across all projects."""
        from main import get_monthly_llm_cost
        
        # Create test LLM records for the current month
        current_date = datetime.now()
        test_records = [
            LLMCallRecord(
                timestamp=current_date.replace(day=1, hour=10, minute=0),
                input_tokens=1000,
                output_tokens=500,
                cost=0.0025,
                project_id="test-project-integration",
                model_name="gemini-2.5-flash"
            ),
            LLMCallRecord(
                timestamp=current_date.replace(day=15, hour=14, minute=30),
                input_tokens=2000,
                output_tokens=1000,
                cost=0.0050,
                project_id="test-project-integration",
                model_name="gemini-2.5-flash"
            ),
            LLMCallRecord(
                timestamp=current_date.replace(day=30, hour=9, minute=15),
                input_tokens=1500,
                output_tokens=750,
                cost=0.00375,
                project_id="test-project-integration",
                model_name="gemini-2.5-flash"
            ),
            # This record should be included (different project)
            LLMCallRecord(
                timestamp=current_date.replace(day=20, hour=16, minute=45),
                input_tokens=800,
                output_tokens=400,
                cost=0.0020,
                project_id="other-project",
                model_name="gemini-2.5-flash"
            )
        ]
        
        mock_file_service.load_llm_usage_for_month.return_value = test_records
        
        # Get monthly cost
        result = await get_monthly_llm_cost()
        
        # Verify the result
        expected_total_cost = 0.0025 + 0.0050 + 0.00375 + 0.0020  # All records
        assert result["total_cost"] == round(expected_total_cost, 6)
        assert result["call_count"] == 4  # All records across all projects
        assert result["year"] == current_date.year
        assert result["month"] == current_date.month
    
    def test_gemini_service_cost_calculation_integration(self):
        """Test that GeminiService correctly calculates costs with environment variables."""
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'test_key',
            'GEMINI_INPUT_COST_PER_M_TOKENS': '0.30',
            'GEMINI_OUTPUT_COST_PER_M_TOKENS': '2.50'
        }):
            service = GeminiService()
            
            # Test realistic token usage
            input_tokens = 2500
            output_tokens = 1200
            
            cost = service._calculate_llm_cost(input_tokens, output_tokens)
            
            # Expected: (2500/1M) * 0.30 + (1200/1M) * 2.50 = 0.00075 + 0.003 = 0.00375
            expected_cost = (input_tokens / 1_000_000) * 0.30 + (output_tokens / 1_000_000) * 2.50
            assert cost == expected_cost
            assert cost == 0.00375


if __name__ == "__main__":
    pytest.main([__file__])
