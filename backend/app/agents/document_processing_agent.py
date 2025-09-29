"""
Document Processing Agent for the LangGraph agentic architecture.

This agent handles document text extraction, cleaning, OCR error correction,
language detection, and markdown structure detection.
"""

import logging
import re
import unicodedata
from typing import Dict, Any, List, Tuple, Optional

from ..services.llm_service import get_default_llm_service
from langdetect import detect
from langdetect.lang_detect_exception import LangDetectException

from .base_agent import BaseAgent
from ..services.document_processor import (
    process_document_for_text,
    base64_to_text,
    clean_text as basic_clean_text
)
from ..errors.document_processor_errors import DocumentProcessorError

logger = logging.getLogger(__name__)


class DocumentProcessingAgent(BaseAgent):
    """
    Agent for processing documents with enhanced text cleaning and structure detection.

    Capabilities:
    - Text extraction from PDF, DOCX, images
    - OCR error correction using LLM
    - Language detection for proper text correction
    - Markdown structure detection and conversion
    - Content quality assessment
    """

    def __init__(self, max_retry_attempts: int = 3):
        super().__init__("document_processing", max_retry_attempts)
        self.llm_service = get_default_llm_service()
        self.logger = logging.getLogger(f"{__name__}.DocumentProcessingAgent")

    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute document processing with enhanced cleaning and structure detection.

        Args:
            input_data: Dict containing:
                - file_bytes: bytes of the file
                - mime_type: MIME type of the file
                - filename: optional filename
                - enable_llm_cleaning: whether to use LLM for text cleaning
                - enable_quality_assessment: whether to assess content quality

        Returns:
            Dict containing:
                - processed_text: cleaned and structured text
                - language: detected language
                - markdown_structure: detected structure elements
                - quality_score: optional quality assessment
                - original_pages: original extracted pages
        """
        self.update_progress(5, "Starting document processing")

        # Extract required parameters
        file_bytes = input_data.get("file_bytes")
        mime_type = input_data.get("mime_type")
        filename = input_data.get("filename", "unknown")
        enable_llm_cleaning = input_data.get("enable_llm_cleaning", True)
        enable_quality_assessment = input_data.get("enable_quality_assessment", False)

        if not file_bytes or not mime_type:
            raise DocumentProcessorError("file_bytes and mime_type are required")

        self.logger.info(f"Processing document: {filename} ({mime_type})")

        # Step 1: Extract raw text using existing functionality
        self.update_progress(10, "Extracting raw text")
        try:
            if isinstance(file_bytes, str):
                # Handle base64 encoded input
                page_texts = base64_to_text(file_bytes, mime_type)
            else:
                # Handle direct bytes input
                page_texts = process_document_for_text(file_bytes, mime_type)
        except Exception as e:
            self.logger.error(f"Text extraction failed: {str(e)}")
            raise DocumentProcessorError(f"Text extraction failed: {str(e)}")

        # Combine all pages into single text
        combined_text = "\n\n".join([text for _, text in page_texts])

        self.update_progress(30, "Detecting language")

        # Step 2: Detect language
        detected_language = await self._detect_language(combined_text)

        self.update_progress(40, "Cleaning and correcting text")

        # Step 3: Enhanced text cleaning
        if enable_llm_cleaning:
            cleaned_text = await self._llm_enhanced_cleaning(
                combined_text, detected_language
            )
        else:
            cleaned_text = self._basic_text_cleaning(combined_text)

        self.update_progress(60, "Detecting markdown structure")

        # Step 4: Markdown structure detection
        markdown_structure = await self._detect_markdown_structure(cleaned_text)

        self.update_progress(80, "Applying structural formatting")

        # Step 5: Apply markdown formatting
        processed_text = await self._apply_markdown_formatting(
            cleaned_text, markdown_structure
        )

        # Step 6: Optional quality assessment
        quality_score = None
        if enable_quality_assessment:
            self.update_progress(90, "Assessing content quality")
            quality_score = await self._assess_content_quality(processed_text)

        self.update_progress(100, "Document processing complete")

        return {
            "processed_text": processed_text,
            "language": detected_language,
            "markdown_structure": markdown_structure,
            "quality_score": quality_score,
            "original_pages": page_texts,
            "filename": filename
        }

    async def _detect_language(self, text: str) -> str:
        """Detect the language of the text."""
        try:
            # Use only first 1000 characters for language detection
            sample_text = text[:1000].strip()
            if not sample_text:
                return "unknown"


            detected = detect(sample_text)
            self.logger.debug(f"Detected language: {detected}")
            return detected
        except (LangDetectException, Exception) as e:
            self.logger.warning(f"Language detection failed: {str(e)}")
            return "unknown"

    def _basic_text_cleaning(self, text: str) -> str:
        """Apply basic text cleaning without LLM."""
        # Use existing basic cleaning
        cleaned = basic_clean_text(text)

        # Additional cleaning for better structure
        # Fix common OCR errors
        cleaned = re.sub(r'\b(\w+)-\n(\w+)\b', r'\1\2', cleaned)  # Fix hyphenated words
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)  # Normalize line breaks
        cleaned = re.sub(r'([.!?])\n([A-Z])', r'\1 \2', cleaned)  # Fix sentence breaks

        return cleaned.strip()

    async def _llm_enhanced_cleaning(self, text: str, language: str) -> str:
        """Use Groq LLM to correct OCR errors and improve text quality."""
        try:
            prompt = f"""Clean and correct the following text that may contain OCR errors. The text is in {language} language.

