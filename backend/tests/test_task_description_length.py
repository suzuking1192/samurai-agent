import pytest
from models import Task
from pydantic import ValidationError


def test_task_description_max_length_20000():
    """Test that task description accepts up to 20000 characters."""
    # Create a description with exactly 20000 characters
    long_description = "x" * 20000
    
    # This should not raise a validation error
    task = Task(
        project_id="test-project",
        title="Test Task",
        description=long_description
    )
    
    assert task.description == long_description
    assert len(task.description) == 20000


def test_task_description_exceeds_max_length():
    """Test that task description rejects more than 20000 characters."""
    # Create a description with 20001 characters (exceeds limit)
    too_long_description = "x" * 20001
    
    # This should raise a validation error
    with pytest.raises(ValidationError) as exc_info:
        Task(
            project_id="test-project",
            title="Test Task",
            description=too_long_description
        )
    
    # Check that the error message mentions the length limit
    error_message = str(exc_info.value)
    assert "20000" in error_message


def test_task_description_within_limit():
    """Test that task description accepts descriptions well within the limit."""
    # Create a description with 15000 characters (well within limit)
    medium_description = "This is a test description. " * 600  # Approximately 15000 characters
    
    # This should not raise a validation error
    task = Task(
        project_id="test-project",
        title="Test Task",
        description=medium_description
    )
    
    assert task.description == medium_description
    assert len(task.description) > 14000  # Should be around 15000


def test_task_description_empty():
    """Test that task description accepts empty string (required field)."""
    # Empty string should be allowed since there's no min_length constraint
    task = Task(
        project_id="test-project",
        title="Test Task",
        description=""
    )
    
    assert task.description == ""


def test_task_description_minimum_length():
    """Test that task description accepts non-empty strings."""
    # This should work fine
    task = Task(
        project_id="test-project",
        title="Test Task",
        description="A valid description"
    )
    
    assert task.description == "A valid description"


if __name__ == "__main__":
    pytest.main([__file__])
