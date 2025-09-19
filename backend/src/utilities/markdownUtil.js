import { marked } from "marked";
import markdownIt from "markdown-it";

// configure both markdown-it and marked
const md = new markdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// Configure marked
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Line breaks as in GitHub
});

/**
 * Convert Markdown to HTML using marked
 */
export function markdownToHTML(markdownText) {
  try {
    return marked.parse(markdownText);
  } catch (err) {
    console.error("❌ Markdown parsing error:", err.message);
    return "<p>Error parsing markdown</p>";
  }
}

/**
 * Alternative conversion with markdown-it (for flexibility)
 */
export function markdownToHTMLAlt(markdownText) {
  try {
    return md.render(markdownText);
  } catch (err) {
    console.error("❌ Markdown-it parsing error:", err.message);
    return "<p>Error parsing markdown</p>";
  }
}
