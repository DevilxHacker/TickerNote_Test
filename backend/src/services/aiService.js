import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { Blob } from 'buffer';
import {GEMINI_API_KEY} from "../config/serverConfig.js"
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function summarizePDFwithGemini( buffer, mimeType) {
  try {
    
      const fileBlob = new Blob([buffer], { type: mimeType });
        console.log(`Uploading file of size ${buffer.length} bytes...`)
    const myfile = await ai.files.upload({
   file: fileBlob,
    config: {
      mimeType: mimeType,
    },
  config: { mimeType: "application/pdf",
      temperature: 0.1,
      maxOutputTokens: 20000,
   }, // required
  });
    console.log("✅ File uploaded to Gemini API");

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
    
      contents: createUserContent([
        createPartFromUri(myfile.uri, myfile.mimeType),
        "\n\n",
        `You are an automated experienced equity research analyst. You will receive the pdf of an Annual Report of a publicly listed Indian company. Your task is to generate a neutral, factual, structured summary in Markdown and your main focus should be to give the investors clarity and deep understanding about the company and its business for making rational investment decisions.

The summary must strictly follow the structure below, with each section treated as one page (max length ~ 15 pages). Use only the information from the report. If something is not available, write “Not Disclosed in Report.” Keep the report in structured format no unstructured format in the results would be accepted.
The tone must be neutral, simple, and explanatory — avoid promotional, judgmental, or advisory language.

Business Snapshot & Model

Briefly describe the company’s core business in 5-10 sentences.

List its main products, services, and customer segments (Show it clearly in structured table format).

Give in detail the value chain of the product from making till distribution (if given in the original report)

Revenue breakdown by business segment and geography

Core revenue streams (product sales, services, contracts, subscriptions).

Key raw materials, suppliers, distribution channels, major cost drivers.

Any structural changes during the year (mergers, acquisitions, divestments).

Chairman/Managing Director’s Letter:

Summarize the overall tone (e.g., Optimistic, Cautious, Confident). Also include the words said by the chairman or MD (Give the spoken words in quotes).

List the key achievements highlighted for the past year.

Extract direct quotes or summaries of the company's stated strategic priorities for the upcoming year.

Identify the primary challenges or headwinds mentioned by the management.

Industry & Macro Overview

Summarize industry environment and demand drivers.

Key challenges (e.g., raw material prices, regulation, competition).

Company’s relative positioning in the industry (only factual disclosures).

Financial Statement Analysis (Consolidated)

Under this if the company does not have any subsidiaries mention that the company has no subsidiaries and the financials show only of the company.

Present a table with columns as years and rows and the no. of years as given in the original report (strictly show the years which is given in the original report)

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

3-4 neutral sentences explaining main revenue/margin/debt drivers.

Financial Statement Analysis (Standalone)

Under this if the company does not have any subsidiaries mention that the company has no subsidiaries and the financials show only of the company.

Use the same table format as Page 3, but for standalone results (strictly show the years which is given in the original report).

Trends Summary:

3–4 neutral sentences comparing standalone performance to consolidated.

Segment & Geography Performance

Create tables with Charts for each:

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

Cash flow summary: CFO, CFI, CFF (as shown in original attached report).

Simple check: whether CFO > Net Profit or CFO < Net Profit.

Key Takeaways (bullets):

How cash was generated and deployed.

Any notable change in debt or equity.

Management Discussion & Analysis Snapshot

Operational Performance Review: Summarize management's commentary on what drove operational performance beyond the financials (e.g., volume growth, price increases, new product launches, efficiency programs).

Key Performance Indicators (KPIs): List any non-financial KPIs discussed (e.g., plant capacity utilization, customer acquisition numbers, store expansions, user engagement metrics).

Demand & Outlook Commentary: What does management say about the demand environment, order book, and their outlook for the industry and the company's position within it?

Strategic Initiatives: Detail any new projects, R&D efforts, or market expansion plans discussed.

Governance & Management Snapshot

Total number of directors and number of independent directors.

Key leadership: Chairman, CEO/MD, CFO. (Show them in table format with their Full name, Position, Education, Experience in years as shown in report if given in the original report) if their education, experience is not given in the original report take the reference from google to find out and then give the education and experience.

Key appointments or resignations.

Primary board committees (Audit, NRC, Risk, CSR).

Auditor’s Report

Name of auditing firm.

Audit opinion (Unqualified, Qualified, Adverse, Disclaimer).

If Qualified/Modified, give factual reason in detail.

Any Emphasis of Matter paragraphs (summarize factually).

Risks & Other Material Disclosures

Risk Factors (categorized with detail and with clarity to help in decision making):

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

Do not repeat explanations. 
- Each section should be explained only once. 
- Maintain the order of sections exactly as given.

temperature = 0.1`
      ]),
      
    });
    console.log("✅ Summary generated by Gemini",result.text);
    return result.text;
  } catch (err) {
    console.error("❌ Gemini API Error:", err.message);
    throw new Error("Gemini summary generation failed");
  }
}
