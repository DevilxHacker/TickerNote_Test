import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { load } from "cheerio";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000/file"
    : "https://tickernote-test.onrender.com/file";

function SummarizerLayout() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [displayedHTML, setDisplayedHTML] = useState([]);
  const typingInterval = useRef(null);

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`);
      if (!Array.isArray(res.data)) return;
      const sanitized = res.data.map((f) => ({
        id: f.id || f._id || Math.random().toString(),
        originalName: f.originalName || f.originalname || "file.pdf",
        url: f.url || f.s3Url || "",
        result: f.result || "No summary available.",
      }));
      setFiles(sanitized);
      if (!selectedFile && sanitized.length > 0) setSelectedFile(sanitized[0]);
    } catch (err) {
      console.error("❌ Error fetching files:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (!selectedFile?.result) {
      setDisplayedHTML([]);
      return;
    }

    const html = DOMPurify.sanitize(marked.parse(selectedFile.result));
    const $ = load(html);
    const sections = [];

    $("table").each((i, el) => {
      const headers = [];
      const rows = [];

      $(el)
        .find("thead th")
        .each((_, th) => headers.push($(th).text().trim()));

      if (headers.length === 0) {
        $(el)
          .find("tr:first-child td, tr:first-child th")
          .each((_, cell) => headers.push($(cell).text().trim()));
      }

      $(el)
        .find("tr")
        .slice(1)
        .each((_, tr) => {
          const row = {};
          $(tr)
            .find("td")
            .each((i, td) => {
              row[headers[i]] = $(td).text().trim();
            });
          if (Object.keys(row).length) rows.push(row);
        });

      const numericHeader = headers.find((h) =>
        rows.some((r) => !isNaN(parseFloat(r[h]?.replace(/[^\d.-]/g, ""))))
      );

      const chartData =
        numericHeader &&
        rows.length > 0 && {
          labels: rows.map((r) => r[headers[0]] || ""),
          datasets: [
            {
              label: numericHeader,
              data: rows.map((r) =>
                parseFloat(r[numericHeader]?.replace(/[^\d.-]/g, "")) || 0
              ),
              backgroundColor: [
                "rgba(59,130,246,0.6)",
                "rgba(16,185,129,0.6)",
                "rgba(239,68,68,0.6)",
                "rgba(245,158,11,0.6)",
                "rgba(139,92,246,0.6)",
              ],
              borderWidth: 1,
            },
          ],
        };

      sections.push({
        htmlBefore: $.html($(el).prevAll().first()),
        table: { headers, rows },
        chart: chartData,
      });
    });

    setDisplayedHTML(sections);
  }, [selectedFile]);

  const downloadPDF = () => {
    const url = selectedFile?.url;
    if (!url) return alert("File URL missing or expired.");
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedFile?.originalName || "file.pdf";
    link.click();
  };

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

  // Chart Options (responsive + fixed height)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom" },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 11 } },
      },
      x: {
        ticks: { font: { size: 11 }, maxRotation: 60, minRotation: 30 },
      },
    },
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

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Header */}
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

        {/* Content */}
        <div className="flex-1 p-6 space-y-8">
          {displayedHTML.length > 0 ? (
            displayedHTML.map((section, i) => (
              <div key={i} className="p-4 space-y-4 bg-white rounded shadow">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: section.htmlBefore }}
                />

                <table className="min-w-full text-sm border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      {section.table.headers.map((h, idx) => (
                        <th key={idx} className="px-3 py-2 text-left border">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {section.table.headers.map((h, cIdx) => (
                          <td key={cIdx} className="px-3 py-1 border">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Charts */}
                {section.chart && (
                  <div className="grid gap-4 mt-4 sm:grid-cols-2">
                    <div className="relative h-64 p-3 rounded-lg shadow-sm bg-gray-50">
                      <h4 className="mb-2 text-sm font-semibold text-center">
                        Table {i + 1} Data (Bar)
                      </h4>
                      <div className="absolute inset-x-0 bottom-0 top-8">
                        <Bar data={section.chart} options={chartOptions} />
                      </div>
                    </div>

                    <div className="relative h-64 p-3 rounded-lg shadow-sm bg-gray-50">
                      <h4 className="mb-2 text-sm font-semibold text-center">
                        Table {i + 1} Data (Pie)
                      </h4>
                      <div className="absolute inset-x-0 bottom-0 top-8">
                        <Pie data={section.chart} options={chartOptions} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
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
