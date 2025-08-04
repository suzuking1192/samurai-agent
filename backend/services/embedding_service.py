"""
Embedding Service for Vector-Enhanced Context Engineering

This service provides local embedding generation using sentence-transformers
and vector similarity search for tasks, memories, and chat messages.
"""

import logging
import numpy as np
from typing import List, Dict, Optional, Tuple, Any
from sentence_transformers import SentenceTransformer
import os
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings and performing vector similarity search."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the embedding service with a local model.
        
        Args:
            model_name: Name of the sentence-transformers model to use
        """
        self.model_name = model_name
        self.model = None
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self) -> None:
        """Load the sentence transformer model."""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            self.model_loaded = True
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.model_loaded = False
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for a given text.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of floats representing the embedding, or None if failed
        """
        if not self.model_loaded or not text:
            return None
        
        try:
            # Clean and normalize text
            cleaned_text = self._clean_text(text)
            if not cleaned_text:
                return None
            
            # Generate embedding
            embedding = self.model.encode(cleaned_text, convert_to_tensor=False)
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts in batch.
        
        Args:
            texts: List of texts to generate embeddings for
            
        Returns:
            List of embeddings (some may be None if generation failed)
        """
        if not self.model_loaded:
            return [None] * len(texts)
        
        try:
            # Clean texts
            cleaned_texts = [self._clean_text(text) for text in texts]
            valid_texts = [(i, text) for i, text in enumerate(cleaned_texts) if text]
            
            if not valid_texts:
                return [None] * len(texts)
            
            # Generate embeddings for valid texts
            indices, valid_text_list = zip(*valid_texts)
            embeddings = self.model.encode(valid_text_list, convert_to_tensor=False)
            
            # Create result list with None for invalid texts
            result = [None] * len(texts)
            for idx, embedding in zip(indices, embeddings):
                result[idx] = embedding.tolist()
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            return [None] * len(texts)
    
    def calculate_cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Calculate cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score between 0 and 1
        """
        try:
            if not embedding1 or not embedding2:
                return 0.0
            
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    def find_similar_items(
        self,
        query_embedding: List[float],
        items: List[Dict[str, Any]],
        similarity_threshold: float = 0.7,
        max_results: int = 10,
        embedding_field: str = "embedding"
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Find items similar to the query embedding.
        
        Args:
            query_embedding: Query embedding to compare against
            items: List of items to search through
            similarity_threshold: Minimum similarity score (0-1)
            max_results: Maximum number of results to return
            embedding_field: Field name containing the embedding
            
        Returns:
            List of tuples (item, similarity_score) sorted by similarity
        """
        if not query_embedding:
            return []
        
        similar_items = []
        
        for item in items:
            item_embedding = item.get(embedding_field)
            if not item_embedding:
                continue
            
            similarity = self.calculate_cosine_similarity(query_embedding, item_embedding)
            
            if similarity >= similarity_threshold:
                similar_items.append((item, similarity))
        
        # Sort by similarity score (highest first)
        similar_items.sort(key=lambda x: x[1], reverse=True)
        
        # Return top results
        return similar_items[:max_results]
    
    def prepare_text_for_embedding(self, text: str, max_length: int = 512) -> str:
        """
        Prepare text for embedding generation.
        
        Args:
            text: Raw text to prepare
            max_length: Maximum length of text (characters)
            
        Returns:
            Prepared text suitable for embedding
        """
        if not text:
            return ""
        
        # Clean text
        cleaned = self._clean_text(text)
        
        # Truncate if too long
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length].rsplit(' ', 1)[0]  # Don't cut words
        
        return cleaned
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text for embedding.
        
        Args:
            text: Raw text to clean
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Convert to string if needed
        text = str(text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        # Remove special characters that might interfere with embedding
        # Keep alphanumeric, spaces, and common punctuation
        import re
        text = re.sub(r'[^\w\s\.\,\!\?\-\_\:\;\(\)\[\]\{\}]', ' ', text)
        
        # Remove extra whitespace again
        text = ' '.join(text.split())
        
        return text.strip()
    
    def is_model_loaded(self) -> bool:
        """Check if the embedding model is loaded."""
        return self.model_loaded
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        if not self.model_loaded:
            return {"loaded": False, "model_name": self.model_name}
        
        return {
            "loaded": True,
            "model_name": self.model_name,
            "max_seq_length": getattr(self.model, 'max_seq_length', 'unknown'),
            "embedding_dimension": getattr(self.model, 'get_sentence_embedding_dimension', lambda: 'unknown')()
        }

# Global instance
embedding_service = EmbeddingService() 