"""
Vector-Enhanced Context Service

This service provides semantic similarity-based context retrieval using vector embeddings
for tasks, memories, and chat messages. It enhances the Samurai Agent's context awareness
by finding semantically relevant content rather than just keyword matches.
"""

import logging
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
import json

from .embedding_service import embedding_service
from models import Task, Memory, ChatMessage

logger = logging.getLogger(__name__)

class VectorContextService:
    """Service for vector-enhanced context retrieval and assembly."""
    
    def __init__(self):
        """Initialize the vector context service."""
        self.task_similarity_threshold = 0.7
        self.memory_similarity_threshold = 0.7
        self.max_task_results = 10
        self.max_memory_results = 15
        
    def get_conversation_context_embedding(
        self, 
        session_messages: List[ChatMessage], 
        new_user_message: str = ""
    ) -> Optional[List[float]]:
        """
        Generate embedding for the full conversation context.
        
        Args:
            session_messages: All messages from the current session
            new_user_message: New user message to include in context
            
        Returns:
            Embedding for the full conversation context
        """
        try:
            # Combine all messages into conversation text
            conversation_text = self._build_conversation_text(session_messages, new_user_message)
            
            if not conversation_text:
                return None
            
            # Generate embedding for the full conversation
            return embedding_service.generate_embedding(conversation_text)
            
        except Exception as e:
            logger.error(f"Error generating conversation context embedding: {e}")
            return None
    
    def find_relevant_tasks(
        self,
        conversation_embedding: List[float],
        all_tasks: List[Task],
        project_id: str
    ) -> List[Tuple[Task, float]]:
        """
        Find tasks relevant to the conversation context using vector similarity.
        
        Args:
            conversation_embedding: Embedding of the full conversation context
            all_tasks: All tasks in the project
            project_id: Project identifier
            
        Returns:
            List of tuples (task, similarity_score) sorted by relevance
        """
        if not conversation_embedding:
            return []
        
        try:
            # Filter tasks for the project and convert to dict format
            project_tasks = [
                {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status,
                    "priority": task.priority,
                    "embedding": task.embedding,
                    "embedding_text": task.embedding_text,
                    "created_at": task.created_at,
                    "updated_at": task.updated_at,
                    "completed": task.completed,
                    "task_object": task
                }
                for task in all_tasks
                if task.project_id == project_id and task.embedding
            ]
            
            # Find similar tasks
            similar_tasks = embedding_service.find_similar_items(
                query_embedding=conversation_embedding,
                items=project_tasks,
                similarity_threshold=self.task_similarity_threshold,
                max_results=self.max_task_results,
                embedding_field="embedding"
            )
            
            # Convert back to Task objects with similarity scores
            result = []
            for task_dict, similarity in similar_tasks:
                task_object = task_dict["task_object"]
                result.append((task_object, similarity))
            
            return result
            
        except Exception as e:
            logger.error(f"Error finding relevant tasks: {e}")
            return []
    
    def find_relevant_memories(
        self,
        conversation_embedding: List[float],
        all_memories: List[Memory],
        project_id: str
    ) -> List[Tuple[Memory, float]]:
        """
        Find memories relevant to the conversation context using vector similarity.
        
        Args:
            conversation_embedding: Embedding of the full conversation context
            all_memories: All memories in the project
            project_id: Project identifier
            
        Returns:
            List of tuples (memory, similarity_score) sorted by relevance
        """
        if not conversation_embedding:
            return []
        
        try:
            # Filter memories for the project and convert to dict format
            project_memories = [
                {
                    "id": memory.id,
                    "title": memory.title,
                    "content": memory.content,
                    "type": memory.type,
                    "category": memory.category,
                    "embedding": memory.embedding,
                    "embedding_text": memory.embedding_text,
                    "created_at": memory.created_at,
                    "session_id": memory.session_id,
                    "memory_object": memory
                }
                for memory in all_memories
                if memory.project_id == project_id and memory.embedding
            ]
            
            # Find similar memories
            similar_memories = embedding_service.find_similar_items(
                query_embedding=conversation_embedding,
                items=project_memories,
                similarity_threshold=self.memory_similarity_threshold,
                max_results=self.max_memory_results,
                embedding_field="embedding"
            )
            
            # Convert back to Memory objects with similarity scores
            result = []
            for memory_dict, similarity in similar_memories:
                memory_object = memory_dict["memory_object"]
                result.append((memory_object, similarity))
            
            return result
            
        except Exception as e:
            logger.error(f"Error finding relevant memories: {e}")
            return []
    
    def assemble_vector_context(
        self,
        session_messages: List[ChatMessage],
        relevant_tasks: List[Tuple[Task, float]],
        relevant_memories: List[Tuple[Memory, float]],
        new_user_message: str = "",
        task_context: Optional[Any] = None
    ) -> str:
        """
        Assemble comprehensive context for the AI agent using vector-enhanced retrieval.
        
        Args:
            session_messages: All messages from the current session
            relevant_tasks: Tasks found via vector similarity with scores
            relevant_memories: Memories found via vector similarity with scores
            new_user_message: New user message to include
            task_context: Optional task context to prioritize
            
        Returns:
            Formatted context string for the AI agent
        """
        try:
            context_parts = []
            
            # 0. Task Context (highest priority if provided)
            if task_context:
                context_parts.append("# 🎯 FOCUSED TASK CONTEXT")
                context_parts.append("**IMPORTANT**: The user has selected this specific task as the main context for our conversation.")
                context_parts.append("Your primary goal is to help refine and polish this task description for use in Cursor.")
                context_parts.append("")
                status_icon = "✅" if getattr(task_context, 'completed', False) else "⏸️"
                context_parts.append(f"**Active Task**: {status_icon} {task_context.title}")
                context_parts.append(f"**Description**: {task_context.description}")
                context_parts.append(f"**Status**: {getattr(task_context, 'status', 'pending')}")
                context_parts.append(f"**Priority**: {getattr(task_context, 'priority', 'medium')}")
                if hasattr(task_context, 'prompt') and task_context.prompt:
                    context_parts.append(f"**Current Prompt**: {task_context.prompt}")
                context_parts.append("")
                context_parts.append("**FOCUS**: Help the user create a refined, detailed task description that can be easily copied and pasted into Cursor.")
                context_parts.append("")
            
            # 1. Current Session Chat History (always included)
            context_parts.append("# Current Conversation Context")
            context_parts.append("## Chat History (Current Session)")
            
            # Add all session messages
            for msg in session_messages:
                role = "User" if msg.message else "Agent"
                content = msg.message or msg.response
                if content:
                    context_parts.append(f"**{role}**: {content}")
            
            # Add new user message if provided
            if new_user_message:
                context_parts.append(f"**User**: {new_user_message}")
            
            # 2. Relevant Tasks (sorted by similarity score)
            if relevant_tasks:
                context_parts.append("\n## Relevant Tasks")
                for task, similarity in relevant_tasks:
                    status_icon = "✅" if task.completed else "⏸️"
                    context_parts.append(f"**Task**: {status_icon} {task.title}")
                    context_parts.append(f"**Description**: {task.description}")
                    context_parts.append(f"**Status**: {task.status}")
                    context_parts.append(f"**Similarity**: {similarity:.3f}")
                    context_parts.append("")
            
            # 3. Relevant Memories (sorted by similarity score)
            if relevant_memories:
                context_parts.append("## Relevant Memory")
                for memory, similarity in relevant_memories:
                    context_parts.append(f"**Memory**: {memory.content}")
                    context_parts.append(f"**Type**: {memory.type}")
                    context_parts.append(f"**Category**: {memory.category}")
                    context_parts.append(f"**Similarity**: {similarity:.3f}")
                    context_parts.append("")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error assembling vector context: {e}")
            return "# Current Conversation Context\n## Chat History (Current Session)\nError assembling context."
    
    def _build_conversation_text(
        self, 
        session_messages: List[ChatMessage], 
        new_user_message: str = ""
    ) -> str:
        """
        Build conversation text for embedding generation.
        
        Args:
            session_messages: All messages from the current session
            new_user_message: New user message to include
            
        Returns:
            Combined conversation text
        """
        try:
            conversation_parts = []
            
            # Add all session messages
            for msg in session_messages:
                if msg.message:
                    conversation_parts.append(f"User: {msg.message}")
                if msg.response:
                    conversation_parts.append(f"Agent: {msg.response}")
            
            # Add new user message if provided
            if new_user_message:
                conversation_parts.append(f"User: {new_user_message}")
            
            # Combine all parts
            conversation_text = " ".join(conversation_parts)
            
            # Clean and prepare for embedding
            return embedding_service.prepare_text_for_embedding(conversation_text)
            
        except Exception as e:
            logger.error(f"Error building conversation text: {e}")
            return ""
    
    def get_vector_context_summary(
        self,
        session_messages: List[ChatMessage],
        relevant_tasks: List[Tuple[Task, float]],
        relevant_memories: List[Tuple[Memory, float]]
    ) -> Dict[str, Any]:
        """
        Get a summary of the vector context for debugging and monitoring.
        
        Args:
            session_messages: Session messages used
            relevant_tasks: Tasks found via vector similarity
            relevant_memories: Memories found via vector similarity
            
        Returns:
            Summary dictionary with context statistics
        """
        return {
            "session_messages_count": len(session_messages),
            "relevant_tasks_count": len(relevant_tasks),
            "relevant_memories_count": len(relevant_memories),
            "task_similarity_range": {
                "min": min([score for _, score in relevant_tasks]) if relevant_tasks else 0,
                "max": max([score for _, score in relevant_tasks]) if relevant_tasks else 0,
                "avg": sum([score for _, score in relevant_tasks]) / len(relevant_tasks) if relevant_tasks else 0
            },
            "memory_similarity_range": {
                "min": min([score for _, score in relevant_memories]) if relevant_memories else 0,
                "max": max([score for _, score in relevant_memories]) if relevant_memories else 0,
                "avg": sum([score for _, score in relevant_memories]) / len(relevant_memories) if relevant_memories else 0
            },
            "embedding_model_loaded": embedding_service.is_model_loaded(),
            "model_info": embedding_service.get_model_info()
        }
    
    def update_similarity_thresholds(
        self,
        task_threshold: Optional[float] = None,
        memory_threshold: Optional[float] = None
    ) -> None:
        """
        Update similarity thresholds for fine-tuning.
        
        Args:
            task_threshold: New task similarity threshold (0-1)
            memory_threshold: New memory similarity threshold (0-1)
        """
        if task_threshold is not None and 0 <= task_threshold <= 1:
            self.task_similarity_threshold = task_threshold
            logger.info(f"Updated task similarity threshold to {task_threshold}")
        
        if memory_threshold is not None and 0 <= memory_threshold <= 1:
            self.memory_similarity_threshold = memory_threshold
            logger.info(f"Updated memory similarity threshold to {memory_threshold}")
    
    def update_result_limits(
        self,
        max_tasks: Optional[int] = None,
        max_memories: Optional[int] = None
    ) -> None:
        """
        Update maximum result limits.
        
        Args:
            max_tasks: Maximum number of task results
            max_memories: Maximum number of memory results
        """
        if max_tasks is not None and max_tasks > 0:
            self.max_task_results = max_tasks
            logger.info(f"Updated max task results to {max_tasks}")
        
        if max_memories is not None and max_memories > 0:
            self.max_memory_results = max_memories
            logger.info(f"Updated max memory results to {max_memories}")

# Global instance
vector_context_service = VectorContextService() 