#!/usr/bin/env python3
"""
Intelligent Memory Management Protocol for Samurai Agent
Implements consolidation-first approach with conversation-wide analysis
"""

import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from models import Memory, MemoryCategory, CATEGORY_CONFIG
from services.consolidated_memory import ConsolidatedMemoryService

logger = logging.getLogger(__name__)

@dataclass
class MemoryTrigger:
    """Represents a memory-worthy trigger from conversation"""
    content: str
    category: MemoryCategory
    confidence: float
    source_message: str
    context: Dict[str, Any]

@dataclass
class ConsolidationOpportunity:
    """Represents an opportunity to consolidate memories"""
    existing_memory: Memory
    new_content: str
    consolidation_type: str  # "update", "merge", "expand"
    confidence: float

class IntelligentMemoryManager:
    """
    Intelligent memory management system that prioritizes consolidation
    and conversation-wide analysis
    """
    
    def __init__(self):
        self.memory_service = ConsolidatedMemoryService()
        
        # Explicit memory triggers
        self.explicit_triggers = [
            r"remember this", r"save this", r"store this info", r"don't forget",
            r"decided to use", r"chose to implement", r"going with",
            r"important note", r"key insight", r"crucial detail",
            r"make sure to", r"keep in mind", r"for future reference"
        ]
        
        # Contextual intelligence patterns using specific model categories
        self.contextual_patterns = self._build_contextual_patterns()
    
    def _build_contextual_patterns(self) -> Dict[MemoryCategory, List[str]]:
        """Build contextual patterns dictionary using model categories and their keywords"""
        patterns = {}
        
        # Technical Categories
        patterns[MemoryCategory.FRONTEND] = [
            r"react", r"vue", r"angular", r"typescript", r"javascript", r"css", r"html",
            r"component", r"ui", r"styling", r"frontend", r"client", r"browser",
            r"using (\w+) for frontend", r"(\w+) component", r"(\w+) styling",
            r"user interface", r"user experience", r"ux", r"ui design"
        ]
        
        patterns[MemoryCategory.BACKEND] = [
            r"api", r"server", r"backend", r"endpoint", r"service", r"microservice",
            r"logic", r"business", r"controller", r"route", r"middleware",
            r"using (\w+) for backend", r"(\w+) api", r"(\w+) server",
            r"business logic", r"server-side", r"api endpoint"
        ]
        
        patterns[MemoryCategory.DATABASE] = [
            r"database", r"db", r"sql", r"nosql", r"schema", r"query", r"migration",
            r"data", r"table", r"collection", r"postgresql", r"mongodb", r"mysql",
            r"using (\w+) database", r"(\w+) schema", r"(\w+) query",
            r"data model", r"database design", r"data migration"
        ]
        
        patterns[MemoryCategory.DEVOPS] = [
            r"deploy", r"deployment", r"ci/cd", r"docker", r"kubernetes", r"aws", r"azure",
            r"infrastructure", r"monitoring", r"container", r"orchestration",
            r"using (\w+) for deployment", r"(\w+) infrastructure", r"(\w+) monitoring",
            r"continuous integration", r"continuous deployment", r"cloud infrastructure"
        ]
        
        patterns[MemoryCategory.AI_ML] = [
            r"ai", r"machine learning", r"ml", r"neural network", r"model", r"training",
            r"prediction", r"algorithm", r"data science", r"tensorflow", r"pytorch",
            r"using (\w+) for ai", r"(\w+) model", r"(\w+) algorithm",
            r"artificial intelligence", r"deep learning", r"natural language processing"
        ]
        
        patterns[MemoryCategory.ARCHITECTURE] = [
            r"architecture", r"design pattern", r"microservices", r"monolithic",
            r"serverless", r"distributed", r"scalable", r"system design",
            r"using (\w+) architecture", r"(\w+) pattern", r"(\w+) design",
            r"system architecture", r"software design", r"architectural decision"
        ]
        
        patterns[MemoryCategory.SECURITY] = [
            r"security", r"authentication", r"authorization", r"encryption", r"jwt",
            r"oauth", r"ssl", r"https", r"vulnerability", r"penetration test",
            r"using (\w+) for security", r"(\w+) authentication", r"(\w+) encryption",
            r"security measure", r"data protection", r"secure coding"
        ]
        
        patterns[MemoryCategory.TESTING] = [
            r"test", r"testing", r"unit test", r"integration test", r"jest", r"cypress",
            r"test coverage", r"tdd", r"bdd", r"qa", r"quality assurance",
            r"using (\w+) for testing", r"(\w+) test", r"(\w+) testing",
            r"test driven development", r"behavior driven development", r"test automation"
        ]
        
        patterns[MemoryCategory.PERFORMANCE] = [
            r"performance", r"optimization", r"speed", r"latency", r"throughput",
            r"caching", r"lazy loading", r"code splitting", r"tree shaking",
            r"using (\w+) for performance", r"(\w+) optimization", r"(\w+) caching",
            r"performance improvement", r"speed optimization", r"performance monitoring"
        ]
        
        patterns[MemoryCategory.THIRD_PARTY] = [
            r"third party", r"external", r"api integration", r"webhook", r"stripe",
            r"paypal", r"google", r"facebook", r"twitter", r"oauth provider",
            r"using (\w+) integration", r"(\w+) api", r"(\w+) service",
            r"external service", r"third party service", r"api integration"
        ]
        
        # Feature Categories
        patterns[MemoryCategory.USER_AUTH] = [
            r"user authentication", r"login", r"logout", r"signup", r"signin",
            r"password", r"reset password", r"email verification", r"two factor",
            r"using (\w+) for auth", r"(\w+) authentication", r"(\w+) login",
            r"user login", r"authentication system", r"user management"
        ]
        
        patterns[MemoryCategory.CORE_FEATURES] = [
            r"core feature", r"main functionality", r"primary feature", r"essential",
            r"basic feature", r"fundamental", r"core functionality",
            r"using (\w+) for core", r"(\w+) feature", r"(\w+) functionality",
            r"main feature", r"core functionality", r"essential feature"
        ]
        
        patterns[MemoryCategory.USER_EXPERIENCE] = [
            r"user experience", r"ux", r"usability", r"user interface", r"ui",
            r"user flow", r"user journey", r"user interaction", r"user feedback",
            r"using (\w+) for ux", r"(\w+) experience", r"(\w+) interface",
            r"user experience design", r"usability improvement", r"user interface design"
        ]
        
        patterns[MemoryCategory.ANALYTICS] = [
            r"analytics", r"tracking", r"metrics", r"dashboard", r"reporting",
            r"data analysis", r"insights", r"statistics", r"kpi", r"measurement",
            r"using (\w+) for analytics", r"(\w+) tracking", r"(\w+) metrics",
            r"data analytics", r"user analytics", r"business intelligence"
        ]
        
        patterns[MemoryCategory.NOTIFICATIONS] = [
            r"notification", r"alert", r"email notification", r"push notification",
            r"sms", r"in-app notification", r"notification system",
            r"using (\w+) for notifications", r"(\w+) notification", r"(\w+) alert",
            r"notification system", r"alert system", r"communication system"
        ]
        
        patterns[MemoryCategory.PAYMENTS] = [
            r"payment", r"billing", r"subscription", r"invoice", r"checkout",
            r"stripe", r"paypal", r"credit card", r"payment processing",
            r"using (\w+) for payments", r"(\w+) payment", r"(\w+) billing",
            r"payment system", r"billing system", r"subscription management"
        ]
        
        patterns[MemoryCategory.ADMIN_TOOLS] = [
            r"admin", r"administrator", r"admin panel", r"admin dashboard",
            r"user management", r"content management", r"admin tool",
            r"using (\w+) for admin", r"(\w+) admin", r"(\w+) management",
            r"admin interface", r"administrative tool", r"management system"
        ]
        
        patterns[MemoryCategory.MOBILE_FEATURES] = [
            r"mobile", r"app", r"ios", r"android", r"react native", r"flutter",
            r"mobile app", r"mobile feature", r"mobile development",
            r"using (\w+) for mobile", r"(\w+) mobile", r"(\w+) app",
            r"mobile application", r"mobile development", r"mobile feature"
        ]
        
        patterns[MemoryCategory.INTEGRATIONS] = [
            r"integration", r"api integration", r"webhook", r"third party",
            r"external service", r"integration service", r"connector",
            r"using (\w+) for integration", r"(\w+) integration", r"(\w+) connector",
            r"service integration", r"api integration", r"external integration"
        ]
        
        patterns[MemoryCategory.ONBOARDING] = [
            r"onboarding", r"user onboarding", r"tutorial", r"walkthrough",
            r"getting started", r"first time user", r"user guide",
            r"using (\w+) for onboarding", r"(\w+) onboarding", r"(\w+) tutorial",
            r"user onboarding", r"onboarding flow", r"user tutorial"
        ]
        
        # General category for fallback
        patterns[MemoryCategory.GENERAL] = [
            r"general", r"misc", r"other", r"note", r"comment", r"remark",
            r"using (\w+)", r"(\w+) note", r"(\w+) comment",
            r"general note", r"miscellaneous", r"general information"
        ]
        
        return patterns
    
    async def analyze_conversation_for_memory_opportunities(
        self, 
        conversation_history: List[Dict[str, Any]], 
        existing_memories: List[Memory],
        project_id: str
    ) -> List[MemoryTrigger]:
        """
        Analyze the ENTIRE conversation for memory-worthy content
        Returns triggers for memory consolidation or creation
        """
        triggers = []
        
        # Analyze each message in context
        for i, message in enumerate(conversation_history):
            if message.get("role") != "user":
                continue
                
            content = message.get("content", "")
            if not content.strip():
                continue
            
            # Get conversation context (previous messages for pattern recognition)
            context = self._get_conversation_context(conversation_history, i)
            
            # Check for explicit triggers
            explicit_trigger = self._check_explicit_triggers(content)
            if explicit_trigger:
                triggers.append(explicit_trigger)
                continue
            
            # Check for contextual intelligence
            contextual_triggers = self._check_contextual_patterns(content, context)
            triggers.extend(contextual_triggers)
        
        # Look for conversation-wide patterns
        conversation_patterns = self._analyze_conversation_patterns(conversation_history)
        triggers.extend(conversation_patterns)
        
        # Filter and rank triggers
        filtered_triggers = self._filter_and_rank_triggers(triggers, existing_memories)
        
        return filtered_triggers
    
    def _get_conversation_context(self, conversation_history: List[Dict], current_index: int) -> Dict[str, Any]:
        """Get context from previous messages for pattern recognition"""
        context = {
            "previous_messages": [],
            "technical_mentions": [],
            "decisions_made": [],
            "preferences_expressed": []
        }
        
        # Look at previous 5 messages for context
        start_index = max(0, current_index - 5)
        for i in range(start_index, current_index):
            msg = conversation_history[i]
            if msg.get("role") == "user":
                content = msg.get("content", "")
                context["previous_messages"].append(content)
                
                # Extract technical mentions
                tech_mentions = re.findall(r'\b(React|Node\.js|Python|PostgreSQL|MongoDB|AWS|Docker|Kubernetes|TypeScript|JavaScript|Next\.js|Express|Django|Flask|Vue|Angular|MySQL|Redis|Azure|GCP|Stripe|PayPal|JWT|OAuth|Jest|Cypress|TensorFlow|PyTorch)\b', content, re.IGNORECASE)
                context["technical_mentions"].extend(tech_mentions)
                
                # Extract decisions
                if any(word in content.lower() for word in ["decided", "chose", "going with", "using"]):
                    context["decisions_made"].append(content)
                
                # Extract preferences
                if any(word in content.lower() for word in ["prefer", "like to", "always", "approach"]):
                    context["preferences_expressed"].append(content)
        
        return context
    
    def _check_explicit_triggers(self, content: str) -> Optional[MemoryTrigger]:
        """Check for explicit memory triggers"""
        content_lower = content.lower()
        
        for pattern in self.explicit_triggers:
            if re.search(pattern, content_lower):
                # Determine category based on content
                category = self._categorize_explicit_content(content)
                return MemoryTrigger(
                    content=content,
                    category=category,
                    confidence=0.9,  # High confidence for explicit triggers
                    source_message=content,
                    context={"trigger_type": "explicit"}
                )
        
        return None
    
    def _check_contextual_patterns(self, content: str, context: Dict[str, Any]) -> List[MemoryTrigger]:
        """Check for contextual intelligence patterns"""
        triggers = []
        content_lower = content.lower()
        
        for category, patterns in self.contextual_patterns.items():
            for pattern in patterns:
                matches = re.findall(pattern, content_lower)
                if matches:
                    # Calculate confidence based on context
                    confidence = self._calculate_contextual_confidence(content, category, context)
                    
                    if confidence > 0.6:  # Only include high-confidence triggers
                        triggers.append(MemoryTrigger(
                            content=content,
                            category=category,
                            confidence=confidence,
                            source_message=content,
                            context={"pattern": pattern, "matches": matches}
                        ))
        
        return triggers
    
    def _analyze_conversation_patterns(self, conversation_history: List[Dict]) -> List[MemoryTrigger]:
        """Analyze conversation-wide patterns for memory opportunities"""
        triggers = []
        
        # Extract all user messages
        user_messages = [
            msg.get("content", "") for msg in conversation_history 
            if msg.get("role") == "user" and msg.get("content", "").strip()
        ]
        
        if len(user_messages) < 2:
            return triggers
        
        # Look for evolving decisions
        decision_evolution = self._detect_decision_evolution(user_messages)
        if decision_evolution:
            triggers.append(decision_evolution)
        
        # Look for preference patterns
        preference_patterns = self._detect_preference_patterns(user_messages)
        triggers.extend(preference_patterns)
        
        # Look for solution building
        solution_building = self._detect_solution_building(user_messages)
        if solution_building:
            triggers.append(solution_building)
        
        return triggers
    
    def _detect_decision_evolution(self, user_messages: List[str]) -> Optional[MemoryTrigger]:
        """Detect when decisions evolve over multiple messages using model categories"""
        decision_keywords = ["decided", "chose", "going with", "using", "switched to"]
        decisions = []
        
        for msg in user_messages:
            for keyword in decision_keywords:
                if keyword in msg.lower():
                    decisions.append(msg)
                    break
        
        if len(decisions) >= 2:
            # Check if decisions are related (same technology domain)
            if self._are_decisions_related(decisions):
                # Determine the most appropriate category for the evolution
                category = self._determine_evolution_category(decisions)
                
                return MemoryTrigger(
                    content="\n".join(decisions),
                    category=category,
                    confidence=0.8,
                    source_message="Multiple messages",
                    context={"evolution": True, "decision_count": len(decisions)}
                )
        
        return None
    
    def _determine_evolution_category(self, decisions: List[str]) -> MemoryCategory:
        """Determine the most appropriate category for decision evolution"""
        combined_text = " ".join(decisions).lower()
        
        # Check for specific technology categories
        if any(tech in combined_text for tech in ["react", "vue", "angular", "typescript", "javascript", "css", "html"]):
            return MemoryCategory.FRONTEND
        elif any(tech in combined_text for tech in ["api", "server", "backend", "endpoint", "express", "django", "flask"]):
            return MemoryCategory.BACKEND
        elif any(tech in combined_text for tech in ["database", "db", "sql", "postgresql", "mongodb", "mysql"]):
            return MemoryCategory.DATABASE
        elif any(tech in combined_text for tech in ["docker", "kubernetes", "aws", "azure", "deployment", "ci/cd"]):
            return MemoryCategory.DEVOPS
        elif any(tech in combined_text for tech in ["authentication", "jwt", "oauth", "security"]):
            return MemoryCategory.SECURITY
        elif any(tech in combined_text for tech in ["test", "testing", "jest", "cypress"]):
            return MemoryCategory.TESTING
        elif any(tech in combined_text for tech in ["performance", "optimization", "speed", "caching"]):
            return MemoryCategory.PERFORMANCE
        elif any(tech in combined_text for tech in ["login", "logout", "signup", "password"]):
            return MemoryCategory.USER_AUTH
        elif any(tech in combined_text for tech in ["payment", "billing", "stripe", "paypal"]):
            return MemoryCategory.PAYMENTS
        elif any(tech in combined_text for tech in ["integration", "webhook", "third party"]):
            return MemoryCategory.THIRD_PARTY
        elif any(tech in combined_text for tech in ["architecture", "microservices", "monolithic", "serverless"]):
            return MemoryCategory.ARCHITECTURE
        elif any(tech in combined_text for tech in ["ai", "machine learning", "ml", "tensorflow", "pytorch"]):
            return MemoryCategory.AI_ML
        
        # Default to general if no specific category is determined
        return MemoryCategory.GENERAL
    
    def _detect_preference_patterns(self, user_messages: List[str]) -> List[MemoryTrigger]:
        """Detect patterns in user preferences across messages using model categories"""
        triggers = []
        preference_keywords = ["prefer", "like to", "always", "approach", "style"]
        preferences = []
        
        for msg in user_messages:
            for keyword in preference_keywords:
                if keyword in msg.lower():
                    preferences.append(msg)
                    break
        
        if len(preferences) >= 2:
            # Group related preferences
            grouped_preferences = self._group_related_preferences(preferences)
            
            for group in grouped_preferences:
                if len(group) >= 2:
                    # Determine the most appropriate category for the preference group
                    category = self._determine_preference_category(group)
                    
                    triggers.append(MemoryTrigger(
                        content="\n".join(group),
                        category=category,
                        confidence=0.7,
                        source_message="Multiple messages",
                        context={"pattern": True, "preference_count": len(group)}
                    ))
        
        return triggers
    
    def _determine_preference_category(self, preferences: List[str]) -> MemoryCategory:
        """Determine the most appropriate category for preference patterns"""
        combined_text = " ".join(preferences).lower()
        
        # Check for specific preference categories
        if any(tech in combined_text for tech in ["test", "testing", "jest", "cypress", "tdd", "bdd"]):
            return MemoryCategory.TESTING
        elif any(tech in combined_text for tech in ["performance", "optimization", "speed", "caching"]):
            return MemoryCategory.PERFORMANCE
        elif any(tech in combined_text for tech in ["react", "vue", "angular", "typescript", "javascript", "css", "html"]):
            return MemoryCategory.FRONTEND
        elif any(tech in combined_text for tech in ["api", "server", "backend", "endpoint"]):
            return MemoryCategory.BACKEND
        elif any(tech in combined_text for tech in ["database", "db", "sql", "postgresql", "mongodb"]):
            return MemoryCategory.DATABASE
        elif any(tech in combined_text for tech in ["docker", "kubernetes", "aws", "azure", "deployment"]):
            return MemoryCategory.DEVOPS
        elif any(tech in combined_text for tech in ["authentication", "jwt", "oauth", "security"]):
            return MemoryCategory.SECURITY
        elif any(tech in combined_text for tech in ["login", "logout", "signup", "password"]):
            return MemoryCategory.USER_AUTH
        elif any(tech in combined_text for tech in ["payment", "billing", "stripe", "paypal"]):
            return MemoryCategory.PAYMENTS
        elif any(tech in combined_text for tech in ["ux", "ui", "user experience", "user interface"]):
            return MemoryCategory.USER_EXPERIENCE
        elif any(tech in combined_text for tech in ["mobile", "ios", "android", "react native", "flutter"]):
            return MemoryCategory.MOBILE_FEATURES
        elif any(tech in combined_text for tech in ["admin", "administrator", "management"]):
            return MemoryCategory.ADMIN_TOOLS
        
        # Default to general for workflow preferences
        return MemoryCategory.GENERAL
    
    def _detect_solution_building(self, user_messages: List[str]) -> Optional[MemoryTrigger]:
        """Detect when solutions are built upon across messages using model categories"""
        solution_keywords = ["fixed", "solved", "optimized", "improved", "found solution"]
        solutions = []
        
        for msg in user_messages:
            for keyword in solution_keywords:
                if keyword in msg.lower():
                    solutions.append(msg)
                    break
        
        if len(solutions) >= 2:
            # Determine the most appropriate category for the solution building
            category = self._determine_solution_category(solutions)
            
            return MemoryTrigger(
                content="\n".join(solutions),
                category=category,
                confidence=0.75,
                source_message="Multiple messages",
                context={"solution_building": True, "solution_count": len(solutions)}
            )
        
        return None
    
    def _determine_solution_category(self, solutions: List[str]) -> MemoryCategory:
        """Determine the most appropriate category for solution building"""
        combined_text = " ".join(solutions).lower()
        
        # Check for specific solution categories
        if any(tech in combined_text for tech in ["performance", "optimization", "speed", "caching", "lazy loading"]):
            return MemoryCategory.PERFORMANCE
        elif any(tech in combined_text for tech in ["bug", "fix", "error", "issue"]):
            return MemoryCategory.GENERAL  # Bug fixes are general implementation insights
        elif any(tech in combined_text for tech in ["react", "vue", "angular", "typescript", "javascript", "css", "html"]):
            return MemoryCategory.FRONTEND
        elif any(tech in combined_text for tech in ["api", "server", "backend", "endpoint"]):
            return MemoryCategory.BACKEND
        elif any(tech in combined_text for tech in ["database", "db", "sql", "postgresql", "mongodb"]):
            return MemoryCategory.DATABASE
        elif any(tech in combined_text for tech in ["authentication", "jwt", "oauth", "security"]):
            return MemoryCategory.SECURITY
        elif any(tech in combined_text for tech in ["test", "testing", "jest", "cypress"]):
            return MemoryCategory.TESTING
        elif any(tech in combined_text for tech in ["docker", "kubernetes", "aws", "azure", "deployment"]):
            return MemoryCategory.DEVOPS
        elif any(tech in combined_text for tech in ["login", "logout", "signup", "password"]):
            return MemoryCategory.USER_AUTH
        elif any(tech in combined_text for tech in ["payment", "billing", "stripe", "paypal"]):
            return MemoryCategory.PAYMENTS
        elif any(tech in combined_text for tech in ["integration", "webhook", "third party"]):
            return MemoryCategory.THIRD_PARTY
        
        # Default to general for general solutions
        return MemoryCategory.GENERAL
    
    def _are_decisions_related(self, decisions: List[str]) -> bool:
        """Check if decisions are related to the same technology domain using expanded keywords"""
        # Extract technology keywords from decisions
        tech_keywords = []
        for decision in decisions:
            tech_matches = re.findall(r'\b(React|Node\.js|Python|PostgreSQL|MongoDB|AWS|Docker|Kubernetes|TypeScript|JavaScript|Next\.js|Express|Django|Flask|Vue|Angular|MySQL|Redis|Azure|GCP|Stripe|PayPal|JWT|OAuth|Jest|Cypress|TensorFlow|PyTorch)\b', decision, re.IGNORECASE)
            tech_keywords.extend(tech_matches)
        
        # If we have multiple tech keywords, they're likely related
        if len(set(tech_keywords)) >= 1:
            return True
        
        # Also check for domain-related keywords
        domain_keywords = {
            "frontend": ["react", "vue", "angular", "typescript", "javascript", "css", "html", "component", "ui"],
            "backend": ["api", "server", "backend", "endpoint", "express", "django", "flask", "node"],
            "database": ["database", "db", "sql", "postgresql", "mongodb", "mysql", "redis", "schema"],
            "devops": ["docker", "kubernetes", "aws", "azure", "deployment", "ci/cd", "infrastructure"],
            "security": ["authentication", "authorization", "jwt", "oauth", "security", "encryption"],
            "payments": ["payment", "billing", "stripe", "paypal", "subscription", "checkout"]
        }
        
        for domain, keywords in domain_keywords.items():
            domain_matches = 0
            for decision in decisions:
                if any(keyword in decision.lower() for keyword in keywords):
                    domain_matches += 1
            
            if domain_matches >= 2:
                return True
        
        return False
    
    def _group_related_preferences(self, preferences: List[str]) -> List[List[str]]:
        """Group preferences by related topics"""
        groups = []
        current_group = []
        
        for pref in preferences:
            if not current_group:
                current_group = [pref]
            else:
                # Check if this preference is related to the current group
                if self._are_preferences_related(current_group, pref):
                    current_group.append(pref)
                else:
                    if current_group:
                        groups.append(current_group)
                    current_group = [pref]
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _are_preferences_related(self, group: List[str], new_pref: str) -> bool:
        """Check if a new preference is related to existing group"""
        # Extract topic keywords
        group_text = " ".join(group).lower()
        new_pref_lower = new_pref.lower()
        
        # Check for common topics
        topics = ["testing", "development", "coding", "debugging", "deployment", "architecture"]
        
        for topic in topics:
            if topic in group_text and topic in new_pref_lower:
                return True
        
        return False
    
    def _categorize_explicit_content(self, content: str) -> MemoryCategory:
        """Categorize explicit memory content using model categories and CATEGORY_CONFIG"""
        content_lower = content.lower()
        
        # Track category matches with scores
        category_scores = {}
        
        # Iterate through CATEGORY_CONFIG to find the best matching category
        for category, config in CATEGORY_CONFIG.items():
            score = 0
            keywords = config.get("keywords", [])
            
            # Check for keyword matches
            for keyword in keywords:
                if keyword.lower() in content_lower:
                    score += 1
            
            # Boost score for exact matches
            for keyword in keywords:
                if re.search(rf'\b{re.escape(keyword.lower())}\b', content_lower):
                    score += 2
            
            # Additional category-specific checks
            if category == MemoryCategory.FRONTEND:
                if any(tech in content_lower for tech in ["react", "vue", "angular", "typescript", "javascript", "css", "html"]):
                    score += 3
            elif category == MemoryCategory.BACKEND:
                if any(tech in content_lower for tech in ["api", "server", "backend", "endpoint", "service"]):
                    score += 3
            elif category == MemoryCategory.DATABASE:
                if any(tech in content_lower for tech in ["database", "db", "sql", "postgresql", "mongodb", "mysql"]):
                    score += 3
            elif category == MemoryCategory.DEVOPS:
                if any(tech in content_lower for tech in ["deploy", "docker", "kubernetes", "aws", "azure", "ci/cd"]):
                    score += 3
            elif category == MemoryCategory.SECURITY:
                if any(tech in content_lower for tech in ["security", "authentication", "authorization", "jwt", "oauth"]):
                    score += 3
            elif category == MemoryCategory.TESTING:
                if any(tech in content_lower for tech in ["test", "testing", "jest", "cypress", "tdd", "bdd"]):
                    score += 3
            elif category == MemoryCategory.PERFORMANCE:
                if any(tech in content_lower for tech in ["performance", "optimization", "speed", "caching", "lazy loading"]):
                    score += 3
            elif category == MemoryCategory.USER_AUTH:
                if any(tech in content_lower for tech in ["login", "logout", "signup", "password", "authentication"]):
                    score += 3
            elif category == MemoryCategory.PAYMENTS:
                if any(tech in content_lower for tech in ["payment", "billing", "stripe", "paypal", "subscription"]):
                    score += 3
            elif category == MemoryCategory.THIRD_PARTY:
                if any(tech in content_lower for tech in ["integration", "webhook", "third party", "external"]):
                    score += 3
            
            if score > 0:
                category_scores[category] = score
        
        # Return the category with the highest score, or GENERAL as fallback
        if category_scores:
            best_category = max(category_scores.items(), key=lambda x: x[1])[0]
            return best_category
        
        return MemoryCategory.GENERAL
    
    def _calculate_contextual_confidence(self, content: str, category: MemoryCategory, context: Dict[str, Any]) -> float:
        """Calculate confidence for contextual triggers using model categories and CATEGORY_CONFIG"""
        confidence = 0.5  # Base confidence
        
        # Get category config for this category
        category_config = CATEGORY_CONFIG.get(category, {})
        category_type = category_config.get("type", "general")
        category_keywords = category_config.get("keywords", [])
        
        # Boost confidence based on category type
        if category_type == "technical":
            # Technical categories get higher base confidence
            confidence += 0.1
        elif category_type == "feature":
            # Feature categories get moderate boost
            confidence += 0.05
        
        # Boost confidence based on context
        if category in [MemoryCategory.FRONTEND, MemoryCategory.BACKEND, MemoryCategory.DATABASE]:
            if context.get("technical_mentions"):
                confidence += 0.2
            if context.get("decisions_made"):
                confidence += 0.2
        
        elif category in [MemoryCategory.USER_AUTH, MemoryCategory.PAYMENTS, MemoryCategory.THIRD_PARTY]:
            if context.get("decisions_made"):
                confidence += 0.3
        
        elif category in [MemoryCategory.TESTING, MemoryCategory.PERFORMANCE, MemoryCategory.SECURITY]:
            if context.get("preferences_expressed"):
                confidence += 0.3
        
        # Boost confidence for longer, more detailed content
        if len(content.split()) > 10:
            confidence += 0.1
        
        # Boost confidence for specific technical terms from category keywords
        content_lower = content.lower()
        keyword_matches = 0
        for keyword in category_keywords:
            if keyword.lower() in content_lower:
                keyword_matches += 1
        
        # Boost confidence based on keyword matches
        if keyword_matches >= 3:
            confidence += 0.2
        elif keyword_matches >= 2:
            confidence += 0.15
        elif keyword_matches >= 1:
            confidence += 0.1
        
        # Additional category-specific confidence boosts
        if category == MemoryCategory.FRONTEND:
            if any(tech in content_lower for tech in ["react", "vue", "angular", "typescript", "javascript"]):
                confidence += 0.1
        elif category == MemoryCategory.BACKEND:
            if any(tech in content_lower for tech in ["api", "server", "endpoint", "service"]):
                confidence += 0.1
        elif category == MemoryCategory.DATABASE:
            if any(tech in content_lower for tech in ["database", "sql", "postgresql", "mongodb"]):
                confidence += 0.1
        elif category == MemoryCategory.DEVOPS:
            if any(tech in content_lower for tech in ["docker", "kubernetes", "aws", "deployment"]):
                confidence += 0.1
        elif category == MemoryCategory.SECURITY:
            if any(tech in content_lower for tech in ["authentication", "jwt", "oauth", "security"]):
                confidence += 0.1
        elif category == MemoryCategory.PAYMENTS:
            if any(tech in content_lower for tech in ["stripe", "paypal", "payment", "billing"]):
                confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _filter_and_rank_triggers(self, triggers: List[MemoryTrigger], existing_memories: List[Memory]) -> List[MemoryTrigger]:
        """Filter and rank triggers based on existing memories"""
        # Remove duplicates and low-confidence triggers
        filtered_triggers = []
        seen_content = set()
        
        for trigger in triggers:
            # Skip if we've seen similar content
            content_key = trigger.content.lower()[:100]  # First 100 chars as key
            if content_key in seen_content:
                continue
            
            # Skip low-confidence triggers
            if trigger.confidence < 0.6:
                continue
            
            seen_content.add(content_key)
            filtered_triggers.append(trigger)
        
        # Sort by confidence (highest first)
        filtered_triggers.sort(key=lambda x: x.confidence, reverse=True)
        
        return filtered_triggers
    
    async def find_consolidation_opportunities(
        self, 
        triggers: List[MemoryTrigger], 
        existing_memories: List[Memory]
    ) -> List[ConsolidationOpportunity]:
        """
        Find opportunities to consolidate new information with existing memories
        """
        opportunities = []
        
        for trigger in triggers:
            # Look for existing memories in the same category
            related_memories = [
                mem for mem in existing_memories 
                if mem.category == trigger.category.value
            ]
            
            for memory in related_memories:
                consolidation_type = self._determine_consolidation_type(trigger, memory)
                if consolidation_type:
                    confidence = self._calculate_consolidation_confidence(trigger, memory)
                    
                    if confidence > 0.7:  # Only high-confidence consolidations
                        opportunities.append(ConsolidationOpportunity(
                            existing_memory=memory,
                            new_content=trigger.content,
                            consolidation_type=consolidation_type,
                            confidence=confidence
                        ))
        
        return opportunities
    
    def _determine_consolidation_type(self, trigger: MemoryTrigger, memory: Memory) -> Optional[str]:
        """Determine how to consolidate new content with existing memory"""
        trigger_content_lower = trigger.content.lower()
        memory_content_lower = memory.content.lower()
        
        # Check for direct updates (same topic, new information)
        if self._is_same_topic(trigger_content_lower, memory_content_lower):
            return "update"
        
        # Check for expansion (related but different aspects)
        if self._is_related_topic(trigger_content_lower, memory_content_lower):
            return "expand"
        
        # Check for evolution (same technology/domain, evolving decision)
        if self._is_evolution(trigger_content_lower, memory_content_lower):
            return "evolve"
        
        return None
    
    def _is_same_topic(self, trigger_content: str, memory_content: str) -> bool:
        """Check if trigger and memory are about the same topic"""
        # Extract key terms
        trigger_terms = set(re.findall(r'\b\w{4,}\b', trigger_content))
        memory_terms = set(re.findall(r'\b\w{4,}\b', memory_content))
        
        # Check for significant overlap
        overlap = len(trigger_terms.intersection(memory_terms))
        total_terms = len(trigger_terms.union(memory_terms))
        
        return overlap / total_terms > 0.3 if total_terms > 0 else False
    
    def _is_related_topic(self, trigger_content: str, memory_content: str) -> bool:
        """Check if trigger and memory are related topics using model categories"""
        # Look for related technology domains and feature areas
        related_domains = {
            # Technical domains
            "frontend": ["react", "vue", "angular", "typescript", "javascript", "css", "html", "component", "ui", "styling"],
            "backend": ["node", "python", "java", "express", "django", "flask", "api", "server", "endpoint", "service"],
            "database": ["postgresql", "mongodb", "mysql", "redis", "database", "sql", "nosql", "schema", "query"],
            "devops": ["docker", "kubernetes", "aws", "azure", "deployment", "ci/cd", "infrastructure", "monitoring"],
            "security": ["authentication", "authorization", "jwt", "oauth", "security", "encryption", "ssl", "https"],
            "testing": ["test", "jest", "cypress", "integration", "unit", "testing", "tdd", "bdd", "qa"],
            "performance": ["performance", "optimization", "speed", "caching", "lazy loading", "code splitting"],
            
            # Feature domains
            "user_auth": ["login", "logout", "signup", "password", "authentication", "user", "auth"],
            "payments": ["payment", "billing", "stripe", "paypal", "subscription", "invoice", "checkout"],
            "notifications": ["notification", "alert", "email", "push", "sms", "communication"],
            "analytics": ["analytics", "tracking", "metrics", "dashboard", "reporting", "insights"],
            "integrations": ["integration", "webhook", "third party", "external", "api integration"],
            
            # Cross-cutting concerns
            "user_experience": ["ux", "ui", "user experience", "user interface", "usability", "user flow"],
            "mobile": ["mobile", "ios", "android", "react native", "flutter", "app"],
            "admin": ["admin", "administrator", "management", "admin panel", "admin dashboard"]
        }
        
        trigger_content_lower = trigger_content.lower()
        memory_content_lower = memory_content.lower()
        
        # Check for domain matches
        for domain, keywords in related_domains.items():
            trigger_has_domain = any(keyword in trigger_content_lower for keyword in keywords)
            memory_has_domain = any(keyword in memory_content_lower for keyword in keywords)
            
            if trigger_has_domain and memory_has_domain:
                return True
        
        # Check for specific technology relationships
        tech_relationships = {
            "react": ["typescript", "javascript", "frontend", "component"],
            "typescript": ["javascript", "react", "angular", "vue"],
            "node": ["express", "javascript", "backend", "api"],
            "python": ["django", "flask", "backend", "api"],
            "postgresql": ["database", "sql", "data", "schema"],
            "mongodb": ["database", "nosql", "data", "collection"],
            "docker": ["kubernetes", "deployment", "container", "devops"],
            "aws": ["azure", "cloud", "deployment", "infrastructure"],
            "stripe": ["payment", "billing", "subscription", "paypal"],
            "jwt": ["authentication", "security", "oauth", "token"]
        }
        
        for tech, related_techs in tech_relationships.items():
            if tech in trigger_content_lower:
                if any(related_tech in memory_content_lower for related_tech in related_techs):
                    return True
            if tech in memory_content_lower:
                if any(related_tech in trigger_content_lower for related_tech in related_techs):
                    return True
        
        return False
    
    def _is_evolution(self, trigger_content: str, memory_content: str) -> bool:
        """Check if trigger represents evolution of memory content"""
        evolution_indicators = [
            "switched to", "migrated to", "upgraded to", "evolved to",
            "instead of", "replaced", "changed from", "moved to"
        ]
        
        return any(indicator in trigger_content for indicator in evolution_indicators)
    
    def _calculate_consolidation_confidence(self, trigger: MemoryTrigger, memory: Memory) -> float:
        """Calculate confidence for consolidation"""
        confidence = trigger.confidence  # Start with trigger confidence
        
        # Boost confidence for same topic
        if self._is_same_topic(trigger.content.lower(), memory.content.lower()):
            confidence += 0.2
        
        # Boost confidence for evolution indicators
        if self._is_evolution(trigger.content.lower(), memory.content.lower()):
            confidence += 0.15
        
        # Reduce confidence if memory is very recent (might be redundant)
        # This would require timestamp comparison - simplified for now
        confidence = min(confidence, 1.0)
        
        return confidence
    
    async def consolidate_memory(
        self, 
        opportunity: ConsolidationOpportunity, 
        project_id: str
    ) -> Memory:
        """
        Consolidate new content with existing memory
        """
        existing_memory = opportunity.existing_memory
        new_content = opportunity.new_content
        
        if opportunity.consolidation_type == "update":
            # Update existing memory with new information
            updated_content = self._merge_content(existing_memory.content, new_content)
            updated_title = self._update_title(existing_memory.title, new_content)
            
            return await self.memory_service.update_memory(
                memory_id=existing_memory.id,
                title=updated_title,
                content=updated_content,
                category=existing_memory.category
            )
        
        elif opportunity.consolidation_type == "expand":
            # Expand existing memory with related information
            expanded_content = f"{existing_memory.content}\n\nAdditional insights:\n{new_content}"
            
            return await self.memory_service.update_memory(
                memory_id=existing_memory.id,
                title=existing_memory.title,
                content=expanded_content,
                category=existing_memory.category
            )
        
        elif opportunity.consolidation_type == "evolve":
            # Show evolution of decision/approach
            evolved_content = f"{existing_memory.content}\n\nEvolved to:\n{new_content}"
            evolved_title = self._evolve_title(existing_memory.title, new_content)
            
            return await self.memory_service.update_memory(
                memory_id=existing_memory.id,
                title=evolved_title,
                content=evolved_content,
                category=existing_memory.category
            )
        
        else:
            # Fallback to update
            updated_content = self._merge_content(existing_memory.content, new_content)
            return await self.memory_service.update_memory(
                memory_id=existing_memory.id,
                title=existing_memory.title,
                content=updated_content,
                category=existing_memory.category
            )
    
    def _merge_content(self, existing_content: str, new_content: str) -> str:
        """Merge new content with existing content intelligently"""
        # Simple merge for now - could be enhanced with NLP
        if new_content in existing_content:
            return existing_content  # Avoid duplication
        
        return f"{existing_content}\n\nUpdated: {new_content}"
    
    def _update_title(self, existing_title: str, new_content: str) -> str:
        """Update title to reflect new information"""
        # Extract key terms from new content
        key_terms = re.findall(r'\b\w{4,}\b', new_content.lower())
        
        # Look for technology names or important terms
        tech_terms = ["react", "node", "python", "postgresql", "docker", "aws"]
        found_tech = [term for term in tech_terms if term in key_terms]
        
        if found_tech:
            return f"{existing_title} ({', '.join(found_tech).title()})"
        
        return existing_title
    
    def _evolve_title(self, existing_title: str, new_content: str) -> str:
        """Evolve title to show progression"""
        evolution_indicators = {
            "switched to": "→",
            "migrated to": "→", 
            "upgraded to": "→",
            "evolved to": "→"
        }
        
        for indicator, arrow in evolution_indicators.items():
            if indicator in new_content.lower():
                # Extract the new technology/approach
                after_indicator = new_content.lower().split(indicator)[-1].strip()
                new_tech = after_indicator.split()[0] if after_indicator else ""
                
                if new_tech:
                    return f"{existing_title} {arrow} {new_tech.title()}"
        
        return f"{existing_title} (Evolved)"
    
    async def create_new_memory(
        self, 
        trigger: MemoryTrigger, 
        project_id: str
    ) -> Memory:
        """
        Create new memory when no consolidation opportunity exists
        """
        title = self._generate_memory_title(trigger)
        
        return await self.memory_service.create_memory(
            title=title,
            content=trigger.content,
            category=trigger.category.value,
            project_id=project_id
        )
    
    def _generate_memory_title(self, trigger: MemoryTrigger) -> str:
        """Generate appropriate title for new memory using specific model categories"""
        content_lower = trigger.content.lower()
        
        # Get category config for better title generation
        category_config = CATEGORY_CONFIG.get(trigger.category, {})
        category_label = category_config.get("label", trigger.category.value.title())
        
        # Technical Categories
        if trigger.category == MemoryCategory.FRONTEND:
            # Extract technology name
            tech_terms = ["react", "vue", "angular", "typescript", "javascript", "css", "html"]
            for tech in tech_terms:
                if tech in content_lower:
                    return f"{tech.title()} Frontend Decision"
            return "Frontend Technology Decision"
        
        elif trigger.category == MemoryCategory.BACKEND:
            tech_terms = ["api", "server", "express", "django", "flask", "node", "python"]
            for tech in tech_terms:
                if tech in content_lower:
                    return f"{tech.title()} Backend Decision"
            return "Backend Technology Decision"
        
        elif trigger.category == MemoryCategory.DATABASE:
            tech_terms = ["postgresql", "mongodb", "mysql", "redis", "sqlite"]
            for tech in tech_terms:
                if tech in content_lower:
                    return f"{tech.title()} Database Decision"
            return "Database Technology Decision"
        
        elif trigger.category == MemoryCategory.DEVOPS:
            tech_terms = ["docker", "kubernetes", "aws", "azure", "gcp", "ci/cd"]
            for tech in tech_terms:
                if tech in content_lower:
                    return f"{tech.title()} DevOps Decision"
            return "DevOps Configuration Decision"
        
        elif trigger.category == MemoryCategory.AI_ML:
            tech_terms = ["tensorflow", "pytorch", "scikit-learn", "openai", "gpt"]
            for tech in tech_terms:
                if tech in content_lower:
                    return f"{tech.title()} AI/ML Decision"
            return "AI/ML Technology Decision"
        
        elif trigger.category == MemoryCategory.ARCHITECTURE:
            if "microservices" in content_lower:
                return "Microservices Architecture Decision"
            elif "monolithic" in content_lower:
                return "Monolithic Architecture Decision"
            elif "serverless" in content_lower:
                return "Serverless Architecture Decision"
            return "System Architecture Decision"
        
        elif trigger.category == MemoryCategory.SECURITY:
            if "authentication" in content_lower:
                return "Authentication Strategy Decision"
            elif "authorization" in content_lower:
                return "Authorization Strategy Decision"
            elif "jwt" in content_lower:
                return "JWT Authentication Decision"
            elif "oauth" in content_lower:
                return "OAuth Integration Decision"
            return "Security Implementation Decision"
        
        elif trigger.category == MemoryCategory.TESTING:
            if "unit test" in content_lower:
                return "Unit Testing Strategy"
            elif "integration test" in content_lower:
                return "Integration Testing Strategy"
            elif "tdd" in content_lower:
                return "Test-Driven Development Approach"
            elif "bdd" in content_lower:
                return "Behavior-Driven Development Approach"
            return "Testing Strategy Decision"
        
        elif trigger.category == MemoryCategory.PERFORMANCE:
            if "optimization" in content_lower:
                return "Performance Optimization Strategy"
            elif "caching" in content_lower:
                return "Caching Strategy Decision"
            elif "lazy loading" in content_lower:
                return "Lazy Loading Implementation"
            return "Performance Improvement Strategy"
        
        # Feature Categories
        elif trigger.category == MemoryCategory.USER_AUTH:
            if "login" in content_lower:
                return "User Login System Design"
            elif "signup" in content_lower:
                return "User Registration System"
            elif "password" in content_lower:
                return "Password Management Strategy"
            elif "two factor" in content_lower:
                return "Two-Factor Authentication Setup"
            return "User Authentication Strategy"
        
        elif trigger.category == MemoryCategory.CORE_FEATURES:
            if "feature" in content_lower:
                return "Core Feature Implementation"
            elif "functionality" in content_lower:
                return "Core Functionality Design"
            return "Core Feature Decision"
        
        elif trigger.category == MemoryCategory.USER_EXPERIENCE:
            if "ux" in content_lower or "user experience" in content_lower:
                return "User Experience Design Decision"
            elif "ui" in content_lower or "user interface" in content_lower:
                return "User Interface Design Decision"
            elif "usability" in content_lower:
                return "Usability Improvement Strategy"
            return "User Experience Strategy"
        
        elif trigger.category == MemoryCategory.ANALYTICS:
            if "tracking" in content_lower:
                return "Analytics Tracking Implementation"
            elif "dashboard" in content_lower:
                return "Analytics Dashboard Design"
            elif "metrics" in content_lower:
                return "Metrics Collection Strategy"
            return "Analytics Implementation Decision"
        
        elif trigger.category == MemoryCategory.NOTIFICATIONS:
            if "email" in content_lower:
                return "Email Notification System"
            elif "push" in content_lower:
                return "Push Notification System"
            elif "sms" in content_lower:
                return "SMS Notification System"
            return "Notification System Design"
        
        elif trigger.category == MemoryCategory.PAYMENTS:
            if "stripe" in content_lower:
                return "Stripe Payment Integration"
            elif "paypal" in content_lower:
                return "PayPal Payment Integration"
            elif "subscription" in content_lower:
                return "Subscription Management System"
            elif "billing" in content_lower:
                return "Billing System Design"
            return "Payment System Decision"
        
        elif trigger.category == MemoryCategory.ADMIN_TOOLS:
            if "admin panel" in content_lower:
                return "Admin Panel Design"
            elif "user management" in content_lower:
                return "User Management System"
            elif "content management" in content_lower:
                return "Content Management System"
            return "Admin Tools Implementation"
        
        elif trigger.category == MemoryCategory.MOBILE_FEATURES:
            if "react native" in content_lower:
                return "React Native Mobile App Decision"
            elif "flutter" in content_lower:
                return "Flutter Mobile App Decision"
            elif "ios" in content_lower:
                return "iOS Mobile Feature Implementation"
            elif "android" in content_lower:
                return "Android Mobile Feature Implementation"
            return "Mobile Feature Implementation"
        
        elif trigger.category == MemoryCategory.INTEGRATIONS:
            if "webhook" in content_lower:
                return "Webhook Integration Setup"
            elif "api integration" in content_lower:
                return "API Integration Implementation"
            elif "third party" in content_lower:
                return "Third-Party Service Integration"
            return "Integration Implementation Decision"
        
        elif trigger.category == MemoryCategory.ONBOARDING:
            if "tutorial" in content_lower:
                return "User Tutorial System"
            elif "walkthrough" in content_lower:
                return "User Walkthrough Design"
            elif "getting started" in content_lower:
                return "Getting Started Flow Design"
            return "User Onboarding Strategy"
        
        elif trigger.category == MemoryCategory.THIRD_PARTY:
            if "stripe" in content_lower:
                return "Stripe Integration Decision"
            elif "paypal" in content_lower:
                return "PayPal Integration Decision"
            elif "google" in content_lower:
                return "Google Service Integration"
            elif "facebook" in content_lower:
                return "Facebook Integration Decision"
            return "Third-Party Service Integration"
        
        else:  # GENERAL or other categories
            # Try to extract a meaningful title from the content
            words = trigger.content.split()
            if len(words) >= 3:
                # Take first few meaningful words
                meaningful_words = [word for word in words[:5] if len(word) > 3]
                if meaningful_words:
                    return f"{' '.join(meaningful_words[:3]).title()} Decision"
            
            return f"{category_label} Decision" 