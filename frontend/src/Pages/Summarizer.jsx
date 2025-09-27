import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3000/file"
  : "https://tickernote-test.onrender.com/file";


function SummarizerLayout() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [displayedHTML, setDisplayedHTML] = useState("");
  const typingInterval = useRef(null);

  // Fetch all uploaded files
  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await axios.get(`${API_BASE}/files`);
      if (!Array.isArray(res.data)) return;

      const sanitized = res.data
        .filter(Boolean)
        .map((f) => ({
          id: f.id || f._id || Math.random().toString(),
          originalName: f.originalName || f.originalname || "file.pdf",
          url: f.url || f.s3Url || "",
          result: f.result || "No summary available.",
        }));

      setFiles(sanitized);
      if (!selectedFile && sanitized.length > 0) {
        setSelectedFile(sanitized[0]);
      }
    } catch (err) {
      console.error("❌ Error fetching files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Helper: split summary into chunks by double newlines
  const splitIntoChunks = (markdownText) => {
    if (!markdownText) return [];
    return markdownText
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  };

  // ChatGPT-like word-by-word typing animation inside single bordered container
  useEffect(() => {
    if (!selectedFile) {
      setDisplayedHTML("");
      return;
    }

    const chunks = splitIntoChunks(selectedFile.result);

    let currentChunkIndex = 0;
    let currentWordIndex = 0;
    let currentText = "";
    let accumulatedHTML = "";

    setDisplayedHTML("");

    if (typingInterval.current) clearInterval(typingInterval.current);

    typingInterval.current = setInterval(() => {
      if (currentChunkIndex >= chunks.length) {
        clearInterval(typingInterval.current);
        return;
      }

      const words = chunks[currentChunkIndex].split(/\s+/);

      if (currentWordIndex < words.length) {
        currentText += words[currentWordIndex] + " ";
        currentWordIndex++;

        // Parse partial chunk markdown to HTML
        const html = marked.parse(currentText);
        const sanitizedHTML = DOMPurify.sanitize(html);

        // Combine all previous full chunks + current partial chunk HTML
        const fullHTML = accumulatedHTML + sanitizedHTML;

        setDisplayedHTML(fullHTML);
      } else {
        // Completed this chunk - add fully parsed chunk HTML to accumulatedHTML
        const fullChunkHTML = DOMPurify.sanitize(marked.parse(chunks[currentChunkIndex]));
        accumulatedHTML += fullChunkHTML;

        // Move to next chunk
        currentChunkIndex++;
        currentWordIndex = 0;
        currentText = "";
      }
    }, 50); // Adjust speed (ms per word) here

    return () => clearInterval(typingInterval.current);
  }, [selectedFile]);

  // Download PDF
const downloadPDF = () => {
  try {
    const url = selectedFile?.url;
    const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", selectedFile?.originalName); // Suggests filename
      document.body.appendChild(link);
      link.click();
      link.remove();
  } catch (err) {
    console.error("❌ Error downloading PDF:", err);
    alert("Failed to download PDF");
  }
};



  // Upload PDF
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      await axios.post(`${API_BASE}/uploads`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      setShowUpload(false);
      fetchFiles();
    } catch (err) {
      console.error("❌ Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 md:flex-row">
      {/* Sidebar */}
      <div className="w-full p-4 overflow-y-auto bg-white border-b md:w-64 md:border-r md:h-screen">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Uploaded PDFs</h4>
          <button
            onClick={() => setShowUpload(true)}
            className="px-2 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Upload
          </button>
        </div>

        {loadingFiles && <p>Loading files...</p>}
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              onClick={() => setSelectedFile(f)}
              className={`p-2 rounded cursor-pointer ${
                selectedFile?.id === f.id ? "bg-blue-100" : "hover:bg-gray-200"
              }`}
            >
              {f.originalName}
            </li>
          ))}
        </ul>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 bg-white border-b">
          <h3 className="text-xl font-semibold">
            {selectedFile?.originalName || "Select a file"}
          </h3>
          <button
            onClick={downloadPDF}
            disabled={!selectedFile?.url}
            className={`px-4 py-2 rounded text-white ${
              selectedFile?.url
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Download PDF
          </button>
        </div>

        {/* Summary output */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedFile ? (
            <div
              className="max-w-3xl p-6 mx-auto prose bg-white border-l-4 border-blue-600 rounded shadow-md"
              dangerouslySetInnerHTML={{ __html: displayedHTML }}
            />
          ) : (
            <p className="text-gray-500">Select a PDF to view its summary.</p>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-sm p-6 bg-white rounded-lg">
            <h4 className="mb-4 text-lg font-semibold">Upload PDF</h4>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="p-2 border rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-white bg-gray-400 rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  {uploading ? "Uploading..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SummarizerLayout;
