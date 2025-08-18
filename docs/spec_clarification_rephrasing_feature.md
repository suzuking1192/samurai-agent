# Spec Clarification Rephrasing Feature

## Overview

The Samurai Agent now has the ability to intelligently rephrase codebase-answerable questions within `spec_clarification` responses. This feature enhances the agent's ability to ask more informed, codebase-aware questions during specification gathering.

## Feature Description

When the UnifiedSamuraiAgent generates a `spec_clarification` response, it now:

1. **Identifies codebase-relevant questions** in the response using LLM analysis
2. **Looks up answers** in the connected codebase using the Agent Code Context Extraction Tool
3. **Rephrases questions** into confirmation statements when relevant code is found
4. **Preserves original questions** when no relevant code is found or when errors occur

## Implementation Details

### Core Components

#### 1. Main Processing Method
- **File**: `backend/services/unified_samurai_agent.py`
- **Method**: `_process_spec_clarification_response(chat_response, conversation_context)`
- **Trigger**: Called automatically when `user_intent == "spec_clarification"`

#### 2. Question Identification
- **Method**: `_identify_codebase_relevant_questions(chat_response)`
- **Purpose**: Uses LLM to identify questions that ask about current code implementation
- **Output**: List of questions with their character positions in the original text

#### 3. Individual Question Processing
- **Method**: `_process_individual_question(question, conversation_context)`
- **Purpose**: For each identified question, calls the code context extraction tool
- **Integration**: Uses `AgentCodeContextExtractionTool` to find relevant code

#### 4. Question Rephrasing
- **Method**: `_rephrase_question_with_context(original_question, context, relevant_code, file_path)`
- **Purpose**: Uses LLM to convert questions into confirmation statements
- **Format**: "Is it correct that..." or "Does [file] contain..." style questions

### Flow Diagram

```
User Message → Intent Analysis → spec_clarification → Generate Initial Response
                                                           ↓
                                                    Process Response
                                                           ↓
                                              Identify Codebase Questions
                                                           ↓
                                              For each question:
                                              ↓
                                    Extract Code Context
                                              ↓
                                    Rephrase Question
                                              ↓
                                    Build Final Response
                                              ↓
                                              Return to User
```

## Example Usage

### Before (Original Response)
```
Thanks for the clarification! Now I need to understand your current implementation:

1. How is user authentication currently implemented in your codebase?
2. What database are you using for user storage?
3. Do you want to support social login providers?

This will help me create the most appropriate tasks for your authentication feature.
```

### After (Rephrased Response)
```
Thanks for the clarification! Now I need to understand your current implementation:

1. Is it correct that you have JWT-based authentication with token validation in services/auth.py?
2. Is it correct that you're using PostgreSQL with a User table in models/user.py?
3. Do you want to support social login providers?

This will help me create the most appropriate tasks for your authentication feature.
```

## Error Handling

The feature includes comprehensive error handling:

1. **LLM Errors**: Falls back to original questions if LLM calls fail
2. **Code Context Errors**: Preserves original questions if code extraction fails
3. **Missing Codebase Path**: Returns original questions if no codebase is connected
4. **Invalid Rephrasing**: Validates rephrased questions and falls back if they're too short/long

## Configuration

### Requirements
- Connected codebase path in project context
- Valid Gemini API key
- Agent Code Context Extraction Tool available

### Performance Considerations
- Uses fewer iterations (max_iterations=2) for code context extraction to maintain efficiency
- Processes questions sequentially to avoid overwhelming the codebase
- Validates rephrased questions to ensure quality

## Testing

### Test Coverage
- **Unit Tests**: `backend/tests/test_spec_clarification_rephrasing.py`
- **Integration Tests**: `backend/tests/test_spec_clarification_rephrasing_integration.py`

### Test Scenarios
1. **Successful rephrasing** when code context is found
2. **Partial rephrasing** when only some questions have code context
3. **No rephrasing** when no codebase-relevant questions are identified
4. **Error handling** when LLM or code extraction fails
5. **Edge cases** like missing codebase paths or invalid responses

## Benefits

1. **More Informed Questions**: Agent asks questions based on actual codebase knowledge
2. **Reduced Redundancy**: Avoids asking questions that can be answered from the code
3. **Better User Experience**: Users receive more specific, actionable questions
4. **Improved Efficiency**: Faster specification gathering through codebase awareness
5. **Graceful Degradation**: Falls back to original behavior when code context is unavailable

## Future Enhancements

Potential improvements for future iterations:

1. **Caching**: Cache code context results to avoid repeated extractions
2. **Batch Processing**: Process multiple questions in parallel for better performance
3. **Context Awareness**: Consider conversation history when rephrasing questions
4. **Customization**: Allow users to configure rephrasing behavior
5. **Metrics**: Track rephrasing success rates and user satisfaction

## Technical Notes

### Dependencies
- `UnifiedSamuraiAgent` - Main agent class
- `AgentCodeContextExtractionTool` - Code context extraction
- `GeminiService` - LLM interactions
- `ConversationContext` - Context management

### Integration Points
- Integrated into the existing `_handle_spec_clarification` method
- Uses existing tool registry for code context extraction
- Maintains backward compatibility with existing functionality

### Security Considerations
- No sensitive code information is exposed beyond the rephrased questions
- All LLM interactions use existing security measures
- Error handling prevents information leakage
