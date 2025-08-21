import pytest
import asyncio
import os
import sys
import re
from unittest.mock import patch, MagicMock

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import AgentToolRegistry
from services.utils import parse_ai_json_response, extract_json_from_ai_response


class TestJSONParsingError:
    """Test to replicate and fix the JSON parsing error in _extract_code_context"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent_tools = AgentToolRegistry()
    
    def test_replicate_exact_error_pattern(self):
        """Test to replicate the exact error pattern from the logs"""
        # The error shows: '\n  "relevance_score"'
        # This suggests there's a string that contains a newline followed by "relevance_score"
        
        # Let's test the regex pattern that might be causing this issue
        problematic_text = '\n  "relevance_score"'
        
        # This is the regex pattern from the extract_json_from_ai_response function
        pattern = r'"relevant_code"\s*:\s*"([^"]*)"'
        
        try:
            # Try to match this pattern against the problematic text
            match = re.search(pattern, problematic_text)
            print(f"Regex match result: {match}")
            
            # This should fail, but let's see what happens
            if match:
                print("Unexpected match found!")
            else:
                print("No match found as expected")
                
        except Exception as e:
            print(f"Regex exception: {e}")
            # This might be the source of our error
    
    def test_multiline_json_parsing(self):
        """Test parsing JSON with multiline content in relevant_code field"""
        # This is the type of response that might cause issues
        multiline_response = '''{
  "relevance_score": 8,
  "context": "This code implements a comprehensive task management system.",
  "relevant_code": "interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    parent_id?: string;
    children?: Task[];
    created_at: string;
    updated_at: string;
    completed_at?: string;
    tags?: string[];
    assignee?: string;
    estimated_hours?: number;
    actual_hours?: number;
    dependencies?: string[];
    notes?: string;
    attachments?: Attachment[];
    custom_fields?: Record<string, any>;
  }",
  "file_path": "frontend/src/types/index.ts"
}'''
        
        try:
            result = parse_ai_json_response(multiline_response, ["relevance_score", "context", "relevant_code", "file_path"])
            print(f"Multiline parse result: {result}")
            
            if "error" in result:
                print(f"Error in multiline parsing: {result['error']}")
                print(f"Error message: {result.get('message', 'No message')}")
                print(f"Raw response: {result.get('raw_response', 'No raw response')}")
            else:
                print("Multiline parsing succeeded")
                
        except Exception as e:
            print(f"Multiline parsing exception: {e}")
            # This might be the error we're seeing
    
    def test_regex_pattern_issues(self):
        """Test the specific regex patterns that might be causing issues"""
        # Test the problematic regex pattern from extract_json_from_ai_response
        problematic_response = '''{
  "relevance_score": 8,
  "context": "Test context",
  "relevant_code": "interface Task {
    id: string;
    title: string;
  }",
  "file_path": "test.ts"
}'''
        
        # Test the regex pattern that extracts relevant_code
        pattern = r'"relevant_code"\s*:\s*"([^"]*)"'
        
        try:
            match = re.search(pattern, problematic_response, re.DOTALL)
            if match:
                print(f"Regex match found: {match.group(1)}")
            else:
                print("No regex match found")
                
        except Exception as e:
            print(f"Regex pattern exception: {e}")
    
    def test_clean_ai_json_response(self):
        """Test the clean_ai_json_response function with problematic content"""
        from services.utils import clean_ai_json_response
        
        problematic_json = '''{
  "relevance_score": 8,
  "context": "Test context",
  "relevant_code": "interface Task {
    id: string;
    title: string;
  }",
  "file_path": "test.ts"
}'''
        
        try:
            cleaned = clean_ai_json_response(problematic_json)
            print(f"Cleaned JSON: {cleaned}")
            
            # Try to parse the cleaned JSON
            import json
            parsed = json.loads(cleaned)
            print(f"Parsed successfully: {parsed}")
            
        except Exception as e:
            print(f"Clean JSON exception: {e}")
            # This might be the source of our error
    
    def test_clean_ai_json_response_issue(self):
        """Test the clean_ai_json_response function with multiline content"""
        from services.utils import clean_ai_json_response
        
        # This is the type of JSON that's causing issues
        problematic_json = '''{
  "relevance_score": 8,
  "context": "Test context",
  "relevant_code": "interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    parent_id?: string;
    children?: Task[];
    created_at: string;
    updated_at: string;
    completed_at?: string;
    tags?: string[];
    assignee?: string;
    estimated_hours?: number;
    actual_hours?: number;
    dependencies?: string[];
    notes?: string;
    attachments?: Attachment[];
    custom_fields?: Record<string, any>;
  }",
  "file_path": "frontend/src/types/index.ts"
}'''
        
        try:
            cleaned = clean_ai_json_response(problematic_json)
            print(f"Cleaned JSON: {cleaned}")
            
            # Try to parse the cleaned JSON
            import json
            parsed = json.loads(cleaned)
            print(f"Parsed successfully: {parsed}")
            
            # Check if the relevant_code field still has newlines
            relevant_code = parsed.get("relevant_code", "")
            if "\n" in relevant_code:
                print("✅ relevant_code still has newlines after cleaning")
            else:
                print("❌ relevant_code lost newlines after cleaning - this is the issue!")
                
        except Exception as e:
            print(f"Clean JSON exception: {e}")
            # This is the error we're trying to fix
    
    def test_extract_json_with_newlines(self):
        """Test extract_json_from_ai_response with newlines in the response"""
        # Create a response that has newlines in the relevant_code field
        response_with_newlines = '''{
  "relevance_score": 8,
  "context": "Test context",
  "relevant_code": "interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    parent_id?: string;
    children?: Task[];
    created_at: string;
    updated_at: string;
    completed_at?: string;
    tags?: string[];
    assignee?: string;
    estimated_hours?: number;
    actual_hours?: number;
    dependencies?: string[];
    notes?: string;
    attachments?: Attachment[];
    custom_fields?: Record<string, any>;
  }",
  "file_path": "frontend/src/types/index.ts"
}'''
        
        try:
            result = extract_json_from_ai_response(response_with_newlines)
            print(f"Extract with newlines result: {result}")
            
            if result is None:
                print("Extraction returned None - this is the issue!")
            else:
                print("Extraction succeeded")
                
        except Exception as e:
            print(f"Extract with newlines exception: {e}")
            # This should be the error we're seeing
            if "relevance_score" in str(e):
                print("Found the expected error pattern!")


if __name__ == "__main__":
    # Run the tests
    test_instance = TestJSONParsingError()
    
    print("Testing exact error pattern...")
    test_instance.test_replicate_exact_error_pattern()
    
    print("\nTesting multiline JSON parsing...")
    test_instance.test_multiline_json_parsing()
    
    print("\nTesting regex pattern issues...")
    test_instance.test_regex_pattern_issues()
    
    print("\nTesting clean AI JSON response...")
    test_instance.test_clean_ai_json_response()
    
    print("\nTesting clean AI JSON response issue...")
    test_instance.test_clean_ai_json_response_issue()
    
    print("\nTesting extract JSON with newlines...")
    test_instance.test_extract_json_with_newlines()
