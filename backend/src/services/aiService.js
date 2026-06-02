import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs/promises';
import { GEMINI_API_KEY } from '../config/serverConfig.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_NAME        = 'gemini-2.5-flash';
const MAX_RETRIES       = 6;
const INITIAL_DELAY_MS  = 5000;
const MAX_OUTPUT_TOKENS = 65536;
const SEP               = '─'.repeat(54);

const FREE_TIER_TOKEN_LIMIT = 220_000;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const generateSystemInstruction = (companyName, reportType, year) => `
You are an automated, experienced equity research analyst.
You will receive the full extracted text of a ${reportType} of a publicly listed Indian company (${companyName}).
Generate a neutral, factual, highly structured Markdown summary for year ${year}.

Strictly follow this section order. Write "Not Disclosed in Report." if a section has no data.

## Business Snapshot & Model
- Concise description of the company's core business (5–10 sentences).
- Main products, services, and customer segments in a Markdown table.
- Value chain if available.
- Revenue breakdown by segment and geography.
- Core revenue streams, key raw materials, suppliers, distribution channels, cost drivers.
- Structural changes if any (mergers, acquisitions, divestments).

## Chairman/Managing Director's Letter
- Overall tone (Optimistic / Cautious / etc.).
- Direct quotes from the chairman or MD.
- Key achievements from the past year.
- Strategic priorities in direct quotes or summary.
- Main challenges or headwinds mentioned.

## Industry & Macro Overview
- Industry environment and demand drivers.
- Key challenges and company's industry positioning (factual disclosures only).

## Financial Statement Analysis (Consolidated)
- Whether the company has subsidiaries.
- Markdown table with columns for each reported year:
  Revenue from Operations | EBITDA | Net Profit (PAT) | Basic EPS |
  EBITDA Margin % | Net Profit Margin % | ROE % | ROCE % | Debt-to-Equity Ratio
- 3–4 neutral sentences summarizing revenue, margin, and debt drivers.

## Financial Statement Analysis (Standalone)
- Repeat above for standalone results if applicable.
- 3–4 neutral sentences comparing standalone to consolidated.

## Segment & Geography Performance
- Segment-wise Markdown table: revenue, EBIT/EBITDA, margins %, % of total revenue.
- Geography-wise Markdown table: region-wise revenue, % total.

## Shareholding Pattern
- Markdown table: promoter, institutional (MFs, FIIs), retail/public holding %.
- Note significant changes during the year.

## Capital Allocation, Dividend & Cash Flow
- Table: capex, dividends, payout ratio, equity actions, debt levels, CFO/CFI/CFF.
- Is CFO > Net Profit?
- Bulleted takeaways: cash generation, deployment, debt/equity changes.

## Management Discussion & Analysis Snapshot
- Operational review, KPIs, demand/outlook, strategic initiatives.

## Governance & Management Snapshot
- Markdown table: directors (total, independent), key leadership (name, position, education, experience).
- Key appointments/resignations, board committees.

## Auditor's Report
- Name of auditing firm, audit opinion, factual reasoning if qualified.
- Emphasis of matters.

## Risks & Other Material Disclosures
- Categorized risk factors.
- Contingent liabilities, regulatory actions, share pledging.

## ESG & CSR Highlights
- CSR spend, focus areas, environmental initiatives, governance/ethics disclosures.
- Use Markdown tables or bullets for clarity.

Rules:
- Never start with "Here is the summary" or any preamble.
- All tabular data must be Markdown tables.
- Output must be neutral — no investment advice or recommendations.
- Be thorough — include every data point. Do NOT truncate or stop early.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Parse JSONL/JSON buffer → clean text, trimmed to token budget
// ─────────────────────────────────────────────────────────────────────────────
const extractCleanText = (jsonBuffer, tokenLimit = FREE_TIER_TOKEN_LIMIT) => {
    const raw     = Buffer.isBuffer(jsonBuffer) ? jsonBuffer.toString('utf8') : String(jsonBuffer);
    const trimmed = raw.trim();

    let records = [];

    if (trimmed.startsWith('[')) {
        try { records = JSON.parse(trimmed); } catch (_) {}
    }
    if (records.length === 0 && trimmed.includes('\n')) {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
        try { records = lines.map(l => JSON.parse(l)); } catch (_) {}
    }
    if (records.length === 0) {
        try { records = [JSON.parse(trimmed)]; } catch (_) {}
    }
    if (records.length === 0) throw new Error('Could not parse any records from input buffer.');

    const chunks = records
        .map(r => (r.text || r.content || '').trim())
        .filter(Boolean);

    const beforeKB  = Math.round(raw.length / 1024);
    const rawText   = chunks.join('\n\n');
    let   estTokens = Math.ceil(rawText.length / 4);

    console.log(`🧹 Stripped to text only`);
    console.log(`   Records parsed   : ${records.length} chunks`);
    console.log(`   Before stripping : ${beforeKB} KB  (full JSON with all fields)`);
    console.log(`   Raw text size    : ${Math.round(rawText.length / 1024)} KB`);
    console.log(`   Est. tokens      : ~${estTokens.toLocaleString()}`);

    let finalText = rawText;
    if (estTokens > tokenLimit) {
        estTokens = Math.ceil(finalText.length / 4);
        console.log(`   ✂️  Pass 1 (no headers): ~${estTokens.toLocaleString()} tokens`);
    }

    if (estTokens > tokenLimit) {
        const seen    = new Set();
        const deduped = finalText
            .split('\n')
            .filter(line => {
                const norm = line.trim().toLowerCase();
                if (norm.length < 20) return true;
                if (seen.has(norm))   return false;
                seen.add(norm);
                return true;
            })
            .join('\n');
        finalText = deduped;
        estTokens = Math.ceil(finalText.length / 4);
        console.log(`   ✂️  Pass 2 (dedup lines): ~${estTokens.toLocaleString()} tokens`);
    }

    if (estTokens > tokenLimit) {
        const maxChars = tokenLimit * 4;
        finalText      = finalText.slice(0, maxChars);
        estTokens      = Math.ceil(finalText.length / 4);
        console.warn(`   ⚠️  Pass 3 (hard truncate): trimmed to ~${estTokens.toLocaleString()} tokens`);
        console.warn(`       Some content at the end of the report was dropped.`);
        console.warn(`       To avoid this: upgrade to paid Gemini tier (no 250K limit).`);
    }

    const afterKB = Math.round(finalText.length / 1024);
    console.log(`   Final text size  : ${afterKB} KB (~${estTokens.toLocaleString()} tokens)`);

    return { fullText: finalText, recordCount: records.length, beforeKB, afterKB, estTokens };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Live ticker + hard timeout
// ─────────────────────────────────────────────────────────────────────────────
const withTicker = (promise, label, timeoutMs = 15 * 60 * 1000) => {
    let ticker;
    const guard = new Promise((_, reject) => {
        const start = Date.now();
        ticker = setInterval(() => {
            const s = Math.round((Date.now() - start) / 1000);
            process.stdout.write(`\r   ⏱  ${label} ... ${s}s elapsed`);
        }, 5000);
        setTimeout(() => {
            clearInterval(ticker);
            process.stdout.write('\n');
            reject(new Error(`${label} timed out after ${timeoutMs / 60000} min`));
        }, timeoutMs);
    });
    return Promise.race([
        promise.then(r => { clearInterval(ticker); process.stdout.write('\n'); return r; }),
        guard,
    ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Parse retry delay from 429 error body
// ─────────────────────────────────────────────────────────────────────────────
const parseRetryDelayMs = (err, fallback = 60000) => {
    try {
        const start = err.message.indexOf('{');
        if (start === -1) return fallback;
        const parsed = JSON.parse(err.message.slice(start));
        for (const d of (parsed?.error?.details || [])) {
            if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
                const s = parseFloat(d.retryDelay);
                if (!isNaN(s)) return Math.ceil(s * 1000) + 5000;
            }
        }
    } catch (_) {}
    return fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Single Gemini call with retry
// ─────────────────────────────────────────────────────────────────────────────
const callGeminiWithRetry = async (ai, modelName, contents, config, maxRetries = MAX_RETRIES) => {
    let delay = INITIAL_DELAY_MS;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🚀 Attempt ${attempt}/${maxRetries} — calling ${modelName}...`);
            const call     = ai.models.generateContent({ model: modelName, contents, config });
            const response = await withTicker(call, `Attempt ${attempt}/${maxRetries}`);
            console.log(`   ✅ Response received.`);
            return response;
        } catch (err) {
            const is429     = err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED");
            const is5xx     = err.message.includes("503") || err.message.includes("500") || err.message.includes("overloaded");
            const isTimeout = err.message.includes('timed out');

            if ((is429 || is5xx || isTimeout) && attempt < maxRetries) {
                const waitMs = is429
                    ? parseRetryDelayMs(err, 60000)
                    : isTimeout ? 10000
                    : Math.min(delay * 2, 60000);
                console.warn(`   ⚠️  Attempt ${attempt}/${maxRetries} — ${is429 ? '429 quota' : is5xx ? '5xx error' : 'timeout'}. Waiting ${(waitMs / 1000).toFixed(0)}s...`);
                await new Promise(r => setTimeout(r, waitMs));
                delay = Math.min(delay * 2, 60000);
            } else if (attempt >= maxRetries) {
                throw new Error(`All ${maxRetries} attempts failed. Last: ${err.message}`);
            } else {
                throw err;
            }
        }
    }
    throw new Error('No response received after all retries.');
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Extract text safely from Gemini response
// ─────────────────────────────────────────────────────────────────────────────
const extractTextFromResponse = (response) => {
    const candidate    = response?.candidates?.[0];
    const finishReason = candidate?.finishReason ?? 'UNKNOWN';
    const parts        = candidate?.content?.parts ?? [];
    const text         = parts
        .filter(p => typeof p.text === 'string' && !p.thought)
        .map(p => p.text)
        .join('');
    return { text, finishReason, parts };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export async function summarizePDFwithGemini(jsonBuffer, options = {}) {
    const apiKey          = options.apiKey          || GEMINI_API_KEY;
    const modelName       = options.modelName       || MODEL_NAME;
    const outputFileName  = options.outputFileName  || `summary_${Date.now()}.md`;
    const companyName     = options.companyName     || 'the Company';
    const reportType      = options.reportType      || 'Annual Report';
    const year            = options.year            || 'Current Year';
    const maxOutputTokens = options.maxOutputTokens || MAX_OUTPUT_TOKENS;
    const tokenLimit      = options.tokenLimit      || FREE_TIER_TOKEN_LIMIT;

    const ai                = new GoogleGenAI({ apiKey });
    const systemInstruction = generateSystemInstruction(companyName, reportType, year);

    console.log(`\n${SEP}`);
    console.log(`🤖 Model         : ${modelName}`);
    console.log(`📤 Max out tokens: ${maxOutputTokens.toLocaleString()}`);
    console.log(`🎯 Token budget  : ${tokenLimit.toLocaleString()} (free tier safe limit)`);

    try {
        // ── 1. Strip + trim to token budget ──────────────────────
        const { fullText, recordCount, beforeKB, afterKB, estTokens } = extractCleanText(jsonBuffer, tokenLimit);
        console.log(`${SEP}\n`);

        // ── 2. Gemini config ──────────────────────────────────────
        const geminiConfig = {
            maxOutputTokens,
            temperature    : 0.1,
            systemInstruction,
            thinkingConfig : { thinkingBudget: 0 },
            safetySettings : [
                { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_NONE" },
            ],
        };

        // ── 3. Decide: single call or chunked ────────────────────
        // If the expected output would overflow MAX_OUTPUT_TOKENS (65536),
        // we split the summary into two halves: sections 1–6 and sections 7–13.
        // Each call gets the FULL document text so facts aren't lost.
        const SECTIONS_PART_1 = [
            'Business Snapshot & Model',
            "Chairman/Managing Director's Letter",
            'Industry & Macro Overview',
            'Financial Statement Analysis (Consolidated)',
            'Financial Statement Analysis (Standalone)',
            'Segment & Geography Performance',
        ];

        const SECTIONS_PART_2 = [
            'Shareholding Pattern',
            'Capital Allocation, Dividend & Cash Flow',
            'Management Discussion & Analysis Snapshot',
            'Governance & Management Snapshot',
            "Auditor's Report",
            'Risks & Other Material Disclosures',
            'ESG & CSR Highlights',
        ];

        const docPreamble = [
            `The following is the full extracted text of a ${reportType} for ${companyName} (${year}).`,
            `It contains ${recordCount} sections. Read everything thoroughly.`,
            ``,
            fullText,
            ``,
        ].join('\n');

        const contentsP1 = [{
            role : 'user',
            parts: [{ text: docPreamble + [
                `Now generate ONLY these sections (skip all others):`,
                SECTIONS_PART_1.map(s => `- ${s}`).join('\n'),
                ``,
                `Follow the system instructions exactly. Be thorough. Do NOT stop early.`,
            ].join('\n') }],
        }];

        const contentsP2 = [{
            role : 'user',
            parts: [{ text: docPreamble + [
                `Now generate ONLY these sections (skip all others):`,
                SECTIONS_PART_2.map(s => `- ${s}`).join('\n'),
                ``,
                `Follow the system instructions exactly. Be thorough. Do NOT stop early.`,
            ].join('\n') }],
        }];

        // ── 4. Call Gemini (two passes) ───────────────────────────
        console.log(`📋 Pass 1/2 — Generating: ${SECTIONS_PART_1.join(', ')}`);
        const resp1             = await callGeminiWithRetry(ai, modelName, contentsP1, geminiConfig);
        const { text: text1, finishReason: fr1 } = extractTextFromResponse(resp1);

        if (!text1 || typeof text1 !== 'string' || !text1.trim()) {
            throw new Error(`Pass 1 returned empty text. finishReason: ${fr1}`);
        }
        if (fr1 === 'MAX_TOKENS') {
            console.warn(`   ⚠️  Pass 1 hit MAX_TOKENS — some sections may be cut short.`);
        }
        console.log(`   ✅ Pass 1 done. (${Math.round(text1.length / 1024)} KB, finish: ${fr1})`);

        // Small cooldown between calls to avoid rate-limiting
        await new Promise(r => setTimeout(r, 3000));

        console.log(`📋 Pass 2/2 — Generating: ${SECTIONS_PART_2.join(', ')}`);
        const resp2             = await callGeminiWithRetry(ai, modelName, contentsP2, geminiConfig);
        const { text: text2, finishReason: fr2 } = extractTextFromResponse(resp2);

        if (!text2 || typeof text2 !== 'string' || !text2.trim()) {
            throw new Error(`Pass 2 returned empty text. finishReason: ${fr2}`);
        }
        if (fr2 === 'MAX_TOKENS') {
            console.warn(`   ⚠️  Pass 2 hit MAX_TOKENS — some sections may be cut short.`);
        }
        console.log(`   ✅ Pass 2 done. (${Math.round(text2.length / 1024)} KB, finish: ${fr2})`);

        // ── 5. Merge ──────────────────────────────────────────────
        let summaryText = [text1.trim(), text2.trim()].join('\n\n');

        // Guard: ensure we always have a valid string before any .replace() calls downstream
        if (typeof summaryText !== 'string' || !summaryText.trim()) {
            throw new Error('Merged summary is empty — both passes returned no usable text.');
        }

        if (fr1 === 'MAX_TOKENS' || fr2 === 'MAX_TOKENS') {
            summaryText += '\n\n> **⚠️ Note:** This summary was truncated due to output token limits. Some sections may be incomplete.\n';
        }

        // ── 6. Save ───────────────────────────────────────────────
        await fs.writeFile(outputFileName, summaryText);

        const in1  = resp1?.usageMetadata?.promptTokenCount    ?? '?';
        const out1 = resp1?.usageMetadata?.candidatesTokenCount ?? '?';
        const in2  = resp2?.usageMetadata?.promptTokenCount    ?? '?';
        const out2 = resp2?.usageMetadata?.candidatesTokenCount ?? '?';
        const sizeKB = Math.round(summaryText.length / 1024);

        console.log(`\n${SEP}`);
        console.log(`🎉 SUCCESS → ${outputFileName}  (${sizeKB} KB)`);
        console.log(`   Input  : ${beforeKB} KB JSON → ${afterKB} KB text sent`);
        console.log(`   Pass 1 tokens in/out : ${in1} / ${out1}  (finish: ${fr1})`);
        console.log(`   Pass 2 tokens in/out : ${in2} / ${out2}  (finish: ${fr2})`);
        console.log(`   Both finish reasons must be STOP ↑`);
        console.log(`${SEP}\n`);

        return summaryText;   // ← always a string from here

    } catch (err) {
        console.error(`\n❌ FATAL: ${err.message}`);
        throw new Error(`Gemini summary generation failed: ${err.message}`);
    }
}