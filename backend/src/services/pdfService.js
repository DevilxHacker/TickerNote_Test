import fs from "fs";
import puppeteer from "puppeteer";
import { markdownToHTML } from "../utilities/markdownUtil.js";

/**
 * Convert Markdown text into PDF buffer with header, footer, and watermark
 */
export async function markdownToPDFBuffer(markdownText) {
  try {
    // Load logos
    const logoBase64 = fs.readFileSync("logo.svg", "base64");
    const logoFooter = fs.readFileSync("footer-logo.svg", "base64");

    // Convert Markdown → HTML
    const htmlContent = markdownToHTML(markdownText);

    // Full HTML template
    const html = `
<html>
  <head>
    <title>Summary Report</title>
    <style>
      body { 
        font-family: sans-serif; 
        padding: 20px; 
        line-height: 1.6;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 20px; 
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 8px; 
        text-align: left; 
      }
      th { 
        background-color: #f2f2f2; 
      }
      h1, h2, h3 { 
        color: #333;
      }

      /* Header container */
      .header {
        text-align: left;
        border-bottom: 2px solid #ddd;
        padding-bottom: 10px;
        margin-bottom: 40px;
      }

      .header img {
        width: 180px;
        height: auto;
      }

      /* Watermark */
      body::before {
        content: "Tickernote";
        position: fixed;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 72px;
        color: rgba(150, 150, 150, 0.10);
        z-index: -1;
        white-space: nowrap;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="data:image/svg+xml;base64,${logoBase64}" alt="Logo" />
    </div>

    <div class="content">
      ${htmlContent}
    </div>
  </body>
</html>`;

    // Puppeteer → PDF
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "80px", left: "40px", right: "40px" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%; font-size:10px; padding:0 20px;
                    display:flex; justify-content:space-between; align-items:center;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <img src="data:image/svg+xml;base64,${logoFooter}" 
               alt="Logo" style="width:80px; height:auto;" />
        </div>`,
    });

    await browser.close();
    console.log("✅ PDF generated from Markdown");
    return pdfBuffer;
  } catch (err) {
    console.error("❌ PDF generation Error:", err.message);
    throw new Error("PDF generation failed");
  }
}
