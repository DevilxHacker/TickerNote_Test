// frontend/src/utils/markdownParser.js
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
});

export function markdownToHTML(markdownText) {
  try {
    return marked.parse(markdownText);
  } catch (err) {
    console.error("❌ Markdown parsing error:", err.message);
    return "<p>Error parsing markdown</p>";
  }
}
