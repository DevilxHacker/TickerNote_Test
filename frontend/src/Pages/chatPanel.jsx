// src/components/ChatPanel.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api";

/* ── Markdown-lite renderer (no extra deps) ── */
function MiniMarkdown({ text }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (/^\*\*(.+)\*\*$/.test(line)) {
          return <p key={i} className="font-semibold">{line.replace(/\*\*/g, "")}</p>;
        }
        if (/^[-•]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 mt-0.5 flex-shrink-0">▸</span>
              <span>{line.replace(/^[-•]\s/, "")}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return <p key={i} className="ml-3">{line}</p>;
        }
        // inline bold
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={i}>
            {parts.map((p, j) =>
              j % 2 === 1 ? <strong key={j}>{p}</strong> : p
            )}
          </p>
        );
      })}
    </div>
  );
}

/* ── Source badge ── */
function SourceBadge({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {sources.slice(0, 3).map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-950/60 border border-blue-800/50 rounded-full text-[10px] text-blue-300"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {s.section?.slice(0, 28) || "Source"}
          {s.pages?.length > 0 && <span className="text-blue-500">· p.{s.pages[0]}</span>}
        </span>
      ))}
    </div>
  );
}

/* ── Typing dots ── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

/* ── Suggested questions ── */
const SUGGESTIONS = [
  "What are the key financial highlights?",
  "What is the revenue breakdown by segment?",
  "Who are the major shareholders?",
  "What are the main risks mentioned?",
  "What is the company's growth strategy?",
];

/* ════════════════════════════════════════════════════════════════
   ChatPanel
   Props:
     fileId      — MongoDB file._id (string)
     fileName    — display name
     isOpen      — boolean
     onClose     — () => void
   ════════════════════════════════════════════════════════════════ */
export default function ChatPanel({ fileId, fileName, isOpen, onClose }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError]         = useState("");
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  /* Load history when panel opens / file changes */
  useEffect(() => {
    if (!isOpen || !fileId) return;
    setHistoryLoaded(false);
    setMessages([]);
    setError("");

    api.get(`/chat/${fileId}`)
      .then((res) => {
        setMessages(res.data.messages || []);
        setHistoryLoaded(true);
      })
      .catch(() => {
        setHistoryLoaded(true); // still show panel even on error
      });
  }, [fileId, isOpen]);

  /* Scroll to bottom on new message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* Focus input on open */
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput("");
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const res = await api.post(`/chat/${fileId}`, { message: trimmed });
      setMessages((prev) => [
        ...prev,
        {
          role:    "assistant",
          content: res.data.message,
          sources: res.data.sources,
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}`, sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, fileId]);

  const clearHistory = async () => {
    try {
      await api.delete(`/chat/${fileId}`);
      setMessages([]);
    } catch {
      setError("Failed to clear history");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      {/* Panel */}
      <div
        className="pointer-events-auto flex flex-col w-full max-w-md h-[calc(100vh-2rem)] max-h-[720px]
          bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60
          animate-in slide-in-from-bottom-4 duration-300"
        style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 border rounded-lg bg-blue-600/20 border-blue-600/40">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.442 2.798H4.24c-1.47 0-2.441-1.798-1.442-2.798L4.2 15.3" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-gray-100">ASK THIS REPORT</p>
              <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{fileName || "Document"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-1.5 text-gray-600 hover:text-gray-400 hover:bg-gray-800 rounded-lg transition-colors"
                title="Clear chat"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-800">
          {!historyLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            /* Empty state with suggestions */
            <div className="flex flex-col items-center justify-center h-full gap-5 px-2">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 border rounded-xl bg-blue-600/10 border-blue-600/20">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="mb-1 text-xs font-semibold text-gray-300">Ask anything about this report</p>
                <p className="text-[11px] text-gray-600">Answers grounded in the document</p>
              </div>

              <div className="w-full space-y-1.5">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-3 py-2 text-[11px] text-gray-400 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    {/* Avatar row */}
                    <div className={`flex items-center gap-1.5 mb-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0
                        ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                        {msg.role === "user" ? "U" : "AI"}
                      </div>
                      <span className="text-[10px] text-gray-600">
                        {msg.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div className={`px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed
                      ${msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm"
                      }`}>
                      {msg.role === "assistant"
                        ? <MiniMarkdown text={msg.content} />
                        : <p>{msg.content}</p>
                      }
                    </div>

                    {/* Sources */}
                    {msg.role === "assistant" && <SourceBadge sources={msg.sources} />}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-900 border border-gray-800 rounded-tl-sm rounded-xl">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 p-3 border-t border-gray-800">
          {error && (
            <p className="text-[10px] text-red-400 mb-2 px-1">{error}</p>
          )}
          <div className="flex items-end gap-2 px-3 py-2 transition-colors bg-gray-900 border border-gray-700 focus-within:border-blue-600/60 rounded-xl">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this report…"
              disabled={loading}
              className="flex-1 bg-transparent text-[12px] text-gray-200 placeholder-gray-600 resize-none focus:outline-none min-h-[20px] max-h-[100px] leading-5"
              style={{ fontFamily: "inherit" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center flex-shrink-0 transition-all bg-blue-600 rounded-lg w-7 h-7 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-3 h-3 border border-white rounded-full border-t-transparent animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[9px] text-gray-700 mt-1.5 text-center tracking-wide">ENTER TO SEND · SHIFT+ENTER FOR NEWLINE</p>
        </div>
      </div>
    </div>
  );
}