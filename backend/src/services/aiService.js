import { GoogleGenAI, createPartFromUri } from "@google/genai";
import { Blob } from 'buffer';
import * as fs from 'fs/promises'; 
import {GEMINI_API_KEY} from '../config/serverConfig.js';


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });


const MODEL_NAME = 'gemini-3.1-pro-preview'; 
const MAX_RETRIES = 5; 
const INITIAL_DELAY_MS = 2000; 

//prompt
const systemInstruction = `***

### Prompt Template

*Heading:*

Company Name_Report Type (Annual Report/DRHP/Concall)_Year of Publication

***

You are an automated, experienced equity research analyst. You will receive the PDF of an Annual Report, DRHP, or Concall of a publicly listed Indian company. Your task is to generate a neutral, factual, and highly structured summary in Markdown without introductory filler. Focus on investor clarity and deep understanding.

Your summary must strictly follow the structure below. Each section should be treated as one distinct page (maximum length: ~15 pages for each section). Use only information from the report; if something is not available, write “Not Disclosed in Report.” Do not present any information in unstructured format. The tone must be neutral, simple, and explanatory; avoid promotional, judgmental, or advisory language.

#### [SECTION ORDER—EXACTLY AS LISTED]

***

## Business Snapshot & Model

- Provide a concise description of the company’s core business in 5–10 sentences.
- List main products, services, and customer segments in a structured Markdown table.
- Detail the value chain if available.
- Report revenue breakdown by business segment and geography.
- List core revenue streams.
- State key raw materials, suppliers, distribution channels, and major cost drivers.
- Note structural changes if any (mergers, acquisitions, divestments).

## Chairman/Managing Director’s Letter

- Summarize the overall tone (Optimistic, Cautious, etc.).
- Include direct quotes from the chairman or MD.
- List key achievements from the past year.
- Present strategic priorities in direct quotes or summary.
- Highlight main challenges or headwinds mentioned by management.

## Industry & Macro Overview

- Summarize the industry environment and demand drivers.
- Present key challenges and company’s industry positioning (only factual disclosures).

## Financial Statement Analysis (Consolidated)

- State whether the company has subsidiaries.
- Present a Markdown table with columns for each year as reported (no extrapolation).
- Table rows must include:
  - Revenue from Operations
  - EBITDA
  - Net Profit (PAT)
  - Basic EPS
  - EBITDA Margin %
  - Net Profit Margin %
  - ROE %
  - ROCE %
  - Debt-to-Equity Ratio
- 3–4 neutral sentences summarizing main revenue, margin, debt drivers.

## Financial Statement Analysis (Standalone)

- Repeat above for standalone results if applicable.
- 3–4 neutral sentences comparing standalone to consolidated.

## Segment & Geography Performance

- Segment-wise: Use stacked bar chart for revenue, EBIT/EBITDA, margins %, % of total revenue, represented in Markdown tables.
- Geography-wise: Pie chart or bar chart format in Markdown for region-wise revenue, % total.

## Shareholding Pattern

- Pie chart or Markdown table showing promoter, institutional (mutual funds, FIIs), retail/public holding %.
- Note any significant changes during the year.

## Capital Allocation, Dividend & Cash Flow

- Table/line chart for capex, dividends, payout ratio, equity actions, debt levels, and cash flow summary (CFO, CFI, CFF), mark source and usage.
- Quick check: is CFO > Net Profit or vice versa?
- Bulleted takeaways about cash generation, deployment, debt/equity changes.

## Management Discussion & Analysis Snapshot

- Summarize management’s operational review, KPIs, demand/outlook, strategic initiatives.

## Governance & Management Snapshot

- Markdown table listing directors (total, independent), key leadership (full name, position, education, experience in years)—if education/experience not in report, find and include from Google.
- Note key appointments/resignations, board committees.

## Auditor’s Report

- Name of auditing firm.
- Audit opinion, factual reasoning (if qualified).
- Summarize emphasis of matters.

## Risks & Other Material Disclosures

- List and categorize risk factors with direct clarity.
- Note contingent liabilities, regulatory actions, share pledging, and ESG/CSR matters.

## ESG & CSR Highlights

- Present CSR spend, focus areas, environmental initiatives, governance/ethics disclosures.
- Use Markdown tables or bullet points wherever best for clarity.

##### Additional instructions:

- Never repeat explanations or start with “Here is the summary.”
- Maintain strict section order and explicit Markdown formatting.
- All charts must be represented as structured Markdown tables (e.g., "| Year | Metric | Value (%) |") or described as pie/stacked bar, not images.
- Output must be neutral—no investment advice, recommendations, or judgmental language.

temperature = 0.1

***`;


