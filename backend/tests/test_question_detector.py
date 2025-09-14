"""
Tests for the question detection module.
"""

import pytest
from utils.question_detector import _detect_interactive_questions, _detect_confirming_question, _detect_option_question, _extract_options_from_match
import re


class TestQuestionDetection:
    """Test cases for question detection functionality."""
    
    def test_detect_confirming_questions(self):
        """Test detection of confirming questions."""
        # Test basic confirming questions
        assert _detect_confirming_question("Is this correct?") is not None
        assert _detect_confirming_question("Is the sky blue?") is not None
        assert _detect_confirming_question("Are you sure?") is not None
        assert _detect_confirming_question("Is it working properly?") is not None
        
        # Test case insensitive
        assert _detect_confirming_question("is this correct?") is not None
        assert _detect_confirming_question("ARE YOU SURE?") is not None
        
        # Test non-confirming questions
        assert _detect_confirming_question("What is this?") is None
        assert _detect_confirming_question("How does it work?") is None
        assert _detect_confirming_question("This is a statement.") is None
        assert _detect_confirming_question("Hello there!") is None
    
    def test_detect_option_questions(self):
        """Test detection of option questions."""
        # Test basic option questions
        option_q1 = _detect_option_question("choose A or B or C")
        assert option_q1 is not None
        assert option_q1.type == "option"
        assert option_q1.options == ["A", "B", "C"]
        
        option_q2 = _detect_option_question("select option A, B, or C")
        assert option_q2 is not None
        assert option_q2.type == "option"
        assert option_q2.options == ["A", "B", "C"]
        
        option_q3 = _detect_option_question("pick between X and Y")
        assert option_q3 is not None
        assert option_q3.type == "option"
        assert option_q3.options == ["X", "Y"]
        
        option_q4 = _detect_option_question("which option: 1, 2, or 3?")
        assert option_q4 is not None
        assert option_q4.type == "option"
        assert option_q4.options == ["1", "2", "3"]
        
        # Test case insensitive
        option_q5 = _detect_option_question("CHOOSE A OR B OR C")
        assert option_q5 is not None
        assert option_q5.options == ["A", "B", "C"]
        
        # Test non-option questions
        assert _detect_option_question("What is this?") is None
        assert _detect_option_question("How does it work?") is None
        assert _detect_option_question("This is a statement.") is None
    
    def test_detect_interactive_questions_comprehensive(self):
        """Test comprehensive question detection."""
        # Test single confirming question
        questions = _detect_interactive_questions("Could you please confirm that this is the correct approach?")
        assert len(questions) == 1
        assert questions[0].type == "confirming"
        assert questions[0].text == "Could you please confirm that this is the correct approach?"
        assert questions[0].options == []
        
        # Test single option question
        questions = _detect_interactive_questions("Choose A or B or C")
        assert len(questions) == 1
        assert questions[0].type == "option"
        assert questions[0].text == "Choose A or B or C"
        assert questions[0].options == ["A", "B", "C"]
        
        # Test multiple questions in one message
        questions = _detect_interactive_questions("Could you please confirm that this is correct? Also, Choose A or B or C.")
        assert len(questions) == 2
        assert questions[0].type == "confirming"
        assert questions[1].type == "option"
        
        # Test mixed question types
        questions = _detect_interactive_questions("Is it correct that the implementation is working? If not, Select option 1, 2, or 3.")
        assert len(questions) == 2
        confirming_questions = [q for q in questions if q.type == "confirming"]
        option_questions = [q for q in questions if q.type == "option"]
        assert len(confirming_questions) == 1
        assert len(option_questions) == 1
        assert option_questions[0].options == ["1", "2", "3"]
        
        # Test no questions
        questions = _detect_interactive_questions("This is a statement without questions.")
        assert len(questions) == 0
        
        # Test empty message
        questions = _detect_interactive_questions("")
        assert len(questions) == 0
        
        # Test None message
        questions = _detect_interactive_questions(None)
        assert len(questions) == 0
    
    def test_extract_options_from_match(self):
        """Test option extraction from regex matches."""
        # Test "between A and B" pattern
        pattern = r'between\s+([A-Za-z0-9]+)\s+and\s+([A-Za-z0-9]+)'
        match = re.search(pattern, "between X and Y")
        options = _extract_options_from_match(match, pattern)
        assert options == ["X", "Y"]
        
        # Test comma/or separated options
        pattern = r'(choose|select|pick)\s+([A-Za-z0-9]+(?:\s+or\s+[A-Za-z0-9]+)+)'
        match = re.search(pattern, "choose A or B or C")
        options = _extract_options_from_match(match, pattern)
        assert options == ["A", "B", "C"]
        
        # Test comma separated options
        pattern = r'which\s+(option|choice|one):\s*([^.!?]+)'
        match = re.search(pattern, "which option: 1, 2, or 3?")
        options = _extract_options_from_match(match, pattern)
        assert options == ["1", "2", "3"]
    
    def test_edge_cases(self):
        """Test edge cases and error handling."""
        # Test malformed sentences
        questions = _detect_interactive_questions("Could you please confirm that this is correct? But also Choose A or B or C")
        assert len(questions) == 2
        
        # Test questions with extra whitespace
        questions = _detect_interactive_questions("  Could you please confirm that this is correct?  ")
        assert len(questions) == 1
        assert questions[0].text == "Could you please confirm that this is correct?"
        
        # Test questions with special characters
        questions = _detect_interactive_questions("Could you please confirm that this is correct (with parentheses)?")
        assert len(questions) == 1
        
        # Test very long messages
        long_message = "This is a very long message. " * 100 + "Could you please confirm that this is correct?"
        questions = _detect_interactive_questions(long_message)
        assert len(questions) == 1
        assert questions[0].type == "confirming"
    
    def test_question_schema_structure(self):
        """Test that detected questions have proper schema structure."""
        questions = _detect_interactive_questions("Could you please confirm that this is correct? Choose A or B or C.")
        
        assert len(questions) == 2
        
        # Test confirming question schema
        confirming_q = questions[0]
        assert hasattr(confirming_q, 'id')
        assert hasattr(confirming_q, 'type')
        assert hasattr(confirming_q, 'text')
        assert hasattr(confirming_q, 'options')
        assert confirming_q.type == "confirming"
        assert isinstance(confirming_q.options, list)
        assert len(confirming_q.options) == 0
        
        # Test option question schema
        option_q = questions[1]
        assert hasattr(option_q, 'id')
        assert hasattr(option_q, 'type')
        assert hasattr(option_q, 'text')
        assert hasattr(option_q, 'options')
        assert option_q.type == "option"
        assert isinstance(option_q.options, list)
        assert len(option_q.options) == 3
    
    def test_real_world_examples(self):
        """Test with real-world example messages."""
        # Example 1: User asking for confirmation
        questions = _detect_interactive_questions("I want to implement user authentication. Could you please confirm that this is the right approach?")
        assert len(questions) == 1
        assert questions[0].type == "confirming"
        
        # Example 2: User asking for choice
        questions = _detect_interactive_questions("For the database, Choose A or B or C")
        assert len(questions) == 1
        assert questions[0].type == "option"
        assert "A" in questions[0].options
        assert "B" in questions[0].options
        assert "C" in questions[0].options
        
        # Example 3: Complex message with multiple questions
        questions = _detect_interactive_questions("Is it correct that the current implementation is working? If not, Choose option A or B or C. Are you satisfied with this solution?")
        assert len(questions) == 3
        confirming_count = sum(1 for q in questions if q.type == "confirming")
        option_count = sum(1 for q in questions if q.type == "option")
        assert confirming_count == 2
        assert option_count == 1


if __name__ == "__main__":
    pytest.main([__file__])
