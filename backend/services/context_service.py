import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
from dataclasses import dataclass
from models import Memory, Task, Project

logger = logging.getLogger(__name__)

@dataclass
class ContextItem:
    """Represents a context item (memory or task) with relevance scoring."""
    id: str
    type: str  # 'memory' or 'task'
    content: str
    relevance_score: float
    source: Any  # Original Memory or Task object
    created_at: datetime
    project_id: str

class ContextSelectionService:
    """Service for efficient context selection using hybrid approach."""
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95
        )
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        
    def _normalize_text(self, text: str) -> str:
        """Normalize text for better matching."""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep important ones
        text = re.sub(r'[^\w\s\-\.]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords from text."""
        normalized = self._normalize_text(text)
        
        # Simple keyword extraction (can be enhanced with NLP libraries)
        words = normalized.split()
        
        # Filter out common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        }
        
        keywords = [word for word in words if len(word) > 2 and word not in stop_words]
        
        return keywords[:20]  # Limit to top 20 keywords
    
    def _calculate_keyword_similarity(self, text1: str, text2: str) -> float:
        """Calculate keyword-based similarity between two texts."""
        keywords1 = set(self._extract_keywords(text1))
        keywords2 = set(self._extract_keywords(text2))
        
        if not keywords1 or not keywords2:
            return 0.0
        
        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _calculate_recency_boost(self, created_at: datetime) -> float:
        """Calculate recency boost for items."""
        now = datetime.now()
        days_old = (now - created_at).days
        
        # Exponential decay: newer items get higher boost
        if days_old <= 1:
            return 1.0
        elif days_old <= 7:
            return 0.8
        elif days_old <= 30:
            return 0.6
        elif days_old <= 90:
            return 0.4
        else:
            return 0.2
    
    def _calculate_project_relevance(self, item_project_id: str, current_project_id: str) -> float:
        """Calculate project relevance boost."""
        return 1.0 if item_project_id == current_project_id else 0.3
    
    def _calculate_task_status_boost(self, task: Task) -> float:
        """Calculate boost based on task status."""
        if task.status == "in_progress":
            return 1.2  # Active tasks are more relevant
        elif task.status == "completed":
            return 0.7  # Completed tasks are less relevant
        else:
            return 1.0  # Pending tasks are neutral
    
    def _calculate_memory_type_boost(self, memory: Memory) -> float:
        """Calculate boost based on memory type."""
        type_boosts = {
            "decision": 1.3,  # Decisions are most important
            "context": 1.1,   # Context is somewhat important
            "note": 1.0,      # Notes are neutral
        }
        return type_boosts.get(memory.type, 1.0)
    
    def calculate_relevance_score(
        self, 
        item: ContextItem, 
        user_input: str, 
        current_project_id: str
    ) -> float:
        """Calculate comprehensive relevance score for a context item."""
        score = 0.0
        
        # 1. Keyword similarity (30% weight)
        keyword_sim = self._calculate_keyword_similarity(user_input, item.content)
        score += keyword_sim * 0.3
        
        # 2. TF-IDF cosine similarity (40% weight)
        try:
            # Create TF-IDF vectors for comparison
            texts = [self._normalize_text(user_input), self._normalize_text(item.content)]
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            score += cosine_sim * 0.4
        except Exception as e:
            logger.warning(f"Error calculating TF-IDF similarity: {e}")
            # Fallback to keyword similarity
            score += keyword_sim * 0.4
        
        # 3. Recency boost (15% weight)
        recency_boost = self._calculate_recency_boost(item.created_at)
        score += recency_boost * 0.15
        
        # 4. Project relevance (10% weight)
        project_relevance = self._calculate_project_relevance(item.project_id, current_project_id)
        score += project_relevance * 0.1
        
        # 5. Type-specific boost (5% weight)
        if item.type == 'task':
            task_boost = self._calculate_task_status_boost(item.source)
            score += task_boost * 0.05
        elif item.type == 'memory':
            memory_boost = self._calculate_memory_type_boost(item.source)
            score += memory_boost * 0.05
        
        return min(score, 1.0)  # Cap at 1.0
    
    def select_relevant_context(
        self,
        user_input: str,
        project_id: str,
        memories: List[Memory],
        tasks: List[Task],
        max_items: int = 10,
        min_score: float = 0.1
    ) -> Tuple[List[Memory], List[Task]]:
        """Select relevant memories and tasks for the given user input."""
        
        # Create context items from memories and tasks
        context_items = []
        
        # Add memories
        for memory in memories:
            context_item = ContextItem(
                id=memory.id,
                type='memory',
                content=memory.content,
                relevance_score=0.0,
                source=memory,
                created_at=memory.created_at,
                project_id=memory.project_id
            )
            context_items.append(context_item)
        
        # Add tasks
        for task in tasks:
            # Combine title and description for better matching
            task_content = f"{task.title} {task.description}"
            context_item = ContextItem(
                id=task.id,
                type='task',
                content=task_content,
                relevance_score=0.0,
                source=task,
                created_at=task.created_at,
                project_id=task.project_id
            )
            context_items.append(context_item)
        
        # Calculate relevance scores
        for item in context_items:
            item.relevance_score = self.calculate_relevance_score(
                item, user_input, project_id
            )
        
        # Sort by relevance score and filter by minimum score
        relevant_items = [
            item for item in context_items 
            if item.relevance_score >= min_score
        ]
        relevant_items.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # Take top items
        top_items = relevant_items[:max_items]
        
        # Separate memories and tasks
        relevant_memories = [
            item.source for item in top_items 
            if item.type == 'memory'
        ]
        relevant_tasks = [
            item.source for item in top_items 
            if item.type == 'task'
        ]
        
        logger.info(f"Selected {len(relevant_memories)} memories and {len(relevant_tasks)} tasks for context")
        
        return relevant_memories, relevant_tasks
    
    def get_hierarchical_context(
        self,
        user_input: str,
        project_id: str,
        memories: List[Memory],
        tasks: List[Task],
        max_total_items: int = 15
    ) -> Tuple[List[Memory], List[Task]]:
        """Get context using hierarchical selection approach."""
        
        # Tier 1: Always include recent and high-priority items
        tier1_memories = []
        tier1_tasks = []
        
        # Recent memories (last 7 days)
        week_ago = datetime.now() - timedelta(days=7)
        for memory in memories:
            if memory.created_at >= week_ago:
                tier1_memories.append(memory)
        
        # Active tasks
        for task in tasks:
            if task.status == "in_progress":
                tier1_tasks.append(task)
        
        # Tier 2: Similarity-based selection
        remaining_memories = [m for m in memories if m not in tier1_memories]
        remaining_tasks = [t for t in tasks if t not in tier1_tasks]
        
        tier2_memories, tier2_tasks = self.select_relevant_context(
            user_input, project_id, remaining_memories, remaining_tasks,
            max_items=max_total_items - len(tier1_memories) - len(tier1_tasks)
        )
        
        # Combine tiers
        all_memories = tier1_memories + tier2_memories
        all_tasks = tier1_tasks + tier2_tasks
        
        # Limit total items
        if len(all_memories) + len(all_tasks) > max_total_items:
            # Prioritize memories over tasks if we need to cut
            excess = len(all_memories) + len(all_tasks) - max_total_items
            if len(all_tasks) >= excess:
                all_tasks = all_tasks[:-excess]
            else:
                all_tasks = []
                all_memories = all_memories[:max_total_items]
        
        logger.info(f"Hierarchical context: {len(all_memories)} memories, {len(all_tasks)} tasks")
        
        return all_memories, all_tasks
    
    def format_context_for_prompt(
        self,
        memories: List[Memory],
        tasks: List[Task],
        project: Project
    ) -> str:
        """Format selected context into a prompt-friendly string."""
        
        context_parts = []
        
        # Project context
        context_parts.append(f"Project: {project.name}")
        context_parts.append(f"Description: {project.description}")
        context_parts.append(f"Tech Stack: {project.tech_stack}")
        context_parts.append("")
        
        # Relevant memories
        if memories:
            context_parts.append("Relevant Memories:")
            for i, memory in enumerate(memories, 1):
                context_parts.append(f"{i}. [{memory.type.upper()}] {memory.content}")
            context_parts.append("")
        
        # Relevant tasks
        if tasks:
            context_parts.append("Relevant Tasks:")
            for i, task in enumerate(tasks, 1):
                status_emoji = {
                    "pending": "⏳",
                    "in_progress": "🔄", 
                    "completed": "✅"
                }.get(task.status, "📋")
                
                context_parts.append(
                    f"{i}. {status_emoji} {task.title} - {task.description}"
                )
            context_parts.append("")
        
        return "\n".join(context_parts)


# Global instance
context_service = ContextSelectionService() 