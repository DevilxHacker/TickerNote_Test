import { useState, useEffect } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Bar, Pie, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000/file"
    : "https://tickernote-test.onrender.com/file";

export default function SummarizerLayout() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contentBlocks, setContentBlocks] = useState([]);

  const fetchFiles = async () => {
    setLoadingFiles(true);
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
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Parse blocks and detect tables for charts
  useEffect(() => {
    if (!selectedFile?.result) {
      setContentBlocks([]);
      return;
    }

    const rawHTML = DOMPurify.sanitize(marked.parse(selectedFile.result));
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawHTML;

    const blocks = [];
    let currentHTML = "";

    const addBlock = (html, tableData = null, chartType = null) => {
      if (html.trim() || tableData)
        blocks.push({ html, tableData, chartType });
    };

    const detectChartType = (text) => {
      const lower = text.toLowerCase();
      if (lower.includes("main product")) return ["pie"];
      if (lower.includes("segment")) return ["bar", "pie"];
      if (lower.includes("geography")) return ["pie"];
      if (lower.includes("financial")) return ["bar", "line"];
      if (lower.includes("cash flow")) return ["bar", "waterfall"];
      if (lower.includes("shareholding")) return ["pie", "donut"];
      return ["bar"];
    };

    tempDiv.childNodes.forEach((node) => {
      if (node.tagName === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr"));
        const headers = Array.from(rows[0]?.querySelectorAll("th") || []).map(
          (th) => th.textContent.trim()
        );
        const dataRows = rows.slice(1).map((r) =>
          Array.from(r.querySelectorAll("td")).map((td) =>
            td.textContent.trim()
          )
        );
        if (headers.length === 0 || dataRows.length === 0) return;
        const tableData = { headers, rows: dataRows };
        const chartTypes = detectChartType(currentHTML);
        addBlock(currentHTML, null);
        currentHTML = "";
        addBlock(node.outerHTML, tableData, chartTypes);
      } else {
        currentHTML += node.outerHTML || node.textContent || "";
      }
    });
    addBlock(currentHTML, null);
    setContentBlocks(blocks);
  }, [selectedFile]);

  // 🌈 Modern color palette
  const colorPalette = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#14B8A6", "#F43F5E",
    "#6366F1", "#84CC16", "#06B6D4", "#D946EF",
  ];

  // ✨ Generate gradient or variant color per dataset
  const generateColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const base = colorPalette[i % colorPalette.length];
      const alpha = (0.6 + (i % 3) * 0.1).toFixed(2);
      colors.push(base + Math.floor(alpha * 255).toString(16));
    }
    return colors;
  };

  // 📊 Chart rendering
  const renderChartFromTable = (tableData, index, chartTypes) => {
    if (!chartTypes || !tableData?.headers?.length || !tableData?.rows?.length)
      return null;

    const labels = tableData.rows.map((r) => r[0]);
    const numericCols = tableData.headers
      .map((header, colIndex) => {
        if (colIndex === 0) return null;
        const values = tableData.rows
          .map((r) => parseFloat(r[colIndex]?.replace(/[,%₹$]/g, "")))
          .filter((v) => !isNaN(v));
        return values.length > 0 ? { header, values } : null;
      })
      .filter(Boolean);

    if (numericCols.length === 0) return null;

    const colors = generateColors(numericCols.length);
    const baseData = {
      labels,
      datasets: numericCols.map((col, i) => ({
        label: col.header,
        data: col.values,
        backgroundColor:
          chartTypes.includes("pie") || chartTypes.includes("donut")
            ? generateColors(labels.length)
            : colors[i],
        borderColor: colors[i],
        borderWidth: 1.5,
        tension: 0.3,
      })),
    };

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 14, font: { size: 12 } } },
        tooltip: { mode: "index", intersect: false },
        title: {
          display: true,
          text: `${chartTypes.join(", ").toUpperCase()} — ${tableData.headers.join(", ")}`,
          font: { size: 14, weight: "bold" },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } } } },
    };

    const chartHeight = 260 + numericCols.length * 30;

    return (
      <div key={`chart-${index}`} className="flex flex-wrap justify-center gap-8 my-8">
        {chartTypes.map((type, idx) => (
          <div
            key={`${index}-${type}`}
            className="w-full md:w-[48%] bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition"
            style={{ height: `${chartHeight}px` }}
          >
            {type === "bar" && <Bar data={baseData} options={baseOptions} />}
            {type === "stackedBar" && (
              <Bar
                data={{
                  ...baseData,
                  datasets: baseData.datasets.map((d) => ({
                    ...d,
                    stack: "Stack 1",
                  })),
                }}
                options={{
                  ...baseOptions,
                  scales: { x: { stacked: true }, y: { stacked: true } },
                }}
              />
            )}
            {type === "line" && <Line data={baseData} options={baseOptions} />}
            {type === "pie" && <Pie data={baseData} options={baseOptions} />}
            {type === "donut" && <Doughnut data={baseData} options={baseOptions} />}
            {type === "waterfall" && (
              <Bar
                data={{
                  labels,
                  datasets: [
                    {
                      label: "Inflow",
                      data: numericCols[0].values.map((v) => (v >= 0 ? v : 0)),
                      backgroundColor: "rgba(16,185,129,0.8)",
                    },
                    {
                      label: "Outflow",
                      data: numericCols[0].values.map((v) => (v < 0 ? Math.abs(v) : 0)),
                      backgroundColor: "rgba(239,68,68,0.8)",
                    },
                  ],
                }}
                options={{
                  ...baseOptions,
                  scales: { x: { stacked: true }, y: { stacked: true } },
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const downloadPDF = () => {
    const url = selectedFile?.url;
    if (!url) return alert("Missing file URL");
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedFile?.originalName || "file.pdf";
    link.click();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Select a file");
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
      console.error(err);
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
              className={`p-2 rounded cursor-pointer transition ${
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

        <div className="flex-1 p-6 overflow-y-auto">
          {selectedFile ? (
            <div className="max-w-6xl p-6 mx-auto prose bg-white border-l-4 border-blue-600 rounded-lg shadow-md">
              {contentBlocks.map((block, index) => (
                <div key={index}>
                  {block.html && (
                    <div dangerouslySetInnerHTML={{ __html: block.html }} />
                  )}
                  {block.tableData &&
                    renderChartFromTable(block.tableData, index, block.chartType)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Select a PDF to view its summary.</p>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-lg">
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
