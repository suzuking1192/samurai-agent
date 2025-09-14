"""
LLM Provider Service for managing multiple LLM providers.
"""
import logging
from typing import List, Dict, Optional, Any

# Import services conditionally to avoid import errors when dependencies are missing
try:
    from .gemini_service import GeminiService
except ImportError:
    GeminiService = None

try:
    from .openai_service import OpenAIService
except ImportError:
    OpenAIService = None

try:
    from .claude_service import ClaudeService
except ImportError:
    ClaudeService = None

logger = logging.getLogger(__name__)


class LLMProviderService:
    """
    Service for managing and providing access to multiple LLM providers.
    
    This service aggregates all available LLM providers (Gemini, OpenAI, Claude)
    and provides a unified interface for model selection and availability checking.
    """
    
    def __init__(self):
        """Initialize the LLM provider service."""
        self.providers = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize all LLM providers."""
        # Initialize Gemini service
        if GeminiService is not None:
            try:
                self.providers['gemini'] = GeminiService()
                logger.info("Gemini service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini service: {e}")
                self.providers['gemini'] = None
        else:
            logger.warning("Gemini service not available - dependencies missing")
            self.providers['gemini'] = None
        
        # Initialize OpenAI service
        if OpenAIService is not None:
            try:
                self.providers['openai'] = OpenAIService()
                logger.info("OpenAI service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI service: {e}")
                self.providers['openai'] = None
        else:
            logger.warning("OpenAI service not available - dependencies missing")
            self.providers['openai'] = None
        
        # Initialize Claude service
        if ClaudeService is not None:
            try:
                self.providers['claude'] = ClaudeService()
                logger.info("Claude service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Claude service: {e}")
                self.providers['claude'] = None
        else:
            logger.warning("Claude service not available - dependencies missing")
            self.providers['claude'] = None
        
        logger.info(f"LLM Provider Service initialized with {len([p for p in self.providers.values() if p is not None])} active providers")
    
    def get_available_llm_models(self, project_id: str) -> List[Dict[str, str]]:
        """
        Get a list of available LLM models for a project.
        
        Args:
            project_id: The project ID (used for logging and future project-specific logic)
            
        Returns:
            List of dictionaries containing model information:
            [
                {
                    "id": "openai-gpt-4o",
                    "name": "OpenAI - gpt-4o",
                    "provider": "OpenAI"
                },
                ...
            ]
        """
        available_models = []
        
        # Check each provider
        for provider_name, provider in self.providers.items():
            if provider is None:
                continue
            
            # Only include providers with valid API keys
            if not provider.is_api_key_valid():
                logger.debug(f"Skipping {provider_name} - API key not valid")
                continue
            
            # Get available models for this provider
            models = provider.get_available_models()
            for model in models:
                model_id = f"{provider_name.lower()}-{model}"
                model_name = f"{provider.provider_name} - {model}"
                
                available_models.append({
                    "id": model_id,
                    "name": model_name,
                    "provider": provider.provider_name
                })
        
        logger.info(f"Found {len(available_models)} available LLM models for project {project_id}")
        return available_models
    
    def get_llm_service_by_model_id(self, model_id: str):
        """
        Get the appropriate LLM service instance for a given model ID.
        
        Args:
            model_id: Model ID in format "provider-model" (e.g., "openai-gpt-4o")
            
        Returns:
            The appropriate LLM service instance, or None if not found
        """
        try:
            # Parse model ID to extract provider and model
            parts = model_id.split('-', 1)
            if len(parts) != 2:
                logger.error(f"Invalid model ID format: {model_id}")
                return None
            
            provider_key = parts[0].lower()
            model_name = parts[1]
            
            # Get the provider
            provider = self.providers.get(provider_key)
            if provider is None:
                logger.error(f"Provider not found: {provider_key}")
                return None
            
            # Check if provider has valid API key
            if not provider.is_api_key_valid():
                logger.error(f"Provider {provider_key} does not have a valid API key")
                return None
            
            # Check if model is available for this provider
            available_models = provider.get_available_models()
            if model_name not in available_models:
                logger.error(f"Model {model_name} not available for provider {provider_key}")
                return None
            
            logger.debug(f"Selected {provider_key} service for model {model_name}")
            return provider
            
        except Exception as e:
            logger.error(f"Error getting LLM service for model {model_id}: {e}")
            return None
    
    def get_default_model_for_provider(self, provider_name: str) -> Optional[str]:
        """
        Get the default model for a specific provider.
        
        Args:
            provider_name: Name of the provider (gemini, openai, claude)
            
        Returns:
            Default model ID for the provider, or None if not available
        """
        provider = self.providers.get(provider_name.lower())
        if provider is None or not provider.is_api_key_valid():
            return None
        
        default_model = provider.get_default_model()
        if default_model:
            return f"{provider_name.lower()}-{default_model}"
        
        return None
    
    def get_llm_service_by_project_id(self, project_id: str):
        """
        Get the appropriate LLM service for a given project.
        
        Args:
            project_id: The project ID
            
        Returns:
            The appropriate LLM service instance, or None if not found
        """
        try:
            # Try to get the project's selected model
            from .project_settings_service import ProjectSettingsService
            settings_service = ProjectSettingsService()
            selected_model = settings_service.get_selected_llm_model(project_id)
            
            if selected_model:
                service = self.get_llm_service_by_model_id(selected_model)
                if service and service.is_api_key_valid():
                    return service
            
            # If no service found, try to get any available service
            for provider_name in ['gemini', 'openai', 'claude']:
                default_model = self.get_default_model_for_provider(provider_name)
                if default_model:
                    service = self.get_llm_service_by_model_id(default_model)
                    if service and service.is_api_key_valid():
                        return service
            
            logger.warning(f"No valid LLM service found for project {project_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting LLM service for project {project_id}: {e}")
            return None
    
    def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get the status of all providers.
        
        Returns:
            Dictionary containing provider status information
        """
        status = {}
        
        for provider_name, provider in self.providers.items():
            if provider is None:
                status[provider_name] = {
                    "available": False,
                    "error": "Failed to initialize"
                }
            else:
                status[provider_name] = {
                    "available": provider.is_api_key_valid(),
                    "api_key_valid": provider.is_api_key_valid(),
                    "available_models": provider.get_available_models(),
                    "default_model": provider.get_default_model(),
                    "provider_name": provider.provider_name
                }
        
        return status
    
    def get_all_providers(self) -> Dict[str, Any]:
        """
        Get all provider instances.
        
        Returns:
            Dictionary of provider instances
        """
        return self.providers.copy()
    
    def get_provider_by_name(self, provider_name: str):
        """
        Get a specific provider by name.
        
        Args:
            provider_name: Name of the provider (gemini, openai, claude)
            
        Returns:
            The provider instance, or None if not found
        """
        return self.providers.get(provider_name.lower())


# Global instance
llm_provider_service = LLMProviderService()
