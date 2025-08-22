import unittest
import os
import sys
from unittest.mock import patch, MagicMock
import tempfile
import shutil
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import LLMCallRecord, Memory, Project, ChatMessage
from services.file_service import FileService


class TestTupleGetErrorFix(unittest.TestCase):
    """Test to verify that the tuple.get error has been completely fixed."""
    
    def setUp(self):
        """Set up test environment."""
        # Create temporary data directory
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService(data_dir=self.temp_dir)
        
        # Create test project
        self.project_id = "test-project"
        self.project = Project(
            id=self.project_id,
            name="Test Project",
            description="Test project for tuple.get error fix",
            tech_stack="Python, FastAPI",
            codebase_path="/tmp/test-project"
        )
        
        # Save test project
        self.file_service.save_project(self.project)
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_llm_call_record_creation_and_loading(self):
        """Test that LLMCallRecord creation and loading works without tuple.get errors."""
        
        # Create a valid LLM call record
        record = LLMCallRecord(
            timestamp=datetime.now(),
            input_tokens=100,
            output_tokens=50,
            cost=0.001,
            project_id=self.project_id,
            model_name="gemini-2.0-flash"
        )
        
        # Save the record
        self.file_service.save_llm_call_record(record)
        
        # Load records for the current month
        records = self.file_service.load_llm_usage_for_month(
            datetime.now().year, 
            datetime.now().month
        )
        
        # Verify the record was loaded correctly
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].project_id, self.project_id)
        self.assertEqual(records[0].model_name, "gemini-2.0-flash")
        self.assertEqual(records[0].input_tokens, 100)
        self.assertEqual(records[0].output_tokens, 50)
        self.assertEqual(records[0].cost, 0.001)
    
    def test_memory_creation_with_embedding_generation(self):
        """Test that memory creation with embedding generation works without tuple.get errors."""
        
        # Create a memory with the exact title from the error
        memory = Memory(
            id="test-memory",
            project_id=self.project_id,
            title="Samurai Agent Data `tuple.get` Error: Validate For",
            content="Test content for validation",
            type="feature",
            category="backend"
        )
        
        # Save the memory (this should trigger embedding generation)
        self.file_service.save_memory(self.project_id, memory)
        
        # Load memories back
        memories = self.file_service.load_memories(self.project_id)
        
        # Verify the memory was saved and loaded correctly
        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0].title, "Samurai Agent Data `tuple.get` Error: Validate For")
        self.assertEqual(memories[0].category, "backend")
    
    def test_corrupted_data_handling(self):
        """Test that corrupted data is handled gracefully without tuple.get errors."""
        
        # Create a corrupted LLM usage file with problematic data
        corrupted_data = [
            {
                'timestamp': '2024-01-01T00:00:00',
                'input_tokens': 100,
                'output_tokens': 50,
                'cost': 0.001,
                'project_id': self.project_id,
                'model_name': 'gemini-2.0-flash',
                # This could potentially cause issues if not handled properly
                'extra_field': ('tuple', 'data', 'structure')
            }
        ]
        
        # Save corrupted data directly to file
        corrupted_file_path = self.file_service.data_dir / "llm_usage_2024-01-01.json"
        with open(corrupted_file_path, 'w') as f:
            json.dump(corrupted_data, f)
        
        # This should handle the corrupted data gracefully
        records = self.file_service.load_llm_usage_for_month(2024, 1)
        
        # Should return a list (even if empty due to validation errors)
        self.assertIsInstance(records, list)
    
    def test_model_name_field_conflict_resolution(self):
        """Test that the model_name field conflict has been resolved."""
        
        # Create multiple LLM call records with different model names
        records = []
        for i in range(3):
            record = LLMCallRecord(
                timestamp=datetime.now(),
                input_tokens=100 + i,
                output_tokens=50 + i,
                cost=0.001 + (i * 0.0001),
                project_id=self.project_id,
                model_name=f"gemini-2.{i}-flash"
            )
            records.append(record)
            self.file_service.save_llm_call_record(record)
        
        # Load all records
        loaded_records = self.file_service.load_llm_usage_for_month(
            datetime.now().year, 
            datetime.now().month
        )
        
        # Verify all records were loaded correctly
        self.assertEqual(len(loaded_records), 3)
        
        # Verify model names are correct
        model_names = [r.model_name for r in loaded_records]
        expected_names = ["gemini-2.0-flash", "gemini-2.1-flash", "gemini-2.2-flash"]
        self.assertEqual(sorted(model_names), sorted(expected_names))
    
    def test_pydantic_model_dump_compatibility(self):
        """Test that model_dump() works correctly for all models."""
        
        # Test LLMCallRecord
        llm_record = LLMCallRecord(
            timestamp=datetime.now(),
            input_tokens=100,
            output_tokens=50,
            cost=0.001,
            project_id=self.project_id,
            model_name="test-model"
        )
        
        # This should work without errors
        record_dict = llm_record.model_dump()
        self.assertIsInstance(record_dict, dict)
        self.assertEqual(record_dict['model_name'], "test-model")
        
        # Test Memory
        memory = Memory(
            id="test-memory",
            project_id=self.project_id,
            title="Test Memory",
            content="Test content",
            type="feature",
            category="backend"
        )
        
        # This should work without errors
        memory_dict = memory.model_dump()
        self.assertIsInstance(memory_dict, dict)
        self.assertEqual(memory_dict['title'], "Test Memory")
    
    def test_error_message_not_containing_tuple_get(self):
        """Test that error messages don't contain 'tuple.get' when errors occur."""
        
        # Try to create an invalid LLMCallRecord (missing required fields)
        try:
            # This should raise a validation error, but not a tuple.get error
            invalid_record = LLMCallRecord(
                timestamp=datetime.now(),
                # Missing required fields
            )
            self.fail("Should have raised a validation error")
        except Exception as e:
            error_message = str(e)
            # The error should not contain 'tuple.get'
            self.assertNotIn("tuple.get", error_message.lower())
            # Should be a validation error
            self.assertIn("validation", error_message.lower())


if __name__ == '__main__':
    unittest.main()
