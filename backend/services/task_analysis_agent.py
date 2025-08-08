"""
Task Analysis Agent for evaluating task descriptions and generating review warnings using LLM.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

try:
    from models import TaskWarning
    from .gemini_service import GeminiService
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import TaskWarning
    from gemini_service import GeminiService

logger = logging.getLogger(__name__)

class TaskAnalysisAgent:
    """
    Agent responsible for analyzing task descriptions and generating review warnings.
    This agent evaluates tasks based on:
    1. General programming best practices
    2. Assumption checking
    3. Detail sufficiency
    """

    def __init__(self):
        """Initialize the TaskAnalysisAgent."""
        self.gemini_service = GeminiService()
        
        # Define analysis criteria for LLM prompts
        self.analysis_criteria = {
            "best_practices": {
                "description": "General programming best practices",
                "checks": [
                    "Clear separation of concerns",
                    "Modularity and reusability", 
                    "Error handling and edge cases",
                    "Security considerations",
                    "Performance implications",
                    "Testing requirements"
                ]
            },
            "assumptions": {
                "description": "Checking for potentially incorrect assumptions",
                "checks": [
                    "Technical dependencies",
                    "User behavior assumptions",
                    "System state assumptions", 
                    "Data availability assumptions",
                    "Integration points"
                ]
            },
            "detail_sufficiency": {
                "description": "Evaluating if the description provides enough detail",
                "checks": [
                    "Implementation steps clarity",
                    "Required inputs/outputs",
                    "Success criteria",
                    "Technical constraints",
                    "Dependencies and prerequisites"
                ]
            }
        }

    async def analyze_task(self, title: str, description: str) -> List[TaskWarning]:
        """
        Analyze a task description and generate review warnings using LLM.
        
        Args:
            title: The task title
            description: The task description
        
        Returns:
            List of TaskWarning objects
        """
        try:
            # Generate comprehensive analysis using LLM
            warnings = await self._generate_llm_warnings(title, description)
            return warnings
        except Exception as e:
            logger.error(f"Error in LLM task analysis: {e}")
            # Fallback to heuristic analysis if LLM fails
            return self._fallback_heuristic_analysis(title, description)

    def _check_best_practices(self, title: str, description: str) -> List[TaskWarning]:
        """Check if the task follows general programming best practices."""
        warnings = []
        
        # Check for error handling consideration
        if not any(term in description.lower() for term in ["error", "exception", "fail", "handle"]):
            warnings.append(TaskWarning(
                message="Error handling not explicitly mentioned",
                reasoning="The task description should consider error cases and how to handle them to ensure robust implementation."
            ))
        
        # Check for testing consideration
        if not any(term in description.lower() for term in ["test", "verify", "validate"]):
            warnings.append(TaskWarning(
                message="Testing requirements not specified",
                reasoning="Consider adding specific testing requirements or acceptance criteria to ensure quality."
            ))
        
        # Check for security implications
        if any(term in description.lower() for term in ["user", "auth", "login", "data", "api"]) and \
           not any(term in description.lower() for term in ["secure", "encrypt", "protect", "sanitize"]):
            warnings.append(TaskWarning(
                message="Security considerations may be missing",
                reasoning="Task involves sensitive operations but doesn't explicitly address security measures."
            ))
        
        return warnings

    def _check_assumptions(self, title: str, description: str) -> List[TaskWarning]:
        """Check for potentially incorrect or missing assumptions."""
        warnings = []
        
        # Check for dependency assumptions
        if any(term in description.lower() for term in ["integrate", "connect", "api", "service"]) and \
           not any(term in description.lower() for term in ["version", "compatibility", "require"]):
            warnings.append(TaskWarning(
                message="External dependency requirements not specified",
                reasoning="Task involves external integrations but doesn't specify version requirements or compatibility needs."
            ))
        
        # Check for data assumptions
        if any(term in description.lower() for term in ["data", "database", "store", "fetch"]) and \
           not any(term in description.lower() for term in ["schema", "format", "structure", "type"]):
            warnings.append(TaskWarning(
                message="Data structure assumptions not clarified",
                reasoning="Task involves data handling but doesn't specify data structures or formats."
            ))
        
        # Check for state assumptions
        if any(term in description.lower() for term in ["update", "modify", "change", "state"]) and \
           not any(term in description.lower() for term in ["initial", "current", "condition", "prerequisite"]):
            warnings.append(TaskWarning(
                message="System state assumptions not defined",
                reasoning="Task modifies state but doesn't specify required initial conditions or prerequisites."
            ))
        
        return warnings

    def _check_detail_sufficiency(self, title: str, description: str) -> List[TaskWarning]:
        """Evaluate if the description provides enough implementation detail."""
        warnings = []
        
        # Check for implementation steps
        if len(description.split()) < 30:  # Simple heuristic for detail level
            warnings.append(TaskWarning(
                message="Task description may lack sufficient detail",
                reasoning="The description seems too brief. Consider adding more specific implementation steps or requirements."
            ))
        
        # Check for success criteria
        if not any(term in description.lower() for term in ["should", "must", "expect", "success", "complete"]):
            warnings.append(TaskWarning(
                message="Success criteria not clearly defined",
                reasoning="Add specific criteria that define when this task can be considered successfully completed."
            ))
        
        # Check for technical constraints
        if not any(term in description.lower() for term in ["use", "using", "implement", "with", "framework", "library"]):
            warnings.append(TaskWarning(
                message="Technical implementation details may be missing",
                reasoning="Consider specifying the technical approach, frameworks, or libraries to be used."
            ))
        
        return warnings

    async def _generate_llm_warnings(self, title: str, description: str) -> List[TaskWarning]:
        """
        Generate warnings using LLM analysis.
        
        Args:
            title: Task title
            description: Task description
            
        Returns:
            List of TaskWarning objects
        """
        system_prompt = f"""
