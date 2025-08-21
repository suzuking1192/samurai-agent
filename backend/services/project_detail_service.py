import logging
from typing import List, Optional

from .gemini_service import GeminiService
from .file_service import file_service


logger = logging.getLogger(__name__)


class ProjectDetailService:
    """
    Orchestrates LLM-based digestion of long-form project detail with semantic merging.
    - Chunks raw input
    - Summarizes chunks
    - Semantically merges with existing spec (merge/replace/append)
    - Persists final result to project_detail.txt
    """

    def __init__(self, gemini_service: Optional[GeminiService] = None):
        self.gemini = gemini_service or GeminiService()

    async def ingest_project_detail(self, project_id: str, raw_text: str, mode: str = "merge") -> str:
        """
        Ingest new insights into project detail with sophisticated merge logic.
        
        This method addresses the issue where project_detail updates overemphasize recent conversations
        by implementing granular merge rules that preserve existing content while intelligently
        incorporating new insights.
        """
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return ""

        # Step 1: Load the complete existing project_detail content
        existing_project_detail_content = file_service.load_project_detail(project_id)
        new_insight_raw_text = raw_text
        
        # Step 2: Prepare inputs for LLM processing
        # Ensure we have both the existing content and new insights available
        if not existing_project_detail_content:
            existing_project_detail_content = ""
        
        # Step 3: Construct structured input for LLM with explicit merge rules
        mode_normalized = (mode or "merge").lower()
        
        if mode_normalized == "merge" and existing_project_detail_content:
            # Use sophisticated merge prompt with granular rules
            merge_system_prompt = self._build_merge_system_prompt()
            merge_input = self._build_merge_input(existing_project_detail_content, new_insight_raw_text)
            
            final_text = await self.gemini.chat_with_system_prompt(
                "Perform sophisticated merge of existing project detail with new insights", 
                f"{merge_system_prompt}\n\n{merge_input}"
            )
        else:
            # For replace mode or when no existing content, use simpler synthesis
            synthesis_prompt = self._build_synthesis_system_prompt()
            final_text = await self.gemini.chat_with_system_prompt(
                "Create new project detail from insights", 
                f"{synthesis_prompt}\n\nNEW INSIGHTS:\n{new_insight_raw_text}"
            )

        final_text = (final_text or "").strip()
        file_service.save_project_detail(project_id, final_text)
        logger.info(f"Project detail ingested and saved for {project_id} ({len(final_text)} chars, mode={mode_normalized})")
        return final_text

    def _build_merge_system_prompt(self) -> str:
        """
        Build the sophisticated merge system prompt with granular merge rules.
        """
        return """
You are an expert software documentation architect performing a PRECISE MERGE of an existing project specification with new insights. Your goal is to maintain the comprehensive historical context while intelligently incorporating new information.

CRITICAL MERGE RULES:

1. PRESERVATION-FIRST POLICY:
   - Preserve ALL existing content by default
   - Only delete information if the new insights EXPLICITLY contradict it at a phrase level
   - When new insights add detail to existing items, AUGMENT rather than replace
   - If conflicts are ambiguous, keep the original and add the conflicting statement to 'Open Questions'

2. GRANULAR CONTRADICTION HANDLING:
   - Example of ADDITION: "Auth uses JWT" + "Auth is implemented in auth_service.py" = Keep both
   - Example of REPLACEMENT: "stopped using python and now using typescript" = Replace the old tech stack entry
   - Only replace when new information explicitly states a change or correction
   - Preserve context and historical information unless explicitly superseded

3. HEADING MANAGEMENT:
   - STRICTLY rely on existing headings in the current document
   - If a heading doesn't exist for new information, create it using "### New Heading" format
   - Attempt to integrate new information into existing, broad headings first
   - Only create new categories when information is truly misaligned with typical software development sections
   - Example: "AI algorithm" for an "AI agent" project should go under existing "Architecture" or "Tech Stack", not create a new section

4. CONTENT ORGANIZATION:
   - Project Overview: Primary goal and 3-5 main features/value propositions
   - Features: User-visible capabilities (action/result statements)
   - Tech Stack: Technologies, frameworks, libraries as explicitly stated
   - Architecture: System design, patterns, components as explicitly stated
   - Key APIs: Explicitly named endpoints with methods/paths if provided
   - Data Models: Database schema elements (tables, fields, types, relationships)
   - Workflows: Main end-to-end flows (3-8 steps, high level)
   - Constraints: Technical or business limitations
   - Non-Functional Requirements: Performance, security, scalability requirements
   - Open Questions: Gaps, ambiguities, and unresolved conflicts

5. FORMATTING REQUIREMENTS:
   - Maintain existing markdown format exactly
   - Use bullet points for lists
   - Keep original domain terminology
   - Write "Not specified" for sections without explicit information
   - Normalize duplicates using stable canonical names from existing spec

6. COMPLETENESS REQUIREMENTS:
   - Do not drop explicit facts from either source
   - If information doesn't fit neatly, place under 'Constraints' or 'Open Questions'
   - Ensure the entire merge operation is completed in a single response
   - Return the complete, updated project detail as a single markdown string

EXAMPLES OF CORRECT MERGE BEHAVIOR:
- Existing: "Authentication uses OAuth2"
  New: "Authentication is implemented in auth_service.py using JWT tokens"
  Result: "Authentication uses OAuth2 and is implemented in auth_service.py using JWT tokens"

- Existing: "Tech Stack: Python, Django"
  New: "stopped using python and now using typescript"
  Result: "Tech Stack: TypeScript, Django"

- Existing: "Features: User registration, Login"
  New: "Users can upload profile pictures"
  Result: "Features: User registration, Login, Profile picture upload"

Output the complete merged project detail specification with all sections properly organized and formatted.
"""

    def _build_merge_input(self, existing_content: str, new_insights: str) -> str:
        """
        Build the structured input for the LLM merge operation.
        """
        return f"""EXISTING PROJECT DETAIL:
{existing_content}

NEW INSIGHTS TO MERGE:
{new_insights}

INSTRUCTIONS: Perform the merge according to the rules above, ensuring preservation of existing content while intelligently incorporating new insights."""

    def _build_synthesis_system_prompt(self) -> str:
        """
        Build the system prompt for creating new project detail from scratch.
        """
        return """
You are a senior software architect creating comprehensive, reader-friendly documentation for engineers and product/project managers. Extract ONLY facts that are explicitly stated in the provided text.

HARD CONSTRAINTS:
- Extract ONLY facts explicitly present in the text; do NOT fabricate or infer details
- Do NOT create API endpoints, parameters, models, fields, or architectural elements unless explicitly stated
- If a section lacks explicit information, write 'Not specified'
- Move missing-but-important details to 'Open Questions' as questions

ORGANIZE INTO THESE SECTIONS:
- Project Overview: Primary goal and 3-5 main features/value propositions
- Features: User-visible capabilities (action/result statements)
- Tech Stack: Technologies, frameworks, libraries as explicitly stated
- Architecture: System design, patterns, components as explicitly stated
- Key APIs: Explicitly named endpoints with methods/paths if provided
- Data Models: Database schema elements (tables, fields, types, relationships)
- Workflows: Main end-to-end flows (3-8 steps, high level)
- Constraints: Technical or business limitations
- Non-Functional Requirements: Performance, security, scalability requirements
- Open Questions: Gaps, ambiguities, and unresolved conflicts

FORMATTING: Use bullet points, crisp language, and avoid internal jargon where possible.
"""


# Singleton
project_detail_service = ProjectDetailService()


