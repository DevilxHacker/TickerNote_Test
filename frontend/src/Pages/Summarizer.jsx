// src/components/SummarizerLayout.jsx
import { useState, useEffect } from "react";
import api from "../utils/api";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import ChatPanel from "./ChatPanel.jsx";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

/* ── Color palette & helpers (unchanged) ── */
const colorPalette = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#84CC16","#06B6D4","#F43F5E"];
const generateColors = (count) => Array.from({ length: count }, (_, i) => colorPalette[i % colorPalette.length]);

const cleanValue = (val) => {
  if (!val && val !== 0) return 0;
  const s = String(val).trim();
  if (s === "") return 0;
  const lower = s.toLowerCase();
  if (["not","na","-","disclosed","comparable"].some((w) => lower.includes(w))) return 0;
  if (s.includes("%")) return NaN;
  const isNegative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),]/g, "").replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
};

const baseChartOptions = {
  maintainAspectRatio: false, responsive: true,
  animation: { duration: 1200, easing: "easeOutQuart" },
  plugins: { tooltip: { backgroundColor: "rgba(0,0,0,0.85)", titleFont: { size: 13 }, bodyFont: { size: 12 }, padding: 10, cornerRadius: 6 } },
};

export default function SummarizerLayout() {
  const [files, setFiles]             = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showUpload, setShowUpload]   = useState(false);
  const [file, setFile]               = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [contentBlocks, setContentBlocks]   = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver]       = useState(false);
  const [error, setError]             = useState("");

  // ── NEW: chat state ──
  const [chatOpen, setChatOpen]       = useState(false);

  /* ── Fetch files ── */
  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await api.get("/file/files");
      if (!Array.isArray(res.data)) return;
      const sanitized = res.data.map((f) => ({
        id: f.id || f._id || Math.random().toString(),
        originalName: f.originalName || f.originalname || "file.pdf",
        url: f.url || f.s3Url || "",
        result: f.result || "No summary available.",
        size: f.size || 0,
        uploadedAt: f.uploadedAt || null,
      }));
      setFiles(sanitized);
      if (!selectedFile && sanitized.length > 0) setSelectedFile(sanitized[0]);
    } catch (err) {
      setError("Failed to fetch files. Please try again.");
    } finally {
      setLoadingFiles(false);
    }
  };
  useEffect(() => { fetchFiles(); }, []);

  /* Close chat when switching files */
  const handleSelectFile = (f) => {
    if (selectedFile?.id !== f.id) setChatOpen(false);
    setSelectedFile(f);
  };

  /* ── Parse markdown into content blocks (unchanged) ── */
  useEffect(() => {
    if (!selectedFile?.result) { setContentBlocks([]); return; }
    const rawHTML = DOMPurify.sanitize(marked.parse(selectedFile.result));
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawHTML;
    const blocks = [];
    let currentHTML = "";
    const detectChartType = (text = "") => {
      const lower = text.toLowerCase();
      if (lower.includes("shareholding pattern")) return ["pie-shareholding"];
      if (lower.includes("financial statement analysis")) return ["bar-financial"];
      if (lower.includes("revenue breakdown")) return ["bar-revenue"];
      return [];
    };
    tempDiv.childNodes.forEach((node) => {
      if (node.tagName === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr"));
        const headers = rows[0] && Array.from(rows[0].querySelectorAll("th")).length > 0
          ? Array.from(rows[0].querySelectorAll("th")).map((th) => th.textContent.trim())
          : Array.from(rows[0].querySelectorAll("td")).map((td) => td.textContent.trim());
        const dataRows = rows.slice(1).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.textContent.trim())).filter((r) => r.length > 0);
        const chartTypes = detectChartType(currentHTML);
        blocks.push({ html: currentHTML, tableHTML: node.outerHTML, tableData: { headers, rows: dataRows }, chartType: chartTypes });
        currentHTML = "";
      } else {
        currentHTML += node.outerHTML || node.textContent || "";
      }
    });
    if (currentHTML.trim()) blocks.push({ html: currentHTML, tableHTML: null, tableData: null, chartType: [] });
    setContentBlocks(blocks);
  }, [selectedFile]);

  /* ── Upload ── */
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Select a PDF first!");
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      setUploadProgress("Uploading PDF...");
      await api.post("/file/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (pe) => {
          const pct = Math.round((pe.loaded * 100) / pe.total);
          setUploadProgress(`Uploading... ${pct}%`);
        },
      });
      setUploadProgress("Processing complete!");
      setTimeout(() => { setFile(null); setShowUpload(false); setUploadProgress(""); fetchFiles(); }, 1200);
    } catch (err) {
      setUploadProgress("");
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") setFile(dropped);
    else alert("Only PDF files are accepted.");
  };

  const downloadPDF = () => {
    const url = selectedFile?.url;
    if (!url) return alert("No file URL");
    const link = document.createElement("a");
    link.href = url; link.download = selectedFile?.originalName || "summary.pdf"; link.click();
  };

  const filteredFiles = files.filter((f) => f.originalName.toLowerCase().includes(searchQuery.toLowerCase()));

  /* ── Chart renderers (unchanged) ── */
  const extractPieData = (tableData) => {
    if (!tableData) return null;
    const parsePercentage = (val) => { if (!val) return 0; const match = String(val).match(/(\d+(\.\d+)?)/); return match ? parseFloat(match[1]) : 0; };
    let percentCol = -1;
    for (let i = 1; i < tableData.headers.length; i++) { if (tableData.rows.some((r) => String(r[i] || "").includes("%"))) { percentCol = i; break; } }
    const rows = tableData.rows.map((r) => ({ label: r[0]?.trim() || "Unknown", value: parsePercentage(percentCol !== -1 ? r[percentCol] : r[1]) })).filter((r) => r.value > 0);
    if (rows.length === 0) return null;
    const total = rows.reduce((s, x) => s + x.value, 0);
    return rows.map((r) => ({ ...r, value: total > 0 ? (r.value / total) * 100 : 0 }));
  };

  const renderTableElement = (tableData) => {
    if (!tableData) return null;
    return (
      <div className="my-4 overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead><tr className="bg-gradient-to-r from-blue-600 to-blue-700">{tableData.headers.map((h, i) => <th key={i} className="px-4 py-2.5 text-xs font-semibold text-left text-white whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{tableData.rows.map((row, rIdx) => (<tr key={rIdx} className={`transition-colors ${rIdx % 2 === 0 ? "bg-white" : "bg-blue-50/40"} hover:bg-blue-50`}>{row.map((cell, cIdx) => <td key={cIdx} className={`px-4 py-2 text-xs border-t border-gray-100 ${cIdx === 0 ? "font-medium text-gray-800" : "text-gray-600"}`}>{cell}</td>)}</tr>))}</tbody>
        </table>
      </div>
    );
  };

  const renderChartFromTable = (tableData, index, chartTypes) => {
    if (!tableData) return null;
    const type = chartTypes?.[0] || null;
    if (type === "pie-shareholding") {
      const pieData = extractPieData(tableData);
      if (!pieData) return null;
      return (<div key={`chart-${index}`} className="flex flex-col items-center my-6"><div className="w-full max-w-[600px] h-[420px] p-6 bg-white rounded-2xl shadow-md border border-gray-100 flex justify-center items-center"><Pie data={{ labels: pieData.map((r) => r.label), datasets: [{ data: pieData.map((r) => parseFloat(r.value.toFixed(2))), backgroundColor: generateColors(pieData.length), borderColor: "#fff", borderWidth: 2, hoverOffset: 14 }] }} options={{ ...baseChartOptions, plugins: { ...baseChartOptions.plugins, legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 13 }, padding: 12 } } } }} /></div></div>);
    }
    if (type === "bar-revenue") {
      const yearIndex = tableData.headers.findIndex((h) => /year/i.test(h));
      const segmentIndex = tableData.headers.findIndex((h) => /segment/i.test(h));
      const revenueIndex = tableData.headers.findIndex((h) => /revenue/i.test(h) && !/%/i.test(h));
      if (yearIndex === -1 || segmentIndex === -1 || revenueIndex === -1) return null;
      let lastYear = "";
      const validRows = tableData.rows.map((r) => { const year = r[yearIndex]?.trim() || lastYear; if (r[yearIndex]?.trim()) lastYear = r[yearIndex].trim(); return { year, segment: r[segmentIndex]?.trim(), revenue: cleanValue(r[revenueIndex]) }; }).filter((r) => r.year && r.segment && !/%/i.test(r.segment) && r.revenue > 0);
      const segments = [...new Set(validRows.map((r) => r.segment))];
      const years = [...new Set(validRows.map((r) => r.year))];
      const datasets = years.map((year, i) => ({ label: year, data: segments.map((segment) => { const m = validRows.find((r) => r.year === year && r.segment === segment); return m ? m.revenue : 0; }), backgroundColor: colorPalette[i % colorPalette.length], borderRadius: 6 }));
      return (<div key={`revenue-${index}`} className="p-5 mx-auto my-4 bg-white border border-gray-100 shadow-md rounded-2xl" style={{ maxWidth: 900 }}><p className="mb-3 font-semibold text-center text-gray-700">Revenue Breakdown — Segment-wise Year Comparison (₹ Cr)</p><div className="w-full h-[360px]"><Bar data={{ labels: segments, datasets }} options={{ ...baseChartOptions, plugins: { ...baseChartOptions.plugins, legend: { position: "bottom", labels: { font: { size: 12 }, boxWidth: 14 } } }, scales: { x: { ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { font: { size: 11 } } } } }} /></div></div>);
    }
    if (type === "bar-financial") {
      const years = tableData.headers.filter((h) => /\d{4}/.test(h));
      if (years.length <= 1) return null;
      const rowsToChart = tableData.rows.filter((row) => !row.some((cell) => String(cell).includes("%")));
      const charts = rowsToChart.map((row, rIdx) => { const values = years.map((h) => cleanValue(row[tableData.headers.indexOf(h)])); if (!values.some((v) => v !== 0)) return null; return (<div key={rIdx} className="flex flex-col items-center p-4 bg-white border border-gray-100 shadow rounded-xl" style={{ maxWidth: 420, margin: "auto" }}><p className="mb-2 text-sm font-semibold text-center text-gray-700">{row[0]}</p><div className="w-full h-[200px]"><Bar data={{ labels: years, datasets: [{ data: values, backgroundColor: generateColors(values.length), borderRadius: 5 }] }} options={{ ...baseChartOptions, plugins: { ...baseChartOptions.plugins, legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } } } } }} /></div></div>); }).filter(Boolean);
      return <div key={`financial-${index}`} className="grid grid-cols-1 gap-4 my-4 md:grid-cols-2">{charts}</div>;
    }
    return null;
  };

  /* ══════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen overflow-hidden font-sans bg-gray-50">

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? "w-72" : "w-0 overflow-hidden"} transition-all duration-300 flex flex-col bg-white border-r border-gray-200 shadow-sm flex-shrink-0`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-blue-600 rounded-lg w-7 h-7">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Reports</span>
          </div>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Upload
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search reports..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2 pr-3 text-xs border border-gray-200 rounded-lg pl-9 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>

        <div className="flex-1 px-3 pb-4 overflow-y-auto">
          {loadingFiles ? (
            <div className="flex flex-col gap-2 mt-2">{[1,2,3].map(i => <div key={i} className="bg-gray-100 h-14 rounded-xl animate-pulse" />)}</div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-xs">No reports found</p>
            </div>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {filteredFiles.map((f) => (
                <li key={f.id} onClick={() => handleSelectFile(f)} className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedFile?.id === f.id ? "bg-blue-50 border border-blue-200 shadow-sm" : "hover:bg-gray-50 border border-transparent"}`}>
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedFile?.id === f.id ? "bg-blue-100" : "bg-gray-100 group-hover:bg-gray-200"}`}>
                    <svg className={`w-4 h-4 ${selectedFile?.id === f.id ? "text-blue-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${selectedFile?.id === f.id ? "text-blue-700" : "text-gray-700"}`}>{f.originalName}</p>
                    {f.uploadedAt && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(f.uploadedAt).toLocaleDateString()}</p>}
                    {f.size > 0 && <p className="text-[10px] text-gray-400">{f.size} KB</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="max-w-md text-sm font-bold text-gray-800 truncate">{selectedFile?.originalName || "Select a report"}</h1>
              {selectedFile && <p className="text-[11px] text-gray-400">AI-generated equity research summary</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchFiles} className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100" title="Refresh">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            {/* ── NEW: Chat button ── */}
            {selectedFile && (
              <button
                onClick={() => setChatOpen((o) => !o)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm
                  ${chatOpen
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                {chatOpen ? "Close Chat" : "Ask AI"}
              </button>
            )}

            <button
              onClick={downloadPDF}
              disabled={!selectedFile?.url}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${selectedFile?.url ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download PDF
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-red-600">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex items-center justify-center w-20 h-20 mb-4 rounded-2xl bg-blue-50">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-gray-700">No Report Selected</h2>
              <p className="max-w-xs mb-6 text-sm text-gray-400">Upload an annual report PDF to get an AI-generated equity research summary.</p>
              <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Upload First Report
              </button>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              <div className="p-8 bg-white border border-gray-100 shadow-sm rounded-2xl">
                {contentBlocks.map((block, idx) => (
                  <div key={idx} className="mb-8">
                    {block.html && (
                      idx === 0 ? (
                        (() => {
                          const firstLine = block.html.split(/<br\s*\/?>|\n/)[0];
                          const rest = block.html.replace(firstLine, "");
                          return (
                            <div className="mb-8">
                              <div className="pb-4 mb-4 text-2xl font-bold text-gray-900 border-b-2 border-blue-600" dangerouslySetInnerHTML={{ __html: firstLine }} />
                              {rest.trim() && <div className="leading-relaxed prose-sm prose text-gray-700 max-w-none" dangerouslySetInnerHTML={{ __html: rest }} />}
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          className="prose prose-sm max-w-none text-gray-700 leading-relaxed prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200 prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-strong:text-gray-800 prose-li:my-0.5 prose-p:my-2"
                          dangerouslySetInnerHTML={{ __html: block.html }}
                        />
                      )
                    )}
                    {block.tableData && renderTableElement(block.tableData)}
                    {block.tableData && renderChartFromTable(block.tableData, idx, block.chartType)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Upload Modal (unchanged) ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Upload Annual Report</h3>
                <p className="text-xs text-gray-400 mt-0.5">PDF format only · Max 50MB</p>
              </div>
              <button onClick={() => { setShowUpload(false); setFile(null); setUploadProgress(""); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 p-6">
              <div onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => document.getElementById("fileInput").click()} className={`relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${dragOver ? "border-blue-500 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/50"}`}>
                <input id="fileInput" type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                {file ? (
                  <><div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div className="text-center"><p className="text-sm font-semibold text-green-700">{file.name}</p><p className="text-xs text-green-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-400 underline hover:text-red-600">Remove</button></>
                ) : (
                  <><div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50"><svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div><div className="text-center"><p className="text-sm font-semibold text-gray-700">Drop PDF here or click to browse</p><p className="mt-1 text-xs text-gray-400">Annual Reports, DRHP, Concall transcripts</p></div></>
                )}
              </div>
              {uploadProgress && (<div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl"><div className="flex-shrink-0 w-4 h-4 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" /><p className="text-sm font-medium text-blue-700">{uploadProgress}</p></div>)}
              <div className="flex items-start gap-3 px-4 py-3 border bg-amber-50 rounded-xl border-amber-100">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-amber-700">Processing may take 1–3 minutes. The AI will extract all financial data, charts, and key metrics. The chat will be ready shortly after upload.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowUpload(false); setFile(null); setUploadProgress(""); }} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={uploading || !file} className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">{uploading ? "Processing..." : "Analyze Report"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NEW: Chat Panel ── */}
      <ChatPanel
        fileId={selectedFile?.id}
        fileName={selectedFile?.originalName}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
