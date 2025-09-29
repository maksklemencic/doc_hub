"""
RAG Query Agent for the LangGraph agentic architecture.

This agent handles intelligent query processing, context-aware chunk retrieval,
enhanced context assembly, and streaming response generation.
"""

import asyncio
import logging
import os
from typing import Dict, Any, List, Optional, AsyncGenerator


from .base_agent import BaseAgent
from ..services import embedding, qdrant_client
from ..errors.embedding_errors import EmbeddingError
from ..errors.qdrant_errors import VectorStoreError
from ..errors.llm_errors import RateLimitExceeded
from ..services.llm_service import get_default_llm_service, LLMService

logger = logging.getLogger(__name__)


class RAGQueryAgent(BaseAgent):
    """
    Agent for processing RAG queries with enhanced context assembly.

    Capabilities:
    - Intelligent query embedding and retrieval
    - Context-aware chunk selection with relationships
    - Enhanced prompt engineering for better responses
    - Streaming response capabilities
    - Parent heading inclusion for context
    - Cross-reference resolution in retrieved chunks
    """

    def __init__(self, max_retry_attempts: int = 3):
        super().__init__("rag_query", max_retry_attempts)
        self.logger = logging.getLogger(f"{__name__}.RAGQueryAgent")

        # Configuration
        self.llm_service = get_default_llm_service()
        self.max_context_length = int(os.getenv("MAX_CONTEXT_LENGTH", "8000"))
        self.top_k = int(os.getenv("DEFAULT_TOP_K", "10"))

    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute RAG query with enhanced context assembly.

        Args:
            input_data: Dict containing:
                - query: user query string
                - user_id: user identifier
                - space_id: space identifier
                - top_k: number of chunks to retrieve (default: 10)
                - only_space_documents: whether to limit to space documents
                - include_relationships: whether to include related chunks
                - stream_response: whether to stream the response

        Returns:
            Dict containing:
                - response: generated response text (if not streaming)
                - retrieved_chunks: list of retrieved chunks
                - context: assembled context
                - query_embedding: query embedding vector
                - streaming: whether response is streaming
        """
        self.update_progress(5, "Starting RAG query processing")

        # Extract parameters
        query = input_data.get("query")
        user_id = input_data.get("user_id")
        space_id = input_data.get("space_id")
        top_k = input_data.get("top_k", self.top_k)
        only_space_documents = input_data.get("only_space_documents", True)
        include_relationships = input_data.get("include_relationships", True)
        stream_response = input_data.get("stream_response", False)

        if not query or not user_id:
            raise ValueError("query and user_id are required")

        # Now we can safely assert these are not None
        assert isinstance(query, str), "query must be a string"
        assert isinstance(user_id, str), "user_id must be a string"

        self.logger.info(
            f"Processing RAG query: '{query[:100]}...' "
            f"(user: {user_id}, space: {space_id}, top_k: {top_k})"
        )

        # Step 1: Generate query embedding
        self.update_progress(15, "Generating query embedding")
        try:
            query_embedding = await self._generate_query_embedding(query)
        except Exception as e:
            self.logger.error(f"Query embedding failed: {str(e)}")
            raise EmbeddingError(f"Query embedding failed: {str(e)}")

        # Step 2: Retrieve relevant chunks
        self.update_progress(30, "Retrieving relevant chunks")
        try:
            retrieved_chunks = await self._retrieve_chunks(
                query_embedding, user_id, space_id, top_k, only_space_documents
            )
        except Exception as e:
            self.logger.error(f"Chunk retrieval failed: {str(e)}")
            raise VectorStoreError(f"Chunk retrieval failed: {str(e)}")

        # Step 3: Enhance context with relationships
        self.update_progress(50, "Enhancing context with relationships")
        if include_relationships and retrieved_chunks:
            try:
                enhanced_chunks = await self._enhance_with_relationships(
                    retrieved_chunks
                )
                retrieved_chunks.extend(enhanced_chunks)
            except Exception as e:
                self.logger.warning(f"Relationship enhancement failed: {str(e)}")

        # Step 4: Assemble optimized context
        self.update_progress(65, "Assembling optimized context")
        context = await self._assemble_context(retrieved_chunks, query)

        # Step 5: Generate response
        self.update_progress(80, "Generating response")
        if stream_response:
            # Return streaming response - create the generator here
            self.update_progress(100, "RAG query processing complete")
            return {
                "response_stream": self._generate_streaming_response(query, context),
                "retrieved_chunks": retrieved_chunks,
                "context": context,
                "query_embedding": query_embedding,
                "streaming": True,
                "total_chunks_retrieved": len(retrieved_chunks)
            }
        else:
            # Generate non-streaming response
            try:
                response = await self._generate_response(query, context)
            except Exception as e:
                self.logger.error(f"Response generation failed: {str(e)}")
                raise Exception(f"Response generation failed: {str(e)}")

            self.update_progress(100, "RAG query processing complete")
            return {
                "response": response,
                "retrieved_chunks": retrieved_chunks,
                "context": context,
                "query_embedding": query_embedding,
                "streaming": False,
                "total_chunks_retrieved": len(retrieved_chunks)
            }

    async def _generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for the query."""
        try:
            # Use enhanced embedding service
            query_embedding = embedding.get_query_embedding(query)

            self.logger.debug(
                f"Generated query embedding (dimension: {len(query_embedding)})"
            )
            return query_embedding

        except Exception as e:
            self.logger.error(f"Query embedding generation failed: {str(e)}")
            raise EmbeddingError(f"Query embedding generation failed: {str(e)}")

    async def _retrieve_chunks(
        self,
        query_embedding: List[float],
        user_id: str,
        space_id: Optional[str],
        top_k: int,
        only_space_documents: bool
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks from vector store."""
        try:
            # Build query filter
            query_filter = {"user_id": user_id}
            if only_space_documents and space_id:
                query_filter["space_id"] = space_id

            # Retrieve from vector store
            search_results = qdrant_client.search_documents(
                query_embedding=query_embedding,
                top_k=top_k * 2,  # Retrieve more for better filtering
                filter_dict=query_filter
            )

            # Process results to include metadata
            processed_results = []
            for result in search_results[:top_k]:  # Take top_k after processing
                metadata = result.get("metadata") or {}
                chunk_data = {
                    "text": result.get("text") or "",
                    "score": result.get("score") or 0.0,
                    "metadata": metadata,
                    "chunk_id": metadata.get("chunk_id"),
                    "document_id": metadata.get("document_id"),
                    "parent_headings": metadata.get("parent_headings") or [],
                    "section_type": metadata.get("section_type") or "content",
                    "related_chunk_ids": metadata.get("related_chunk_ids") or [],
                    "markdown_level": metadata.get("markdown_level") or 0,
                    "language": metadata.get("language") or "unknown"
                }
                processed_results.append(chunk_data)

            self.logger.info(
                f"Retrieved {len(processed_results)} chunks "
                f"(scores: {[round(r['score'], 3) for r in processed_results[:5]]})"
            )

            return processed_results

        except Exception as e:
            self.logger.error(f"Chunk retrieval failed: {str(e)}")
            raise VectorStoreError(f"Chunk retrieval failed: {str(e)}")

    async def _enhance_with_relationships(
        self,
        chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Enhance context by including related chunks."""
        enhanced_chunks = []
        processed_chunk_ids = {
            chunk.get("chunk_id") for chunk in chunks
            if chunk.get("chunk_id") is not None
        }

        for chunk in chunks:
            related_ids = chunk.get("related_chunk_ids") or []

            # Get related chunks that aren't already included
            for related_id in related_ids:
                if related_id not in processed_chunk_ids:
                    try:
                        # Retrieve related chunk (simplified - in real implementation,
                        # you'd batch these requests)
                        related_chunk = await self._get_chunk_by_id(related_id)
                        if related_chunk:
                            enhanced_chunks.append(related_chunk)
                            processed_chunk_ids.add(related_id)
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to retrieve related chunk {related_id}: {e}"
                        )

        self.logger.info(f"Enhanced context with {len(enhanced_chunks)} related chunks")
        return enhanced_chunks

    async def _get_chunk_by_id(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific chunk by ID."""
        # This is a simplified implementation
        # In practice, you'd have a direct lookup method in qdrant_client
        try:
            # For now, return None - this would need to be implemented in qdrant_client
            return None
        except Exception:
            return None

    async def _assemble_context(
        self,
        chunks: List[Dict[str, Any]],
        query: str
    ) -> str:
        """Assemble optimized context from chunks."""
        if not chunks:
            return ""

        context_parts = []
        current_length = 0
        max_context_length = self.max_context_length - len(query) - 500  # Reserve space

        # Sort chunks by score (highest first)
        sorted_chunks = sorted(chunks, key=lambda x: x.get("score", 0), reverse=True)

        for chunk in sorted_chunks:
            chunk_text = (chunk.get("text") or "").strip()
            if not chunk_text:
                continue

            # Add parent heading context if available
            parent_headings = chunk.get("parent_headings") or []
            if parent_headings:
                heading_context = " > ".join(str(h) for h in parent_headings)
                chunk_text = f"[Context: {heading_context}]\\n{chunk_text}"

            # Check if adding this chunk would exceed context limit
            if current_length + len(chunk_text) > max_context_length:
                break

            context_parts.append(chunk_text)
            current_length += len(chunk_text)

        assembled_context = "\\n\\n---\\n\\n".join(context_parts)

        self.logger.info(
            f"Assembled context from {len(context_parts)} chunks "
            f"({current_length} characters)"
        )

        return assembled_context

    async def _generate_response(self, query: str, context: str) -> str:
        """Generate non-streaming response using Groq."""
        prompt = self._create_enhanced_prompt(query, context)

        try:
            generated_response = await self.llm_service.generate_response(
                prompt=prompt,
                max_tokens=4000,
                temperature=0.7
            )

            if not generated_response:
                raise Exception("Empty response from Groq LLM")

            self.logger.info("Generated non-streaming response successfully")
            return generated_response

        except RateLimitExceeded as e:
            self.logger.error(f"Groq rate limit exceeded: {str(e)}")
            raise
        except Exception as e:
            self.logger.error(f"Response generation failed: {str(e)}")
            raise Exception(f"Groq response generation failed: {str(e)}")

    async def _generate_streaming_response(
        self,
        query: str,
        context: str
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response using Groq."""
        prompt = self._create_enhanced_prompt(query, context)

        try:
            async for chunk in self.llm_service.generate_streaming_response(
                prompt=prompt,
                max_tokens=4000,
                temperature=0.7
            ):
                yield chunk

            self.logger.info("Generated streaming response successfully")

        except RateLimitExceeded as e:
            self.logger.error(f"Groq rate limit exceeded during streaming: {str(e)}")
            raise
        except Exception as e:
            self.logger.error(f"Streaming response generation failed: {str(e)}")
            raise Exception(f"Groq streaming failed: {str(e)}")

    def _create_enhanced_prompt(self, query: str, context: str) -> str:
        """Create enhanced prompt with better engineering."""
        prompt_template = """<|im_start|>system
You are a highly knowledgeable and accurate RAG system with enhanced context
understanding. Your primary goal is to provide comprehensive, well-structured
answers based on the provided context.

**Guidelines:**
1. **Prioritize Context**: Base your answer exclusively on the provided context
2. **Use Hierarchical Information**: Pay attention to section headings and
   document structure
3. **Synthesize Information**: Combine relevant information from multiple
   sources in the context
4. **Maintain Accuracy**: If the context doesn't contain sufficient
   information, clearly state this
5. **Structure Response**: Use clear formatting with bullet points or
   numbered lists when appropriate
6. **Context Awareness**: Consider the document structure and relationships
   between sections

**Context Quality**: The context below has been enhanced with:
- Parent heading information for better understanding
- Related section cross-references
- Multilingual content support
- Structure-aware chunking
- Powered by Groq for fast, high-quality responses

<|im_end|>
<|im_start|>user
<context>
{context}
</context>

<query>
{query}
</query>

Please provide a comprehensive answer based on the enhanced context above.
If you reference specific sections or documents, mention them clearly.
<|im_end|>"""

        return prompt_template.format(context=context, query=query)