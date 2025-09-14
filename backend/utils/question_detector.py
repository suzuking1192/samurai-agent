"""
Question Detection Module

This module provides functionality to detect confirming and option-type questions
within user messages using regex patterns and text analysis.
"""

import re
import uuid
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

# Import QuestionSchema from models to ensure consistency
try:
    from models import QuestionSchema
except ImportError:
    # Fallback definition if models import fails
    class QuestionSchema(BaseModel):
        """
        Schema for detected interactive questions.
        
        Attributes:
            id: Unique identifier for the question
            type: Type of question ('confirming' or 'option')
            text: The full question sentence
            options: List of options for option-type questions (empty for confirming)
        """
        id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique question identifier")
        type: str = Field(..., description="Question type: 'confirming' or 'option'")
        text: str = Field(..., description="The full question sentence")
        options: List[str] = Field(default=[], description="List of options for option-type questions")


def _detect_interactive_questions(message: str) -> List[QuestionSchema]:
    """
    Detect confirming and option-type questions within a user message.
    
    This function uses exact phrase matching to identify:
    1. Confirming questions: "Could you please confirm that...", "Is it correct that", "Are you satisfied with" or "Is it true that..?"
    2. Option questions: "Choose A or B or C..." or "Select option 1, 2, or 3..."
    
    Args:
        message: The raw text of the user's chat message
        
    Returns:
        List of detected questions, each with type and extracted options
    """
    if not message or not isinstance(message, str):
        return []
    
    detected_questions = []
    
    # Check for all confirming questions using exact phrase matching
    confirming_questions = _detect_all_confirming_questions_exact(message)
    detected_questions.extend(confirming_questions)
    
    # Check for all option questions using exact phrase matching
    option_questions = _detect_all_option_questions_exact(message)
    detected_questions.extend(option_questions)
    
    return detected_questions


