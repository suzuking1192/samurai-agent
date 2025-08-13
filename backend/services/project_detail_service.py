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
            You are a senior software architect creating comprehensive, reader-friendly documentation for engineers
            and product/project managers. Digest the provided text and extract ONLY facts that are explicitly stated.
            Do NOT infer, guess, extrapolate, or invent any details.

            Principles:
            - Be comprehensive yet concise: capture all explicit, useful facts for understanding the product goal and
              planning implementation, but avoid fluff.
            - Use consistent terminology exactly as written in the source; include aliases only if explicitly provided.
            - If a detail is missing or ambiguous, write 'Not specified' or add a question to 'Open Questions' without
              proposing an answer.

            Output a concise, structured summary using these exact sections (omit sections with no info):
            - Project Overview: primary goal/value proposition, and the 3–5 main features/value points if explicitly
              present. Exclude implementation details. Include target users only if explicitly stated.
            - Features: only user-visible capabilities that are clearly and explicitly described. Omit vague items.
            - Tech Stack: as explicitly stated.
            - Architecture: as explicitly stated.
            - Key APIs: only explicitly named endpoints (methods/paths if present); do not invent.
            - Data Models: only database schema elements (tables/collections, fields, types if provided, relationships).
              Exclude DTOs/payload shapes/runtime objects unless the text explicitly marks them as schema.
            - Workflows: only main end-to-end flows at a high level (roughly 3–8 steps); exclude micro-interactions.
            - Constraints
            - Non-Functional Requirements
            - Open Questions
            Formatting: Use bullet points, crisp language, and avoid internal jargon where possible (unless it appears
            verbatim in the text).
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
                """
                You are updating an existing software project specification to be comprehensive and easy to understand
                for engineers and product/project managers. Perform a STRICT, FACTS-ONLY, CONSERVATIVE SEMANTIC MERGE of
                the EXISTING SPEC with the NEW INSIGHTS.

                Preservation-first merge policy:
                - Preserve existing content by default. Do not delete, weaken, rename, or downgrade existing items unless
                  the NEW INSIGHTS explicitly deprecate, replace, or correct that exact item.
                - When NEW INSIGHTS add detail to an existing item, augment the existing item with the additional detail.
                - If NEW INSIGHTS conflict ambiguously with existing content, keep the original and add the conflicting
                  statement under 'Open Questions' as a question to resolve; do not choose a side.
                - Never infer, guess, or invent any details (APIs, endpoints, parameters, models, fields, services,
                  libraries, versions, or architectural components). Include ONLY items explicitly present in either the
                  existing spec or the new insights text.
                - Comprehensiveness: do not drop explicit facts from either source. If a fact does not neatly fit a
                  section but is relevant, place it under 'Constraints' or 'Open Questions' rather than omitting it.

                Section rules (optimize for understanding the goal and major capabilities):
                - Project Overview: include only the primary goal and 3–5 main features/value propositions. Exclude
                  implementation details, APIs, workflows, tech stack, constraints, or minor specifics.
                - Features: include only user-visible capabilities that are explicitly and clearly described. If an item
                  is vague or unclear, omit it from this section. Each item should be a short action/result statement
                  (e.g., "Users can … to …").
                - Tech Stack and Architecture: list exactly as explicitly stated; do not infer or rename.
                - Key APIs: include only endpoints explicitly named (methods/paths if provided). Omit examples and
                  payload minutiae unless explicitly present.
                - Data Models: include only database schema elements (tables/collections, fields, types if provided,
                  and relationships). Exclude runtime objects, DTOs, API payload shapes, and memory categories. If types
                  are not stated, note "type: Not specified".
                - Workflows: capture only main end-to-end flows at a high level (roughly 3–8 steps). Exclude UI micro-
                  interactions, edge cases, error/status code details, and payload/response examples.
                - Constraints and Non-Functional Requirements: include only what is explicitly stated.
                - Open Questions: list gaps, ambiguities, and conflicts.

                Clarity and formatting for a broad audience:
                - Use bullet points and short, direct sentences.
                - Prefer clear phrasing without internal shorthand. Keep original domain terms but avoid unexplained jargon.
                - If a section lacks explicit information, write 'Not specified'.
                - Normalize duplicates; prefer stable canonical names present in the existing spec when possible.

                Output a single concise 'Project Detail Specification' with these exact sections:
                Project Overview, Features, Tech Stack, Architecture, Key APIs, Data Models, Workflows, Constraints,
                Non-Functional Requirements, Open Questions.
                """
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


