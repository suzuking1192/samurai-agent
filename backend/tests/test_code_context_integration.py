"""
Integration Test for Code Context Extraction Feature

This test demonstrates the end-to-end functionality of the code context extraction feature.
"""

import pytest
import tempfile
import os
import asyncio
from unittest.mock import patch, AsyncMock, Mock

try:
    from services.unified_samurai_agent import UnifiedSamuraiAgent
    from services.code_context_storage import code_context_storage
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from unified_samurai_agent import UnifiedSamuraiAgent
    from code_context_storage import code_context_storage


class TestCodeContextIntegration:
    """Integration test for code context extraction."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.agent = UnifiedSamuraiAgent()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create a simple codebase for testing
        self._create_test_codebase()
        
        # Create project context
        self.project_context = {
            "id": "test_project",
            "name": "Test Project",
            "tech_stack": "Python, JavaScript",
            "codebase_path": self.temp_dir,
            "project_detail": "A test project for code context extraction"
        }
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def _create_test_codebase(self):
        """Create a simple test codebase."""
        # Create a Python file with user authentication
        auth_file = os.path.join(self.temp_dir, "auth.py")
        with open(auth_file, 'w') as f:
            f.write("""
import jwt
from datetime import datetime, timedelta

class UserAuth:
    def __init__(self, secret_key):
        self.secret_key = secret_key
    
    def authenticate_user(self, email, password):
        # Authentication logic here
        if email == "user@example.com" and password == "password123":
            return self.generate_token(email)
        return None
    
    def generate_token(self, user_id):
        payload = {
            'user_id': user_id,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_token(self, token):
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload['user_id']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
""")
        
        # Create a JavaScript file with API endpoints
        api_file = os.path.join(self.temp_dir, "api.js")
        with open(api_file, 'w') as f:
            f.write("""
const express = require('express');
const router = express.Router();

// User authentication endpoints
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const token = await authenticateUser(email, password);
        if (token) {
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const user = await createUser(email, password, name);
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

module.exports = router;
""")
        
        # Create a configuration file
        config_file = os.path.join(self.temp_dir, "config.json")
        with open(config_file, 'w') as f:
            f.write('{"database": "sqlite", "port": 8000, "secret_key": "your-secret-key"}')
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_integration(self):
        """Test the complete code context extraction flow."""
        session_id = "test_session_123"
        
        # Mock the Gemini service to avoid actual API calls
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "pure_discussion"
            
            # Mock the Gemini service calls for intent analysis and code context extraction
            with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_generate:
                mock_generate.side_effect = [
                    '{"intent_type": "feature_exploration", "new_code_context_necessary": true, "code_context_request": "Find user authentication code including login/logout functions, user model, and JWT token handling"}',  # Intent analysis with code context decision
                    '{"auth.py": ["UserAuth", "authenticate_user"]}',  # File and method selection
                    '{"relevance_score": 9, "context": "User authentication service with JWT token generation", "relevant_code": "class UserAuth:", "file_path": "auth.py"}'  # Code analysis
                ]
                
                # Process a message that should trigger code context extraction
                result = await self.agent.process_message(
                    message="How do I implement user authentication?",
                    project_id="test_project",
                    project_context=self.project_context,
                    session_id=session_id,
                    conversation_history=[]
                )
                
                # Verify the LLM was called for code context extraction
                print(f"LLM call count: {mock_generate.call_count}")
                print(f"LLM call args: {mock_generate.call_args_list}")
                
                # Verify the response contains information about code context
                assert "type" in result
                assert "response" in result
                assert "intent_analysis" in result
                
                # Verify that the LLM was called for code context necessity determination
                assert mock_generate.call_count >= 1
    
    @pytest.mark.asyncio
    async def test_code_context_persistence_across_sessions(self):
        """Test that code context persists across multiple sessions."""
        session_id = "persistent_session"
        
        # First, save some code context
        test_context = {
            "context": "Database configuration and connection setup",
            "relevant_code": "const db = require('./database');",
            "file_path": os.path.join(self.temp_dir, "config.json"),
            "relevance_score": 7
        }
        
        success = code_context_storage.save_code_context("test_project", session_id, test_context)
        assert success
        
        # Now process a new message in the same session
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "pure_discussion"
            
            result = await self.agent.process_message(
                message="What's the database configuration?",
                project_id="test_project",
                project_context=self.project_context,
                session_id=session_id,
                conversation_history=[]
            )
            
            # The agent should have loaded the existing code context
            assert "type" in result
            assert "response" in result
    
    @pytest.mark.asyncio
    async def test_no_code_context_for_non_code_questions(self):
        """Test that code context is not extracted for non-code questions."""
        session_id = "non_code_session"
        
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "pure_discussion"
            
            result = await self.agent.process_message(
                message="Hello, how are you today?",
                project_id="test_project",
                project_context=self.project_context,
                session_id=session_id,
                conversation_history=[]
            )
            
            # Should not trigger code context extraction
            assert "type" in result
            assert "response" in result
            
            # No code context should be saved
            saved_context = code_context_storage.load_code_context("test_project", session_id)
            assert saved_context is None


if __name__ == "__main__":
    # Run the integration tests
    pytest.main([__file__, "-v"])
