from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
        "python_says": "Hello World from Python!",
        "you_sent": data.message,
        "note": "Connection between MERN and Python is working 🎉"
    }