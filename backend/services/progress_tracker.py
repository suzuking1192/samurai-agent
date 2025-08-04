from enum import Enum
import asyncio
import json
import logging
from typing import List, Dict, Any, Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class PlanningStep(Enum):
    ANALYZING_REQUEST = "analyzing_request"
    DETECTING_INTENT = "detecting_intent"
    GATHERING_CONTEXT = "gathering_context"
    PLANNING_ACTIONS = "planning_actions"
    SEARCHING_DATA = "searching_data"
    EXECUTING_TOOLS = "executing_tools"
    GENERATING_RESPONSE = "generating_response"
    COMPLETE = "complete"
    ERROR = "error"


class ProgressUpdate:
    def __init__(self, step: PlanningStep, message: str, details: Dict = None):
        self.step = step
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.now()
    
    def to_dict(self):
        return {
            "step": self.step.value,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat()
        }
    
    def get_unique_key(self):
        """Generate a unique key for deduplication"""
        # Use step and message only for deduplication, not timestamp
        # This prevents the same progress update from being sent multiple times
        return f"{self.step.value}-{self.message}"


class ProgressTracker:
    def __init__(self, progress_callback: Callable = None):
        self.progress_callback = progress_callback
        self.steps = []
        self.current_step = None
        self.sent_progress_keys = set()  # Track sent progress to prevent duplicates
    
    async def update_progress(self, step: PlanningStep, message: str, details: Dict = None):
        """
        Update progress and notify frontend with deduplication
        """
        progress = ProgressUpdate(step, message, details)
        
        # Check if this progress update is a duplicate
        progress_key = progress.get_unique_key()
        if progress_key in self.sent_progress_keys:
            logger.debug(f"Skipping duplicate progress update: {progress_key}")
            return
        
        # Add to sent keys to prevent future duplicates
        self.sent_progress_keys.add(progress_key)
        
        self.steps.append(progress)
        self.current_step = step
        
        if self.progress_callback:
            await self.progress_callback(progress.to_dict())
        
        # Small delay to make progress visible to users
        await asyncio.sleep(0.3)
    
    def get_progress_summary(self):
        return {
            "total_steps": len(self.steps),
            "current_step": self.current_step.value if self.current_step else None,
            "steps": [step.to_dict() for step in self.steps]
        }
    
    def get_current_progress(self):
        """Get the current progress state for real-time updates"""
        return {
            "current_step": self.current_step.value if self.current_step else None,
            "total_steps": len(self.steps),
            "latest_step": self.steps[-1].to_dict() if self.steps else None,
            "all_steps": [step.to_dict() for step in self.steps]
        }
    
    def reset(self):
        """Reset the progress tracker for a new conversation"""
        self.steps = []
        self.current_step = None
        self.sent_progress_keys.clear() 