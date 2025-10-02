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
    clean_text as basic_clean_text,
    pdf_pages_to_images
)
from ..services.llm_service import LLMServiceFactory
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
        # Text LLM for cleaning and conversion
        self.llm_service = get_default_llm_service()
        # Vision LLM for PDF extraction - use full model ID
        self.vision_service = LLMServiceFactory.get_service(
            model_name="meta-llama/llama-4-scout-17b-16e-instruct"
        )
        self.logger = logging.getLogger(f"{__name__}.DocumentProcessingAgent")

    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute document processing with enhanced cleaning and markdown conversion.

        Args:
            input_data: Dict containing:
                - file_bytes: bytes of the file
                - mime_type: MIME type of the file
                - filename: optional filename
                - enable_llm_cleaning: whether to use LLM for text cleaning
                - enable_markdown_conversion: whether to convert to markdown
                - enable_quality_assessment: whether to assess content quality

        Returns:
            Dict containing:
                - raw_text: original extracted text (unprocessed)
                - cleaned_text: cleaned text with structure preserved
                - markdown_text: markdown-formatted version
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
        enable_markdown_conversion = input_data.get("enable_markdown_conversion", True)
        enable_quality_assessment = input_data.get("enable_quality_assessment", False)
        custom_vision_prompt = input_data.get("custom_vision_prompt")  # NEW: Custom prompt for vision model

        if not file_bytes or not mime_type:
            raise DocumentProcessorError("file_bytes and mime_type are required")

        self.logger.info(f"Processing document: {filename} ({mime_type})")

        # Step 1: Extract raw text
        # For PDFs and images, try vision extraction first, then fallback to traditional
        vision_markdown = None
        is_pdf = mime_type == "application/pdf"
        is_image = mime_type.startswith("image/")

        if is_pdf:
            self.update_progress(10, "Extracting PDF with vision model")
            try:
                # Convert base64 to bytes if needed
                if isinstance(file_bytes, str):
                    import base64 as b64
                    pdf_bytes = b64.b64decode(file_bytes)
                else:
                    pdf_bytes = file_bytes

                # Try vision extraction with optional custom prompt
                vision_markdown, page_images = await self._extract_pdf_with_vision(
                    pdf_bytes, filename, custom_prompt=custom_vision_prompt
                )
                self.logger.info("Vision extraction successful")

            except Exception as vision_error:
                self.logger.warning(
                    f"Vision extraction failed: {str(vision_error)}, falling back to traditional extraction"
                )
                vision_markdown = None  # Mark as failed

        elif is_image:
            self.update_progress(10, "Extracting image with vision model")
            try:
                # Convert base64 to bytes if needed
                if isinstance(file_bytes, str):
                    import base64 as b64
                    image_bytes = b64.b64decode(file_bytes)
                else:
                    image_bytes = file_bytes

                # Try vision extraction for single image with optional custom prompt
                vision_markdown = await self._extract_image_with_vision(
                    image_bytes, filename, custom_prompt=custom_vision_prompt
                )
                self.logger.info("Image vision extraction successful")

            except Exception as vision_error:
                self.logger.warning(
                    f"Image vision extraction failed: {str(vision_error)}, falling back to OCR"
                )
                vision_markdown = None  # Mark as failed

        # Traditional extraction (for non-PDFs or as fallback)
        self.update_progress(15, "Extracting raw text (traditional method)")
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

        # Combine all pages into single text (raw text)
        raw_text = "\n\n".join([text for _, text in page_texts])

        self.update_progress(30, "Detecting language")

        # Step 2: Detect language
        detected_language = await self._detect_language(raw_text)

        self.update_progress(40, "Processing document text")

        # Step 3: Generate markdown (vision or LLM-based)
        if vision_markdown:
            markdown_text = vision_markdown
            self.logger.info("Using vision-extracted markdown")
        elif enable_markdown_conversion:
            # Traditional flow: clean text first, then convert to markdown
            if enable_llm_cleaning:
                cleaned_text = await self._llm_enhanced_cleaning(
                    raw_text, detected_language
                )
            else:
                cleaned_text = self._basic_text_cleaning(raw_text)

            markdown_text = await self._convert_to_markdown(
                cleaned_text, detected_language
            )
        else:
            # No markdown conversion
            if enable_llm_cleaning:
                cleaned_text = await self._llm_enhanced_cleaning(
                    raw_text, detected_language
                )
            else:
                cleaned_text = self._basic_text_cleaning(raw_text)
            markdown_text = cleaned_text

        self.update_progress(70, "Generating clean text for RAG")

        # Step 4: Generate clean text optimized for RAG from markdown
        cleaned_text = await self._generate_clean_text_from_markdown(
            markdown_text, detected_language
        )

        self.update_progress(75, "Detecting markdown structure")

        # Step 5: Markdown structure detection (for metadata)
        markdown_structure = await self._detect_markdown_structure(cleaned_text)

        # Step 6: Optional quality assessment
        quality_score = None
        if enable_quality_assessment:
            self.update_progress(90, "Assessing content quality")
            quality_score = await self._assess_content_quality(cleaned_text)

        self.update_progress(100, "Document processing complete")

        # Create markdown pages for chunking
        # Priority: vision markdown > LLM-converted markdown > original pages
        if vision_markdown:
            # Best case: Use vision-extracted markdown for chunking
            markdown_pages = [(1, markdown_text)]
            self.logger.info("Using vision-extracted markdown for chunking")
        elif enable_markdown_conversion and markdown_text != raw_text:
            # Fallback case 1: Vision failed but LLM converted to markdown successfully
            markdown_pages = [(1, markdown_text)]
            self.logger.info("Using LLM-converted markdown for chunking (vision unavailable)")
        else:
            # Fallback case 2: No markdown available, use original pages
            markdown_pages = page_texts
            self.logger.info("Using original extracted text for chunking (no markdown conversion)")

        return {
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "markdown_text": markdown_text,  # Unified markdown (vision or LLM-converted)
            "used_vision": vision_markdown is not None,  # Flag to indicate vision was used
            "language": detected_language,
            "markdown_structure": markdown_structure,
            "quality_score": quality_score,
            "original_pages": page_texts,  # Original OCR/text extraction
            "markdown_pages": markdown_pages,  # NEW: Use this for chunking (structured markdown)
            "filename": filename
        }

    async def _extract_pdf_with_vision(
        self,
        file_bytes: bytes,
        filename: str,
        custom_prompt: Optional[str] = None
    ) -> Tuple[str, List[Tuple[int, str]]]:
        """
        Extract text from PDF using vision model.

        Args:
            file_bytes: PDF file bytes
            filename: Name of the file for logging
            custom_prompt: Optional custom prompt for vision extraction

        Returns:
            Tuple of (combined_markdown, page_images)
        """
        self.logger.info(f"Extracting PDF with vision model: {filename}")

        try:
            # Convert PDF pages to high-res images
            page_images = pdf_pages_to_images(file_bytes, dpi=300)

            if not page_images:
                raise DocumentProcessorError("No pages found in PDF")

            # Process pages in batches (max 5 images per request per Groq limit)
            batch_size = 5
            all_markdown_pages = []

            for batch_start in range(0, len(page_images), batch_size):
                batch_end = min(batch_start + batch_size, len(page_images))
                batch = page_images[batch_start:batch_end]

                page_numbers = [page_num for page_num, _ in batch]
                images = [img_data for _, img_data in batch]

                self.logger.info(f"Processing pages {page_numbers[0]}-{page_numbers[-1]} with vision model")

                # Use custom prompt if provided, otherwise use default
                if custom_prompt:
                    prompt = custom_prompt
                else:
                    # Create default prompt for vision model
                    prompt = f"""You are an expert document analyzer. Extract ALL text from {"this page" if len(batch) == 1 else "these pages"} and convert it to clean, well-structured markdown.

Your task:
1. Extract ALL text accurately, preserving the exact wording
2. Identify and format structural elements:
   - Headers: Use #, ##, ### based on hierarchy
   - Lists: Use - for bullets, 1. 2. 3. for numbered lists
   - Tables: Use markdown table format with | pipes
   - Code blocks: Use ``` for code snippets
   - Emphasis: Use **bold** and *italic* appropriately
3. Handle special content intelligently:
   - For diagrams/images: ONLY if visible and meaningful, provide detailed descriptions in [Image: ...] format including:
     * What the diagram shows (flowchart, architecture, process, etc.)
     * Key components and their relationships
     * Labels, arrows, and connections
     * Colors or visual distinctions if meaningful
   - For charts/graphs: ONLY if visible, describe in detail in [Chart: ...] format:
     * Type of chart (bar, line, pie, scatter, etc.)
     * Axes labels and scales
     * Key data points and trends
     * Legend information
   - For photographs/illustrations: ONLY if meaningful, describe what is shown and its relevance
   - For tables: Extract and format accurately, preserving all symbols and structure
4. Preserve all relationships between text blocks (maintain logical flow)
5. Add horizontal rules (---) between major sections if appropriate

CRITICAL RULES:
- Do NOT omit any text, even if it seems redundant
- Do NOT add placeholder text like "No data visible" or "No charts present" - simply skip those sections
- Do NOT add explanations or commentary beyond describing actual visual elements
- Do NOT invent content - only describe what you actually see
- If there are no images/charts/diagrams, simply extract the text without mentioning their absence
- Output ONLY the markdown-formatted text

{"Page " + str(page_numbers[0]) + ":" if len(batch) == 1 else f"Pages {page_numbers[0]}-{page_numbers[-1]}:"}"""

                # Call vision model
                markdown_text = await self.vision_service.generate_vision_response(
                    prompt=prompt,
                    images=images,
                    temperature=0.1,  # Low temp for accuracy
                    max_tokens=8000
                )

                # Log rate limit info after request
                rate_limit_info = self.vision_service.get_rate_limit_info()
                self.logger.info(
                    f"Vision model rate limits - "
                    f"Requests remaining: {rate_limit_info['requests_remaining']}/{rate_limit_info['requests_per_minute_limit']} per minute, "
                    f"{rate_limit_info['day_remaining']}/{rate_limit_info['requests_per_day_limit']} per day"
                )

                all_markdown_pages.append(markdown_text)

            # Combine all pages
            combined_markdown = "\n\n---\n\n".join(all_markdown_pages)

            # Calculate total API calls made
            num_batches = len(all_markdown_pages)
            final_rate_info = self.vision_service.get_rate_limit_info()

            self.logger.info(
                f"Vision extraction complete: {len(page_images)} pages, "
                f"{len(combined_markdown)} characters, "
                f"{num_batches} API calls made"
            )
            self.logger.info(
                f"Vision model daily quota: {final_rate_info['day_remaining']}/{final_rate_info['requests_per_day_limit']} requests remaining"
            )

            return combined_markdown, page_images

        except Exception as e:
            self.logger.error(f"Vision-based PDF extraction failed: {str(e)}")
            raise DocumentProcessorError(f"Vision extraction failed: {str(e)}")

    async def _extract_image_with_vision(
        self,
        image_bytes: bytes,
        filename: str,
        custom_prompt: Optional[str] = None
    ) -> str:
        """
        Extract text from a single image using vision model.

        Args:
            image_bytes: Image file bytes
            filename: Name of the file for logging
            custom_prompt: Optional custom prompt for vision extraction

        Returns:
            Markdown-formatted text extracted from the image
        """
        self.logger.info(f"Extracting image with vision model: {filename}")

        try:
            # Convert image bytes to base64 data URI
            import base64
            img_base64 = base64.b64encode(image_bytes).decode('utf-8')

            # Detect image format from bytes
            if image_bytes.startswith(b'\x89PNG'):
                image_format = 'png'
            elif image_bytes.startswith(b'\xff\xd8\xff'):
                image_format = 'jpeg'
            elif image_bytes.startswith(b'GIF'):
                image_format = 'gif'
            elif image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP':
                image_format = 'webp'
            else:
                image_format = 'png'  # Default

            data_uri = f"data:image/{image_format};base64,{img_base64}"

            # Use custom prompt if provided, otherwise use default
            if custom_prompt:
                prompt = custom_prompt
            else:
                # Default prompt for image extraction
                prompt = """You are an expert image analyzer. Extract ALL text from this image and convert it to clean, well-structured markdown.

Your task:
1. Extract ALL text accurately, preserving the exact wording
2. Identify and format structural elements:
   - Headers: Use #, ##, ### based on hierarchy
   - Lists: Use - for bullets, 1. 2. 3. for numbered lists
   - Tables: Use markdown table format with | pipes
   - Code blocks: Use ``` for code snippets
   - Emphasis: Use **bold** and *italic* appropriately
3. Handle special content intelligently:
   - For diagrams: Provide detailed descriptions in [Diagram: ...] format
   - For charts/graphs: Describe data, trends, and axes in [Chart: ...] format
   - For photos: Describe what is shown if relevant to content
4. Preserve logical flow and relationships between text blocks
5. Add horizontal rules (---) between major sections if appropriate

CRITICAL RULES:
- Do NOT omit any text
- Do NOT add placeholder text if no visuals exist - simply skip
- Do NOT add explanations beyond describing actual visual elements
- Do NOT invent content
- Output ONLY the markdown-formatted text

Extract the content now:"""

            # Call vision model with single image
            markdown_text = await self.vision_service.generate_vision_response(
                prompt=prompt,
                images=[data_uri],
                temperature=0.1,  # Low temp for accuracy
                max_tokens=8000
            )

            # Log rate limit info
            rate_limit_info = self.vision_service.get_rate_limit_info()
            self.logger.info(
                f"Vision model rate limits - "
                f"Requests remaining: {rate_limit_info['requests_remaining']}/{rate_limit_info['requests_per_minute_limit']} per minute, "
                f"{rate_limit_info['day_remaining']}/{rate_limit_info['requests_per_day_limit']} per day"
            )

            self.logger.info(f"Image vision extraction complete: {len(markdown_text)} characters")

            return markdown_text

        except Exception as e:
            self.logger.error(f"Vision-based image extraction failed: {str(e)}")
            raise DocumentProcessorError(f"Image vision extraction failed: {str(e)}")

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
        """Use Groq LLM to intelligently clean text while preserving structure."""
        try:
            prompt = f"""You are a text cleaning expert. Clean the following text that may contain OCR errors and structural artifacts. The text is in {language} language.

Your task is to produce clean, readable text that:
1. Fixes OCR errors (misrecognized characters like 'l' for 'I', '0' for 'O')
2. Removes structural symbols that don't add meaning (excessive dashes, asterisks, underscores used for decoration)
3. Preserves meaningful structure:
   - Keep list indicators (numbers, bullets) but make them consistent
   - Maintain paragraph breaks
   - Preserve table-like structures
   - Keep section separators that indicate topic changes
4. Fixes spacing issues (multiple spaces, broken hyphenated words)
5. Removes headers/footers that repeat on every page
6. Corrects punctuation

IMPORTANT: Do not remove all structural elements - keep those that help understand the content organization (lists, tables, sections). Only remove decorative/meaningless symbols.

Text to clean:
{text[:5000]}

Return only the cleaned text with preserved structure. No explanations or meta-commentary."""

            cleaned_text = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=6000,
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

    async def _generate_clean_text_from_markdown(self, markdown_text: str, language: str) -> str:
        """
        Generate clean text optimized for RAG/LLM from markdown.
        Removes markdown syntax while preserving document structure for smart chunking.
        """
        try:
            prompt = f"""You are a text processing expert. Convert the following markdown document into clean plain text optimized for semantic search and RAG systems. The text is in {language} language.

Your task:
1. Remove ALL markdown syntax (#, **, `, |, etc.)
2. Preserve document structure using simple markers:
   - Use "SECTION: " prefix for major headings
   - Use "SUBSECTION: " prefix for subheadings
   - Keep list items on separate lines with proper indentation
   - Preserve paragraph breaks (double newlines)
   - Keep table data in readable format (rows separated by newlines)
3. Maintain semantic boundaries for smart chunking:
   - Add clear section breaks
   - Keep related content together
   - Preserve logical flow
4. Remove redundant whitespace but keep structural spacing
5. Keep ALL original text content - do not summarize or omit

IMPORTANT:
- Output plain text without markdown syntax
- Preserve enough structure for context-aware chunking
- Make text easily searchable and embeddable
- Do NOT add meta-commentary or explanations

Markdown document:
{markdown_text[:8000]}

Return only the clean text:"""

            clean_text = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=8000,
                temperature=0.1
            )

            if clean_text:
                self.logger.debug("Generated clean text from markdown successfully")
                return clean_text
            else:
                self.logger.warning("LLM returned empty response for clean text generation")
                # Fallback: basic markdown stripping
                return markdown_text.replace('#', '').replace('**', '').replace('`', '')

        except Exception as e:
            self.logger.warning(f"Clean text generation from markdown failed: {str(e)}")
            # Fallback: basic markdown stripping
            return markdown_text.replace('#', '').replace('**', '').replace('`', '')

    async def _convert_to_markdown(self, text: str, language: str) -> str:
        """Use Groq LLM to convert cleaned text into well-structured markdown."""
        try:
            prompt = f"""You are a markdown conversion expert. Convert the following text into clean, well-structured markdown format. The text is in {language} language.

Your task is to:
1. Identify and format headers (use #, ##, ###, etc.)
2. Convert lists to proper markdown format:
   - Unordered lists: use "- " prefix
   - Ordered lists: use "1. ", "2. ", etc.
3. Convert tables to markdown table format with pipes (|)
4. Preserve paragraph breaks with blank lines
5. Use **bold** for emphasis where appropriate (section titles, important terms)
6. Use > for blockquotes if any
7. Use `code` formatting for technical terms, commands, or code snippets
8. Add horizontal rules (---) between major sections if appropriate

IMPORTANT:
- Maintain the logical structure of the document
- Don't invent content - only restructure what's there
- Keep all the original text content, just apply markdown formatting
- Make the document easy to read and navigate

Text to convert:
{text[:5000]}

Return only the markdown-formatted text. No explanations or meta-commentary."""

            markdown_text = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=6000,
                temperature=0.2  # Slightly higher for better formatting decisions
            )

            if markdown_text:
                self.logger.debug("Groq LLM markdown conversion successful")
                return markdown_text
            else:
                self.logger.warning("LLM returned empty response for markdown conversion")
                return text  # Return original text if conversion fails

        except Exception as e:
            self.logger.warning(f"Groq LLM markdown conversion failed: {str(e)}")
            return text  # Return original text if conversion fails

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