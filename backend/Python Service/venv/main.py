from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel



from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from reportCleaning import process_pdf_to_chunks
import json
from pathlib import Path
import logging


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