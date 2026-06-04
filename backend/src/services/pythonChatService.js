import { PYTHON_API_URL } from "../config/serverConfig.js";
import fetch from "node-fetch";

const PYTHON_URL = PYTHON_API_URL || "http://localhost:8000";


export const callPythonChat = async (payload) => {
  const res = await fetch(`${PYTHON_URL}/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(60_000), //waitiing 60 sec for llm
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Python chat error ${res.status}: ${err}`);
  }

  return res.json();
};


export const callPythonIngest = async (payload) => {
  const res = await fetch(`${PYTHON_URL}/ingest-chunks`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(300_000),  // 5 min for large docs
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Python ingest error ${res.status}: ${err}`);
  }

  return res.json();
};


export const callPythonDeleteChunks = async (document_id) => {
  const res = await fetch(`${PYTHON_URL}/document-chunks`, {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ document_id }),
    signal:  AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Python delete error ${res.status}: ${err}`);
  }

  return res.json();
};