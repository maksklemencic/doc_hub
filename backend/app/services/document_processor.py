import io
import base64
import fitz
import re
from typing import List
from PIL import Image
import pytesseract

from app.services.document_processor import clean_text


def base64_to_text(base64_text: str) -> list[(int, str)]:
    file_bytes = base64.b64decode(base64_text)
    return extract_text_with_structure(file_bytes)


def extract_text_with_structure(file_bytes: bytes) -> list[(int, str)]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
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

def clean_text(text: str) -> str:
    text = re.sub(r"-\n", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()