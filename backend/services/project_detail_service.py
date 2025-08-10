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
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return ""

        # 1) Chunk raw input for LLM limits
        max_chunk_chars = 8000
        chunks: List[str] = [raw_text[i:i + max_chunk_chars] for i in range(0, len(raw_text), max_chunk_chars)]

        # 2) Summarize chunks individually
        partial_summaries: List[str] = []
        chunk_system_prompt = (
            """
            You are a senior software architect. Digest the following raw notes/document text and extract ONLY facts
            that are explicitly stated. Do NOT infer, guess, extrapolate, or invent any details.

            Strict rules:
            - Never make up API endpoints, routes, parameters, response schemas, data models, fields, services,
              libraries, versions, or architectural components that are not explicitly present in the text.
            - If a detail is missing or ambiguous, mark it as 'Not specified' or include it under 'Open Questions'
              as a question (do not propose an answer).
            - Prefer exact domain terms as written; do not rename concepts unless the text provides the alias.
            - Remove fluff and keep only actionable information useful for software design.

            Output a concise, structured summary using these headings when applicable (omit headings with no info):
            - Goals
            - Features (only if explicitly stated; do not invent)
            - Tech Stack (as stated)
            - Architecture (as stated)
            - Key APIs (only if explicitly named; do not invent).
            - Data Models (only if explicitly named; do not invent).
            - Workflows
            - Constraints
            - Non-Functional Requirements
            - Open Questions
            """
        )
        for chunk in chunks:
            summary = await self.gemini.chat_with_system_prompt(chunk, chunk_system_prompt)
            partial_summaries.append((summary or "").strip())

        # 3) Semantic merge synthesis with existing content
        synthesis_input = "\n\n".join(partial_summaries)
        existing_detail = file_service.load_project_detail(project_id)
        mode_normalized = (mode or "merge").lower()

        # append => concatenate then perform semantic merge to dedupe and update
        if mode_normalized == "append" and existing_detail:
            synthesis_input = existing_detail.strip() + "\n\n" + synthesis_input
            mode_for_prompt = "merge"
        else:
            mode_for_prompt = mode_normalized

        if mode_for_prompt == "merge" and existing_detail:
            merge_system_prompt = (
                "You are updating an existing software project specification. Perform a STRICT, FACTS-ONLY "
                "SEMANTIC MERGE of the EXISTING SPEC with the NEW INSIGHTS.\n\n"
                "Non-negotiable constraints:\n"
                "- Do NOT infer, guess, or invent any details (APIs, endpoints, parameters, models, fields, services, "
                "  libraries, versions, or architecture). Include ONLY items explicitly present in either the existing "
                "  spec or the new insights text.\n"
                "- If a section lacks explicit information, write 'Not specified'.\n"
                "- If conflicts exist, prefer the most recent NEW insight only when it is explicitly more specific; "
                "  otherwise, surface the conflict in 'Open Questions' without resolving by assumption.\n"
                "- Normalize duplicates and keep the result concise and implementable.\n\n"
                "Output a single concise 'Project Detail Specification' using these sections:\n"
                "Project Overview, Features, Tech Stack, Architecture, Key APIs, Data Models, Workflows, Constraints, "
                "Non-Functional Requirements, Open Questions.\n\n"
                "Formatting rules:\n"
                "- Use bullet points.\n"
                "- Under 'Features', include ONLY features explicitly present in inputs. If none are present, write 'Not specified'.\n"
                "- Under 'Key APIs' and 'Data Models', include ONLY items explicitly present in inputs. If none are "
                "  present, write 'Not specified'.\n"
                "- Put unknowns and needed clarifications in 'Open Questions' as questions."
            )
            merge_input = f"EXISTING SPEC:\n{existing_detail}\n\nNEW INSIGHTS (summaries):\n{synthesis_input}"
            final_text = await self.gemini.chat_with_system_prompt(
                "Merge existing spec with new insights semantically", f"{merge_system_prompt}\n\n{merge_input}"
            )
        else:
            # replace or no existing
            replace_system_prompt = (
                "Synthesize the provided summaries into a single concise 'Project Detail Specification' suitable as a "
                "permanent reference for an AI coding assistant.\n\n"
                "Hard constraints:\n"
                "- Extract ONLY facts explicitly present in the summaries; do NOT fabricate or infer details.\n"
                "- Do NOT create API endpoints, parameters, models, fields, or architectural elements unless they are "
                "  explicitly stated.\n"
                "- If a section lacks explicit information, write 'Not specified'.\n"
                "- Move missing-but-important details to 'Open Questions' as questions.\n\n"
                "Use these sections: Project Overview, Tech Stack, Architecture, Key APIs, Data Models, Workflows, "
                "Constraints, Non-Functional Requirements, Features, Open Questions. Use bullet points and keep it crisp."
            )
            final_text = await self.gemini.chat_with_system_prompt(
                "Create synthesized project detail", f"{replace_system_prompt}\n\n{synthesis_input}"
            )

        final_text = (final_text or "").strip()
        file_service.save_project_detail(project_id, final_text)
        logger.info(f"Project detail ingested and saved for {project_id} ({len(final_text)} chars, mode={mode_for_prompt})")
        return final_text


# Singleton
project_detail_service = ProjectDetailService()


