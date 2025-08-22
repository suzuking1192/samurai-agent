import pytest
import os
import tempfile
import shutil
from datetime import datetime, date
from unittest.mock import patch, MagicMock
import sys

# Add the backend directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models import LLMCallRecord
from services.gemini_service import GeminiService
from services.file_service import FileService


class TestLLMCallRecord:
    """Test the LLMCallRecord model."""
    
    def test_llm_call_record_creation(self):
        """Test creating a valid LLMCallRecord."""
        timestamp = datetime.now()
        record = LLMCallRecord(
            timestamp=timestamp,
            input_tokens=1000,
            output_tokens=500,
            cost=0.0025,
            project_id="test-project",
            model_name="gemini-2.5-flash"
        )
        
        assert record.timestamp == timestamp
        assert record.input_tokens == 1000
        assert record.output_tokens == 500
        assert record.cost == 0.0025
        assert record.project_id == "test-project"
        assert record.model_name == "gemini-2.5-flash"
    
    def test_llm_call_record_validation(self):
        """Test LLMCallRecord validation."""
        # Test negative tokens
        with pytest.raises(ValueError):
            LLMCallRecord(
                timestamp=datetime.now(),
                input_tokens=-1,
                output_tokens=500,
                cost=0.0025,
                project_id="test-project",
                model_name="gemini-2.5-flash"
            )
        
        # Test negative cost
        with pytest.raises(ValueError):
            LLMCallRecord(
                timestamp=datetime.now(),
                input_tokens=1000,
                output_tokens=500,
                cost=-0.001,
                project_id="test-project",
                model_name="gemini-2.5-flash"
            )


class TestGeminiServiceCostCalculation:
    """Test the GeminiService cost calculation functionality."""
    
    @patch.dict(os.environ, {
        'GEMINI_API_KEY': 'test_key',
        'GEMINI_INPUT_COST_PER_M_TOKENS': '0.30',
        'GEMINI_OUTPUT_COST_PER_M_TOKENS': '2.50'
    })
    def test_cost_calculation(self):
        """Test the _calculate_llm_cost method."""
        service = GeminiService()
        
        # Test cost calculation
        cost = service._calculate_llm_cost(1000000, 500000)  # 1M input, 500K output
        expected_cost = (1000000 / 1_000_000) * 0.30 + (500000 / 1_000_000) * 2.50
        assert cost == expected_cost
        assert cost == 1.55  # 0.30 + 1.25
    
    @patch.dict(os.environ, {
        'GEMINI_API_KEY': 'test_key',
        'GEMINI_INPUT_COST_PER_M_TOKENS': '0.30',
        'GEMINI_OUTPUT_COST_PER_M_TOKENS': '2.50'
    })
    def test_cost_calculation_with_zero_tokens(self):
        """Test cost calculation with zero tokens."""
        service = GeminiService()
        
        cost = service._calculate_llm_cost(0, 0)
        assert cost == 0.0
    
    @patch.dict(os.environ, {
        'GEMINI_API_KEY': 'test_key'
    })
    def test_default_cost_values(self):
        """Test that default cost values are used when not set."""
        service = GeminiService()
        
        assert service.input_cost_per_m_tokens == 0.30
        assert service.output_cost_per_m_tokens == 2.50


