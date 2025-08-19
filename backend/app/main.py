from fastapi import FastAPI
import debugpy
from backend.db_init.db_init import Message
from .routes import upload, chat, documents, spaces, messages, users

debugpy.listen(("0.0.0.0", 5678))

app = FastAPI()
app.include_router(upload.router, prefix="/upload")
app.include_router(chat.router, prefix="/chat")
app.include_router(documents.router, prefix="/documents")
app.include_router(spaces.router, prefix="/spaces")
app.include_router(messages.router, prefix="/spaces")
app.include_router(users.router, prefix="/users")

@app.get("/")
def read_root():
    return {"message": "FastAPI is running!"}

# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: str = None):
#     return {"item_id": item_id, "q": q}