Please:
1. Fix obvious OCR errors and character misrecognitions
2. Correct spacing and punctuation issues
3. Preserve the original structure and meaning
4. Remove unnecessary line breaks while keeping paragraph structure
5. Fix hyphenated words that were broken across lines

Text to clean:
{text[:3000]}  # Limit text length for LLM processing

Return only the cleaned text, no explanations."""

            cleaned_text = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=4000,
                temperature=0.1  # Low temperature for consistent cleaning
            )

            if cleaned_text:
                self.logger.debug("Groq LLM text cleaning successful")
                return cleaned_text
            else:
                self.logger.warning("LLM returned empty response, using basic cleaning")
                return self._basic_text_cleaning(text)

        except Exception as e:
            self.logger.warning(f"Groq LLM text cleaning failed: {str(e)}, using basic cleaning")
            return self._basic_text_cleaning(text)

    async def _detect_markdown_structure(self, text: str) -> Dict[str, Any]:
        """Use LLM to detect document structure and generate proper markdown."""
        try:
            prompt = f"""Analyze this document text and identify its structural elements. Return a JSON object with the following structure:

{{
    "document_type": "article|report|manual|letter|other",
    "title": "main document title if found",
    "sections": [
        {{
            "type": "header",
            "level": 1-6,
            "text": "section title",
            "start_line": 1
        }}
    ],
    "lists": [
        {{
            "type": "ordered|unordered",
            "items": ["item 1", "item 2"],
            "start_line": 5
        }}
    ],
    "tables": [
        {{
            "headers": ["col1", "col2"],
            "rows": [["data1", "data2"]],
            "start_line": 10
        }}
    ],
    "has_structure": true|false,
    "confidence": 0.0-1.0
}}

Document text to analyze:
{text[:4000]}

