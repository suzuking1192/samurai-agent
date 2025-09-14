"""
Abstract base class for LLM services providing a unified interface.
"""
import os
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class AbstractLLMService(ABC):
    """
    Abstract base class for LLM services.
    
    Provides a unified interface for different LLM providers (Gemini, OpenAI, Claude)
    with consistent methods for chat interactions, cost tracking, and API key validation.
    """
    
    def __init__(self, provider_name: str, api_key_env_var: str, models_env_var: str, 
                 input_cost_env_var: str, output_cost_env_var: str):
        """
        Initialize the LLM service.
        
        Args:
            provider_name: Name of the provider (e.g., "Gemini", "OpenAI", "Claude")
            api_key_env_var: Environment variable name for the API key
            models_env_var: Environment variable name for the models list
            input_cost_env_var: Environment variable name for input cost per 1M tokens
            output_cost_env_var: Environment variable name for output cost per 1M tokens
        """
        self.provider_name = provider_name
        self.api_key = os.getenv(api_key_env_var)
        self.use_mock = os.getenv("SAMURAI_USE_MOCK_LLM") == "1"
        self.is_key_valid = self._validate_api_key()
        
        # Load cost configuration
        self.input_cost_per_m_tokens = float(os.getenv(input_cost_env_var, "0.0"))
        self.output_cost_per_m_tokens = float(os.getenv(output_cost_env_var, "0.0"))
        
        # Load available models
        self.available_models = self._load_models(models_env_var)
        self.default_model = self.available_models[0] if self.available_models else None
        
        # Initialize client
        self.client = self._initialize_client()
        
        if self.use_mock:
            logger.warning(f"SAMURAI_USE_MOCK_LLM=1 detected. Using mock LLM model for {provider_name} responses.")
        elif self.is_key_valid:
            logger.info(f"{provider_name} service initialized successfully")
        else:
            logger.warning(f"{provider_name} API key not set or invalid. Service will return warning messages.")
    
    def _validate_api_key(self) -> bool:
        """Check if the API key is valid and available."""
        return bool(self.api_key and len(self.api_key) > 10)
    
    def _load_models(self, models_env_var: str) -> List[str]:
        """
        Load and parse the models list from environment variables.
        
        Args:
            models_env_var: Environment variable name for the models list
            
        Returns:
            List of available model names
        """
        models_str = os.getenv(models_env_var, "")
        if not models_str:
            logger.warning(f"No models configured for {self.provider_name} in {models_env_var}")
            return []
        
        # Split by comma and strip whitespace
        models = [model.strip() for model in models_str.split(",") if model.strip()]
        logger.info(f"Loaded {len(models)} models for {self.provider_name}: {models}")
        return models
    
    @abstractmethod
    def _initialize_client(self):
        """Initialize the provider-specific client."""
        pass
    
    @abstractmethod
    async def chat(self, message: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with the LLM. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            context: Optional context string
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        pass
    
    @abstractmethod
    async def chat_with_system_prompt(self, message: str, system_prompt: str, project_id: str = None) -> str:
        """
        Chat with a custom system prompt. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            system_prompt: System prompt to guide the conversation
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        pass
    
    def is_api_key_valid(self) -> bool:
        """Return whether the API key is valid and the service can make real API calls."""
        return self.is_key_valid and not self.use_mock
    
    def get_available_models(self) -> List[str]:
        """Get list of available models for this provider."""
        return self.available_models.copy()
    
    def get_default_model(self) -> Optional[str]:
        """Get the default model for this provider."""
        return self.default_model
    
    def _calculate_llm_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate the cost for an LLM call based on token usage.
        
        Args:
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated
            
        Returns:
            Calculated cost in dollars
        """
        input_cost = (input_tokens / 1_000_000) * self.input_cost_per_m_tokens
        output_cost = (output_tokens / 1_000_000) * self.output_cost_per_m_tokens
        return input_cost + output_cost
    
    def _save_llm_call_record(self, input_tokens: int, output_tokens: int, cost: float, 
                             project_id: str = None, model_name: str = None) -> None:
        """
        Save LLM call record to daily usage file.
        
        Args:
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated  
            cost: Calculated cost for the call
            project_id: Project ID if available
            model_name: Name of the model used for the call
        """
        try:
            from models import LLMCallRecord
            from ..core.file_service import file_service
            
            # Use provided model_name or default model
            actual_model_name = model_name or self.default_model or f"{self.provider_name.lower()}-unknown"
            
            record = LLMCallRecord(
                timestamp=datetime.now(),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
                project_id=project_id or "unknown",
                model_name=actual_model_name
            )
            
            file_service.save_llm_call_record(record)
            logger.debug(f"Saved LLM call record: {input_tokens} input, {output_tokens} output, ${cost:.6f}")
        except Exception as e:
            logger.error(f"Failed to save LLM call record: {e}")
            # Don't raise - cost tracking failure shouldn't break the main functionality
    
    def _create_mock_response(self, message: str) -> str:
        """
        Create a mock response for testing purposes.
        
        Args:
            message: The user message
            
        Returns:
            Mock response text
        """
        preview = message[:120] + "..." if len(message) > 120 else message
        return f"[mock-{self.provider_name.lower()}] {preview if preview else 'OK'}"
