import { marked } from "marked";
import markdownIt from "markdown-it";


const md = new markdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// Configure marked
marked.setOptions({
  gfm: true, 
  breaks: true, 
});


export function markdownToHTML(markdownText) {
  try {
    return marked.parse(markdownText);
  } catch (err) {
    console.error("Markdown parsing error:", err.message);
    return "<p>Error parsing markdown</p>";
  }
}


export function markdownToHTMLAlt(markdownText) {
  try {
    return md.render(markdownText);
  } catch (err) {
    console.error("Markdown-it parsing error:", err.message);
    return "<p>Error parsing markdown</p>";
  }
}