Return only the JSON object, no explanations."""

            response = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=2000,
                temperature=0.1
            )

            if response:
                import json
                structure = json.loads(response.strip())
                self.logger.debug(f"LLM detected structure with confidence: {structure.get('confidence', 'unknown')}")
                return structure
            else:
                self.logger.warning("LLM returned empty response for structure detection")
                return self._fallback_structure_detection(text)

        except Exception as e:
            self.logger.warning(f"LLM structure detection failed: {str(e)}, using fallback")
            return self._fallback_structure_detection(text)

    def _fallback_structure_detection(self, text: str) -> Dict[str, Any]:
        """Fallback to basic structure detection if LLM fails."""
        return {
            "document_type": "other",
            "title": None,
            "sections": [],
            "lists": [],
            "tables": [],
            "has_structure": False,
            "confidence": 0.3
        }

    async def _apply_markdown_formatting(self, text: str, structure: Dict[str, Any]) -> str:
        """Apply markdown formatting based on detected structure."""
        if not structure["has_structure"]:
            return text

        lines = text.split('\n')
        processed_lines = []

        for i, line in enumerate(lines):
            line_num = i + 1
            processed_line = line

            # Apply header formatting
            for header in structure["headers"]:
                if header["line_number"] == line_num:
                    level = header["level"]
                    processed_line = f"{'#' * level} {line.strip()}"
                    break

            # Apply list formatting
            for list_item in structure["lists"]:
                if list_item["line_number"] == line_num:
                    # Clean up existing list formatting and apply consistent markdown
                    cleaned = re.sub(r'^[\d\w]+[\.\)]\s*', '- ', line.strip())
                    cleaned = re.sub(r'^[-•*]\s*', '- ', cleaned)
                    processed_line = cleaned
                    break

            # Apply table formatting
            for table in structure["tables"]:
                if table["line_number"] == line_num:
                    # Basic table formatting (pipe-separated)
                    if '|' in line:
                        # Already has pipes, just clean up spacing
                        parts = [part.strip() for part in line.split('|')]
                        processed_line = '| ' + ' | '.join(parts) + ' |'
                    elif '\t' in line:
                        # Convert tabs to pipes
                        parts = [part.strip() for part in line.split('\t')]
                        processed_line = '| ' + ' | '.join(parts) + ' |'
                    break

            processed_lines.append(processed_line)

        return '\n'.join(processed_lines)

    async def _assess_content_quality(self, text: str) -> float:
        """Assess the quality of the processed text."""
        try:
            # Basic quality metrics
            word_count = len(text.split())
            char_count = len(text)
            line_count = len([line for line in text.split('\n') if line.strip()])

            # Calculate basic quality score (0.0 to 1.0)
            quality_score = 0.0

            # Word count factor (more words generally means better extraction)
            if word_count > 100:
                quality_score += 0.3
            elif word_count > 50:
                quality_score += 0.2
            elif word_count > 10:
                quality_score += 0.1

            # Character to word ratio (should be reasonable)
            if word_count > 0:
                char_to_word_ratio = char_count / word_count
                if 4 <= char_to_word_ratio <= 8:  # Good ratio
                    quality_score += 0.2
                elif 3 <= char_to_word_ratio <= 10:  # Acceptable ratio
                    quality_score += 0.1

            # Line structure factor
            if line_count > 5:
                avg_words_per_line = word_count / line_count
                if 5 <= avg_words_per_line <= 15:  # Good line structure
                    quality_score += 0.2
                elif 3 <= avg_words_per_line <= 20:  # Acceptable
                    quality_score += 0.1

            # Text coherence (check for repeated characters/gibberish)
            coherence_score = self._calculate_coherence_score(text)
            quality_score += coherence_score * 0.3

            # Ensure score is between 0 and 1
            quality_score = max(0.0, min(1.0, quality_score))

            self.logger.debug(f"Quality assessment: {quality_score:.2f}")
            return quality_score

        except Exception as e:
            self.logger.warning(f"Quality assessment failed: {str(e)}")
            return 0.5  # Default score

    def _calculate_coherence_score(self, text: str) -> float:
        """Calculate a simple coherence score for the text."""
        if not text:
            return 0.0

        # Check for excessive repetition of characters
        char_counts = {}
        for char in text.lower():
            if char.isalpha():
                char_counts[char] = char_counts.get(char, 0) + 1

        if not char_counts:
            return 0.0

        total_chars = sum(char_counts.values())
        max_char_frequency = max(char_counts.values()) / total_chars

        # If any character appears more than 30% of the time, it's likely gibberish
        if max_char_frequency > 0.3:
            return 0.0
        elif max_char_frequency > 0.2:
            return 0.3
        elif max_char_frequency > 0.15:
            return 0.7
        else:
            return 1.0