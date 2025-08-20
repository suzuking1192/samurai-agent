"""
Tests for UserIntentEnum and Session model with previous_session_intent tracking.
"""

import pytest
from datetime import datetime
from models import UserIntentEnum, Session


class TestUserIntentEnum:
    """Test UserIntentEnum functionality."""
    
    def test_user_intent_enum_values(self):
        """Test that UserIntentEnum has all expected values."""
        assert UserIntentEnum.FEATURE_EXPLORATION == "feature_exploration"
        assert UserIntentEnum.SPEC_CLARIFICATION == "spec_clarification"
        assert UserIntentEnum.READY_FOR_ACTION == "ready_for_action"
        assert UserIntentEnum.PURE_DISCUSSION == "pure_discussion"
        assert UserIntentEnum.DIRECT_ACTION == "direct_action"
        assert UserIntentEnum.INITIAL_STATE == "initial_state"
    
    def test_user_intent_enum_string_representation(self):
        """Test string representation of UserIntentEnum values."""
        assert UserIntentEnum.FEATURE_EXPLORATION.value == "feature_exploration"
        assert UserIntentEnum.READY_FOR_ACTION.value == "ready_for_action"
    
    def test_user_intent_enum_comparison(self):
        """Test comparison operations with UserIntentEnum."""
        assert UserIntentEnum.FEATURE_EXPLORATION == UserIntentEnum.FEATURE_EXPLORATION
        assert UserIntentEnum.FEATURE_EXPLORATION != UserIntentEnum.READY_FOR_ACTION
        assert UserIntentEnum.FEATURE_EXPLORATION in [UserIntentEnum.FEATURE_EXPLORATION, UserIntentEnum.SPEC_CLARIFICATION]


class TestSessionWithPreviousIntent:
    """Test Session model with previous_session_intent field."""
    
    def test_session_creation_with_default_previous_intent(self):
        """Test that Session is created with INITIAL_STATE as default previous_session_intent."""
        session = Session(
            project_id="test-project-123",
            name="Test Session"
        )
        
        assert session.previous_session_intent == UserIntentEnum.INITIAL_STATE
        assert session.project_id == "test-project-123"
        assert session.name == "Test Session"
    
    def test_session_creation_with_custom_previous_intent(self):
        """Test that Session can be created with a custom previous_session_intent."""
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.FEATURE_EXPLORATION
        )
        
        assert session.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
    
    def test_session_previous_intent_update(self):
        """Test that previous_session_intent can be updated."""
        session = Session(
            project_id="test-project-123",
            name="Test Session"
        )
        
        # Initially should be INITIAL_STATE
        assert session.previous_session_intent == UserIntentEnum.INITIAL_STATE
        
        # Update to a different intent
        session.previous_session_intent = UserIntentEnum.READY_FOR_ACTION
        assert session.previous_session_intent == UserIntentEnum.READY_FOR_ACTION
        
        # Update to another intent
        session.previous_session_intent = UserIntentEnum.SPEC_CLARIFICATION
        assert session.previous_session_intent == UserIntentEnum.SPEC_CLARIFICATION
    
    def test_session_serialization_with_previous_intent(self):
        """Test that Session can be serialized and deserialized with previous_session_intent."""
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.FEATURE_EXPLORATION
        )
        
        # Serialize to dict
        session_dict = session.model_dump()
        assert session_dict["previous_session_intent"] == "feature_exploration"
        
        # Deserialize from dict
        new_session = Session(**session_dict)
        assert new_session.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
    
    def test_session_json_serialization(self):
        """Test JSON serialization of Session with previous_session_intent."""
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.READY_FOR_ACTION
        )
        
        # Convert to JSON
        session_json = session.model_dump_json()
        
        # Parse back
        import json
        session_data = json.loads(session_json)
        assert session_data["previous_session_intent"] == "ready_for_action"
    
    def test_session_all_intent_types(self):
        """Test that Session works with all UserIntentEnum types."""
        for intent in UserIntentEnum:
            session = Session(
                project_id="test-project-123",
                name=f"Test Session {intent.value}",
                previous_session_intent=intent
            )
            assert session.previous_session_intent == intent


if __name__ == "__main__":
    pytest.main([__file__])
