from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from reportCleaning import process_pdf_to_chunks
from ragService import ingest_chunks, rag_query, delete_document_chunks
import json
from pathlib import Path
import logging
from typing import List, Optional


logger = logging.getLogger(__name__)

app = FastAPI(title="Python Hello World")

# Allow MERN to access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    message: str

class IngestRequest(BaseModel):
    document_id: str
    chunks: List[dict]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    document_id: str
    chat_history: Optional[List[ChatMessage]] = []

class DeleteRequest(BaseModel):
    document_id: str


@app.get("/")
def home():
    return {"message": "Hello World from Python Server!"}

@app.post("/hello")
def hello_world(data: Message):
    return {
        "status": "success",
        "python_says": "Hello World from Python",
        "you_sent": data.message,
        "note": "Connection between MERN and Python is successful"
    }


@app.post("/upload-pdf")
async def receive_pdf(file: UploadFile = File(...)):
    print("recived file in python")
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_bytes = await file.read()

    try:
        logger.info(f"Starting processing: {file.filename} | Size: {len(file_bytes)/1024:.1f} KB")

        rag_chunks = process_pdf_to_chunks(file_bytes, file.filename)

        logger.info(f"Successfully generated {len(rag_chunks)} chunks")

        def generate_jsonl():
            for chunk in rag_chunks:
                yield json.dumps(chunk, ensure_ascii=False) + "\n"

        response = StreamingResponse(
            generate_jsonl(),
            media_type="application/jsonl",
            headers={
                "Content-Disposition": f'attachment; filename="{Path(file.filename).stem}_chunks.jsonl"'
            }
        )

        # Add custom header for easier verification
        response.headers["X-Chunks-Count"] = str(len(rag_chunks))
        response.headers["X-Processing-Status"] = "success"

        return response

    except Exception as e:
        logger.error(f"Failed to process {file.filename}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest-chunks")
async def ingest_chunks_endpoint(req: IngestRequest):

    try:
        logger.info(f"Ingesting {len(req.chunks)} chunks for document {req.document_id}")

        stored = ingest_chunks(req.chunks, req.document_id)

        return {
            "status": "success",
            "chunks_stored": stored,
            "document_id": req.document_id
        }

    except Exception as e:
        logger.error(f"Ingest failed for {req.document_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat_endpoint(req: ChatRequest):

    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        history = [{"role": m.role, "content": m.content} for m in (req.chat_history or [])]

        result = rag_query(req.query, req.document_id, history)

        return {
            "status": "success",
            "answer": result["answer"],
            "sources": result["sources"],
            "chunks_used": result["chunks_used"],
            "document_id": req.document_id
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat failed for {req.document_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/document-chunks")
async def delete_chunks(req: DeleteRequest):

    try:
        deleted = delete_document_chunks(req.document_id)

        return {
            "status": "success",
            "deleted": deleted,
            "document_id": req.document_id
        }

    except Exception as e:
        logger.error(f"Delete failed for {req.document_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))