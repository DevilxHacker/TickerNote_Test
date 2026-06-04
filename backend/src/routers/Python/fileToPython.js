import axios from 'axios';
export async function filePythonRouter(blob, name) {
  const form = new FormData();
  form.append("file", blob, name);

  const FASTAPI_URL = "http://127.0.0.1:8000";
  console.log(`Forwarding ${name} to Python...`);

  try {
    console.log("sending file to python")
    const pythonResponse = await axios.post(`${FASTAPI_URL}/upload-pdf`, form);
    const fullJsonlData =
      typeof pythonResponse.data === "string"
        ? pythonResponse.data
        : JSON.stringify(pythonResponse.data);
    console.log("Python processing complete. JSONL data received.");
    return Buffer.from(fullJsonlData, "utf-8");
  } catch (error) {
    console.error("Error forwarding to Python:", error.message);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
}