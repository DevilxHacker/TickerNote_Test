

import os
import time
import logging
from typing import List, Dict, Optional
from datetime import datetime

from pymongo import MongoClient, UpdateOne
from pymongo.operations import SearchIndexModel
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


# Config 
MONGO_URI         = os.getenv("MONGO_URI")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY")
DB_NAME           = os.getenv("MONGO_DB_NAME", "ragdb")
COLLECTION_NAME   = "rag_chunks"
VECTOR_INDEX      = "vector_index"
EMBEDDING_DIM     = 384          

# retrival
TOP_K             = 1            
MIN_SCORE         = 0.50         
MAX_CHUNK_CHARS   = 3000         

# Context / prompt
MAX_CONTEXT_CHARS = 1200        
CHUNK_TRUNCATE    = 1000         
MAX_HISTORY_TURNS = 1           
HISTORY_MSG_CAP   = 150          

# Generation
MAX_OUTPUT_TOKENS = 256          
TEMPERATURE       = 0.2          

# Retry
MAX_RETRIES       = 3            
RETRY_BASE_WAIT   = 1.0         


_embedder: Optional[SentenceTransformer] = None
_mongo_client: Optional[MongoClient]     = None
_collection                              = None


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        logger.info("Loading sentence-transformer model...")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded.")
    return _embedder


def get_collection():
    global _mongo_client, _collection
    if _collection is None:
        _mongo_client = MongoClient(MONGO_URI)
        db = _mongo_client[DB_NAME]
        _collection = db[COLLECTION_NAME]
        _ensure_vector_index(_collection)
    return _collection


# ── Vector Index ──────────────────────────────────────────────────────────────
def _ensure_vector_index(col):
    try:
        db = col.database
        if COLLECTION_NAME not in db.list_collection_names():
            db.create_collection(COLLECTION_NAME)
            logger.info(f"Created {COLLECTION_NAME} collection.")

        existing = list(col.list_search_indexes())
        names = [idx.get("name") for idx in existing]

        if VECTOR_INDEX not in names:
            logger.info("Creating Atlas Vector Search index...")
            index_def = SearchIndexModel(
                definition={
                    "fields": [
                        {
                            "type": "vector",
                            "path": "embedding",
                            "numDimensions": EMBEDDING_DIM,
                            "similarity": "cosine",
                        },
                        {
                            "type": "filter",
                            "path": "document_id",
                        },
                    ]
                },
                name=VECTOR_INDEX,
                type="vectorSearch",
            )
            col.create_search_index(index_def)
            logger.info("Vector index created. It may take ~1 min to become active.")
        else:
            logger.info("Vector index already exists.")
    except Exception as e:
        logger.warning(
            f"Could not verify/create vector index: {e}. "
            "Ensure your Atlas cluster supports Vector Search."
        )


# Embedding 
def embed_texts(texts: List[str]) -> List[List[float]]:
    model = get_embedder()
    vecs = model.encode(
        texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True
    )
    return vecs.tolist()


def embed_query(text: str) -> List[float]:
    return embed_texts([text])[0]


#Ingest 
def ingest_chunks(chunks: List[Dict], document_id: str) -> int:
    """
    Embed each chunk and upsert into MongoDB Atlas.

    chunks      : list of dicts from reportCleaning.process_pdf_to_chunks()
                  Expected keys: chunk_id, text, section, chunk_index,
                                 total_chunks, pages, token_count, metadata
    document_id : unique identifier (e.g. file._id from MongoDB)

    Returns number of chunks stored.
    """
    col   = get_collection()
    texts = [c["text"] for c in chunks]

    logger.info(f"Embedding {len(texts)} chunks for document '{document_id}'...")
    embeddings = embed_texts(texts)
    logger.info("Embeddings done.")

    ops = []
    for chunk, emb in zip(chunks, embeddings):
        doc = {
            "document_id":  document_id,
            "chunk_id":     chunk["chunk_id"],
            "section":      chunk.get("section", ""),
            "chunk_index":  chunk.get("chunk_index", 0),
            "total_chunks": chunk.get("total_chunks", 1),
            "pages":        chunk.get("pages", []),
            "token_count":  chunk.get("token_count", 0),
            "text":         chunk["text"],
            "embedding":    emb,
            "source_file":  chunk.get("metadata", {}).get("source_file", ""),
            "created_at":   datetime.utcnow(),
        }
        ops.append(
            UpdateOne(
                {"document_id": document_id, "chunk_id": chunk["chunk_id"]},
                {"$set": doc},
                upsert=True,
            )
        )

    if ops:
        result = col.bulk_write(ops, ordered=False)
        logger.info(
            f"Upserted {result.upserted_count + result.modified_count} chunks."
        )
        print("ingested chunks in ragService")
    return len(ops)


