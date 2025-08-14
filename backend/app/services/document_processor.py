import io
import base64
import fitz
import re
from typing import List, Tuple
from PIL import Image
import pytesseract
from docx import Document
import unicodedata


def clean_text(text: str) -> str:
    text = re.sub(r"-\n", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"[\x00-\x1F\x7F]+", "", text)
    text = unicodedata.normalize("NFKC", text)
    return text.strip()


def extract_text_from_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Failed to open PDF file: {e}")

    page_texts = []
    for i, page in enumerate(doc):
        text = page.get_text()

        if not len(text.strip()) < 5:
            pix = page.get_pixmap(dpi=300, alpha=False)
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
    
    text_chunks = []
    for paragraph in doc.paragraphs:
        try:
            text = clean_text(paragraph.text)
            if text:
                text_chunks.append(text)
        except Exception as e:
            print(f"Warning: failed to read paragraph: {e}")

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(clean_text(cell.text) for cell in row.cells if cell.text.strip())
            if row_text:
                text_chunks.append(row_text)

    combined_text = "\n".join(text_chunks)

    if not combined_text.strip():
        raise ValueError("No readable text found in DOCX file.")

    return [(1, combined_text)]


def extract_text_from_image(image_bytes: bytes) -> List[Tuple[int, str]]:
    
    image = Image.open(io.BytesIO(image_bytes))
    text = pytesseract.image_to_string(image).strip()
    clean = clean_text(text)

    return [(1, clean)]


def process_document_for_text(file_bytes: bytes, file_type: str) -> List[Tuple[int, str]]:

    handlers = {
        "pdf": extract_text_from_pdf,
        "docx": extract_text_from_docx,
        "img": extract_text_from_image
        # Add more handlers here as you support new file types
    }

    handler = handlers.get(file_type.lower())
    
    if not handler:
        raise ValueError(f"Unsupported document type: '{file_type}'. Supported types are: {', '.join(handlers.keys())}")
    
    return handler(file_bytes)

def base64_to_text(base64_text: str, file_type: str) -> List[Tuple[int, str]]:
    file_bytes = base64.b64decode(base64_text)
    return process_document_for_text(file_bytes, file_type)

