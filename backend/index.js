import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createUserContent, createPartFromUri } from "@google/genai";
import { marked } from "marked";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import markdownIt from "markdown-it"
// const markdownIt = require('markdown-it');
const md = new markdownIt();
dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ---------------- MongoDB ----------------
const mongourl = process.env.MONGO_URI || "mongodb://localhost:27017/mydb";
mongoose
  .connect(mongourl)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));
marked.setOptions({
  gfm: true, // ✅ Enable GitHub Flavored Markdown (supports tables)
  breaks: true,
});
// // ---------------- Mongoose Schema ----------------
const fileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now },
  summaryPDF: Buffer,
  summaryPDFName: String,
});
const File = mongoose.model("File", fileSchema);

// ---------------- Multer Setup ----------------
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    ),
});
const upload = multer({ storage });

// ---------------- Serve uploads ----------------
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ---------------- Google Gemini AI Setup ----------------
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------- Summarize PDF with Gemini ----------------
async function summarizePDFwithGemini(uploadDir, filename) {
  try {
    const myfile = await ai.files.upload({
      file: path.join(uploadDir, filename),
    });
    console.log("✅ File uploaded to Gemini API");

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: createUserContent([
        createPartFromUri(myfile.uri, myfile.mimeType),
        "\n\n",
        `You are an automated financial analyst. You will receive the raw text of an Annual Report of a publicly listed Indian company. Your task is to generate a neutral, factual, structured summary in Markdown.

The summary must follow the structure below, with each section treated as one page (max length ~12 pages). Use only the information from the report. If something is not available, write “Not Disclosed in Report.”

The tone must be neutral, simple, and explanatory — avoid promotional, judgmental, or advisory language.

 Business Snapshot & Model

Briefly describe the company’s core business in 1–2 sentences.

List its main products, services, and customer segments.

Revenue breakdown by business segment and geography (if disclosed).

Core revenue streams (product sales, services, contracts, subscriptions).

Key raw materials, suppliers, distribution channels, major cost drivers.

Any structural changes during the year (mergers, acquisitions, divestments).

 Industry & Macro Overview

Summarize industry environment and demand drivers.

Key challenges (e.g., raw material prices, regulation, competition).

Company’s relative positioning in the industry (only factual disclosures).

 Consolidated Financial Highlights 

Present a  table with columns as years and rows and the no. of years as given in the original report :

Revenue from Operations

EBITDA

Net Profit (Profit After Tax)

Basic EPS

EBITDA Margin %

Net Profit Margin %

ROE %

ROCE %

Debt-to-Equity Ratio

Trends Summary:
3–4 neutral sentences explaining main revenue/margin/debt drivers.

 Standalone Financial Highlights 

Use the same table format as Page 3, but for standalone results.

Trends Summary:
3–4 neutral sentences comparing standalone performance to consolidated.

Page 5 – Segment & Geography Performance

Create tables with:

Segment-wise: Revenue, EBIT/EBITDA, Margins %, % of total revenue.

Geography-wise: Revenue by region, % of total revenue.

 Shareholding Pattern

Promoter holding %

Institutional holding % (mutual funds, FIIs)

Retail & public holding %

Any major changes during the year.

 Capital Allocation, Dividend & Cash Flow

Capex during the year and planned capex (₹, if disclosed).

Dividend per share and payout ratio (last 3–5 years table if disclosed).

Equity actions (buybacks, issuances, allotments).

Debt levels (gross debt, net debt, debt/equity movement).

Cash flow summary: CFO, CFI, CFF (latest year).

Simple check: whether CFO > Net Profit or CFO < Net Profit.

Key Takeaways (bullets):

How cash was generated and deployed.

Any notable change in debt or equity.

 Governance & Management Snapshot

Total number of directors and number of independent directors.

Key leadership: Chairman, CEO/MD, CFO.

Key appointments or resignations.

Promoter shareholding and changes (if already not captured earlier).

Primary board committees (Audit, NRC, Risk, CSR).

 Auditor’s Report

Name of auditing firm.

Audit opinion (Unqualified, Qualified, Adverse, Disclaimer).

If Qualified/Modified, give factual reason.

Any Emphasis of Matter paragraphs (summarize factually).

 Risks & Other Material Disclosures

Risk Factors (categorized):

Business risks

Financial risks

Regulatory/legal risks

Other Disclosures:

Contingent liabilities (₹ value, nature).

Subsidiary/JV performance (if disclosed).

Regulatory filings or SEBI/BSE actions.

Share pledging (if any).

 ESG & CSR Highlights

CSR spend (₹ and % of average profits).

Focus areas (education, health, environment, etc.).

Environmental initiatives (renewable use, emissions reduction, etc.).

Governance/ethics disclosures (if mentioned).

Business Recap (5 points):

What does the company do?

Where does most of its revenue come from (by segment or geography)?

Where is the company spending or investing its money?

What are the key risks mentioned in the report?

What are the company’s stated plans for the future?`,
      ]),
    });
    console.log("✅ Summary generated by Gemini",result.text);
    return result.text;
  } catch (err) {
    console.error("❌ Gemini API Error:", err.message);
    throw new Error("Gemini summary generation failed");
  }
}

