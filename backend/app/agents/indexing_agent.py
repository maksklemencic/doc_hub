import logging
import os
from typing import Dict, Any, List, Optional

from .base_agent import BaseAgent
from ..services.chunking_service import chunk_pages_with_markdown_chunker, ChunkMetadata
from ..services import embedding, qdrant_client
from ..errors.embedding_errors import EmbeddingError, ChunkingError
from ..errors.qdrant_errors import VectorStoreError

logger = logging.getLogger(__name__)

class IndexingAgent(BaseAgent):

    def __init__(self, max_retry_attempts: int = 3):
        super().__init__("indexing", max_retry_attempts)
        self.logger = logging.getLogger(f"{__name__}.IndexingAgent")

        self.max_chunk_size = int(os.getenv("MAX_CHUNK_SIZE", "1000"))
        self.min_chunk_size = int(os.getenv("MIN_CHUNK_SIZE", "100"))
        self.overlap_size = int(os.getenv("CHUNK_OVERLAP_SIZE", "100"))

    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        
        self.update_progress(5, "Starting indexing process")

        processed_text = input_data.get("processed_text")
        language = input_data.get("language", "unknown")
        markdown_structure = input_data.get("markdown_structure", {})
        document_metadata = input_data.get("document_metadata", {})
        original_pages = input_data.get("original_pages")

        if not processed_text:
            raise ChunkingError("processed_text is required for indexing")

        self.logger.info(f"Indexing document in {language} with markdown structure detection")

        # Step 1: Prepare pages data
        self.update_progress(10, "Preparing pages data")
        if original_pages:
            # Use original pages if available
            pages = original_pages
        else:
            # Create single page from processed text
            pages = [(1, processed_text)]

        # Step 2: Enhanced chunking with markdown awareness
        self.update_progress(20, "Performing structure-aware chunking")
        try:
            chunk_texts, page_numbers, chunk_metadata_list = await self._perform_chunking(
                pages, document_metadata, language, markdown_structure
            )
        except Exception as e:
            self.logger.error(f"Chunking failed: {str(e)}")
            raise ChunkingError(f"Structure-aware chunking failed: {str(e)}")

        # Step 3: Generate embeddings
        self.update_progress(50, "Generating multilingual embeddings")
        try:
            embeddings = await self._generate_embeddings(chunk_texts)
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {str(e)}")
            raise EmbeddingError(f"Multilingual embedding generation failed: {str(e)}")

        # Step 4: Prepare enhanced metadata
        self.update_progress(70, "Preparing enhanced metadata")
        enhanced_metadata = self._prepare_enhanced_metadata(
            chunk_metadata_list, page_numbers, document_metadata
        )

        # Step 5: Store in vector database
        self.update_progress(80, "Storing in vector database")
        try:
            storage_success = await self._store_in_vector_db(
                embeddings, chunk_texts, enhanced_metadata, chunk_metadata_list
            )
        except Exception as e:
            self.logger.error(f"Vector storage failed: {str(e)}")
            raise VectorStoreError(f"Enhanced vector storage failed: {str(e)}")

        # Step 6: Create chunk relationship mapping
        self.update_progress(95, "Creating chunk relationship mapping")
        chunk_relationships = self._create_relationship_mapping(chunk_metadata_list)

        self.update_progress(100, "Indexing complete")

        return {
            "chunks": chunk_texts,
            "embeddings": embeddings,
            "chunk_metadata": [metadata.__dict__ for metadata in chunk_metadata_list],
            "stored_successfully": storage_success,
            "chunk_relationships": chunk_relationships,
            "total_chunks": len(chunk_texts),
            "language": language,
            "has_structure": markdown_structure.get("has_structure", False)
        }

    async def _perform_chunking(
        self,
        pages: List[tuple],
        document_metadata: Dict[str, Any],
        language: str,
        markdown_structure: Dict[str, Any]
    ) -> tuple:

        base_metadata = {
            "document_id": document_metadata.get("document_id", ""),
            "filename": document_metadata.get("filename", ""),
            "mime_type": document_metadata.get("mime_type", ""),
            "user_id": document_metadata.get("user_id", ""),
            "space_id": document_metadata.get("space_id", ""),
            "language": language,
            "has_markdown_structure": markdown_structure.get("has_structure", False)
        }

        chunk_texts, page_numbers, chunk_metadata_list = chunk_pages_with_markdown_chunker(
            pages=pages,
            base_metadata=base_metadata,
            max_chunk_size=self.max_chunk_size,
            min_chunk_size=self.min_chunk_size,
            overlap_size=self.overlap_size
        )

        self.logger.info(
            f"Created {len(chunk_texts)} chunks with structure-aware splitting"
        )

        return chunk_texts, page_numbers, chunk_metadata_list

    async def _generate_embeddings(self, chunk_texts: List[str]) -> List[List[float]]:
        try:
            embeddings = embedding.get_embeddings(chunks=chunk_texts)

            self.logger.info(f"Generated {len(embeddings)} embeddings")
            return embeddings

        except Exception as e:
            self.logger.error(f"Embedding generation failed: {str(e)}")
            raise EmbeddingError(f"Failed to generate embeddings: {str(e)}")

    def _prepare_enhanced_metadata(
        self,
        chunk_metadata_list: List[ChunkMetadata],
        page_numbers: List[int],
        document_metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        enhanced_metadata = []

        for i, chunk_meta in enumerate(chunk_metadata_list):
            metadata = {
                "document_id": chunk_meta.document_id,
                "filename": chunk_meta.filename,
                "mime_type": chunk_meta.mime_type,
                "user_id": chunk_meta.user_id,
                "space_id": chunk_meta.space_id,
                "page_number": page_numbers[i] if i < len(page_numbers) else chunk_meta.page_number,
                "chunk_index": chunk_meta.chunk_index,

                # Enhanced metadata fields
                "chunk_id": chunk_meta.chunk_id,
                "markdown_level": chunk_meta.markdown_level,
                "parent_headings": chunk_meta.parent_headings,
                "section_type": chunk_meta.section_type.value,
                "related_chunk_ids": chunk_meta.related_chunk_ids,
                "content_density_score": chunk_meta.content_density_score,
                "language": chunk_meta.language,
                "token_count": chunk_meta.token_count,
                "char_count": chunk_meta.char_count,

                # Additional document metadata
                **document_metadata
            }
            self.logger.debug(f"Preparing metadata for chunk with document_id: {chunk_meta.document_id}")
            enhanced_metadata.append(metadata)

        return enhanced_metadata

    async def _store_in_vector_db(
        self,
        embeddings: List[List[float]],
        chunk_texts: List[str],
        metadata: List[Dict[str, Any]],
        chunk_metadata_list: List[ChunkMetadata]
    ) -> bool:
        try:
            qdrant_client.store_document(
                embeddings=embeddings,
                chunks=chunk_texts,
                metadata=metadata
            )

            structure_info = self._analyze_chunk_structure(chunk_metadata_list)
            self.logger.info(
                f"Successfully stored {len(chunk_texts)} chunks with enhanced metadata. "
                f"Structure info: {structure_info}"
            )

            return True

        except Exception as e:
            self.logger.error(f"Vector storage failed: {str(e)}")
            return False

    def _analyze_chunk_structure(self, chunk_metadata_list: List[ChunkMetadata]) -> Dict[str, Any]:
        if not chunk_metadata_list:
            return {}

        section_types = {}
        markdown_levels = {}
        relationships_count = 0

        for chunk_meta in chunk_metadata_list:
            section_type = chunk_meta.section_type.value
            section_types[section_type] = section_types.get(section_type, 0) + 1

            if chunk_meta.markdown_level > 0:
                level = f"H{chunk_meta.markdown_level}"
                markdown_levels[level] = markdown_levels.get(level, 0) + 1

            relationships_count += len(chunk_meta.related_chunk_ids)

        avg_density = sum(c.content_density_score for c in chunk_metadata_list) / len(chunk_metadata_list)

        return {
            "section_types": section_types,
            "markdown_levels": markdown_levels,
            "total_relationships": relationships_count,
            "avg_content_density": round(avg_density, 2)
        }

    def _create_relationship_mapping(self, chunk_metadata_list: List[ChunkMetadata]) -> Dict[str, Any]:
        relationships = {}

        for chunk_meta in chunk_metadata_list:
            chunk_id = chunk_meta.chunk_id
            relationships[chunk_id] = {
                "related_chunks": chunk_meta.related_chunk_ids,
                "parent_headings": chunk_meta.parent_headings,
                "section_type": chunk_meta.section_type.value,
                "markdown_level": chunk_meta.markdown_level,
                "content_density": chunk_meta.content_density_score
            }

        return {
            "chunk_relationships": relationships,
            "total_chunks": len(chunk_metadata_list),
            "total_relationships": sum(len(rel["related_chunks"]) for rel in relationships.values())
        }