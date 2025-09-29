"""
Advanced chunking service with markdown-aware splitting and semantic boundaries.

This service provides enhanced chunking capabilities including:
- Markdown-aware splitting by headers
- Parent heading context inclusion
- Variable chunk sizes based on content density
- Cross-references between related sections
"""

import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

logger = logging.getLogger(__name__)


class SectionType(str, Enum):
    """Types of content sections."""
    CONTENT = "content"
    HEADER = "header"
    LIST = "list"
    TABLE = "table"
    CODE = "code"
    QUOTE = "quote"


@dataclass
class ChunkMetadata:
    """Enhanced metadata for chunks."""
    chunk_id: str
    text: str
    markdown_level: int = 0  # H1=1, H2=2, etc.
    parent_headings: List[str] = field(default_factory=list)
    section_type: SectionType = SectionType.CONTENT
    related_chunk_ids: List[str] = field(default_factory=list)
    content_density_score: float = 0.0
    language: str = "unknown"
    page_number: int = 1
    chunk_index: int = 0
    token_count: int = 0
    char_count: int = 0

    # Original metadata fields for compatibility
    document_id: str = ""
    filename: str = ""
    mime_type: str = ""
    user_id: str = ""
    space_id: str = ""


class MarkdownChunker:
    """
    Advanced markdown-aware chunking with semantic boundary detection.
    """

    def __init__(
        self,
        max_chunk_size: int = 1000,
        min_chunk_size: int = 100,
        overlap_size: int = 100,
        preserve_headers: bool = True
    ):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
        self.overlap_size = overlap_size
        self.preserve_headers = preserve_headers
        self.logger = logging.getLogger(f"{__name__}.MarkdownChunker")

    def chunk_text(
        self,
        text: str,
        base_metadata: Dict[str, Any]
    ) -> List[ChunkMetadata]:
        """
        Chunk text with markdown awareness and semantic boundaries.

        Args:
            text: The text to chunk
            base_metadata: Base metadata to include in all chunks

        Returns:
            List of ChunkMetadata objects
        """
        self.logger.info(f"Starting markdown-aware chunking for {len(text)} characters")

        # Parse markdown structure
        sections = self._parse_markdown_structure(text)

        # Create chunks preserving semantic boundaries
        chunks = self._create_semantic_chunks(sections, base_metadata)

        # Add relationships between chunks
        chunks = self._add_chunk_relationships(chunks)

        self.logger.info(f"Created {len(chunks)} chunks with semantic boundaries")
        return chunks

    def _parse_markdown_structure(self, text: str) -> List[Dict[str, Any]]:
        """Parse text into structured sections."""
        sections = []
        lines = text.split('\n')
        current_section = {"content": [], "headers": [], "type": SectionType.CONTENT}

        for line_num, line in enumerate(lines):
            line = line.strip()
            if not line:
                current_section["content"].append("")
                continue

            # Detect headers
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                # Save current section
                if current_section["content"] or current_section["headers"]:
                    sections.append(current_section.copy())

                # Start new section
                level = len(header_match.group(1))
                header_text = header_match.group(2)

                current_section = {
                    "content": [line],
                    "headers": [{"level": level, "text": header_text, "line": line_num}],
                    "type": SectionType.HEADER,
                    "markdown_level": level
                }
                continue

            # Detect lists
            if re.match(r'^[-*+]\s+', line) or re.match(r'^\d+\.\s+', line):
                if current_section["type"] != SectionType.LIST:
                    if current_section["content"]:
                        sections.append(current_section.copy())
                    current_section = {
                        "content": [line],
                        "headers": current_section["headers"].copy(),
                        "type": SectionType.LIST
                    }
                else:
                    current_section["content"].append(line)
                continue

            # Detect tables
            if '|' in line and line.count('|') >= 2:
                if current_section["type"] != SectionType.TABLE:
                    if current_section["content"]:
                        sections.append(current_section.copy())
                    current_section = {
                        "content": [line],
                        "headers": current_section["headers"].copy(),
                        "type": SectionType.TABLE
                    }
                else:
                    current_section["content"].append(line)
                continue

            # Detect code blocks
            if line.startswith('```'):
                if current_section["type"] != SectionType.CODE:
                    if current_section["content"]:
                        sections.append(current_section.copy())
                    current_section = {
                        "content": [line],
                        "headers": current_section["headers"].copy(),
                        "type": SectionType.CODE
                    }
                else:
                    current_section["content"].append(line)
                continue

            # Regular content
            current_section["content"].append(line)
            if current_section["type"] == SectionType.HEADER:
                current_section["type"] = SectionType.CONTENT

        # Add final section
        if current_section["content"] or current_section["headers"]:
            sections.append(current_section)

        return sections

    def _create_semantic_chunks(
        self,
        sections: List[Dict[str, Any]],
        base_metadata: Dict[str, Any]
    ) -> List[ChunkMetadata]:
        """Create chunks that respect semantic boundaries."""
        chunks = []
        current_chunk_content = []
        current_chunk_size = 0
        current_headers = []
        chunk_index = 0

        for section in sections:
            section_text = '\n'.join(section["content"])
            section_size = len(section_text)

            # Update headers context
            if section.get("headers"):
                current_headers = section["headers"]

            # If section is too large, split it
            if section_size > self.max_chunk_size:
                # Save current chunk if it has content
                if current_chunk_content:
                    chunk = self._create_chunk_metadata(
                        current_chunk_content, current_headers,
                        base_metadata, chunk_index
                    )
                    chunks.append(chunk)
                    chunk_index += 1
                    current_chunk_content = []
                    current_chunk_size = 0

                # Split large section
                sub_chunks = self._split_large_section(
                    section, current_headers, base_metadata, chunk_index
                )
                chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
                continue

            # Check if adding section would exceed max size
            if current_chunk_size + section_size > self.max_chunk_size and current_chunk_content:
                # Create chunk from current content
                chunk = self._create_chunk_metadata(
                    current_chunk_content, current_headers,
                    base_metadata, chunk_index
                )
                chunks.append(chunk)
                chunk_index += 1

                # Start new chunk with overlap if needed
                current_chunk_content = self._create_overlap(current_chunk_content)
                current_chunk_size = len('\n'.join(current_chunk_content))

            # Add section to current chunk
            current_chunk_content.extend(section["content"])
            current_chunk_size += section_size

        # Create final chunk if it has content
        if current_chunk_content:
            chunk = self._create_chunk_metadata(
                current_chunk_content, current_headers,
                base_metadata, chunk_index
            )
            chunks.append(chunk)

        return chunks

    def _split_large_section(
        self,
        section: Dict[str, Any],
        headers: List[Dict[str, Any]],
        base_metadata: Dict[str, Any],
        start_index: int
    ) -> List[ChunkMetadata]:
        """Split a large section into multiple chunks."""
        chunks = []
        content_lines = section["content"]
        current_lines = []
        current_size = 0
        chunk_index = start_index

        for line in content_lines:
            line_size = len(line)

            if current_size + line_size > self.max_chunk_size and current_lines:
                # Create chunk
                chunk = self._create_chunk_metadata(
                    current_lines, headers, base_metadata, chunk_index
                )
                chunks.append(chunk)
                chunk_index += 1

                # Start new chunk with overlap
                current_lines = self._create_overlap(current_lines)
                current_size = len('\n'.join(current_lines))

            current_lines.append(line)
            current_size += line_size

        # Final chunk
        if current_lines:
            chunk = self._create_chunk_metadata(
                current_lines, headers, base_metadata, chunk_index
            )
            chunks.append(chunk)

        return chunks

    def _create_overlap(self, lines: List[str]) -> List[str]:
        """Create overlap content for chunk continuity."""
        if not lines or self.overlap_size <= 0:
            return []

        # Take last portion of content for overlap
        overlap_text = '\n'.join(lines)
        if len(overlap_text) <= self.overlap_size:
            return lines[-len(lines)//2:] if len(lines) > 1 else []

        # Find good break point within overlap size
        overlap_lines = []
        current_size = 0

        for line in reversed(lines):
            if current_size + len(line) > self.overlap_size:
                break
            overlap_lines.insert(0, line)
            current_size += len(line)

        return overlap_lines

    def _create_chunk_metadata(
        self,
        content_lines: List[str],
        headers: List[Dict[str, Any]],
        base_metadata: Dict[str, Any],
        chunk_index: int
    ) -> ChunkMetadata:
        """Create chunk metadata object."""
        text = '\n'.join(content_lines).strip()

        # Extract parent headings
        parent_headings = [h["text"] for h in headers if h.get("text")]

        # Determine section type and markdown level
        section_type = SectionType.CONTENT
        markdown_level = 0

        if headers:
            markdown_level = headers[-1].get("level", 0)

        # Detect section type from content
        if any(line.startswith('#') for line in content_lines[:3]):
            section_type = SectionType.HEADER
        elif any(re.match(r'^[-*+]\s+', line) or re.match(r'^\d+\.\s+', line)
                for line in content_lines[:5]):
            section_type = SectionType.LIST
        elif any('|' in line and line.count('|') >= 2 for line in content_lines[:3]):
            section_type = SectionType.TABLE
        elif any(line.startswith('```') for line in content_lines[:2]):
            section_type = SectionType.CODE

        # Calculate content density score
        density_score = self._calculate_content_density(text)

        # Generate chunk ID
        chunk_id = str(uuid.uuid4())

        return ChunkMetadata(
            chunk_id=chunk_id,
            text=text,
            markdown_level=markdown_level,
            parent_headings=parent_headings,
            section_type=section_type,
            content_density_score=density_score,
            language=base_metadata.get("language", "unknown"),
            page_number=base_metadata.get("page_number", 1),
            chunk_index=chunk_index,
            token_count=len(text.split()),
            char_count=len(text),
            document_id=base_metadata.get("document_id", ""),
            filename=base_metadata.get("filename", ""),
            mime_type=base_metadata.get("mime_type", ""),
            user_id=base_metadata.get("user_id", ""),
            space_id=base_metadata.get("space_id", "")
        )

    def _calculate_content_density(self, text: str) -> float:
        """Calculate content density score (0.0 to 1.0)."""
        if not text:
            return 0.0

        words = text.split()
        if not words:
            return 0.0

        # Factors that indicate high content density
        score = 0.0

        # Word count factor
        if len(words) > 50:
            score += 0.3
        elif len(words) > 20:
            score += 0.2
        elif len(words) > 10:
            score += 0.1

        # Average word length factor
        avg_word_len = sum(len(word) for word in words) / len(words)
        if avg_word_len > 5:
            score += 0.2
        elif avg_word_len > 4:
            score += 0.1

        # Sentence structure factor
        sentences = re.split(r'[.!?]+', text)
        if len(sentences) > 3:
            avg_sentence_len = len(words) / len(sentences)
            if 10 <= avg_sentence_len <= 25:  # Good sentence length
                score += 0.2
            elif 5 <= avg_sentence_len <= 35:  # Acceptable
                score += 0.1

        # Special content factor
        if re.search(r'\b\d+\b', text):  # Contains numbers
            score += 0.1
        if re.search(r'[()[\]{}]', text):  # Contains brackets/parentheses
            score += 0.1
        if text.count(',') + text.count(';') > len(words) * 0.1:  # Good punctuation
            score += 0.1

        return min(1.0, score)

    def _add_chunk_relationships(self, chunks: List[ChunkMetadata]) -> List[ChunkMetadata]:
        """Add relationships between related chunks."""
        for i, chunk in enumerate(chunks):
            related_ids = []

            # Adjacent chunks are related
            if i > 0:
                related_ids.append(chunks[i-1].chunk_id)
            if i < len(chunks) - 1:
                related_ids.append(chunks[i+1].chunk_id)

            # Chunks with same parent headings are related
            for j, other_chunk in enumerate(chunks):
                if i != j and chunk.parent_headings and other_chunk.parent_headings:
                    # Check if they share parent headings
                    shared_headings = set(chunk.parent_headings) & set(other_chunk.parent_headings)
                    if shared_headings and other_chunk.chunk_id not in related_ids:
                        related_ids.append(other_chunk.chunk_id)

            chunk.related_chunk_ids = related_ids

        return chunks


def chunk_pages_with_markdown_chunker(
    pages: List[Tuple[int, str]],
    base_metadata: Dict[str, Any],
    max_chunk_size: int = 1000,
    min_chunk_size: int = 100,
    overlap_size: int = 100
) -> Tuple[List[str], List[int], List[ChunkMetadata]]:
    """
    Enhanced chunking function using MarkdownChunker.

    Args:
        pages: List of (page_number, text) tuples
        base_metadata: Base metadata for all chunks
        max_chunk_size: Maximum chunk size
        min_chunk_size: Minimum chunk size
        overlap_size: Overlap between chunks

    Returns:
        Tuple of (chunk_texts, page_numbers, chunk_metadata)
    """
    chunker = MarkdownChunker(max_chunk_size, min_chunk_size, overlap_size)

    all_chunks = []
    chunk_texts = []
    page_numbers = []

    for page_num, page_text in pages:
        # Add page number to metadata
        page_metadata = base_metadata.copy()
        page_metadata["page_number"] = page_num

        # Chunk the page
        page_chunks = chunker.chunk_text(page_text, page_metadata)

        for chunk in page_chunks:
            chunk_texts.append(chunk.text)
            page_numbers.append(page_num)
            all_chunks.append(chunk)

    logger.info(
        f"Processed {len(pages)} pages into {len(chunk_texts)} chunks "
        f"with enhanced metadata"
    )

    return chunk_texts, page_numbers, all_chunks