// ---------------- Convert Markdown to PDF ----------------
async function markdownToPDFBuffer(markdownText) {
  try {
    const logoBase64 = fs.readFileSync("logo.svg", "base64");
    const logoFooter= fs.readFileSync("footer-logo.svg", "base64");
       const html= `
<html>
  <head>
    <title>Markdown Table</title>
    <style>
      body { 
        font-family: sans-serif; 
        padding: 20px; 
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

      /* Header container as logo header */
      .header {
        text-align: left;
        border-bottom: 2px solid #ddd; /* subtle line like official header */
        padding-bottom: 10px;
        margin-bottom: 40px;  /* space before content */
      }

      .header img {
        width: 180px;   /* logo size */
        height: auto;
      }

      /* ✅ Watermark */
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
      ${marked.parse(markdownText)}
    </div>
  </body>
</html>


      `;
      
      const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html,  { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "40px", bottom: "80px", left: "40px", right: "40px" },
        displayHeaderFooter: true,
        headerTemplate: `<div></div>`,
        footerTemplate: `
          <div style="width:100%; font-size:15px; padding:0 20px;
                  display:flex; justify-content:space-between; align-items:center;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        <img src="data:image/svg+xml;base64,${logoFooter}" 
             alt="Logo" style="width:80px; height:auto;" />
      </div>
  `,
    });
    await browser.close();
    console.log("✅ PDF generated from Markdown");
    return pdfBuffer;
  } catch (err) {
    console.error("❌ PDF generation Error:", err.message);
    throw new Error("PDF generation failed");
  }
}

// ---------------- Routes ----------------
app.post("/uploads", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "❌ No file uploaded" });
    console.log("✅ File received:", req.file.originalname);
    // Step 1: Generate summary
    const summary = await summarizePDFwithGemini(uploadDir, req.file.filename);

    // Step 2: Convert summary (Markdown) to PDF
    const pdfBuffer = await markdownToPDFBuffer(summary);
    const summaryFilename = `summary-${req.file.filename}.pdf`;
    fs.writeFileSync(path.join(uploadDir, summaryFilename), pdfBuffer);
    console.log("✅ Summary PDF saved locally:", summaryFilename);

    // Step 3: Save PDF to MongoDB
    const newFile = new File({
      filename: req.file.filename,
      originalname: req.file.originalname,
      summaryPDF: Buffer.from(pdfBuffer),
      summaryPDFName: summaryFilename,
    });
    await newFile.save();
    console.log("✅ File saved to MongoDB");

    res.json({
      message: "✅ File uploaded and summary PDF saved successfully",
      file: newFile,
      summaryFile: `/uploads/${summaryFilename}`,
    });
  } catch (err) {
    console.error("❌ Error processing file:", err.message);
    res
      .status(500)
      .json({ message: "❌ Error processing file", error: err.message });
  }
});

app.get("/files", async (req, res) => {
  try {
    const files = await File.find();
    res.json(files);
  } catch (err) {
    console.error("❌ Error fetching files:", err.message);
    res
      .status(500)
      .json({ message: "❌ Error fetching files", error: err.message });
  }
});

// --------- View or Download PDF ---------
app.get("/view-pdf/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || !file.summaryPDF)
      return res.status(404).json({ message: "❌ PDF not found" });

    if (req.query.download === "true") {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file.summaryPDFName}"`,
      });
    } else {
      res.set({ "Content-Type": "application/pdf" });
    }
    res.send(file.summaryPDF);
  } catch (err) {
    console.error("❌ Error serving PDF:", err.message);
    res.status(500).json({ message: "❌ Error serving PDF" });
  }
});

app.get("/", (req, res) => res.send("Backend running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
