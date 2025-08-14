import os
import uuid
from pathlib import Path
from fastapi import UploadFile
import base64

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def save_file(upload_file: UploadFile, user_id: uuid.UUID) -> str:
    extension = Path(upload_file.filename).suffix
    unique_filename = f"{upload_file.filename}"

    user_dir = Path(UPLOAD_DIR) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_dir / unique_filename

    upload_file.file.seek(0)
    file_bytes = upload_file.file.read()
    if not file_bytes:
        raise ValueError("Uploaded file is empty")

    with file_path.open("wb") as f:
        f.write(file_bytes)

    return str(file_path)

def save_base64_file(content_base64: str, filename: str, user_id: uuid.UUID) -> str:
    
    user_folder = Path(UPLOAD_DIR) / str(user_id)
    user_folder.mkdir(parents=True, exist_ok=True)

    extension = Path(filename).suffix
    # unique_filename = f"{uuid.uuid4()}{extension}"
    unique_filename = f"{filename}"
    file_path = user_folder / unique_filename

    file_bytes = base64.b64decode(content_base64)
    with file_path.open("wb") as f:
        f.write(file_bytes)

    return str(file_path)