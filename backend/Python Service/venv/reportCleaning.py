import re
import json
from io import BytesIO
from pathlib import Path
from collections import Counter
from typing import List, Dict

import pdfplumber
import tiktoken

TOKENIZER = tiktoken.get_encoding("cl100k_base")
CHUNK_SIZE = 512
CHUNK_OVERLAP = 80


def extract_raw_pages(pdf_bytes: bytes) -> List[Dict]:
    pages_data = []
    table_settings = {
        "vertical_strategy": "lines_strict",
        "horizontal_strategy": "lines_strict",
        "intersection_tolerance": 10,
        "snap_tolerance": 5,
        "join_tolerance": 5,
        "edge_min_length": 10,
        "min_words_vertical": 3,
        "min_words_horizontal": 2,
    }

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            tables_on_page = page.find_tables(table_settings)
            table_bboxes = [t.bbox for t in tables_on_page]

            filtered_page = page
            for bbox in table_bboxes:
                filtered_page = filtered_page.filter(
                    lambda obj, bb=bbox: not (bb[0] <= obj["x0"] <= bb[2] and bb[1] <= obj["top"] <= bb[3])
                )

            prose_text = filtered_page.extract_text() or ""
            extracted_tables = [t.extract() for t in tables_on_page if t.extract()]

            pages_data.append({
                "page_num": i + 1,
                "raw_text": prose_text,
                "tables": extracted_tables,
            })
    return pages_data


SKIP_PAGE_PATTERNS = [
    r"^\s*$",
    r"(?i)this\s+page\s+intentionally\s+left\s+blank",
    r"(?i)^(table\s+of\s+contents?|contents?)\s*$",
    r"(?i)forward.?looking",
    r"(?i)safe\s+harbor",
]


