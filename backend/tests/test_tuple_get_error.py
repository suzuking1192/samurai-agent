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

from services.intelligent_memory_consolidation import IntelligentMemoryConsolidationService
from models import Memory, MemoryCategory, Project, ChatMessage, LLMCallRecord
from services.file_service import FileService


class TestTupleGetError(unittest.IsolatedAsyncioTestCase):
    """Test to replicate the tuple.get error in memory consolidation."""
    
    def setUp(self):
        """Set up test environment."""
        # Create temporary data directory
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService(data_dir=self.temp_dir)
        self.consolidation_service = IntelligentMemoryConsolidationService()
        
        # Create test project
        self.project_id = "test-project"
        self.project = Project(
            id=self.project_id,
            name="Test Project",
            description="Test project for tuple.get error",
            tech_stack="Python, FastAPI",
            codebase_path="/tmp/test-project"
        )
        
        # Create test session messages
        self.session_messages = [
            ChatMessage(
                id="msg1",
                project_id=self.project_id,
                session_id="session1",
                message="How do I validate data in FastAPI?",
                response="You can use Pydantic models for validation...",
                role="user"
            ),
            ChatMessage(
                id="msg2", 
                project_id=self.project_id,
                session_id="session1",
                message="What about tuple.get() errors?",
                response="That error occurs when you try to call .get() on a tuple instead of a dict...",
                role="assistant"
            )
        ]
        
        # Save test data
        self.file_service.save_project(self.project)
        for msg in self.session_messages:
            self.file_service.save_chat_message(self.project_id, msg)
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_llm_call_record_tuple_get_error(self):
        """Test that reproduces the tuple.get error in LLMCallRecord validation."""
        
        # Create a problematic LLM call record with tuple data that could cause .get() error
        problematic_data = {
            'timestamp': datetime.now(),
            'input_tokens': 100,
            'output_tokens': 50,
            'cost': 0.001,
            'project_id': self.project_id,
            'model_name': 'gemini-2.0-flash',
            # This could cause tuple.get() error if not handled properly
            'metadata': ('invalid', 'tuple', 'structure')
        }
        
        try:
            # This should handle the problematic data gracefully
            record = LLMCallRecord(**problematic_data)
            self.file_service.save_llm_call_record(record)
            
            # Load records for the month
            records = self.file_service.load_llm_usage_for_month(
                datetime.now().year, 
                datetime.now().month
            )
            self.assertIsInstance(records, list)
            
        except Exception as e:
            # If there's an error, it should be handled gracefully
            self.assertNotIn("tuple.get", str(e), f"Should not have tuple.get error: {e}")
    
    def test_memory_creation_with_problematic_data(self):
        """Test memory creation with data that could cause tuple.get errors."""
        
        # Create a memory with potentially problematic data structure
        problematic_memory_data = {
            'id': 'test-memory',
            'project_id': self.project_id,
            'title': 'Samurai Agent Data `tuple.get` Error: Validate For',
            'content': 'Test content that might cause validation issues',
            'type': 'feature',
            'category': 'backend',
            # This could cause tuple.get() error if not handled properly
            'metadata': ('invalid', 'tuple', 'structure')
        }
        
        try:
            # This should not raise a tuple.get() error
            memory = Memory(**problematic_memory_data)
            self.file_service.save_memory(self.project_id, memory)
            
            # Load it back
            loaded_memories = self.file_service.load_memories(self.project_id)
            self.assertGreater(len(loaded_memories), 0)
            
        except Exception as e:
            self.fail(f"Memory creation should handle problematic data gracefully: {e}")
    
    def test_corrupted_llm_usage_file(self):
        """Test handling of corrupted LLM usage files that might contain tuple data."""
        
        # Create a corrupted LLM usage file with tuple data
        corrupted_data = [
            {
                'timestamp': '2024-01-01T00:00:00',
                'input_tokens': 100,
                'output_tokens': 50,
                'cost': 0.001,
                'project_id': self.project_id,
                'model_name': 'gemini-2.0-flash',
                'metadata': ('invalid', 'tuple', 'structure')  # This could cause .get() error
            }
        ]
        
        # Save corrupted data directly to file
        corrupted_file_path = self.file_service.data_dir / "llm_usage_2024-01-01.json"
        with open(corrupted_file_path, 'w') as f:
            json.dump(corrupted_data, f)
        
        try:
            # This should handle the corrupted data gracefully
            records = self.file_service.load_llm_usage_for_month(2024, 1)
            self.assertIsInstance(records, list)
            
        except Exception as e:
            # If there's an error, it should be handled gracefully
            self.assertNotIn("tuple.get", str(e), f"Should not have tuple.get error: {e}")
    
    @patch('backend.services.intelligent_memory_consolidation.GeminiService')
    async def test_memory_consolidation_with_problematic_insights(self, mock_gemini):
        """Test memory consolidation with insights that could cause tuple.get errors."""
        
        # Mock the Gemini service to return problematic data
        mock_gemini_instance = MagicMock()
        mock_gemini_instance.chat_with_system_prompt.return_value = """
        {
            "insights": [
                {
                    "content": "Samurai Agent Data `tuple.get` Error: Validate For",
                    "category": "backend",
                    "is_new_category": false,
                    "new_category_suggestion": null,
                    "significance_score": 0.9,
                    "insight_type": "decision",
                    "related_keywords": ["validation", "error", "tuple"]
                }
            ],
            "session_relevance_score": 0.8,
            "suggested_new_categories": []
        }
        """
        mock_gemini.return_value = mock_gemini_instance
        
        # Create a longer session to trigger consolidation
        for i in range(5):
            msg = ChatMessage(
                id=f"msg{i+3}",
                project_id=self.project_id,
                session_id="session1",
                message=f"Test message {i+3}",
                response=f"Test response {i+3}",
                role="user"
            )
            self.file_service.save_chat_message(self.project_id, msg)
        
        project_context = {
            'name': 'Test Project',
            'tech_stack': 'Python, FastAPI'
        }
        
        try:
            # This should handle any tuple.get errors gracefully
            result = await self.consolidation_service.consolidate_session_memories(
                self.project_id,
                "session1", 
                project_context
            )
            
            # Verify the error was handled gracefully
            self.assertIsNotNone(result)
            
        except Exception as e:
            # If there's an error, it should be handled gracefully
            self.assertNotIn("tuple.get", str(e), f"Should not have tuple.get error: {e}")


if __name__ == '__main__':
    unittest.main()
