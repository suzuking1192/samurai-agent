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
from models import Memory, ChatMessage

logger = logging.getLogger(__name__)

class VectorContextService:
    """Service for vector-enhanced context retrieval and assembly."""
    
    def __init__(self):
        """Initialize the vector context service."""
        self.memory_similarity_threshold = 0.7
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
    
    def update_similarity_thresholds(
        self,
        memory_threshold: Optional[float] = None
    ) -> None:
        """
        Update similarity thresholds for fine-tuning.
        
        Args:
            memory_threshold: New memory similarity threshold (0-1)
        """
        if memory_threshold is not None and 0 <= memory_threshold <= 1:
            self.memory_similarity_threshold = memory_threshold
            logger.info(f"Updated memory similarity threshold to {memory_threshold}")
    
    def update_result_limits(
        self,
        max_memories: Optional[int] = None
    ) -> None:
        """
        Update maximum result limits.
        
        Args:
            max_memories: Maximum number of memory results
        """
        if max_memories is not None and max_memories > 0:
            self.max_memory_results = max_memories
            logger.info(f"Updated max memory results to {max_memories}")

# Global instance
vector_context_service = VectorContextService() 