def is_boilerplate_page(text: str) -> bool:
    if not text or not text.strip():
        return True
    return any(re.search(pat, text) for pat in SKIP_PAGE_PATTERNS)


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2022", "-").replace("\u00b7", "-")
    text = text.replace("\u00a0", " ")
    text = re.sub(r'\b(k\s+no\s+wn|kno wn)\b', 'known', text, flags=re.IGNORECASE)
    text = re.sub(r"(?m)^[\s\-]*Page\s+\d+.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?m)^\s*\d{1,4}\s*$", "", text)
    text = re.sub(r"(?m)^[\s\-=_\.\*]{4,}$", "", text)
    text = re.sub(r"-\n(\w)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines = [l.strip() for l in text.splitlines()]
    return "\n".join(lines).strip()


def remove_repeated_headers_footers(pages_data: List[Dict], top_n=3, min_freq_ratio=0.30):
    total_pages = len(pages_data)
    top_counter = Counter()
    bot_counter = Counter()

    for p in pages_data:
        lines = [l.strip() for l in p.get("clean_text", "").splitlines() if l.strip()]
        for line in lines[:top_n]:
            top_counter[line] += 1
        for line in lines[-top_n:]:
            bot_counter[line] += 1

    freq_threshold = max(3, int(total_pages * min_freq_ratio))
    repeated = {line for line, cnt in {**top_counter, **bot_counter}.items()
                if cnt >= freq_threshold and len(line) < 120}

    for p in pages_data:
        p["clean_text"] = "\n".join(
            l for l in p["clean_text"].splitlines() if l.strip() not in repeated
        )
    return pages_data


def table_to_markdown(table_rows) -> str:
    if not table_rows:
        return ""
    rows = [[str(c).replace("\n", " ").strip() if c is not None else "" for c in row]
            for row in table_rows if any(str(c).strip() for c in row)]
    if not rows:
        return ""
    col_count = max(len(r) for r in rows)
    rows = [r + [""] * (col_count - len(r)) for r in rows]

    md = "| " + " | ".join(rows[0]) + " |\n"
    md += "| " + " | ".join(["---"] * col_count) + " |\n"
    for row in rows[1:]:
        md += "| " + " | ".join(row) + " |\n"
    return md


def attach_tables_to_pages(pages_data: List[Dict]):
    for p in pages_data:
        table_blocks = [f"\n[Table {i} — Page {p['page_num']}]\n{table_to_markdown(tbl)}"
                        for i, tbl in enumerate(p.get("tables", []), 1) if table_to_markdown(tbl)]
        if table_blocks:
            p["clean_text"] += "\n" + "\n".join(table_blocks)
    return pages_data


SECTION_HEADING_RE = re.compile(
    r"(?m)^(?:[A-Z][A-Z0-9\s\-&,()]{5,80}[A-Z]$|\d{1,2}\.?\s+[A-Z][A-Za-z\s\-&,]{8,}|NOTE\s+-\s?\d+|Item No\.\s?\d+)",
    re.IGNORECASE
)


def split_into_sections(pages_data: List[Dict]):
    all_lines = [(p["page_num"], line) for p in pages_data for line in p.get("clean_text", "").splitlines()]
    sections = []
    current_title = "Preamble"
    current_pages = set()
    current_lines = []

    for page_num, line in all_lines:
        current_pages.add(page_num)
        stripped = line.strip()
        if SECTION_HEADING_RE.match(stripped) and len(stripped) > 5:
            if current_lines:
                sections.append({
                    "section": current_title,
                    "pages": sorted(current_pages),
                    "text": "\n".join(current_lines).strip(),
                })
            current_title = stripped
            current_pages = {page_num}
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append({
            "section": current_title,
            "pages": sorted(current_pages),
            "text": "\n".join(current_lines).strip(),
        })
    return sections


def chunk_text(text: str) -> List[str]:
    chunks = []
    table_pattern = re.compile(r"(\[Table \d+ — Page \d+\]\n(?:\|.*\|\n)+)")
    blocks = table_pattern.split(text)

    for block in blocks:
        if not block.strip():
            continue
        if block.startswith("[Table"):
            chunks.append(block.strip())
        else:
            paragraphs = [p.strip() for p in re.split(r"\n{2,}", block) if p.strip()]
            current = []
            current_tokens = 0
            for para in paragraphs:
                para_tokens = len(TOKENIZER.encode(para))
                if current_tokens + para_tokens > CHUNK_SIZE and current:
                    chunks.append(" ".join(current))
                    overlap = " ".join(current).split()[-CHUNK_OVERLAP//2:]
                    current = [" ".join(overlap)]
                    current_tokens = len(TOKENIZER.encode(" ".join(current)))
                current.append(para)
                current_tokens += para_tokens
            if current:
                chunks.append(" ".join(current))
    return [c.strip() for c in chunks if c.strip()]


def build_rag_chunks(pages_data: List[Dict], filename: str) -> List[Dict]:
    sections = split_into_sections(pages_data)
    all_chunks = []
    chunk_id = 0
    doc_id = Path(filename).stem.replace(" ", "_").replace("(", "").replace(")", "").replace("[", "").replace("]", "")

    for sec in sections:
        text_chunks = chunk_text(sec["text"])
        for idx, chunk in enumerate(text_chunks):
            all_chunks.append({
                "chunk_id": chunk_id,
                "document": doc_id,
                "section": sec["section"][:120],
                "chunk_index": idx,
                "total_chunks": len(text_chunks),
                "pages": sec["pages"],
                "token_count": len(TOKENIZER.encode(chunk)),
                "text": chunk,
                "metadata": {
                    "document": doc_id,
                    "source_file": filename,
                    "section": sec["section"],
                    "pages": sec["pages"],
                }
            })
            chunk_id += 1
    return all_chunks


def process_pdf_to_chunks(pdf_bytes: bytes, filename: str) -> List[Dict]:
    """Main processing function - called by FastAPI"""
    raw_pages = extract_raw_pages(pdf_bytes)
    content_pages = [p for p in raw_pages if not is_boilerplate_page(p["raw_text"])]

    for p in content_pages:
        p["clean_text"] = clean_text(p["raw_text"])

    content_pages = remove_repeated_headers_footers(content_pages)
    content_pages = attach_tables_to_pages(content_pages)

    return build_rag_chunks(content_pages, filename)