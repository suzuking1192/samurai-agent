import os
import sys
import json
import tempfile
import shutil
import unittest
from unittest import mock
from datetime import datetime

# Ensure backend is importable as a module
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
backend_dir = os.path.join(repo_root, 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


class TestIntentTypeStreaming(unittest.IsolatedAsyncioTestCase):
    """Test that intent_type is correctly included in streaming responses"""
    
    @classmethod
    def setUpClass(cls):
        # Ensure backend is importable as a module
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
        backend_dir = os.path.join(repo_root, 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)

    def setUp(self):
        # Create a temporary data directory for isolation
        self.temp_dir = tempfile.mkdtemp(prefix="samurai_agent_test_data_")

        # Import after path setup
        import main as main_module
        from services.file_service import FileService
        from models import Project, Session, ChatMessage

        # Prepare a file service bound to the temp dir
        tdir = self.temp_dir
        class TempFileService(FileService):
            def __init__(self):
                super().__init__(data_dir=tdir, backup_dir=os.path.join(tdir, 'backups'))

        self.main = main_module
        self.TempFileService = TempFileService
        self.Project = Project
        self.Session = Session
        self.ChatMessage = ChatMessage

        # Patch the global file_service used by the API module
        self.file_service_patch = mock.patch.object(self.main, 'file_service', TempFileService())
        self.file_service = self.file_service_patch.start()

    def tearDown(self):
        self.file_service_patch.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_mock_project(self):
        return self.Project(
            id="test-project-id",
            name="Test Project",
            description="A test project",
            tech_stack="Python, FastAPI",
            created_at=datetime.now()
        )

    def create_mock_session(self):
        return self.Session(
            id="test-session-id",
            project_id="test-project-id",
            name="Test Session",
            created_at=datetime.now(),
            last_activity=datetime.now()
        )

    def create_mock_chat_message(self):
        return self.ChatMessage(
            id="test-message-id",
            project_id="test-project-id",
            session_id="test-session-id",
            message="Test message",
            response="Test response",
            created_at=datetime.now()
        )

    @mock.patch('main.unified_samurai_agent.process_message')
    async def test_chat_with_progress_includes_intent_type(self, mock_process_message):
        """Test that chat_with_progress endpoint includes intent_type in response"""
        
        # Setup mocks
        mock_project = self.create_mock_project()
        mock_session = self.create_mock_session()
        
        with mock.patch.object(self.main.file_service, 'get_project_by_id', return_value=mock_project), \
             mock.patch.object(self.main.file_service, 'get_latest_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'create_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'load_chat_messages_by_session', return_value=[]):
            
            # Mock the agent response with intent_type
            mock_process_message.return_value = {
                "type": "unified_response",
                "response": "I understand you want to create tasks.",
                "intent_analysis": {
                    "intent_type": "spec_clarification",
                    "confidence": 0.9,
                    "needs_clarification": False
                }
            }
            
            # Test the streaming response by calling the endpoint function directly
            from main import chat_with_progress
            from models import ChatRequest
            
            request = ChatRequest(message="I want to add user authentication with JWT tokens")
            
            # Get the streaming response generator
            response_generator = await chat_with_progress("test-project-id", request)
            
            # Collect streaming responses
            responses = []
            async for response in response_generator.body_iterator:
                responses.append(response)
            
            # Find the complete response
            complete_response = None
            for response in responses:
                if '"type":"complete"' in response:
                    complete_response = response
                    break
            
            self.assertIsNotNone(complete_response, "Complete response not found in streaming data")
            
            # Parse the complete response
            data_str = complete_response.replace('data: ', '')
            data = json.loads(data_str)
            
            # Verify intent_type is included
            self.assertEqual(data["type"], "complete")
            self.assertIn("response", data)
            self.assertIn("intent_type", data)
            self.assertEqual(data["intent_type"], "spec_clarification")

    @mock.patch('main.unified_samurai_agent.process_message')
    async def test_chat_stream_includes_intent_type(self, mock_process_message):
        """Test that chat_stream endpoint includes intent_type in response"""
        
        # Setup mocks
        mock_project = self.create_mock_project()
        mock_session = self.create_mock_session()
        
        with mock.patch.object(self.main.file_service, 'get_project_by_id', return_value=mock_project), \
             mock.patch.object(self.main.file_service, 'get_latest_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'create_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'load_chat_messages_by_session', return_value=[]):
            
            # Mock the agent response with intent_type
            mock_process_message.return_value = {
                "type": "unified_response",
                "response": "I understand you want to create tasks.",
                "intent_analysis": {
                    "intent_type": "ready_for_action",
                    "confidence": 0.8,
                    "needs_clarification": False
                }
            }
            
            # Test the streaming response by calling the endpoint function directly
            from main import chat_stream
            from models import ChatRequest
            
            request = ChatRequest(message="create tasks for user authentication")
            
            # Get the streaming response generator
            response_generator = await chat_stream("test-project-id", request)
            
            # Collect streaming responses
            responses = []
            async for response in response_generator.body_iterator:
                responses.append(response)
            
            # Find the complete response
            complete_response = None
            for response in responses:
                if '"type":"complete"' in response:
                    complete_response = response
                    break
            
            self.assertIsNotNone(complete_response, "Complete response not found in streaming data")
            
            # Parse the complete response
            data_str = complete_response.replace('data: ', '')
            data = json.loads(data_str)
            
            # Verify intent_type is included
            self.assertEqual(data["type"], "complete")
            self.assertIn("response", data)
            self.assertIn("intent_type", data)
            self.assertEqual(data["intent_type"], "ready_for_action")

    @mock.patch('main.unified_samurai_agent.process_message')
    async def test_intent_type_fallback_to_unknown(self, mock_process_message):
        """Test that intent_type defaults to 'unknown' when not provided by agent"""
        
        # Setup mocks
        mock_project = self.create_mock_project()
        mock_session = self.create_mock_session()
        
        with mock.patch.object(self.main.file_service, 'get_project_by_id', return_value=mock_project), \
             mock.patch.object(self.main.file_service, 'get_latest_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'create_session', return_value=mock_session), \
             mock.patch.object(self.main.file_service, 'load_chat_messages_by_session', return_value=[]):
            
            # Mock the agent response without intent_analysis
            mock_process_message.return_value = {
                "type": "unified_response",
                "response": "I understand you want to create tasks."
            }
            
            # Test the streaming response by calling the endpoint function directly
            from main import chat_with_progress
            from models import ChatRequest
            
            request = ChatRequest(message="Hello")
            
            # Get the streaming response generator
            response_generator = await chat_with_progress("test-project-id", request)
            
            # Collect streaming responses
            responses = []
            async for response in response_generator.body_iterator:
                responses.append(response)
            
            # Find the complete response
            complete_response = None
            for response in responses:
                if '"type":"complete"' in response:
                    complete_response = response
                    break
            
            if complete_response:
                data_str = complete_response.replace('data: ', '')
                data = json.loads(data_str)
                
                # Verify intent_type defaults to 'unknown'
                self.assertEqual(data["intent_type"], "unknown")


if __name__ == '__main__':
    unittest.main()