class TestFileServiceLLMUsage:
    """Test the FileService LLM usage functionality."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService(data_dir=self.temp_dir)
    
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    def test_get_daily_llm_usage_file_path(self):
        """Test the _get_daily_llm_usage_file_path method."""
        test_date = datetime(2023, 10, 27)
        file_path = self.file_service._get_daily_llm_usage_file_path(test_date)
        
        expected_path = os.path.join(self.temp_dir, "llm_usage_2023-10-27.json")
        assert str(file_path) == expected_path
    
    def test_save_llm_call_record_new_file(self):
        """Test saving LLM call record to a new daily file."""
        timestamp = datetime(2023, 10, 27, 12, 30, 0)
        record = LLMCallRecord(
            timestamp=timestamp,
            input_tokens=1000,
            output_tokens=500,
            cost=0.0025,
            project_id="test-project",
            model_name="gemini-2.5-flash"
        )
        
        self.file_service.save_llm_call_record(record)
        
        # Check that file was created
        file_path = self.file_service._get_daily_llm_usage_file_path(timestamp)
        assert file_path.exists()
        
        # Check file contents
        with open(file_path, 'r') as f:
            import json
            data = json.load(f)
            assert len(data) == 1
            assert data[0]['project_id'] == "test-project"
            assert data[0]['input_tokens'] == 1000
            assert data[0]['output_tokens'] == 500
            assert data[0]['cost'] == 0.0025
    
    def test_save_llm_call_record_append_to_existing(self):
        """Test appending LLM call record to existing daily file."""
        timestamp = datetime(2023, 10, 27, 12, 30, 0)
        
        # Create first record
        record1 = LLMCallRecord(
            timestamp=timestamp,
            input_tokens=1000,
            output_tokens=500,
            cost=0.0025,
            project_id="test-project-1",
            model_name="gemini-2.5-flash"
        )
        
        # Create second record
        record2 = LLMCallRecord(
            timestamp=timestamp,
            input_tokens=2000,
            output_tokens=1000,
            cost=0.0050,
            project_id="test-project-2",
            model_name="gemini-2.5-flash"
        )
        
        self.file_service.save_llm_call_record(record1)
        self.file_service.save_llm_call_record(record2)
        
        # Check that both records are in the file
        file_path = self.file_service._get_daily_llm_usage_file_path(timestamp)
        with open(file_path, 'r') as f:
            import json
            data = json.load(f)
            assert len(data) == 2
            assert data[0]['project_id'] == "test-project-1"
            assert data[1]['project_id'] == "test-project-2"
    
    def test_load_llm_usage_for_month(self):
        """Test loading LLM usage records for a specific month."""
        # Create records for different dates
        dates = [
            datetime(2023, 10, 27, 12, 30, 0),
            datetime(2023, 10, 28, 14, 30, 0),
            datetime(2023, 11, 1, 10, 30, 0),  # Different month
        ]
        
        for i, timestamp in enumerate(dates):
            record = LLMCallRecord(
                timestamp=timestamp,
                input_tokens=1000 + i,
                output_tokens=500 + i,
                cost=0.0025 + (i * 0.001),
                project_id=f"test-project-{i}",
                model_name="gemini-2.5-flash"
            )
            self.file_service.save_llm_call_record(record)
        
        # Load records for October 2023
        october_records = self.file_service.load_llm_usage_for_month(2023, 10)
        assert len(october_records) == 2
        
        # Load records for November 2023
        november_records = self.file_service.load_llm_usage_for_month(2023, 11)
        assert len(november_records) == 1
        
        # Load records for non-existent month
        empty_records = self.file_service.load_llm_usage_for_month(2023, 12)
        assert len(empty_records) == 0


class TestMonthlyCostEndpoint:
    """Test the monthly cost endpoint."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService(data_dir=self.temp_dir)
    
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    @patch('main.file_service')
    @pytest.mark.asyncio
    async def test_get_monthly_llm_cost_success(self, mock_file_service):
        """Test successful monthly cost retrieval."""
        from main import get_monthly_llm_cost
        
        # Mock LLM records across all projects
        mock_records = [
            MagicMock(project_id="test-project", cost=0.0025),
            MagicMock(project_id="test-project", cost=0.0030),
            MagicMock(project_id="other-project", cost=0.0010),  # Different project
        ]
        mock_file_service.load_llm_usage_for_month.return_value = mock_records
        
        # Test the endpoint
        result = await get_monthly_llm_cost()
        
        assert result["total_cost"] == 0.0065  # 0.0025 + 0.0030 + 0.0010 (all projects)
        assert result["call_count"] == 3
        assert result["year"] == datetime.now().year
        assert result["month"] == datetime.now().month
    
    @patch('main.file_service')
    @pytest.mark.asyncio
    async def test_get_monthly_llm_cost_no_records(self, mock_file_service):
        """Test monthly cost retrieval when no records exist."""
        from main import get_monthly_llm_cost
        
        # Mock empty records
        mock_file_service.load_llm_usage_for_month.return_value = []
        
        # Test the endpoint
        result = await get_monthly_llm_cost()
        
        assert result["total_cost"] == 0.0
        assert result["call_count"] == 0
    



if __name__ == "__main__":
    pytest.main([__file__])
