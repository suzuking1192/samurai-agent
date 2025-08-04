# Vector-Enhanced Context Engineering for Samurai Agent

## Overview

The Vector-Enhanced Context Engineering system significantly improves the Samurai Agent's context awareness by using semantic similarity-based retrieval instead of simple keyword matching. This system enables the AI agent to understand the full conversation context and find semantically relevant tasks and memories.

## Key Features

### 🧠 **Semantic Understanding**
- Uses local sentence-transformers model for embedding generation
- Captures semantic meaning, not just keyword matches
- Understands context shifts and conversation flow

### 🔍 **Full Conversation Context**
- Processes entire session conversation history
- Generates embeddings for complete conversation context
- Finds relevant content based on conversation meaning

### 📊 **Vector Similarity Search**
- Cosine similarity-based retrieval for tasks and memories
- Configurable similarity thresholds and result limits
- Prioritizes semantically relevant content

### 🛡️ **Graceful Fallback**
- Falls back to existing keyword-based methods if embeddings fail
- Maintains system reliability even with embedding issues
- Comprehensive error handling and logging

## Architecture

### Core Components

1. **EmbeddingService** (`services/embedding_service.py`)
   - Local sentence-transformers model integration
   - Text preprocessing and normalization
   - Batch embedding generation
   - Cosine similarity calculation

2. **VectorContextService** (`services/vector_context_service.py`)
   - Conversation context embedding generation
   - Semantic similarity search for tasks and memories
   - Context assembly and formatting
   - Configuration management

3. **Enhanced FileService** (`services/file_service.py`)
   - Automatic embedding generation for new content
   - Embedding storage in JSON data structures
   - Backward compatibility with existing data

4. **Updated AI Agent** (`services/ai_agent.py`)
   - Vector-enhanced context processing
   - Fallback to existing methods
   - Comprehensive context assembly

## Data Model Updates

### Task Structure
```json
{
  "id": "task_uuid",
  "title": "string",
  "description": "string",
  "status": "pending|in_progress|completed",
  "created_at": "timestamp",
  "embedding": [0.123, -0.456, 0.789, ...],
  "embedding_text": "concatenated text used for embedding"
}
```

### Memory Structure
```json
{
  "id": "memory_uuid",
  "content": "string",
  "type": "context|decision|code_snippet|requirement|other",
  "created_at": "timestamp",
  "session_id": "session_uuid",
  "embedding": [0.123, -0.456, 0.789, ...],
  "embedding_text": "content text used for embedding"
}
```

### Chat Message Structure
```json
{
  "id": "message_uuid",
  "project_id": "project_uuid",
  "session_id": "session_uuid",
  "message": "user message",
  "response": "ai response",
  "created_at": "timestamp",
  "embedding": [0.123, -0.456, 0.789, ...],
  "embedding_text": "combined message text"
}
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

The system automatically installs `sentence-transformers` which will download the embedding model on first use.

### 2. Run Migration (for existing data)
```bash
python migrate_to_vector_embeddings.py
```

This will generate embeddings for all existing tasks, memories, and chat messages.

### 3. Test the System
```bash
python test_vector_context.py
```

This runs comprehensive tests to verify the system is working correctly.

## Configuration

### Similarity Thresholds
```python
# In vector_context_service.py
self.task_similarity_threshold = 0.7    # Minimum similarity for tasks
self.memory_similarity_threshold = 0.7  # Minimum similarity for memories
```

### Result Limits
```python
self.max_task_results = 10      # Maximum tasks to return
self.max_memory_results = 15    # Maximum memories to return
```

### Embedding Model
```python
# In embedding_service.py
model_name = "all-MiniLM-L6-v2"  # Default model
```

## Usage Examples

### Basic Context Retrieval
```python
from services.vector_context_service import vector_context_service
from services.file_service import FileService

# Get session messages
file_service = FileService()
session_messages = file_service.load_chat_messages_by_session(project_id, session_id)

# Generate conversation embedding
conversation_embedding = vector_context_service.get_conversation_context_embedding(
    session_messages, "How do I handle token expiration?"
)

# Find relevant tasks and memories
all_tasks = file_service.load_tasks(project_id)
all_memories = file_service.load_memories(project_id)

relevant_tasks = vector_context_service.find_relevant_tasks(
    conversation_embedding, all_tasks, project_id
)

relevant_memories = vector_context_service.find_relevant_memories(
    conversation_embedding, all_memories, project_id
)

# Assemble context
context = vector_context_service.assemble_vector_context(
    session_messages, relevant_tasks, relevant_memories, "How do I handle token expiration?"
)
```

### AI Agent Integration
```python
from services.ai_agent import SamuraiAgent

agent = SamuraiAgent()

# Process message with vector-enhanced context
response = await agent.process_message(
    message="How do I handle token expiration?",
    project_id="project_uuid",
    project_context=project_dict,
    session_id="session_uuid"
)

