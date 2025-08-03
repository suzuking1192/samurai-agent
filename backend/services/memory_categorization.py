"""
Memory categorization service for automatically categorizing memories using software engineering categories.
"""

import logging
from typing import Optional, List
from models import MemoryCategory, CATEGORY_CONFIG

logger = logging.getLogger(__name__)

def detect_memory_category(content: str, conversation_context: List[str] = None) -> MemoryCategory:
    """
    Automatically detect the most appropriate category for a memory based on content.
    
    Args:
        content: The memory content to categorize
        conversation_context: Optional list of recent conversation messages for context
        
    Returns:
        The most appropriate MemoryCategory
    """
    content_lower = content.lower()
    
    # Score each category based on keyword matches
    category_scores = {}
    
    for category, config in CATEGORY_CONFIG.items():
        score = 0
        keywords = config.get("keywords", [])
        
        # Basic keyword matching
        for keyword in keywords:
            if keyword in content_lower:
                score += 1
                
        # Boost score for repeated keywords
        for keyword in keywords:
            score += content_lower.count(keyword) * 0.5
            
        # Context-based scoring
        if conversation_context:
            context_text = " ".join(conversation_context[-3:])  # Last 3 messages
            context_lower = context_text.lower()
            
            for keyword in keywords:
                if keyword in context_lower:
                    score += 0.3  # Context boost
        
        category_scores[category] = score
    
    # Special logic for feature vs technical distinction
    feature_indicators = [
        "user", "feature", "workflow", "experience", "journey", "flow", 
        "requirement", "business", "product", "customer", "interface"
    ]
    
    technical_indicators = [
        "implementation", "code", "technical", "architecture", "database", 
        "api", "server", "deployment", "performance", "security"
    ]
    
    feature_score = sum(1 for indicator in feature_indicators if indicator in content_lower)
    technical_score = sum(1 for indicator in technical_indicators if indicator in content_lower)
    
    # Boost appropriate category types
    for category, score in category_scores.items():
        category_type = CATEGORY_CONFIG[category].get('type', 'general')
        
        if category_type == 'feature' and feature_score > technical_score:
            category_scores[category] += feature_score * 0.5
        elif category_type == 'technical' and technical_score > feature_score:
            category_scores[category] += technical_score * 0.5
    
    # Return category with highest score
    best_category = max(category_scores.items(), key=lambda x: x[1])[0]
    return best_category if category_scores[best_category] > 0 else MemoryCategory.GENERAL

async def detect_category_with_llm(content: str, available_categories: List[MemoryCategory]) -> Optional[MemoryCategory]:
    """
    Use LLM to detect category when keyword matching is insufficient.
    
    Args:
        content: The memory content
        available_categories: List of categories to choose from
        
    Returns:
        The detected category or None if detection fails
    """
    try:
        from .gemini_service import GeminiService
        gemini_service = GeminiService()
        
        # Group categories by type for better prompting
        technical_cats = [cat for cat in available_categories if CATEGORY_CONFIG[cat].get('type') == 'technical']
        feature_cats = [cat for cat in available_categories if CATEGORY_CONFIG[cat].get('type') == 'feature']
        
        technical_text = "\n".join([
            f"- {cat.value}: {CATEGORY_CONFIG[cat]['description']}" 
            for cat in technical_cats
        ])
        
        feature_text = "\n".join([
            f"- {cat.value}: {CATEGORY_CONFIG[cat]['description']}" 
            for cat in feature_cats
        ])
        
        prompt = f"""
        Categorize this software development memory. Choose the most specific and appropriate category.
        
        CONTENT: {content[:500]}
        
        TECHNICAL CATEGORIES (how to build it):
        {technical_text}
        
        FEATURE CATEGORIES (what to build):
        {feature_text}
        
        Guidelines:
        - If discussing implementation details, architecture, or technical decisions → use TECHNICAL categories
        - If discussing user requirements, workflows, or product features → use FEATURE categories
        - Choose the most specific category that fits
        
        Return only the category name (e.g., "frontend", "user_auth", "database"):
        """
        
        response = await gemini_service.chat_with_system_prompt("", prompt)
        response_clean = response.strip().lower()
        
        # Match response to enum value
        for category in available_categories:
            if category.value == response_clean:
                return category
                
    except Exception as e:
        logger.warning(f"LLM category detection failed: {e}")
    
    return None

