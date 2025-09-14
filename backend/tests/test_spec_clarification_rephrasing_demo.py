"""
Demonstration test for the spec clarification rephrasing feature.

This test shows how different types of questions are processed and rephrased
when the agent has access to codebase information.
"""

import pytest
import json
from unittest.mock import patch, AsyncMock
from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestSpecClarificationRephrasingDemo:
    """Demonstration tests showing the rephrasing feature in action."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context with a connected codebase."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="User wants to add user authentication to their app",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React',
                'codebase_path': '/path/to/codebase'
            },
            session_id='test-session-456'
        )

    @pytest.mark.asyncio
    async def test_authentication_implementation_questions(self, agent, mock_conversation_context):
        """Test rephrasing of authentication implementation questions."""
        print("\n" + "="*80)
        print("TEST 1: Authentication Implementation Questions")
        print("="*80)
        
        # Mock initial response with authentication questions
        mock_initial_response = """
        Thanks for the clarification! I need to understand your current authentication setup:

        1. How is user authentication currently implemented in your codebase?
        2. What authentication method are you using (JWT, sessions, OAuth)?
        3. Do you have any existing user management system?
        4. What database are you using for storing user credentials?
        5. Are there any existing API endpoints for authentication?

        This will help me create the most appropriate tasks for your authentication feature.
        """
        
        # Mock identified questions
        mock_questions = [
            {
                "question": "How is user authentication currently implemented in your codebase?",
                "start": 89,
                "end": 165
            },
            {
                "question": "What authentication method are you using (JWT, sessions, OAuth)?",
                "start": 167,
                "end": 235
            },
            {
                "question": "Do you have any existing user management system?",
                "start": 237,
                "end": 295
            },
            {
                "question": "What database are you using for storing user credentials?",
                "start": 297,
                "end": 355
            },
            {
                "question": "Are there any existing API endpoints for authentication?",
                "start": 357,
                "end": 415
            }
        ]
        
        # Mock code context results
        mock_code_context_results = [
            {
                "success": True,
                "context": "JWT-based authentication with token validation middleware",
                "relevant_code": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token, SECRET_KEY)\n    def generate_token(self, user_id):\n        return jwt.encode({'user_id': user_id}, SECRET_KEY)",
                "file_path": "services/auth.py"
            },
            {
                "success": True,
                "context": "JWT tokens with refresh token mechanism",
                "relevant_code": "class JWTManager:\n    def create_access_token(self, user_id):\n        return jwt.encode({'user_id': user_id, 'type': 'access'}, SECRET_KEY)\n    def create_refresh_token(self, user_id):\n        return jwt.encode({'user_id': user_id, 'type': 'refresh'}, SECRET_KEY)",
                "file_path": "services/jwt_manager.py"
            },
            {
                "success": True,
                "context": "User model with authentication fields",
                "relevant_code": "class User:\n    id = Column(Integer, primary_key=True)\n    email = Column(String, unique=True)\n    password_hash = Column(String)\n    is_active = Column(Boolean, default=True)",
                "file_path": "models/user.py"
            },
            {
                "success": True,
                "context": "PostgreSQL database with User table",
                "relevant_code": "class UserRepository:\n    def get_user_by_email(self, email):\n        return self.session.query(User).filter(User.email == email).first()\n    def create_user(self, email, password_hash):\n        user = User(email=email, password_hash=password_hash)\n        self.session.add(user)\n        self.session.commit()",
                "file_path": "repositories/user_repository.py"
            },
            {
                "success": True,
                "context": "Authentication API endpoints",
                "relevant_code": "@app.route('/api/auth/login', methods=['POST'])\ndef login():\n    data = request.get_json()\n    user = auth_service.authenticate_user(data['email'], data['password'])\n    if user:\n        token = jwt_manager.create_access_token(user.id)\n        return jsonify({'token': token})\n    return jsonify({'error': 'Invalid credentials'}), 401",
                "file_path": "routes/auth.py"
            }
        ]
        
        # Mock rephrased questions
        mock_rephrased_questions = [
            "Is it correct that you have JWT-based authentication with token validation middleware in services/auth.py?",
            "Is it correct that you're using JWT tokens with refresh token mechanism in services/jwt_manager.py?",
            "Is it correct that you have a User model with authentication fields in models/user.py?",
            "Is it correct that you're using PostgreSQL with User repository in repositories/user_repository.py?",
            "Is it correct that you have authentication API endpoints including login in routes/auth.py?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the current auth implementation?"],
                accumulated_specs={}
            )
            
            result = await agent._handle_spec_clarification(
                "I want to add user authentication with JWT tokens",
                mock_conversation_context,
                intent_analysis
            )
            
            print("\nORIGINAL QUESTIONS:")
            for i, question in enumerate(mock_questions, 1):
                print(f"{i}. {question['question']}")
            
            print("\nREPHRASED QUESTIONS:")
            for i, rephrased in enumerate(mock_rephrased_questions, 1):
                print(f"{i}. {rephrased}")
            
            print("\nFINAL RESPONSE:")
            print(result["response"])
            
            # Verify all questions were rephrased
            response = result["response"]
            for rephrased in mock_rephrased_questions:
                assert rephrased in response, f"Rephrased question not found: {rephrased}"
            
            print("\n✅ All authentication questions successfully rephrased!")

    @pytest.mark.asyncio
    async def test_database_schema_questions(self, agent, mock_conversation_context):
        """Test rephrasing of database schema questions."""
        print("\n" + "="*80)
        print("TEST 2: Database Schema Questions")
        print("="*80)
        
        mock_initial_response = """
        Great! I need to understand your database structure:

        1. What database schema are you using for user data?
        2. How are user roles and permissions stored?
        3. What's the current database migration setup?
        4. Are there any existing database indexes for performance?
        5. How do you handle database connections and pooling?

        This will help me design the right database structure.
        """
        
        mock_questions = [
            {
                "question": "What database schema are you using for user data?",
                "start": 45,
                "end": 105
            },
            {
                "question": "How are user roles and permissions stored?",
                "start": 107,
                "end": 165
            },
            {
                "question": "What's the current database migration setup?",
                "start": 167,
                "end": 225
            },
            {
                "question": "Are there any existing database indexes for performance?",
                "start": 227,
                "end": 285
            },
            {
                "question": "How do you handle database connections and pooling?",
                "start": 287,
                "end": 345
            }
        ]
        
        mock_code_context_results = [
            {
                "success": True,
                "context": "PostgreSQL with SQLAlchemy ORM",
                "relevant_code": "from sqlalchemy import create_engine\nengine = create_engine('postgresql://user:pass@localhost/dbname')\nBase = declarative_base()",
                "file_path": "database/config.py"
            },
            {
                "success": True,
                "context": "Role-based access control with UserRole model",
                "relevant_code": "class UserRole(Base):\n    __tablename__ = 'user_roles'\n    id = Column(Integer, primary_key=True)\n    user_id = Column(Integer, ForeignKey('users.id'))\n    role = Column(String, nullable=False)",
                "file_path": "models/user_role.py"
            },
            {
                "success": True,
                "context": "Alembic migration system",
                "relevant_code": "from alembic import op\nimport sqlalchemy as sa\n\ndef upgrade():\n    op.create_table('users',\n        sa.Column('id', sa.Integer(), primary_key=True),\n        sa.Column('email', sa.String(), nullable=False))",
                "file_path": "migrations/versions/001_create_users.py"
            },
            {
                "success": True,
                "context": "Database indexes on email and user_id",
                "relevant_code": "CREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_user_roles_user_id ON user_roles(user_id);",
                "file_path": "migrations/versions/002_add_indexes.py"
            },
            {
                "success": True,
                "context": "Connection pooling with SQLAlchemy",
                "relevant_code": "engine = create_engine('postgresql://user:pass@localhost/dbname',\n    pool_size=20,\n    max_overflow=30,\n    pool_pre_ping=True)",
                "file_path": "database/connection.py"
            }
        ]
        
        mock_rephrased_questions = [
            "Is it correct that you're using PostgreSQL with SQLAlchemy ORM in database/config.py?",
            "Is it correct that you have role-based access control with UserRole model in models/user_role.py?",
            "Is it correct that you're using Alembic migration system in migrations/versions/001_create_users.py?",
            "Is it correct that you have database indexes on email and user_id in migrations/versions/002_add_indexes.py?",
            "Is it correct that you're using connection pooling with SQLAlchemy in database/connection.py?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the database structure?"],
                accumulated_specs={}
            )
            
            result = await agent._handle_spec_clarification(
                "I want to understand the database schema",
                mock_conversation_context,
                intent_analysis
            )
            
            print("\nORIGINAL QUESTIONS:")
            for i, question in enumerate(mock_questions, 1):
                print(f"{i}. {question['question']}")
            
            print("\nREPHRASED QUESTIONS:")
            for i, rephrased in enumerate(mock_rephrased_questions, 1):
                print(f"{i}. {rephrased}")
            
            print("\nFINAL RESPONSE:")
            print(result["response"])
            
            print("\n✅ All database schema questions successfully rephrased!")

    @pytest.mark.asyncio
    async def test_api_endpoint_questions(self, agent, mock_conversation_context):
        """Test rephrasing of API endpoint questions."""
        print("\n" + "="*80)
        print("TEST 3: API Endpoint Questions")
        print("="*80)
        
        mock_initial_response = """
        Perfect! I need to understand your API structure:

        1. What API endpoints do you currently have for user management?
        2. How is API authentication implemented?
        3. What's the current API response format?
        4. Are there any existing API rate limiting mechanisms?
        5. How do you handle API error responses?

        This will help me design the right API structure.
        """
        
        mock_questions = [
            {
                "question": "What API endpoints do you currently have for user management?",
                "start": 45,
                "end": 115
            },
            {
                "question": "How is API authentication implemented?",
                "start": 117,
                "end": 175
            },
            {
                "question": "What's the current API response format?",
                "start": 177,
                "end": 235
            },
            {
                "question": "Are there any existing API rate limiting mechanisms?",
                "start": 237,
                "end": 305
            },
            {
                "question": "How do you handle API error responses?",
                "start": 307,
                "end": 365
            }
        ]
        
        mock_code_context_results = [
            {
                "success": True,
                "context": "RESTful API with Flask routes",
                "relevant_code": "@app.route('/api/users', methods=['GET'])\ndef get_users():\n    return jsonify(users)\n\n@app.route('/api/users/<int:user_id>', methods=['GET'])\ndef get_user(user_id):\n    return jsonify(get_user_by_id(user_id))",
                "file_path": "routes/users.py"
            },
            {
                "success": True,
                "context": "JWT token authentication middleware",
                "relevant_code": "def require_auth(f):\n    @wraps(f)\n    def decorated(*args, **kwargs):\n        token = request.headers.get('Authorization')\n        if not token:\n            return jsonify({'error': 'No token provided'}), 401\n        return f(*args, **kwargs)\n    return decorated",
                "file_path": "middleware/auth.py"
            },
            {
                "success": True,
                "context": "JSON response format with status codes",
                "relevant_code": "def api_response(data=None, message='', status_code=200):\n    response = {\n        'success': status_code < 400,\n        'message': message,\n        'data': data\n    }\n    return jsonify(response), status_code",
                "file_path": "utils/api_helpers.py"
            },
            {
                "success": True,
                "context": "Rate limiting with Flask-Limiter",
                "relevant_code": "from flask_limiter import Limiter\nlimiter = Limiter(app, key_func=get_remote_address)\n\n@app.route('/api/users')\n@limiter.limit('100 per minute')\ndef get_users():\n    return jsonify(users)",
                "file_path": "middleware/rate_limit.py"
            },
            {
                "success": True,
                "context": "Error handling with custom exception classes",
                "relevant_code": "class APIError(Exception):\n    def __init__(self, message, status_code=400):\n        self.message = message\n        self.status_code = status_code\n\n@app.errorhandler(APIError)\ndef handle_api_error(error):\n    return jsonify({'error': error.message}), error.status_code",
                "file_path": "exceptions/api_exceptions.py"
            }
        ]
        
        mock_rephrased_questions = [
            "Is it correct that you have RESTful API with Flask routes in routes/users.py?",
            "Is it correct that you have JWT token authentication middleware in middleware/auth.py?",
            "Is it correct that you have JSON response format with status codes in utils/api_helpers.py?",
            "Is it correct that you have rate limiting with Flask-Limiter in middleware/rate_limit.py?",
            "Is it correct that you have error handling with custom exception classes in exceptions/api_exceptions.py?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the API structure?"],
                accumulated_specs={}
            )
            
            result = await agent._handle_spec_clarification(
                "I want to understand the API structure",
                mock_conversation_context,
                intent_analysis
            )
            
            print("\nORIGINAL QUESTIONS:")
            for i, question in enumerate(mock_questions, 1):
                print(f"{i}. {question['question']}")
            
            print("\nREPHRASED QUESTIONS:")
            for i, rephrased in enumerate(mock_rephrased_questions, 1):
                print(f"{i}. {rephrased}")
            
            print("\nFINAL RESPONSE:")
            print(result["response"])
            
            print("\n✅ All API endpoint questions successfully rephrased!")

    @pytest.mark.asyncio
    async def test_frontend_component_questions(self, agent, mock_conversation_context):
        """Test rephrasing of frontend component questions."""
        print("\n" + "="*80)
        print("TEST 4: Frontend Component Questions")
        print("="*80)
        
        mock_initial_response = """
        Excellent! I need to understand your frontend structure:

        1. What frontend framework are you using for the UI?
        2. How are user components currently structured?
        3. What's the current state management setup?
        4. Are there any existing UI component libraries?
        5. How do you handle frontend routing and navigation?

        This will help me design the right frontend structure.
        """
        
        mock_questions = [
            {
                "question": "What frontend framework are you using for the UI?",
                "start": 45,
                "end": 105
            },
            {
                "question": "How are user components currently structured?",
                "start": 107,
                "end": 165
            },
            {
                "question": "What's the current state management setup?",
                "start": 167,
                "end": 225
            },
            {
                "question": "Are there any existing UI component libraries?",
                "start": 227,
                "end": 285
            },
            {
                "question": "How do you handle frontend routing and navigation?",
                "start": 287,
                "end": 345
            }
        ]
        
        mock_code_context_results = [
            {
                "success": True,
                "context": "React with TypeScript",
                "relevant_code": "import React from 'react';\nimport { Component } from 'react';\n\ninterface AppProps {\n  title: string;\n}\n\nclass App extends Component<AppProps> {\n  render() {\n    return <div>{this.props.title}</div>;\n  }\n}",
                "file_path": "src/App.tsx"
            },
            {
                "success": True,
                "context": "Component-based architecture with user components",
                "relevant_code": "import React from 'react';\n\nconst UserProfile = ({ user }) => {\n  return (\n    <div className='user-profile'>\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n    </div>\n  );\n};\n\nexport default UserProfile;",
                "file_path": "src/components/UserProfile.tsx"
            },
            {
                "success": True,
                "context": "Redux state management with actions and reducers",
                "relevant_code": "import { createStore } from 'redux';\n\nconst initialState = {\n  user: null,\n  isAuthenticated: false\n};\n\nconst userReducer = (state = initialState, action) => {\n  switch (action.type) {\n    case 'SET_USER':\n      return { ...state, user: action.payload };\n    default:\n      return state;\n  }\n};",
                "file_path": "src/store/userReducer.ts"
            },
            {
                "success": True,
                "context": "Material-UI component library",
                "relevant_code": "import { Button, TextField, Card } from '@mui/material';\n\nconst LoginForm = () => {\n  return (\n    <Card>\n      <TextField label='Email' />\n      <TextField label='Password' type='password' />\n      <Button variant='contained'>Login</Button>\n    </Card>\n  );\n};",
                "file_path": "src/components/LoginForm.tsx"
            },
            {
                "success": True,
                "context": "React Router for navigation",
                "relevant_code": "import { BrowserRouter, Route, Switch } from 'react-router-dom';\n\nconst AppRouter = () => {\n  return (\n    <BrowserRouter>\n      <Switch>\n        <Route path='/login' component={LoginForm} />\n        <Route path='/profile' component={UserProfile} />\n      </Switch>\n    </BrowserRouter>\n  );\n};",
                "file_path": "src/router/AppRouter.tsx"
            }
        ]
        
        mock_rephrased_questions = [
            "Is it correct that you're using React with TypeScript in src/App.tsx?",
            "Is it correct that you have component-based architecture with user components in src/components/UserProfile.tsx?",
            "Is it correct that you have Redux state management with actions and reducers in src/store/userReducer.ts?",
            "Is it correct that you're using Material-UI component library in src/components/LoginForm.tsx?",
            "Is it correct that you have React Router for navigation in src/router/AppRouter.tsx?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the frontend structure?"],
                accumulated_specs={}
            )
            
            result = await agent._handle_spec_clarification(
                "I want to understand the frontend structure",
                mock_conversation_context,
                intent_analysis
            )
            
            print("\nORIGINAL QUESTIONS:")
            for i, question in enumerate(mock_questions, 1):
                print(f"{i}. {question['question']}")
            
            print("\nREPHRASED QUESTIONS:")
            for i, rephrased in enumerate(mock_rephrased_questions, 1):
                print(f"{i}. {rephrased}")
            
            print("\nFINAL RESPONSE:")
            print(result["response"])
            
            print("\n✅ All frontend component questions successfully rephrased!")

    @pytest.mark.asyncio
    async def test_mixed_question_types_with_partial_answers(self, agent, mock_conversation_context):
        """Test rephrasing with mixed question types and partial code context availability."""
        print("\n" + "="*80)
        print("TEST 5: Mixed Question Types with Partial Answers")
        print("="*80)
        
        mock_initial_response = """
        Perfect! I need to understand your current setup:

        1. How is user authentication currently implemented in your codebase?
        2. What database are you using for user storage?
        3. Do you want to support social login providers?
        4. Are there any existing API endpoints for user management?
        5. Should we implement password reset functionality?

        This will help me create the most appropriate tasks.
        """
        
        mock_questions = [
            {
                "question": "How is user authentication currently implemented in your codebase?",
                "start": 45,
                "end": 121
            },
            {
                "question": "What database are you using for user storage?",
                "start": 123,
                "end": 181
            },
            {
                "question": "Are there any existing API endpoints for user management?",
                "start": 245,
                "end": 315
            }
        ]
        
        # Note: Only 3 questions are identified as codebase-relevant
        # Questions 3 and 5 are preference/requirement questions, not codebase questions
        
        mock_code_context_results = [
            {
                "success": True,
                "context": "JWT-based authentication with token validation",
                "relevant_code": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token, SECRET_KEY)",
                "file_path": "services/auth.py"
            },
            {
                "success": False,
                "message": "No relevant database code found"
            },
            {
                "success": True,
                "context": "RESTful API endpoints for user CRUD operations",
                "relevant_code": "@app.route('/api/users', methods=['GET', 'POST'])\ndef users_endpoint():\n    if request.method == 'GET':\n        return jsonify(get_all_users())\n    elif request.method == 'POST':\n        return jsonify(create_user(request.json))",
                "file_path": "routes/users.py"
            }
        ]
        
        mock_rephrased_questions = [
            "Is it correct that you have JWT-based authentication with token validation in services/auth.py?",
            "Is it correct that you have RESTful API endpoints for user CRUD operations in routes/users.py?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the current setup?"],
                accumulated_specs={}
            )
            
            result = await agent._handle_spec_clarification(
                "I want to add user authentication features",
                mock_conversation_context,
                intent_analysis
            )
            
            print("\nORIGINAL QUESTIONS:")
            print("1. How is user authentication currently implemented in your codebase?")
            print("2. What database are you using for user storage?")
            print("3. Do you want to support social login providers?")
            print("4. Are there any existing API endpoints for user management?")
            print("5. Should we implement password reset functionality?")
            
            print("\nCODEBASE-RELEVANT QUESTIONS IDENTIFIED:")
            for i, question in enumerate(mock_questions, 1):
                print(f"{i}. {question['question']}")
            
            print("\nREPHRASED QUESTIONS (where code context found):")
            for i, rephrased in enumerate(mock_rephrased_questions, 1):
                print(f"{i}. {rephrased}")
            
            print("\nQUESTIONS PRESERVED (no code context or preference questions):")
            print("2. What database are you using for user storage? (no code found)")
            print("3. Do you want to support social login providers? (preference question)")
            print("5. Should we implement password reset functionality? (preference question)")
            
            print("\nFINAL RESPONSE:")
            print(result["response"])
            
            # Verify mixed behavior
            response = result["response"]
            assert "Is it correct that you have JWT-based authentication" in response
            assert "Is it correct that you have RESTful API endpoints" in response
            assert "What database are you using for user storage?" in response  # Preserved (no code found)
            assert "Do you want to support social login providers?" in response  # Preserved (preference question)
            assert "Should we implement password reset functionality?" in response  # Preserved (preference question)
            
            print("\n✅ Mixed question types handled correctly!")
            print("   - Codebase questions rephrased when context found")
            print("   - Codebase questions preserved when no context found")
            print("   - Preference questions preserved (not rephrased)")


if __name__ == "__main__":
    # Run the demo tests
    import asyncio
    
    async def run_demos():
        agent = UnifiedSamuraiAgent()
        mock_context = ConversationContext(
            session_messages=[],
            conversation_summary="User wants to add user authentication to their app",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React',
                'codebase_path': '/path/to/codebase'
            },
            session_id='test-session-456'
        )
        
        demo = TestSpecClarificationRephrasingDemo()
        
        print("🚀 RUNNING SPEC CLARIFICATION REPHRASING DEMO")
        print("="*80)
        
        await demo.test_authentication_implementation_questions(agent, mock_context)
        await demo.test_database_schema_questions(agent, mock_context)
        await demo.test_api_endpoint_questions(agent, mock_context)
        await demo.test_frontend_component_questions(agent, mock_context)
        await demo.test_mixed_question_types_with_partial_answers(agent, mock_context)
        
        print("\n" + "="*80)
        print("🎉 DEMO COMPLETE - All question types tested successfully!")
        print("="*80)
    
    asyncio.run(run_demos())
