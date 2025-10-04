<div align="center">

# 📚 Documents Hub

*A document management application with conversational search capabilities*

</div>

---

## What it does

Documents Hub enables document upload, processing, and retrieval through natural language queries. The application extracts text from various document formats, indexes the content in a vector database, and uses language models to answer questions based on the document content.

## 📄 Supported Document Types

- **PDF files** - Text extraction with automatic OCR fallback for scanned documents
- **Word documents** (.docx, .doc) - Full text and table content extraction
- **Images** (PNG, JPG, etc.) - OCR-based text extraction using Tesseract

## 🔍 How it works

1. **Document Processing**: Uploaded files are parsed and text is extracted using format-specific handlers
2. **OCR Support**: Scanned PDFs and images are processed with OCR to extract readable text
3. **Text Chunking**: Extracted text is split into semantic chunks for efficient retrieval
4. **Vector Indexing**: Document chunks are embedded and stored in Qdrant vector database
5. **Conversational Search**: Natural language queries retrieve relevant chunks and generate contextual answers

## Technology Stack

- **Backend**: FastAPI
- **Language Model**: Groq for document analysis and question answering
- **Vector Database**: Qdrant for semantic search
- **OCR**: Tesseract and PyMuPDF for text extraction
- **Deployment**: Docker containerization