def delete_document_chunks(document_id: str) -> int:
    col = get_collection()
    result = col.delete_many({"document_id": document_id})
    return result.deleted_count


# Retrieval 
def retrieve_chunks(
    query: str, document_id: str, top_k: int = TOP_K
) -> List[Dict]:
   
    col   = get_collection()
    q_emb = embed_query(query)

    pipeline = [
        {
            "$vectorSearch": {
                "index":         VECTOR_INDEX,
                "path":          "embedding",
                "queryVector":   q_emb,
                "numCandidates": top_k * 4,   
                "limit":         top_k,
                "filter":        {"document_id": {"$eq": document_id}},
            }
        },
        {
            "$project": {
                "_id":         0,
                "text":        1,
                "section":     1,
                "pages":       1,
                "chunk_index": 1,
                "score":       {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        results = list(col.aggregate(pipeline))

#removing low confidence chunk
        results = [r for r in results if r.get("score", 0) >= MIN_SCORE]

        results = [
            r for r in results if len(r.get("text", "")) <= MAX_CHUNK_CHARS
        ]

        if not results:
            logger.warning(
                "All retrieved chunks failed quality gate "
                "(low score or oversized). Falling back to text search."
            )
            return _fallback_text_search(query, document_id, top_k)

        logger.info(
            f"Retrieved {len(results)} chunk(s) "
            f"(score ≥ {MIN_SCORE}, size ≤ {MAX_CHUNK_CHARS} chars)"
        )
        return results

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return _fallback_text_search(query, document_id, top_k)


def _fallback_text_search(
    query: str, document_id: str, top_k: int
) -> List[Dict]:
    """Keyword fallback when the vector index isn't ready yet."""
    col        = get_collection()
    words      = query.split()[:5]
    regex_part = "|".join(words)
    docs = list(
        col.find(
            {
                "document_id": document_id,
                "text": {"$regex": regex_part, "$options": "i"},
            },
            {"_id": 0, "text": 1, "section": 1, "pages": 1, "chunk_index": 1},
        ).limit(top_k)
    )
    logger.info(f"Fallback text search returned {len(docs)} result(s).")
    return docs


# sContext Builder 
def build_context(
    chunks: List[Dict], max_chars: int = MAX_CONTEXT_CHARS
) -> str:
    """
    Build a compact context string from retrieved chunks.
    Each chunk is individually truncated, then the total is capped at max_chars.
    """
    if not chunks:
        return "No relevant context found."

    parts       = []
    total_chars = 0

    for i, c in enumerate(chunks, 1):
        section  = c.get("section", "Unknown Section")
        pages    = c.get("pages", [])
        page_str = f"p.{pages[0]}" if pages else ""
        text     = c["text"].strip()

        # Truncate large chunks
        if len(text) > CHUNK_TRUNCATE:
            text = text[:CHUNK_TRUNCATE] + "…[truncated]"

        entry = f"[{i} | {section} {page_str}]\n{text}"

        if total_chars + len(entry) > max_chars:
            logger.info(f"Context budget reached at chunk {i}, stopping.")
            break

        parts.append(entry)
        total_chars += len(entry)

    logger.info(f"Built context: {total_chars} chars from {len(parts)} chunk(s)")
    return "\n\n---\n\n".join(parts)


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")


def _get_gemini() -> genai.GenerativeModel:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set in environment.")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(GEMINI_MODEL)



SYSTEM_PROMPT = (
    "Answer using ONLY the document context below. "
    "If the answer isn't there, say: \"I couldn't find that in this document.\" "
    "Cite section name or page number when available. "
    "Be concise; use bullet points for multi-part answers."
)


def generate_answer(
    query: str,
    context: str,
    chat_history: Optional[List[Dict]] = None,
) -> str:
    """
    Call Gemini with retrieved context + optional chat history.
    Retries up to MAX_RETRIES times with exponential backoff on 429 errors.
    """
    model = _get_gemini()

  
    history_text = ""
    if chat_history:
        recent = chat_history[-(MAX_HISTORY_TURNS * 2):]
        for turn in recent:
            role    = "User" if turn["role"] == "user" else "Assistant"
            content = turn["content"][:HISTORY_MSG_CAP]
            history_text += f"{role}: {content}\n"


    sections = [f"CONTEXT:\n{context}"]
    if history_text:
        sections.append(f"RECENT CHAT:\n{history_text.strip()}")
    sections.append(f"QUESTION: {query}")

    prompt = SYSTEM_PROMPT + "\n\n" + "\n\n".join(sections) + "\n\nANSWER:"

    estimated_tokens = len(prompt) // 4
    logger.info(f"Prompt estimate: ~{estimated_tokens} tokens | model: {GEMINI_MODEL}")

    generation_config = genai.GenerationConfig(
        max_output_tokens=MAX_OUTPUT_TOKENS,
        temperature=TEMPERATURE,
    )

    # retry
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            response = model.generate_content(prompt, generation_config=generation_config)
            return response.text.strip()

        except Exception as e:
            last_error = e
            err_str    = str(e)

            is_rate_limit = "429" in err_str or "quota" in err_str.lower()
            is_transient  = any(
                code in err_str for code in ("500", "502", "503", "504")
            )

            if (is_rate_limit or is_transient) and attempt < MAX_RETRIES - 1:
                wait = RETRY_BASE_WAIT * (2 ** attempt)   # 1s → 2s → 4s
                logger.warning(
                    f"Gemini {'rate limit' if is_rate_limit else 'transient error'} "
                    f"(attempt {attempt + 1}/{MAX_RETRIES}). "
                    f"Retrying in {wait:.0f}s… [{err_str[:80]}]"
                )
                time.sleep(wait)
            else:
                # Non-retryable error or out of attempts
                logger.error(f"Gemini error after {attempt + 1} attempt(s): {e}")
                raise

    # Should never reach here, but satisfy type checker
    raise RuntimeError(f"Gemini call failed after {MAX_RETRIES} attempts: {last_error}")


# Main RAG Pipeline 
def rag_query(
    query: str,
    document_id: str,
    chat_history: Optional[List[Dict]] = None,
) -> Dict:
    """
    Full RAG pipeline: retrieve → quality gate → build context → generate answer.

    Args:
        query       : user question
        document_id : MongoDB document identifier (used to filter chunks)
        chat_history: list of {"role": "user"|"assistant", "content": str}

    Returns:
        {
            "answer":      str,
            "sources":     [{"section": str, "pages": list, "score": float}],
            "chunks_used": int,
        }
    """
    chunks  = retrieve_chunks(query, document_id)
    context = build_context(chunks)
    answer  = generate_answer(query, context, chat_history)

    sources = [
        {
            "section": c.get("section", ""),
            "pages":   c.get("pages", []),
            "score":   round(c.get("score", 0), 3),
        }
        for c in chunks
    ]

    return {
        "answer":      answer,
        "sources":     sources,
        "chunks_used": len(chunks),
    }