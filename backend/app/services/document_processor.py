import io
import base64
import fitz
import re
from typing import List, Tuple
from PIL import Image
import pytesseract
from docx import Document


def clean_text(text: str) -> str:
    text = re.sub(r"-\n", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_text_from_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Failed to open PDF file: {e}")

    page_texts = []
    for i, page in enumerate(doc):
        text = page.get_text()

        if not text.strip():
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(image)
        
        page_number = i + 1
        page_texts.append((page_number, clean_text(text.strip())))
    
    return page_texts


def extract_text_from_docx(file_bytes: bytes) -> List[Tuple[int, str]]:
    try:
        doc = Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Failed to open DOCX file: {e}")
    
    full_text = []
    for paragraph in doc.paragraphs:
        full_text.append(paragraph.text)
        
    text_content = "\n".join(full_text)
    
    return [(1, clean_text(text_content))]


def process_document_for_text(file_bytes: bytes, file_type: str) -> List[Tuple[int, str]]:

    handlers = {
        "pdf": extract_text_from_pdf,
        "docx": extract_text_from_docx
        # Add more handlers here as you support new file types
    }

    handler = handlers.get(file_type.lower())
    
    if not handler:
        raise ValueError(f"Unsupported document type: '{file_type}'. Supported types are: {', '.join(handlers.keys())}")
    
    return handler(file_bytes)

def base64_to_text(base64_text: str, file_type: str) -> List[Tuple[int, str]]:
    file_bytes = base64.b64decode(base64_text)
    return process_document_for_text(file_bytes, file_type)

