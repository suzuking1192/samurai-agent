"""
Intelligent Memory Consolidation Service

This service analyzes completed conversation sessions and consolidates insights
into existing project memories before starting a fresh session.
"""

import json
import logging
from typing import List, Dict, Any, Optional, Set
from datetime import datetime
from dataclasses import dataclass

from models import ChatMessage, Memory, Project, MemoryCategory, CATEGORY_CONFIG
from services.gemini_service import GeminiService
from services.file_service import FileService

# Configuration constants
MIN_SESSION_LENGTH = 3  # messages to trigger consolidation
MIN_SIGNIFICANCE_SCORE = 0.7  # for insight extraction
MIN_RELEVANCE_SCORE = 0.5  # for session relevance to project
MEMORY_MERGE_THRESHOLD = 0.5  # similarity score to merge
NEW_MEMORY_THRESHOLD = 0.8  # significance needed for new memory
MAX_CATEGORY_NAME_LENGTH = 30

logger = logging.getLogger(__name__)


@dataclass
class ConversationInsight:
    """Represents an insight extracted from conversation analysis."""
    content: str
    category: str
    is_new_category: bool
    new_category_suggestion: Optional[str]
    significance_score: float
    insight_type: str  # decision|specification|pattern|requirement
    related_keywords: List[str]


@dataclass
class SessionAnalysis:
    """Results from analyzing a complete session."""
    insights: List[ConversationInsight]
    session_relevance_score: float
    suggested_new_categories: List[Dict[str, str]]
    total_insights_found: int
    total_insights_processed: int


@dataclass
class CategoryProcessingResult:
    """Results from processing insights for a specific category."""
    category: str
    memories_updated: int
    memories_created: int
    insights_processed: int
    is_new_category: bool = False


@dataclass
class MemoryConsolidationResult:
    """Complete results from memory consolidation process."""
    status: str  # completed|skipped_too_short|no_relevant_insights
    total_insights_processed: int
    total_insights_skipped: int
    categories_affected: List[CategoryProcessingResult]
    new_categories_created: List[str]
    total_memories_affected: int
    session_relevance: float


