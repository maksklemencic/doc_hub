from fastapi import FastAPI
import debugpy
from .routes import upload, chat, documents

debugpy.listen(("0.0.0.0", 5678))

app = FastAPI()
app.include_router(upload.router, prefix="/upload")
app.include_router(chat.router, prefix="/chat")
app.include_router(documents.router, prefix="/documents")

@app.get("/")
def read_root():
    return {"message": "FastAPI is running!"}

# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: str = None):
#     return {"item_id": item_id, "q": q}