# Response includes vector context summary
print(response["vector_context_summary"])
```

## Context Assembly Process

### 1. Conversation Context Generation
- Combines all session messages + new user message
- Generates embedding for full conversation context
- Handles conversation flow and context shifts

### 2. Semantic Similarity Search
- Calculates cosine similarity between conversation embedding and all task/memory embeddings
- Filters results by similarity threshold
- Sorts by relevance score (highest first)

### 3. Context Assembly
```
# Current Conversation Context
## Chat History (Current Session)
**User**: I need to implement user authentication
**Agent**: I'll help you create a user authentication system with JWT tokens.
**User**: What about password hashing?
**Agent**: You should use bcrypt for password hashing. Here's how to implement it...
**User**: How do I handle token expiration?

## Relevant Tasks
**Task**: ⏸️ Implement User Authentication
**Description**: Create login and registration system with JWT tokens and bcrypt password hashing
**Status**: in_progress
**Similarity**: 0.892

## Relevant Memory
**Memory**: Using JWT tokens for authentication with bcrypt for password hashing. Tokens expire after 24 hours.
**Type**: decision
**Category**: security
**Similarity**: 0.856
```

## Performance Considerations

### Embedding Generation
- **Model Loading**: ~100MB model downloaded on first use
- **Generation Speed**: ~50-100ms per embedding
- **Memory Usage**: ~200MB for model in memory

### Similarity Search
- **Search Speed**: Linear time O(n) where n = number of items
- **Memory Usage**: ~1KB per embedding vector
- **Scalability**: Suitable for projects with thousands of items

### Optimization Strategies
- **Batch Processing**: Generate multiple embeddings simultaneously
- **Caching**: Embeddings stored in JSON files
- **Lazy Loading**: Embeddings generated on-demand

## Error Handling

### Embedding Generation Failures
- Graceful fallback to existing keyword-based methods
- Logging of specific failure reasons
- Continued system operation without embeddings

### Model Loading Issues
- Clear error messages for missing dependencies
- Fallback to basic context retrieval
- Automatic retry mechanisms

### Data Corruption
- Validation of embedding data structures
- Automatic regeneration of corrupted embeddings
- Backup and recovery procedures

## Monitoring & Debugging

### Context Summary
```python
summary = vector_context_service.get_vector_context_summary(
    session_messages, relevant_tasks, relevant_memories
)

# Returns:
{
    "session_messages_count": 5,
    "relevant_tasks_count": 3,
    "relevant_memories_count": 2,
    "task_similarity_range": {
        "min": 0.712,
        "max": 0.892,
        "avg": 0.801
    },
    "memory_similarity_range": {
        "min": 0.756,
        "max": 0.856,
        "avg": 0.806
    },
    "embedding_model_loaded": true,
    "model_info": {
        "model_name": "all-MiniLM-L6-v2",
        "embedding_dimension": 384
    }
}
```

### Logging
```python
import logging
logging.getLogger("services.embedding_service").setLevel(logging.DEBUG)
logging.getLogger("services.vector_context_service").setLevel(logging.DEBUG)
```

## Troubleshooting

### Common Issues

1. **Model Download Fails**
   - Check internet connection
   - Verify disk space (need ~100MB)
   - Try manual download: `python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"`

2. **Low Similarity Scores**
   - Adjust similarity thresholds
   - Check embedding generation quality
   - Verify text preprocessing

3. **Performance Issues**
   - Reduce batch sizes
   - Implement caching
   - Consider model optimization

4. **Memory Issues**
   - Monitor embedding storage size
   - Implement cleanup procedures
   - Consider vector database for large datasets

## Future Enhancements

### Planned Features
- **Cross-session similarity search**
- **Dynamic similarity threshold adjustment**
- **Embedding model fine-tuning**
- **Vector database integration**
- **Context relevance scoring optimization**

### Performance Improvements
- **GPU acceleration for embedding generation**
- **Indexed similarity search**
- **Embedding compression**
- **Distributed processing**

## API Reference

### EmbeddingService
```python
# Generate single embedding
embedding = embedding_service.generate_embedding("text")

# Generate batch embeddings
embeddings = embedding_service.generate_embeddings_batch(["text1", "text2"])

# Calculate similarity
similarity = embedding_service.calculate_cosine_similarity(embedding1, embedding2)

# Find similar items
similar_items = embedding_service.find_similar_items(
    query_embedding, items, threshold=0.7, max_results=10
)
```

### VectorContextService
```python
# Generate conversation embedding
embedding = vector_context_service.get_conversation_context_embedding(
    session_messages, new_message
)

# Find relevant tasks/memories
tasks = vector_context_service.find_relevant_tasks(embedding, all_tasks, project_id)
memories = vector_context_service.find_relevant_memories(embedding, all_memories, project_id)

# Assemble context
context = vector_context_service.assemble_vector_context(
    session_messages, tasks, memories, new_message
)

# Get summary
summary = vector_context_service.get_vector_context_summary(
    session_messages, tasks, memories
)
```

## Contributing

When contributing to the vector context system:

1. **Test thoroughly** with `test_vector_context.py`
2. **Update documentation** for new features
3. **Maintain backward compatibility**
4. **Add comprehensive error handling**
5. **Follow performance best practices**

## License

This system is part of the Samurai Agent project and follows the same licensing terms. 