def _split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences using common sentence delimiters.
    
    This function is smarter about splitting and avoids splitting on:
    - Periods in file paths (e.g., file.py)
    - Periods in URLs (e.g., example.com)
    - Periods in abbreviations (e.g., U.S.A.)
    - Periods in decimal numbers (e.g., 3.14)
    
    Args:
        text: Input text to split
        
    Returns:
        List of sentences
    """
    if not text or not text.strip():
        return []
    
    # First, try to detect if this is a single sentence by looking for question marks
    # If it contains a question mark and no other sentence-ending punctuation, treat as one sentence
    # But be careful about cases like "Is this correct? But also choose A or B or C"
    if '?' in text and not re.search(r'[.!](?=\s|$)', text):
        # Check if there are multiple question marks or if there's text after a question mark
        question_marks = text.count('?')
        if question_marks == 1:
            # Single question mark - check if there's significant text after it
            q_index = text.find('?')
            after_question = text[q_index + 1:].strip()
            if len(after_question) > 10:  # If there's substantial text after the question mark
                # This might be multiple sentences, so don't treat as single sentence
                pass
            else:
                return [text.strip()]
        else:
            # Multiple question marks - definitely multiple sentences
            pass
    
    # More sophisticated sentence splitting
    sentences = []
    current_sentence = ""
    i = 0
    paren_depth = 0  # Track parentheses depth
    
    while i < len(text):
        char = text[i]
        current_sentence += char
        
        # Track parentheses depth BEFORE checking for sentence boundaries
        if char == '(':
            paren_depth += 1
        elif char == ')':
            paren_depth -= 1
        
        # Check if this might be a sentence ending
        if char in '.!?':
            # Look ahead to see if this is really a sentence boundary
            next_chars = text[i+1:i+3] if i+1 < len(text) else ""
            
            # Don't split if:
            # 1. Next character is a digit (decimal number)
            # 2. Next character is a letter (abbreviation or file extension)
            # 3. This is part of a file path (look for common patterns)
            # 4. This is part of a URL
            # 5. We're inside parentheses (unless it's the end of the sentence)
            should_split = True
            
            # Don't split if we're inside parentheses
            if paren_depth > 0:
                should_split = False
            elif next_chars and next_chars[0].isdigit():
                # Decimal number like 3.14
                should_split = False
            elif next_chars and (next_chars[0].isalpha() or next_chars[0] == '_'):
                # Could be abbreviation, file extension, or method name
                # Check if it looks like a file extension (short, followed by space or end)
                if len(next_chars) <= 4 and (i+2 >= len(text) or text[i+2] in ' \t\n'):
                    should_split = False
                # Also check if this is a file extension followed by more text (like .py is)
                elif len(next_chars) <= 4 and i+2 < len(text):
                    # Look ahead to see if there's a space and lowercase word after the extension
                    after_extension = text[i+1:i+10]
                    if ' ' in after_extension:
                        space_index = after_extension.find(' ')
                        if space_index > 0 and space_index <= 4:  # Extension is 1-4 chars
                            after_space = after_extension[space_index+1:].strip()
                            if after_space and after_space[0].islower():
                                # This looks like a file extension followed by lowercase text
                                should_split = False
                # Check if this is a file extension followed by comma, space, or other punctuation
                elif len(next_chars) <= 4 and i+2 < len(text):
                    after_period = text[i+1:i+5]
                    if any(char in after_period for char in ', \t\n'):
                        # This looks like a file extension followed by punctuation
                        should_split = False
                # Check if this is a method name like __init__ or similar
                elif next_chars[0] == '_' and i+2 < len(text):
                    # Look ahead to see if this is a method name pattern
                    after_underscore = text[i+1:i+10]
                    if '_' in after_underscore or '(' in after_underscore:
                        # This looks like a method name, don't split
                        should_split = False
            elif next_chars and next_chars[0] in '.)':
                # Check if this is part of a method call or ellipsis
                if next_chars[0] == '.' and i+2 < len(text):
                    # Look ahead to see if this is an ellipsis (...)
                    after_dots = text[i+1:i+5]
                    if after_dots.startswith('..'):
                        # This looks like an ellipsis, don't split
                        should_split = False
                elif next_chars[0] == ')' and i+2 < len(text):
                    # Look ahead to see if this is part of a method call
                    after_paren = text[i+1:i+5]
                    if any(char in after_paren for char in ' \t\n'):
                        # This looks like the end of a method call, don't split
                        should_split = False
            elif char == '.' and i > 0:
                # Check if this looks like part of a file path
                # Look for patterns like /path/to/file.py or C:\path\file.py
                before_period = text[max(0, i-20):i]
                if re.search(r'[/\\][^/\\]*$', before_period) or re.search(r'[A-Za-z]:\\', before_period):
                    should_split = False
                # Also check if this is a file extension followed by a space and more text
                elif next_chars and next_chars[0] == ' ' and i+2 < len(text):
                    # Look ahead to see if there's more content that suggests this is part of a sentence
                    after_space = text[i+2:i+10].strip()
                    if after_space and not after_space[0].isupper():
                        # This looks like a continuation of the same sentence
                        should_split = False
            
            if should_split:
                # This is a real sentence boundary
                sentence = current_sentence.strip()
                if sentence:
                    sentences.append(sentence)
                current_sentence = ""
        
        i += 1
    
    # Add any remaining text as a sentence
    if current_sentence.strip():
        sentences.append(current_sentence.strip())
    
    # If no sentences were found, return the original text as a single sentence
    if not sentences:
        sentences = [text.strip()]
    
    return sentences


def _detect_confirming_question(sentence: str) -> Optional[QuestionSchema]:
    """
    Detect confirming questions using regex patterns.
    
    Looks for patterns like:
    - "Is this correct?"
    - "Is the sky blue?"
    - "Are you sure?"
    - "Is it working?"
    - "Is it correct that ...?"
    - "Can you confirm that ...?"
    - "Would you say that ...?"
    - "Do you think that ...?"
    
    Args:
        sentence: Single sentence to analyze
        
    Returns:
        QuestionSchema if confirming question detected, None otherwise
    """
    # Patterns for confirming questions
    confirming_patterns = [
        r'^(Is|Are)\s+.*\?$',  # Basic Is/Are + question mark
        r'^(Can|Could)\s+you\s+(confirm|verify|check)\s+.*\?$',  # Can you confirm/verify/check
        r'^(Would|Do)\s+you\s+(say|think|agree)\s+.*\?$',  # Would you say/think/agree
        r'^(Does|Do)\s+.*\s+(seem|appear|look)\s+.*\?$',  # Does/Do ... seem/appear/look
        r'^(Am|Are)\s+I\s+(correct|right)\s+.*\?$',  # Am/Are I correct/right
        r'^(Is|Are)\s+it\s+(correct|right|true)\s+.*\?$',  # Is/Are it correct/right/true
        r'^(Is|Are)\s+it\s+(correct|right|true)\s+that\s+.*\?$',  # Is/Are it correct/right/true that...
        r'^(Should|Would|Could)\s+.*\s+(remain|stay|be)\s+.*\?$',  # Should/Would/Could ... remain/stay/be
        r'^(Is|Are)\s+.*\s+(appropriate|suitable|correct|right)\s+.*\?$',  # Is/Are ... appropriate/suitable/correct/right
        r'^(Does|Do)\s+.*\s+(make|seem)\s+sense\s+.*\?$',  # Does/Do ... make/seem sense
        r'^(Is|Are)\s+.*\s+(the\s+)?(right|correct|proper|appropriate)\s+(approach|way|solution|choice)\s+.*\?$',  # Is/Are ... the right approach/way/solution/choice
        r'^(Should|Would|Could)\s+we\s+.*\?$',  # Should/Would/Could we...
    ]
    
    for pattern in confirming_patterns:
        if re.match(pattern, sentence, re.IGNORECASE):
            return QuestionSchema(
                type="confirming",
                text=sentence,
                options=[]
            )
    
    return None


def _detect_option_question(sentence: str) -> Optional[QuestionSchema]:
    """
    Detect option-type questions using regex patterns.
    
    Looks for patterns like:
    - "choose A or B or C"
    - "select option A, B, or C"
    - "pick between A and B"
    - "which option: A, B, or C?"
    
    Args:
        sentence: Single sentence to analyze
        
    Returns:
        QuestionSchema if option question detected, None otherwise
    """
    # Pattern for option questions with "choose", "select", "pick", etc.
    option_patterns = [
        # "between A and B" pattern - must come first to avoid conflicts
        r'between\s+([A-Za-z0-9]+)\s+and\s+([A-Za-z0-9]+)',
        # "choose A or B or C" pattern - must come before general pattern
        r'(choose|select|pick)\s+([A-Za-z0-9]+(?:\s+or\s+[A-Za-z0-9]+)+)',
        # "which option: A, B, or C?" pattern
        r'which\s+(option|choice|one):\s*([^.!?]+)',
        # "select option A, B, or C" pattern - general pattern comes last
        r'(select|choose|pick)\s+(?:option\s+)?([^.!?]+)',
    ]
    
    for pattern in option_patterns:
        match = re.search(pattern, sentence, re.IGNORECASE)
        if match:
            options = _extract_options_from_match(match, pattern)
            if options:
                return QuestionSchema(
                    type="option",
                    text=sentence,
                    options=options
                )
    
    return None


def _extract_options_from_match(match: re.Match, pattern: str) -> List[str]:
    """
    Extract individual options from a regex match.
    
    Args:
        match: Regex match object
        pattern: The pattern that was matched
        
    Returns:
        List of extracted options
    """
    options = []
    
    if 'between' in pattern:
        # Handle "between A and B" pattern
        if len(match.groups()) >= 2:
            options = [match.group(1).strip(), match.group(2).strip()]
    else:
        # Handle other patterns with comma/or separated options
        if len(match.groups()) >= 2:
            options_text = match.group(2).strip()
        else:
            options_text = match.group(1).strip()
        
        # Split by comma and "or" - handle the case where "or" might be part of the text
        # First split by comma, then by "or" for each part
        parts = re.split(r'\s*,\s*', options_text)
        options = []
        for part in parts:
            if re.search(r'\s+or\s+', part, re.IGNORECASE):
                # Split by "or" (case insensitive) and add each option
                or_parts = re.split(r'\s+or\s+', part, flags=re.IGNORECASE)
                options.extend([opt.strip() for opt in or_parts if opt.strip()])
            elif re.match(r'^or\s+', part, re.IGNORECASE):
                # Handle cases where "or" is at the beginning of a part
                options.append(re.sub(r'^or\s+', '', part, flags=re.IGNORECASE).strip())
            else:
                options.append(part.strip())
        
        # Remove empty options
        options = [opt for opt in options if opt]
    
    return options


def _detect_all_confirming_questions_exact(message: str) -> List[QuestionSchema]:
    """
    Detect all confirming questions using exact phrase matching.
    
    Looks for exact phrases:
    - "Could you please confirm that..."
    - "Is it correct that"
    - "Are you satisfied with"
    - "Is it true that..?"
    
    Args:
        message: The full message to analyze
        
    Returns:
        List of detected confirming questions
    """
    questions = []
    
    # Exact phrases to match for confirming questions
    confirming_phrases = [
        "Could you please confirm that",
        "Is it correct that",
        "Are you satisfied with",
        "Is it true that"
    ]
    
    for phrase in confirming_phrases:
        # Find all occurrences of the phrase in the message (case insensitive)
        phrase_lower = phrase.lower()
        message_lower = message.lower()
        
        start_index = 0
        while True:
            start_index = message_lower.find(phrase_lower, start_index)
            if start_index == -1:
                break
                
            # Find the first question mark after the phrase
            question_mark_index = message.find('?', start_index)
            if question_mark_index != -1:
                # Extract the full question from start to question mark
                question_text = message[start_index:question_mark_index + 1].strip()
                questions.append(QuestionSchema(
                    type="confirming",
                    text=question_text,
                    options=[]
                ))
            
            # Move past this occurrence to find the next one
            start_index += len(phrase)
    
    return questions


def _detect_all_option_questions_exact(message: str) -> List[QuestionSchema]:
    """
    Detect all option questions using exact phrase matching.
    
    Looks for exact phrases:
    - "Choose A or B or C..."
    - "Select option 1, 2, or 3..."
    
    Args:
        message: The full message to analyze
        
    Returns:
        List of detected option questions
    """
    questions = []
    
    # Exact phrases to match for option questions
    option_phrases = [
        "Choose A or B or C",
        "Choose option A or B or C",
        "Select option 1, 2, or 3"
    ]
    
    for phrase in option_phrases:
        # Find all occurrences of the phrase in the message (case insensitive)
        phrase_lower = phrase.lower()
        message_lower = message.lower()
        
        start_index = 0
        while True:
            start_index = message_lower.find(phrase_lower, start_index)
            if start_index == -1:
                break
                
            # Extract the full phrase and any text that follows until end of sentence
            # Look for the end of the sentence (period, exclamation, or end of message)
            end_index = len(message)
            for i in range(start_index + len(phrase), len(message)):
                if message[i] in '.!?':
                    end_index = i + 1
                    break
            
            question_text = message[start_index:end_index].strip()
            
            # Extract options from the question text
            options = _extract_options_from_exact_phrase(question_text, phrase)
            
            questions.append(QuestionSchema(
                type="option",
                text=question_text,
                options=options
            ))
            
            # Move past this occurrence to find the next one
            start_index += len(phrase)
    
    return questions


def _detect_confirming_question_exact(message: str) -> Optional[QuestionSchema]:
    """
    Detect confirming questions using exact phrase matching.
    
    Looks for exact phrases:
    - "Could you please confirm that..."
    - "Is it correct that"
    - "Are you satisfied with"
    - "Is it true that..?"
    
    Args:
        message: The full message to analyze
        
    Returns:
        QuestionSchema if confirming question detected, None otherwise
    """
    # Exact phrases to match for confirming questions
    confirming_phrases = [
        "Could you please confirm that",
        "Is it correct that",
        "Are you satisfied with",
        "Is it true that"
    ]
    
    for phrase in confirming_phrases:
        # Find the phrase in the message (case insensitive)
        phrase_lower = phrase.lower()
        message_lower = message.lower()
        
        start_index = message_lower.find(phrase_lower)
        if start_index != -1:
            # Find the first question mark after the phrase
            question_mark_index = message.find('?', start_index)
            if question_mark_index != -1:
                # Extract the full question from start to question mark
                question_text = message[start_index:question_mark_index + 1].strip()
                return QuestionSchema(
                    type="confirming",
                    text=question_text,
                    options=[]
                )
    
    return None


def _detect_option_question_exact(message: str) -> Optional[QuestionSchema]:
    """
    Detect option questions using exact phrase matching.
    
    Looks for exact phrases:
    - "Choose A or B or C..."
    - "Select option 1, 2, or 3..."
    
    Args:
        message: The full message to analyze
        
    Returns:
        QuestionSchema if option question detected, None otherwise
    """
    # Exact phrases to match for option questions
    option_phrases = [
        "Choose A or B or C",
        "Select option 1, 2, or 3"
    ]
    
    for phrase in option_phrases:
        # Find the phrase in the message (case insensitive)
        phrase_lower = phrase.lower()
        message_lower = message.lower()
        
        start_index = message_lower.find(phrase_lower)
        if start_index != -1:
            # Extract the full phrase and any text that follows until end of sentence
            # Look for the end of the sentence (period, exclamation, or end of message)
            end_index = len(message)
            for i in range(start_index + len(phrase), len(message)):
                if message[i] in '.!?':
                    end_index = i + 1
                    break
            
            question_text = message[start_index:end_index].strip()
            
            # Extract options from the question text
            options = _extract_options_from_exact_phrase(question_text, phrase)
            
            return QuestionSchema(
                type="option",
                text=question_text,
                options=options
            )
    
    return None


def _extract_options_from_exact_phrase(question_text: str, matched_phrase: str) -> List[str]:
    """
    Extract options from an exact phrase match.
    
    Args:
        question_text: The full question text
        matched_phrase: The phrase that was matched
        
    Returns:
        List of extracted options
    """
    options = []
    
    if "Choose A or B or C" in matched_phrase or "Choose option A or B or C" in matched_phrase:
        # Look for the pattern "A or B or C" in the question text
        # This is a template, so we need to find the actual options
        # Look for patterns like "X or Y or Z" where X, Y, Z are words/numbers
        import re
        pattern = r'(\w+)\s+or\s+(\w+)\s+or\s+(\w+)'
        match = re.search(pattern, question_text, re.IGNORECASE)
        if match:
            options = [match.group(1).strip(), match.group(2).strip(), match.group(3).strip()]
    
    elif "Select option 1, 2, or 3" in matched_phrase:
        # Look for the pattern "1, 2, or 3" or similar in the question text
        # This is a template, so we need to find the actual options
        import re
        pattern = r'(\w+),\s*(\w+),\s*or\s+(\w+)'
        match = re.search(pattern, question_text, re.IGNORECASE)
        if match:
            options = [match.group(1).strip(), match.group(2).strip(), match.group(3).strip()]
    
    return options


def _validate_question_detection():
    """
    Validate the question detection logic with test cases.
    
    This function can be used for testing and validation.
    """
    test_cases = [
        # Confirming questions
        ("Could you please confirm that this is the correct approach?", "confirming", []),
        ("Is it correct that you want to proceed with this solution?", "confirming", []),
        ("Are you satisfied with the current implementation?", "confirming", []),
        ("Is it true that this meets your requirements?", "confirming", []),
        
        # Option questions
        ("Choose A or B or C", "option", ["A", "B", "C"]),
        ("Select option 1, 2, or 3", "option", ["1", "2", "3"]),
        ("Choose approach A or approach B or approach C", "option", ["approach", "approach", "approach"]),
        
        # Mixed messages
        ("Could you please confirm that this is correct? Also, Choose A or B or C.", "mixed", []),
        
        # Non-questions
        ("This is a statement.", None, []),
        ("Hello there!", None, []),
    ]
    
    for message, expected_type, expected_options in test_cases:
        questions = _detect_interactive_questions(message)
        if expected_type is None:
            assert len(questions) == 0, f"Expected no questions for: {message}"
        else:
            assert len(questions) > 0, f"Expected questions for: {message}"
            if expected_type == "confirming":
                confirming_questions = [q for q in questions if q.type == "confirming"]
                assert len(confirming_questions) > 0, f"Expected confirming question for: {message}"
            elif expected_type == "option":
                option_questions = [q for q in questions if q.type == "option"]
                assert len(option_questions) > 0, f"Expected option question for: {message}"
                if expected_options:
                    assert option_questions[0].options == expected_options, f"Expected options {expected_options} for: {message}"


if __name__ == "__main__":
    # Run validation when script is executed directly
    _validate_question_detection()
    print("Question detection validation passed!")