def calculate_category_confidence(content: str, category: MemoryCategory) -> float:
    """
    Calculate confidence score for category detection.
    
    Args:
        content: The memory content
        category: The detected category
        
    Returns:
        Confidence score between 0.0 and 1.0
    """
    content_lower = content.lower()
    config = CATEGORY_CONFIG[category]
    keywords = config.get("keywords", [])
    
    if not keywords:
        return 0.5  # Default confidence for general category
    
    # Count keyword matches
    matches = 0
    total_keywords = len(keywords)
    
    for keyword in keywords:
        if keyword in content_lower:
            matches += 1
            # Bonus for multiple occurrences
            matches += content_lower.count(keyword) * 0.1
    
    # Calculate confidence based on match ratio
    confidence = min(matches / total_keywords, 1.0)
    
    # Boost confidence for longer content with more context
    if len(content) > 100:
        confidence = min(confidence * 1.2, 1.0)
    
    return confidence

async def generate_category_specific_title(content: str, category: MemoryCategory) -> str:
    """
    Generate titles that incorporate category context.
    
    Args:
        content: The memory content
        category: The memory category
        
    Returns:
        A short, category-specific title
    """
    try:
        from .gemini_service import GeminiService
        gemini_service = GeminiService()
        
        config = CATEGORY_CONFIG[category]
        
        prompt = f"""
        Generate a short, specific title for this {config['label'].lower()} memory:
        
        Content: {content[:200]}
        
        Context: This is about {config['description']}
        
        Requirements:
        - Maximum 40 characters
        - Include relevant technical terms
        - Be specific to {config['label']}
        
        Examples for {config['label']}:
        {get_category_title_examples(category)}
        
        Return only the title:
        """
        
        response = await gemini_service.chat_with_system_prompt("", prompt)
        title = response.strip()
        
        # Ensure length limit
        if len(title) > 40:
            title = title[:37] + "..."
        
        return title
        
    except Exception as e:
        logger.warning(f"Title generation failed: {e}")
        # Fallback to simple title
        words = content.split()[:4]
        return " ".join(words)[:40]

def get_category_title_examples(category: MemoryCategory) -> str:
    """
    Provide category-specific title examples.
    
    Args:
        category: The memory category
        
    Returns:
        String with example titles for the category
    """
    examples = {
        # Technical Categories
        MemoryCategory.FRONTEND: "- React component structure\n- CSS Grid layout decision\n- State management approach",
        MemoryCategory.BACKEND: "- API endpoint design\n- User service refactor\n- Rate limiting strategy", 
        MemoryCategory.DATABASE: "- User table schema\n- Query optimization notes\n- Migration strategy",
        MemoryCategory.DEVOPS: "- Docker deployment config\n- CI/CD pipeline setup\n- AWS infrastructure plan",
        MemoryCategory.AI_ML: "- Prompt engineering notes\n- Model integration plan\n- LLM response handling",
        MemoryCategory.ARCHITECTURE: "- Microservices decision\n- Event-driven architecture\n- Scalability planning",
        MemoryCategory.SECURITY: "- JWT implementation\n- OAuth integration\n- Data encryption plan",
        MemoryCategory.TESTING: "- Unit test structure\n- E2E test scenarios\n- Testing strategy",
        MemoryCategory.PERFORMANCE: "- Caching strategy\n- Database optimization\n- Load testing results",
        MemoryCategory.THIRD_PARTY: "- Stripe integration\n- External API limits\n- Webhook handling",
        
        # Feature Categories  
        MemoryCategory.USER_AUTH: "- Login flow requirements\n- Password reset design\n- User profile features",
        MemoryCategory.CORE_FEATURES: "- Main workflow design\n- Feature requirements\n- Business logic rules",
        MemoryCategory.USER_EXPERIENCE: "- User journey mapping\n- Interaction patterns\n- Usability improvements",
        MemoryCategory.ANALYTICS: "- Tracking requirements\n- Metrics definition\n- Reporting features",
        MemoryCategory.NOTIFICATIONS: "- Email templates\n- Push notification rules\n- Alert preferences",
        MemoryCategory.PAYMENTS: "- Pricing strategy\n- Checkout flow\n- Subscription features",
        MemoryCategory.ADMIN_TOOLS: "- Dashboard requirements\n- User management\n- System controls",
        MemoryCategory.MOBILE_FEATURES: "- Mobile navigation\n- Touch interactions\n- Responsive design",
        MemoryCategory.INTEGRATIONS: "- Third-party connections\n- Data sync requirements\n- Webhook workflows",
        MemoryCategory.ONBOARDING: "- Signup flow\n- Tutorial design\n- First-time experience",
    }
    
    return examples.get(category, "- General development notes")