class IntelligentMemoryConsolidationService:
    """Service for intelligent memory consolidation on session end."""

    def __init__(self):
        self.gemini_service = GeminiService()
        self.file_service = FileService()
        logger.info("IntelligentMemoryConsolidationService initialized")

    async def consolidate_session_memories(
        self,
        project_id: str,
        session_id: str,
        project_context: Dict[str, Any]
    ) -> MemoryConsolidationResult:
        """
        Main entry point for consolidating session memories.
        
        Args:
            project_id: Project identifier
            session_id: Session identifier for completed conversation
            project_context: Project context including name, tech_stack, etc.
            
        Returns:
            MemoryConsolidationResult with detailed consolidation results
        """
        try:
            logger.info(f"Starting memory consolidation for session {session_id}")
            
            # Step 1: Load session messages
            session_messages = self.file_service.load_chat_messages_by_session(project_id, session_id)
            
            # Step 2: Check if session is long enough for consolidation
            if len(session_messages) < MIN_SESSION_LENGTH:
                logger.info(f"Session too short ({len(session_messages)} messages), skipping consolidation")
                return MemoryConsolidationResult(
                    status="skipped_too_short",
                    total_insights_processed=0,
                    total_insights_skipped=0,
                    categories_affected=[],
                    new_categories_created=[],
                    total_memories_affected=0,
                    session_relevance=0.0
                )
            
            # Step 3: Analyze conversation for insights
            session_analysis = await self._analyze_conversation_for_insights(
                session_messages, project_context
            )
            
            # Step 4: Check session relevance
            if session_analysis.session_relevance_score < MIN_RELEVANCE_SCORE:
                logger.info(f"Session relevance too low ({session_analysis.session_relevance_score}), skipping consolidation")
                return MemoryConsolidationResult(
                    status="no_relevant_insights",
                    total_insights_processed=0,
                    total_insights_skipped=len(session_analysis.insights),
                    categories_affected=[],
                    new_categories_created=[],
                    total_memories_affected=0,
                    session_relevance=session_analysis.session_relevance_score
                )
            
            # Step 5: Process insights for all categories
            category_results = await self._process_multi_category_insights(
                session_analysis.insights, project_id
            )
            
            # Step 6: Calculate final results
            total_memories_affected = sum(
                r.memories_updated + r.memories_created for r in category_results
            )
            new_categories_created = [
                r.category for r in category_results if r.is_new_category
            ]
            
            logger.info(
                f"Memory consolidation completed: {len(category_results)} categories affected, "
                f"{total_memories_affected} memories affected"
            )
            
            return MemoryConsolidationResult(
                status="completed",
                total_insights_processed=session_analysis.total_insights_processed,
                total_insights_skipped=session_analysis.total_insights_found - session_analysis.total_insights_processed,
                categories_affected=category_results,
                new_categories_created=new_categories_created,
                total_memories_affected=total_memories_affected,
                session_relevance=session_analysis.session_relevance_score
            )
            
        except Exception as e:
            logger.error(f"Error in memory consolidation: {e}")
            return MemoryConsolidationResult(
                status="error",
                total_insights_processed=0,
                total_insights_skipped=0,
                categories_affected=[],
                new_categories_created=[],
                total_memories_affected=0,
                session_relevance=0.0
            )

    async def _analyze_conversation_for_insights(
        self, 
        session_messages: List[ChatMessage], 
        project_context: Dict[str, Any]
    ) -> SessionAnalysis:
        """
        Analyze conversation to extract significant project-relevant insights.
        
        Args:
            session_messages: List of chat messages from the session
            project_context: Project context including name, tech_stack
            
        Returns:
            SessionAnalysis with extracted insights and metadata
        """
        try:
            # Build conversation text
            conversation_text = self._build_session_conversation_text(session_messages)
            
            # Get existing categories for reference
            existing_categories = [cat.value for cat in MemoryCategory]
            existing_categories_str = ", ".join(existing_categories)
            
            # Create analysis prompt
            analysis_prompt = f"""
Analyze this development conversation and extract ONLY significant, project-relevant insights.

PROJECT: {project_context.get('name', 'Unknown')}
TECH STACK: {project_context.get('tech_stack', 'Unknown')}

CONVERSATION:
{conversation_text}

Extract insights that are:
1. **Significant decisions** made about the project
2. **Important specifications** clarified or defined  
3. **Technical choices** that affect future development
4. **Feature requirements** that were solidified
5. **Architecture decisions** or patterns established

Do NOT extract:
- General chat or greetings
- Temporary task management discussions
- Questions without clear answers/decisions
- Conversations that didn't lead to concrete outcomes

EXISTING CATEGORIES: {existing_categories_str}

For each insight, categorize using the existing categories above.
If the insight doesn't fit existing categories well, mark is_new_category: true and suggest an appropriate new category.

Return JSON:
{{
    "insights": [
        {{
            "content": "Detailed insight content",
            "category": "frontend|backend|database|security|etc",
            "is_new_category": false,
            "new_category_suggestion": null,
            "significance_score": 0.0-1.0,
            "insight_type": "decision|specification|pattern|requirement",
            "related_keywords": ["keyword1", "keyword2"]
        }}
    ],
    "session_relevance_score": 0.0-1.0,
    "suggested_new_categories": [
        {{
            "name": "suggested_category_name",
            "description": "What this category would represent",
            "justification": "Why this category is needed"
        }}
    ]
}}

Only include insights with significance_score > {MIN_SIGNIFICANCE_SCORE}
Set session_relevance_score to how relevant this entire conversation was to the project.
Set is_new_category: true and provide new_category_suggestion if insight doesn't fit existing categories well.
"""
            
            # Get LLM analysis
            response = await self.gemini_service.chat_with_system_prompt(
                "Please analyze this conversation and extract project insights as JSON.",
                analysis_prompt
            )
            
            # Parse response
            analysis_data = self._parse_analysis_response(response)
            
            # Convert to structured insights
            insights = []
            for insight_data in analysis_data.get("insights", []):
                insight = ConversationInsight(
                    content=insight_data.get("content", ""),
                    category=insight_data.get("category", "general"),
                    is_new_category=insight_data.get("is_new_category", False),
                    new_category_suggestion=insight_data.get("new_category_suggestion"),
                    significance_score=insight_data.get("significance_score", 0.0),
                    insight_type=insight_data.get("insight_type", "note"),
                    related_keywords=insight_data.get("related_keywords", [])
                )
                insights.append(insight)
            
            # Filter insights by significance score
            filtered_insights = [
                i for i in insights if i.significance_score >= MIN_SIGNIFICANCE_SCORE
            ]
            
            logger.info(
                f"Extracted {len(filtered_insights)} significant insights "
                f"from {len(insights)} total insights"
            )
            
            return SessionAnalysis(
                insights=filtered_insights,
                session_relevance_score=analysis_data.get("session_relevance_score", 0.0),
                suggested_new_categories=analysis_data.get("suggested_new_categories", []),
                total_insights_found=len(insights),
                total_insights_processed=len(filtered_insights)
            )
            
        except Exception as e:
            logger.error(f"Error analyzing conversation: {e}")
            return SessionAnalysis(
                insights=[],
                session_relevance_score=0.0,
                suggested_new_categories=[],
                total_insights_found=0,
                total_insights_processed=0
            )

    async def _process_multi_category_insights(
        self,
        insights: List[ConversationInsight],
        project_id: str
    ) -> List[CategoryProcessingResult]:
        """
        Process insights across multiple categories, handling both existing and new categories.
        
        Args:
            insights: List of conversation insights to process
            project_id: Project identifier
            
        Returns:
            List of CategoryProcessingResult for each category processed
        """
        try:
            # Group insights by category
            category_insights: Dict[str, List[ConversationInsight]] = {}
            for insight in insights:
                category = insight.category
                if category not in category_insights:
                    category_insights[category] = []
                category_insights[category].append(insight)
            
            # Process each category
            category_results = []
            for category, cat_insights in category_insights.items():
                result = await self._process_category_insights(
                    category, cat_insights, project_id
                )
                category_results.append(result)
            
            return category_results
            
        except Exception as e:
            logger.error(f"Error processing multi-category insights: {e}")
            return []

    async def _process_category_insights(
        self,
        category: str,
        insights: List[ConversationInsight],
        project_id: str
    ) -> CategoryProcessingResult:
        """
        Process insights for a specific category.
        
        Args:
            category: Category name to process
            insights: Insights for this category
            project_id: Project identifier
            
        Returns:
            CategoryProcessingResult with processing details
        """
        try:
            logger.info(f"Processing {len(insights)} insights for category: {category}")
            
            # Check if this is a new category
            is_new_category = not self._is_existing_category(category)
            
            # If new category, validate it
            if is_new_category:
                if not self._validate_new_category_name(category):
                    logger.warning(f"Invalid new category name: {category}, falling back to 'general'")
                    category = "general"
                    is_new_category = False
            
            # Get existing memories for this category
            existing_memories = self._find_memories_by_category(project_id, category)
            
            memories_updated = 0
            memories_created = 0
            
            # Process each insight
            for insight in insights:
                # Try to find existing memory to merge with
                matching_memory = await self._find_best_matching_memory(
                    insight, existing_memories
                )
                
                if matching_memory and await self._should_merge_insight(insight, matching_memory):
                    # Merge with existing memory
                    await self._merge_insight_into_memory(insight, matching_memory, project_id)
                    memories_updated += 1
                    
                elif insight.significance_score >= NEW_MEMORY_THRESHOLD:
                    # Create new memory
                    await self._create_memory_from_insight(insight, project_id)
                    memories_created += 1
                    
                else:
                    logger.info(f"Skipping insight with low significance: {insight.significance_score}")
            
            logger.info(
                f"Category {category}: {memories_updated} updated, "
                f"{memories_created} created, {len(insights)} processed"
            )
            
            return CategoryProcessingResult(
                category=category,
                memories_updated=memories_updated,
                memories_created=memories_created,
                insights_processed=len(insights),
                is_new_category=is_new_category
            )
            
        except Exception as e:
            logger.error(f"Error processing category {category}: {e}")
            return CategoryProcessingResult(
                category=category,
                memories_updated=0,
                memories_created=0,
                insights_processed=0,
                is_new_category=False
            )

    # Helper methods for processing and validation

    def _build_session_conversation_text(self, session_messages: List[ChatMessage]) -> str:
        """Convert ChatMessage list to clean conversation text."""
        try:
            conversation_parts = []
            
            for msg in session_messages:
                if msg.message and msg.message.strip():
                    conversation_parts.append(f"User: {msg.message.strip()}")
                if msg.response and msg.response.strip():
                    conversation_parts.append(f"Assistant: {msg.response.strip()}")
            
            return "\n\n".join(conversation_parts)
            
        except Exception as e:
            logger.error(f"Error building conversation text: {e}")
            return ""

    def _find_memories_by_category(self, project_id: str, category: str) -> List[Memory]:
        """Query memories filtered by category field, handle new/unknown categories gracefully."""
        try:
            all_memories = self.file_service.load_memories(project_id)
            # Filter by category, handling both exact matches and case-insensitive
            matching_memories = [
                memory for memory in all_memories 
                if memory.category.lower() == category.lower()
            ]
            
            logger.info(f"Found {len(matching_memories)} memories for category: {category}")
            return matching_memories
            
        except Exception as e:
            logger.error(f"Error finding memories by category {category}: {e}")
            return []

    def _validate_new_category_name(self, category_name: str) -> bool:
        """Check if proposed category name follows conventions and doesn't duplicate existing ones."""
        try:
            # Check length
            if len(category_name) > MAX_CATEGORY_NAME_LENGTH:
                return False
            
            # Check format (lowercase with underscores)
            if not category_name.islower() or ' ' in category_name:
                return False
            
            # Check for existing duplicates
            existing_categories = [cat.value.lower() for cat in MemoryCategory]
            if category_name.lower() in existing_categories:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating category name {category_name}: {e}")
            return False

    def _is_existing_category(self, category: str) -> bool:
        """Check if category exists in MemoryCategory enum."""
        try:
            existing_categories = [cat.value for cat in MemoryCategory]
            return category in existing_categories
        except Exception as e:
            logger.error(f"Error checking existing category {category}: {e}")
            return False

    def _extract_keywords_from_content(self, content: str) -> List[str]:
        """Simple keyword extraction from text."""
        try:
            # Basic keyword extraction - can be enhanced with NLP later
            words = content.lower().split()
            # Filter out common words and keep meaningful terms
            stop_words = {
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                'of', 'with', 'by', 'we', 'you', 'i', 'they', 'this', 'that', 'is', 'are'
            }
            keywords = [word for word in words if len(word) > 3 and word not in stop_words]
            return keywords[:10]  # Return top 10 keywords
        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            return []

    def _calculate_content_similarity(self, text1: str, text2: str) -> float:
        """Basic text similarity calculation."""
        try:
            # Simple word overlap similarity
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            if len(union) == 0:
                return 0.0
            
            return len(intersection) / len(union)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0

    async def _find_best_matching_memory(
        self, 
        insight: ConversationInsight, 
        existing_memories: List[Memory]
    ) -> Optional[Memory]:
        """Find the best matching existing memory for an insight."""
        try:
            if not existing_memories:
                return None
            
            best_match = None
            best_score = 0.0
            
            for memory in existing_memories:
                # Calculate similarity based on content and keywords
                content_similarity = self._calculate_content_similarity(
                    insight.content, memory.content
                )
                
                # Boost score if keywords match
                memory_keywords = self._extract_keywords_from_content(memory.content)
                keyword_overlap = len(set(insight.related_keywords).intersection(set(memory_keywords)))
                keyword_boost = keyword_overlap * 0.1
                
                total_score = content_similarity + keyword_boost
                
                if total_score > best_score:
                    best_score = total_score
                    best_match = memory
            
            # Only return if similarity is above threshold
            if best_score >= MEMORY_MERGE_THRESHOLD:
                logger.info(f"Found matching memory with similarity: {best_score}")
                return best_match
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding matching memory: {e}")
            return None

    async def _should_merge_insight(
        self, 
        insight: ConversationInsight, 
        memory: Memory
    ) -> bool:
        """Check if insight should be merged with existing memory using LLM."""
        try:
            # Use LLM to detect conflicting information
            conflict_prompt = f"""
Analyze if this new insight conflicts with or contradicts the existing memory content:

EXISTING MEMORY:
Title: {memory.title}
Content: {memory.content}

NEW INSIGHT:
{insight.content}

Return JSON:
{{
    "has_conflict": true/false,
    "conflict_reason": "explanation if conflicting",
    "should_merge": true/false,
    "merge_reason": "explanation of decision"
}}

Consider insights conflicting if they:
1. Contradict technical decisions
2. Override previous specifications with incompatible ones  
3. Suggest opposite approaches to the same problem

Consider merging if the insight:
1. Adds complementary information
2. Provides additional details or context
3. Refines or clarifies existing information
"""
            
            response = await self.gemini_service.chat_with_system_prompt(
                "Analyze for conflicts and merge compatibility",
                conflict_prompt
            )
            
            analysis = self._parse_analysis_response(response)
            should_merge = analysis.get("should_merge", True)
            
            if analysis.get("has_conflict", False):
                logger.warning(f"Conflict detected, not merging: {analysis.get('conflict_reason', 'Unknown')}")
                return False
            
            return should_merge
            
        except Exception as e:
            logger.error(f"Error checking merge compatibility: {e}")
            return True  # Default to merge if analysis fails

    async def _merge_insight_into_memory(
        self, 
        insight: ConversationInsight, 
        memory: Memory,
        project_id: str
    ) -> None:
        """Merge insight into existing memory using LLM."""
        try:
            merge_prompt = f"""
Merge this new insight into the existing memory content intelligently:

EXISTING MEMORY:
Title: {memory.title}
Content: {memory.content}
Category: {memory.category}

NEW INSIGHT:
{insight.content}
Type: {insight.insight_type}
Category: {insight.category}

Rules:
1. Preserve ALL important existing information - do not truncate or remove details
2. Integrate new insight naturally into the existing structure
3. Remove only truly redundant information (exact duplicates)
4. Update title if necessary to reflect the expanded scope
5. Maintain clear, organized structure with proper sections/paragraphs
6. Keep the existing category unless the new insight fundamentally changes the scope
7. Prioritize completeness and accuracy over brevity

Return JSON:
{{
    "title": "Updated title",
    "content": "Merged content with all important details preserved",
    "category": "final_category_to_use"
}}
"""
            
            response = await self.gemini_service.chat_with_system_prompt(
                "Merge the insight into existing memory",
                merge_prompt
            )
            
            merge_result = self._parse_analysis_response(response)
            
            # Update memory with merged content
            memory.title = merge_result.get("title", memory.title)
            memory.content = merge_result.get("content", memory.content)
            memory.category = merge_result.get("category", memory.category)
            
            # Save updated memory
            memories = self.file_service.load_memories(project_id)
            updated_memories = [m if m.id != memory.id else memory for m in memories]
            self.file_service.save_memories(project_id, updated_memories)
            
            logger.info(f"Successfully merged insight into memory: {memory.title}")
            
        except Exception as e:
            logger.error(f"Error merging insight into memory: {e}")

    async def _create_memory_from_insight(
        self, 
        insight: ConversationInsight, 
        project_id: str
    ) -> None:
        """Build Memory model from insight data, including new categories."""
        try:
            # Generate title from content
            title = await self._generate_memory_title(insight.content)
            
            # Create new memory
            new_memory = Memory(
                project_id=project_id,
                title=title,
                content=insight.content,
                category=insight.category,
                type=insight.insight_type if insight.insight_type in ['feature', 'decision', 'spec', 'note'] else 'note'
            )
            
            # Save memory
            memories = self.file_service.load_memories(project_id)
            memories.append(new_memory)
            self.file_service.save_memories(project_id, memories)
            
            logger.info(f"Created new memory: {title} (category: {insight.category})")
            
        except Exception as e:
            logger.error(f"Error creating memory from insight: {e}")

    async def _generate_memory_title(self, content: str) -> str:
        """Generate a concise title for memory content."""
        try:
            title_prompt = f"""
Generate a concise, descriptive title (max 50 characters) for this memory content:

{content}

The title should:
1. Capture the main topic or decision
2. Be specific and actionable
3. Use technical terms appropriately
4. Be under 50 characters

Return only the title, no extra text or quotes.
"""
            
            title = await self.gemini_service.chat_with_system_prompt(
                "Generate memory title",
                title_prompt
            )
            
            return title.strip()[:50]  # Ensure max length
            
        except Exception as e:
            logger.error(f"Error generating memory title: {e}")
            # Fallback to first few words of content
            words = content.split()[:6]
            return " ".join(words)

    def _parse_analysis_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response as JSON with error handling."""
        try:
            # Try to find JSON in response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                return json.loads(json_str)
            else:
                logger.warning("No JSON found in response")
                return {}
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error parsing analysis response: {e}")
            return {}