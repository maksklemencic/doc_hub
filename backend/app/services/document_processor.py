import io
import base64
import fitz
import re
from typing import List
from PIL import Image
import pytesseract

def base64_to_bytes(base64_text: str):
    file_bytes = base64.b64decode(base64_text)
    return extract_text_with_structure(file_bytes)


def extract_text_with_structure(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = []
    
    for page in doc:
        text = page.get_text()
        
        if not text.strip():
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(image)
        
        full_text.append(text.strip())
    
    return "\n".join(full_text)

def clean_text(text: str) -> str:
    text = re.sub(r"-\n", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()