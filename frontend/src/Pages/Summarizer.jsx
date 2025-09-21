// frontend/src/Form.jsx
import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE =  "http://localhost:3000/file";

function Summarizer() {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`);
      setFiles(res.data);
    } catch (err) {
      console.error("❌ Fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_BASE}/uploads`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      fetchFiles();
    } catch (err) {
      console.error("❌ Upload failed:", err);
    }
  };

  return (
    <div className="max-w-3xl p-6 mx-auto">
      {/* Upload form */}
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 p-6 bg-white border shadow-md rounded-xl"
      >
        <h4 className="text-lg font-semibold">Upload PDF</h4>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="p-2 border rounded-lg"
        />
        <button
          type="submit"
          className="px-4 py-2 text-white transition bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Submit
        </button>
      </form>

      {/* Uploaded files */}
      <div className="mt-8">
        <h5 className="mb-2 font-bold text-md">Uploaded Files</h5>
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f._id}
              className="flex flex-col items-center justify-between p-3 border rounded-lg shadow-sm sm:flex-row bg-gray-50"
            >
              <span className="font-medium">{f.originalname}</span>

              <div className="flex gap-2">
                {/* View summary in new tab */}
                <a
                  href={`${API_BASE}/view-pdf/${f._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                >
                  View Summary
                </a>

                {/* Download summary directly */}
                <a
                  href={`${API_BASE}/download-pdf/${f._id}`}
                  download={`${f.originalname.replace(".pdf", "")}-summary.pdf`}
                  className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Download PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Summarizer;