def migrate_existing_memories():
    """
    Migrate existing memories from old categories to new software engineering categories.
    """
    try:
        from .file_service import FileService
        file_service = FileService()
        
        # Migration mapping from old to new categories
        migration_map = {
            'nodes': MemoryCategory.ARCHITECTURE,
            'conditions': MemoryCategory.BACKEND, 
            'decisions': MemoryCategory.ARCHITECTURE,
            'general': MemoryCategory.GENERAL
        }
        
        # Get all projects
        projects = file_service.load_projects()
        
        for project in projects:
            memories = file_service.load_memories(project.id)
            
            for memory in memories:
                old_category = memory.get('category', 'general')
                
                if old_category in migration_map:
                    # Use migration mapping
                    new_category = migration_map[old_category]
                else:
                    # Detect category from content
                    new_category = detect_memory_category(memory.get('content', ''))
                
                # Update memory with new category
                memory['category'] = new_category.value
                file_service.save_memory(project.id, memory)
                
                logger.info(f"Migrated memory {memory['id']} from {old_category} to {new_category.value}")
                
    except Exception as e:
        logger.error(f"Memory migration failed: {e}")

def bulk_recategorize_memories(project_id: str = None) -> int:
    """
    Re-categorize all memories using improved detection.
    
    Args:
        project_id: Optional project ID to limit recategorization
        
    Returns:
        Number of memories updated
    """
    try:
        from .file_service import FileService
        file_service = FileService()
        
        updated_count = 0
        
        if project_id:
            # Recategorize specific project
            memories = file_service.load_memories(project_id)
            for memory in memories:
                old_category = memory.get('category', 'general')
                new_category = detect_memory_category(memory.get('content', ''))
                
                if old_category != new_category.value:
                    memory['category'] = new_category.value
                    file_service.save_memory(project_id, memory)
                    updated_count += 1
                    logger.info(f"Updated memory {memory['id']}: {old_category} → {new_category.value}")
        else:
            # Recategorize all projects
            projects = file_service.load_projects()
            for project in projects:
                memories = file_service.load_memories(project.id)
                for memory in memories:
                    old_category = memory.get('category', 'general')
                    new_category = detect_memory_category(memory.get('content', ''))
                    
                    if old_category != new_category.value:
                        memory['category'] = new_category.value
                        file_service.save_memory(project.id, memory)
                        updated_count += 1
                        logger.info(f"Updated memory {memory['id']}: {old_category} → {new_category.value}")
        
        return updated_count
        
    except Exception as e:
        logger.error(f"Bulk recategorization failed: {e}")
        return 0 