import fs from "fs";
import puppeteer from "puppeteer";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { markdownToHTML } from "../utilities/markdownUtil.js";

let pdfGenerating = false;
export async function markdownToPDFBuffer(markdownText) {

    while (pdfGenerating) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
pdfGenerating = true;
  try {
 
    if (!markdownText || typeof markdownText !== "string") {
      throw new Error(`markdownToPDFBuffer received invalid input: ${typeof markdownText}`);
    }

    // Chart configuration ===
    const chartSections = {
      "Revenue Breakdown (Consolidated, in ₹ Cr)": { type: "bar" },
      "Financial Statement Analysis (Consolidated)": { type: "bar" },
      "Financial Statement Analysis (Standalone)": { type: "bar" },
      "Shareholding Pattern": { type: "pie" },
      "Capital Allocation, Dividend & Cash Flow": { type: "bar" },
    };

    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });

    // Parse Markdown Table
    function parseMarkdownTable(markdownTable) {
      if (!markdownTable || !markdownTable.includes("|")) return { headers: [], rows: [] };

      const lines = markdownTable
        .trim()
        .split("\n")
        .filter(l => l.trim() && l.includes("|"));

      if (lines.length < 2) return { headers: [], rows: [] };

      const headers = lines[0]
        .split("|")
        .slice(1, -1)
        .map(h => h.trim())
        .filter(Boolean);

      const rows = lines
        .slice(2)
        .map(line =>
          line
            .split("|")
            .slice(1, -1)
            .map(cell => cell.trim())
            .filter(Boolean)
        )
        .filter(r => r.length);

      return { headers, rows };
    }

    // Generate chart image (returns base64)
    async function generateChartImage(chartType, chartData) {
      const config = {
        type: chartType,
        data: chartData,
        options: {
          responsive: false,
          plugins: {
            legend: { position: "bottom" },
            title: { display: false },
          },
          scales: chartType === "bar" ? { y: { beginAtZero: true } } : undefined,
        },
      };
      const buffer = await chartJSNodeCanvas.renderToBuffer(config);
      return buffer.toString("base64");
    }

    // Logic for each section 
    async function generateSectionCharts(section, headers, rows) {
      if (!headers.length || !rows.length) return [];

      // Revenue Breakdown (Consolidated, in ₹ Cr)
      if (section.includes("Revenue Breakdown")) {
        const years = headers.slice(1).filter(h => /\d{4}/.test(h));
        const datasets = rows.map(r => ({
          label: r[0],
          data: r.slice(1, years.length + 1).map(v => parseFloat(v.replace(/,/g, "")) || 0),
        }));
        const chartData = { labels: years, datasets };
        return [await generateChartImage("bar", chartData)];
      }

      // Financial Statement Analysis (Consolidated / Standalone)
      if (section.includes("Financial Statement Analysis")) {
        const years = headers.filter(h => /\d{4}/.test(h) && !h.includes("%"));
        const charts = [];

        for (const row of rows) {
          const numericValues = row.slice(1, years.length + 1).map(v => {
            const val = parseFloat(v.replace(/,/g, ""));
            return isNaN(val) ? 0 : val;
          });

          const chartData = {
            labels: years,
            datasets: [{ label: row[0], data: numericValues }],
          };
          charts.push(await generateChartImage("bar", chartData));
        }
        return charts;
      }

      //Shareholding Pattern (Pie)
      if (section.includes("Shareholding Pattern")) {
        const labels = rows.map(r => r[0]);
        const data = rows.map(r => parseFloat((r[1] ?? "").replace("%", "").replace(/,/g, "")) || 0);
        const chartData = { labels, datasets: [{ data }] };
        return [await generateChartImage("pie", chartData)];
      }

      // Capital Allocation, Dividend & Cash Flow
      if (section.includes("Capital Allocation")) {
        const years = headers.filter(h => /\d{4}/.test(h));
        const selected = [
          "Cash Flow from Operations (CFO)",
          "Cash Flow from Investing (CFI)",
          "Cash Flow from Financing (CFF)",
        ];
        const filteredRows = rows.filter(r => selected.includes(r[0]));

        const datasets = filteredRows.map(row => ({
          label: row[0],
          data: row.slice(1, years.length + 1).map(v => parseFloat(v.replace(/,/g, "")) || 0),
        }));

        const chartData = { labels: years, datasets };
        return [await generateChartImage("bar", chartData)];
      }

      return [];
    }

    // async replace helper
    async function replaceAsync(str, regex, asyncFn) {
      if (typeof str !== "string") return str; 

      // Collect all match positions and replacement promises
      const matchData = [];
      let match;
      const globalRegex = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");

      while ((match = globalRegex.exec(str)) !== null) {
        matchData.push({
          index: match.index,
          length: match[0].length,
          promise: asyncFn(match[0], ...match.slice(1)),
        });
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) globalRegex.lastIndex++;
      }

      if (matchData.length === 0) return str; // no matches → return original unchanged

      // Resolve all replacements in parallel
      const replacements = await Promise.all(matchData.map(m => m.promise));

      // Rebuild string from right to left to preserve indices
      let result = str;
      for (let i = matchData.length - 1; i >= 0; i--) {
        const { index, length } = matchData[i];
        const replacement = typeof replacements[i] === "string" ? replacements[i] : str.slice(index, index + length);
        result = result.slice(0, index) + replacement + result.slice(index + length);
      }

      return result;
    }

    // injecting charts
    for (const section in chartSections) {
      const sectionRegex = new RegExp(
        `(?:^|\\n)(?:##|###)\\s*${section}[\\s\\S]*?(\\|.*?\\|[\\s\\S]*?)(?=(?:\\n##|\\n###|$))`,
        "gi"
      );

      const result = await replaceAsync(markdownText, sectionRegex, async (match, tableMarkdown) => {
        try {
          const { headers, rows } = parseMarkdownTable(tableMarkdown);
          if (!headers.length || !rows.length) return match;

          const charts = await generateSectionCharts(section, headers, rows);
          if (!charts.length) return match;

          const imgTags = charts
            .map(
              base64 =>
                `<img src="data:image/png;base64,${base64}" alt="${section} Chart" style="margin-top:15px;max-width:100%;border:1px solid #eee;border-radius:8px;"/>`
            )
            .join("\n");

          return `${match}\n\n${imgTags}\n`;
        } catch (chartErr) {
          // If chart generation fails for any section, log and return original match
          console.warn(`Chart generation skipped for "${section}": ${chartErr.message}`);
          return match;
        }
      });

      
      if (typeof result === "string" && result.trim()) {
        markdownText = result;
      } else {
        console.warn(`replaceAsync returned invalid result for section "${section}", keeping original.`);
      }
    }

    // error handling for html
    if (!markdownText || typeof markdownText !== "string") {
      throw new Error("markdownText became invalid after chart injection.");
    }

    
    const htmlContent = markdownToHTML(markdownText);

    if (!htmlContent || typeof htmlContent !== "string") {
      throw new Error(`markdownToHTML returned invalid output: ${typeof htmlContent}`);
    }

    //loading logo
    const logoBase64   = fs.readFileSync("logo.svg",        "base64");
    const logoFooter   = fs.readFileSync("footer-logo.svg", "base64");

    // html template
    const html = `
<html>
  <head>
    <title>Summary Report</title>
    <style>
      body { 
        font-family: 'Segoe UI', Arial, sans-serif; 
        padding: 40px; 
        line-height: 1.6;
        color: #222;
      }
      h1, h2, h3 { color: #333; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
      .header { text-align: left; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 40px; }
      .header img { width: 180px; height: auto; }
      body::before {
        content: "Tickernote";
        position: fixed;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 72px;
        color: rgba(150, 150, 150, 0.08);
        z-index: -1;
        white-space: nowrap;
        pointer-events: none;
      }
      .page-break { page-break-before: always; }
      .last-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #f8f9fb, #f2f4f7);
        color: #333;
        padding: 60px 80px;
        min-height: 100vh;
      }
      .last-page img { width: 140px; margin-bottom: 20px; }
      .last-page h1 { font-size: 26px; margin-bottom: 10px; }
      .last-page p { font-size: 15px; max-width: 600px; color: #555; margin: 8px auto; }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="data:image/svg+xml;base64,${logoBase64}" alt="Logo" />
    </div>
    <div class="content">${htmlContent}</div>
    <div class="last-page" style="page-break-before: always;">
      <img src="data:image/svg+xml;base64,${logoBase64}" alt="Tickernote Logo" />
      <h1>Disclaimer</h1>
      <p>This summary has been automatically generated by <strong>Tickernote</strong> using publicly available company reports...</p>
      <p>This document does not constitute investment advice...</p>
      <p>Users should not make investment or trading decisions...</p>
      <p>© Tickernote — AI-generated educational summary.</p>
    </div>
  </body>
</html>`;

    // generating pdf with puppeter
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // ← critical for Render
    '--disable-gpu',
  ]
});

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "60px", left: "40px", right: "40px" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
      <div style="width:100%;font-size:10px;padding:8px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;">
        <div>Page <span class='pageNumber'></span> of <span class='totalPages'></span></div>
        <div style="flex:2;text-align:center;font-size:12px;color:#555;">AI summary by <strong>Tickernote</strong> — not investment advice.</div>
        <div><img src="data:image/svg+xml;base64,${logoFooter}" alt="Tickernote Logo" style="width:70px;height:auto;"/></div>
      </div>`,
    });

    await browser.close();
    console.log("PDF generated with charts and full layout");
    return pdfBuffer;

  } catch (err) {
    console.error("PDF generation Error:", err.message);
    throw new Error("PDF generation failed");
  } finally {
    pdfGenerating = false; // always release even if error
  }

}