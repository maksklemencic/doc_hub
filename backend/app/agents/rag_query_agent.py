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
    def __init__(self, max_retry_attempts: int = 3):
        super().__init__("rag_query", max_retry_attempts)
        self.logger = logging.getLogger(f"{__name__}.RAGQueryAgent")

        self.llm_service = get_default_llm_service()
        self.max_context_length = int(os.getenv("MAX_CONTEXT_LENGTH", "8000"))
        self.top_k = int(os.getenv("DEFAULT_TOP_K", "10"))

    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.update_progress(5, "Starting RAG query processing")

        query = input_data.get("query")
        user_id = input_data.get("user_id")
        space_id = input_data.get("space_id")
        top_k = input_data.get("top_k", self.top_k)
        only_space_documents = input_data.get("only_space_documents", True)
        document_ids = input_data.get("document_ids")
        include_relationships = input_data.get("include_relationships", True)
        stream_response = input_data.get("stream_response", False)

        if not query or not user_id:
            raise ValueError("query and user_id are required")

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
                query_embedding, user_id, space_id, top_k, only_space_documents, document_ids
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
        try:
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
        only_space_documents: bool,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        try:
            query_filter = {"user_id": user_id}
            if only_space_documents and space_id:
                query_filter["space_id"] = space_id

            if document_ids:
                query_filter["document_ids"] = document_ids
                self.logger.info(f"Filtering by document_ids: {document_ids}")

            search_results = qdrant_client.search_documents(
                query_embedding=query_embedding,
                top_k=top_k * 2,
                filter_dict=query_filter
            )

            processed_results = []
            for result in search_results[:top_k]:
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

            doc_ids_retrieved = set(r.get("document_id") for r in processed_results if r.get("document_id"))
            self.logger.info(
                f"Retrieved {len(processed_results)} chunks from {len(doc_ids_retrieved)} document(s) "
                f"(scores: {[round(r['score'], 3) for r in processed_results[:5]]})"
            )
            self.logger.info(f"Document IDs in retrieved chunks: {doc_ids_retrieved}")

            for i, result in enumerate(processed_results[:3]):
                text_preview = result.get("text", "")[:150].replace("\n", " ")
                self.logger.info(
                    f"  Chunk {i+1}: doc_id={result.get('document_id')}, "
                    f"score={round(result.get('score', 0), 3)}, "
                    f"text='{text_preview}...'"
                )

            return processed_results

        except Exception as e:
            self.logger.error(f"Chunk retrieval failed: {str(e)}")
            raise VectorStoreError(f"Chunk retrieval failed: {str(e)}")

    async def _enhance_with_relationships(
        self,
        chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        enhanced_chunks = []
        processed_chunk_ids = {
            chunk.get("chunk_id") for chunk in chunks
            if chunk.get("chunk_id") is not None
        }

        for chunk in chunks:
            related_ids = chunk.get("related_chunk_ids") or []

            for related_id in related_ids:
                if related_id not in processed_chunk_ids:
                    try:
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
        try:
            return None
        except Exception:
            return None

    async def _assemble_context(
        self,
        chunks: List[Dict[str, Any]],
        query: str
    ) -> str:
        if not chunks:
            return ""

        context_parts = []
        current_length = 0
        max_context_length = self.max_context_length - len(query) - 500

        sorted_chunks = sorted(chunks, key=lambda x: x.get("score", 0), reverse=True)

        for chunk in sorted_chunks:
            chunk_text = (chunk.get("text") or "").strip()
            if not chunk_text:
                continue

            parent_headings = chunk.get("parent_headings") or []
            if parent_headings:
                heading_context = " > ".join(str(h) for h in parent_headings)
                chunk_text = f"[Context: {heading_context}]\\n{chunk_text}"

            if current_length + len(chunk_text) > max_context_length:
                break

            context_parts.append(chunk_text)
            current_length += len(chunk_text)

        assembled_context = "\\n\\n---\\n\\n".join(context_parts)

        self.logger.info(
            f"Assembled context from {len(context_parts)} chunks "
            f"({current_length} characters)"
        )

        self.logger.debug(f"Context preview (first 500 chars): {assembled_context[:500]}...")

        doc_ids_in_context = set()
        for chunk in context_parts:
            if isinstance(chunk, str):
                continue
        for chunk in chunks:
            doc_id = chunk.get("document_id")
            if doc_id:
                doc_ids_in_context.add(doc_id)

        if doc_ids_in_context:
            self.logger.info(f"Context includes chunks from document IDs: {doc_ids_in_context}")

        return assembled_context

    async def _generate_response(self, query: str, context: str) -> str:
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
    ) -> AsyncGenerator[tuple[str, Optional[Dict[str, Any]]], None]:
        
        prompt = self._create_enhanced_prompt(query, context)

        try:
            async for chunk, rate_limit_info in self.llm_service.generate_streaming_response(
                prompt=prompt,
                max_tokens=4000,
                temperature=0.7
            ):
                yield chunk, rate_limit_info

            self.logger.info("Generated streaming response successfully")

        except RateLimitExceeded as e:
            self.logger.error(f"Groq rate limit exceeded during streaming: {str(e)}")
            raise
        except Exception as e:
            self.logger.error(f"Streaming response generation failed: {str(e)}")
            raise Exception(f"Groq streaming failed: {str(e)}")

    def _create_enhanced_prompt(self, query: str, context: str) -> str:
        prompt_template = """<|im_start|>system
You are a document assistant that answers questions STRICTLY based on the provided text.

**ABSOLUTE RULES - NO EXCEPTIONS:**
1. You can ONLY answer if the answer is explicitly stated in the text below
2. DO NOT use any external knowledge, training data, or general knowledge
3. If the answer is not clearly found in the text below, you MUST respond: "I don't have information about that in the provided documents" or something similar to that.
4. Never make assumptions, inferences, or educated guesses beyond what is explicitly written
5. Answer directly without mentioning "the text", "the context", "the documents", or "according to"
6. Use markdown formatting for clarity
7. Do NOT include a title or heading at the start.

<|im_end|>
<|im_start|>user
TEXT TO USE FOR ANSWERING:

{context}

---

QUESTION: {query}

INSTRUCTIONS: Answer ONLY if the answer is explicitly found in the text above. If not found, say "I don't have information about that in the provided documents."
<|im_end|>"""

        formatted_prompt = prompt_template.format(context=context, query=query)

        self.logger.info(f"=== CONTEXT SENT TO LLM (length: {len(context)} chars) ===")
        self.logger.info(f"Context preview: {context[:800]}..." if len(context) > 800 else f"Full context: {context}")
        self.logger.info(f"=== END CONTEXT ===")

        return formatted_prompt