export async function summarizePDFwithGemini(buffer) {
    let file = null; 
    
    try {
        const fileBlob = new Blob([buffer], { type: 'application/pdf' });
        console.log(`Uploading file of size ${buffer.length} bytes...`);
        
        file = await ai.files.upload({
            file: fileBlob,
            displayName: 'annual_report_for_summary',
        });
        
        let getFile = await ai.files.get({ name: file.name });
        let attempts = 0;
        const maxProcessingAttempts = 20; 

        while (getFile.state === 'PROCESSING' && attempts < maxProcessingAttempts) {
            getFile = await ai.files.get({ name: file.name });
            console.log(`Current file status: ${getFile.state}. Waiting...`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            attempts++;
        }

        if (getFile.state === 'FAILED' || attempts === maxProcessingAttempts) {
            await ai.files.delete({ name: file.name });
            const errorMsg = getFile.state === 'FAILED' 
                ? `File processing failed. Status: ${getFile.state}` 
                : 'File processing timed out after 100 seconds.';
            throw new Error(errorMsg);
        }

        const content = [];
        if (file.uri && file.mimeType) {
            const fileContent = createPartFromUri(file.uri, file.mimeType);
            content.push(fileContent);
        }
        content.push({ text: "Generate the full structured Annual Report summary based on the attached PDF, strictly following the system instruction." });
        
        // retry if fails
        let response = null;
        let delay = INITIAL_DELAY_MS;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`Attempt ${attempt} of ${MAX_RETRIES} to generate content using ${MODEL_NAME}.`);

                response = await ai.models.generateContent({
                    model: MODEL_NAME, 
                    contents: content,
                    config: {
                        maxOutputTokens: 30000, 
                        temperature: 0.1,
                        systemInstruction: systemInstruction,
                        stopSequences: [], 
                        safetySettings: [ 
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                        ],
                    },
                });

                console.log("Content generation successful.");
                break; 

            } catch (err) {
                if (err.message.includes("503") || err.message.includes("overloaded") || err.message.includes("500")) {
                    if (attempt < MAX_RETRIES) {
                        console.warn(`Model unavailable (5xx). Retrying in ${delay / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; 
                    } else {
                        throw new Error(`Model remains unavailable after ${MAX_RETRIES} attempts. Last error: ${err.message}`);
                    }
                } else {
                    throw err; 
                }
            }
        }
        
        if (!response) {
             throw new Error("Failed to get a valid response after all retries.");
        }
        
       
        const outputFileName = 'annual_report_summary.md';
        await fs.writeFile(outputFileName, response.text);
        

        await ai.files.delete({ name: file.name });

        console.log("------------------------------------------------");
        console.log(`SUCCESS! Summary written to: ${outputFileName}`);
        console.log(`Model Finish Reason: ${response.candidates[0].finishReason}`);
        console.log("------------------------------------------------");
        
        return response.text;

    } catch (err) {
       
        if (file) {
            try {
                await ai.files.delete({ name: file.name });
                console.log("Cleanup attempted after API failure.");
            } catch (cleanupError) {
                console.error("Failed to clean up file:", cleanupError.message);
            }
        }
        console.error("Gemini API Error:", err.message);
        throw new Error("Gemini summary generation failed");
    }
}