You are an expert software development task reviewer. Your job is to analyze task descriptions and identify potential issues that could lead to problems during implementation.

## ANALYSIS CRITERIA

### 1. Programming Best Practices
- Error handling and edge cases
- Security considerations
- Performance implications
- Testing requirements
- Code maintainability and modularity

### 2. Assumption Checking
- Technical dependencies and requirements
- User behavior assumptions
- System state assumptions
- Data availability and format assumptions
- Integration point assumptions

### 3. Detail Sufficiency
- Implementation steps clarity
- Required inputs/outputs specification
- Success criteria definition
- Technical constraints identification
- Dependencies and prerequisites

## TASK TO ANALYZE
Title: {title}
Description: {description}

## INSTRUCTIONS
Analyze this task description and identify potential issues. For each issue found:

1. Create a clear, actionable warning message
2. Provide detailed reasoning explaining why this could be problematic
3. Focus on issues that could lead to implementation problems, bugs, or maintenance issues

## OUTPUT FORMAT
Return a JSON array of warnings. Each warning should have:
- "message": A concise warning message
- "reasoning": Detailed explanation of the potential issue

Example format:
```json
[
    {{
        "message": "Error handling not explicitly mentioned",
        "reasoning": "The task description should consider error cases and how to handle them to ensure robust implementation. Without explicit error handling, the system may fail unexpectedly or provide poor user experience."
    }},
    {{
        "message": "Testing requirements not specified",
        "reasoning": "Consider adding specific testing requirements or acceptance criteria to ensure quality. This helps verify the implementation works correctly and prevents regressions."
    }}
]
```

If no significant issues are found, return an empty array: []

IMPORTANT: Only return valid JSON. Do not include any other text or explanations outside the JSON array.
"""

        try:
            # Get LLM response
            response = await self.gemini_service.chat_with_system_prompt(
                f"Analyze this task: {title} - {description}", 
                system_prompt
            )
            
            # Parse JSON response
            warnings = self._parse_llm_response(response)
            return warnings
            
        except Exception as e:
            logger.error(f"Error generating LLM warnings: {e}")
            raise

    def _parse_llm_response(self, response: str) -> List[TaskWarning]:
        """
        Parse LLM response and extract warnings.
        
        Args:
            response: LLM response string
            
        Returns:
            List of TaskWarning objects
        """
        try:
            # Try to extract JSON from response
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                warnings_data = json.loads(json_str)
                
                warnings = []
                for warning_data in warnings_data:
                    if isinstance(warning_data, dict) and 'message' in warning_data and 'reasoning' in warning_data:
                        warnings.append(TaskWarning(
                            message=warning_data['message'],
                            reasoning=warning_data['reasoning']
                        ))
                
                return warnings
            else:
                logger.warning("No JSON array found in LLM response")
                return []
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return []
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return []

    def _fallback_heuristic_analysis(self, title: str, description: str) -> List[TaskWarning]:
        """
        Fallback to heuristic analysis if LLM fails.
        
        Args:
            title: Task title
            description: Task description
            
        Returns:
            List of TaskWarning objects
        """
        warnings = []
        
        # Analyze best practices
        best_practice_warnings = self._check_best_practices(title, description)
        warnings.extend(best_practice_warnings)
        
        # Check for assumptions
        assumption_warnings = self._check_assumptions(title, description)
        warnings.extend(assumption_warnings)
        
        # Evaluate detail sufficiency
        detail_warnings = self._check_detail_sufficiency(title, description)
        warnings.extend(detail_warnings)
        
        return warnings
