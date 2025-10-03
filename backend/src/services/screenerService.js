import { ai, aiConfig } from "../config/aiConfig.js";
import { parseTickers } from "../utilities/parser.js";

export const fetchTickers = async ( prompt) => {
  let query= `You are an AI stock screener. Follow these rules strictly ( Only result with the companies listed in NSE and BSE ):

1. Verification:
   - If the user query is not a valid stock screening request (e.g., unrelated to finance, missing filters, or not logically screenable),
     return exactly this text:
     → "Invalid screening query. Please provide valid financial filters or a company name."

2. Structure:
   - The input will always be a "User Query".
   - The User Query may contain:
       a) Specific filters (e.g., sector, market cap, valuation, ratios, growth, technicals, etc.)
       b) Return only a specific company name and ticker name, do not return 2 for both nse and bse
   - Convert the User Query into structured screening logic.

3. Output:
   - Always return only the Ticker Symbol + Company Name in a table format.
   - Do not include explanations, commentary, or extra text.
   - If no matches are found, return:
     → "No matching companies found."
User Query:${prompt}
  `

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query + prompt ,
    config: aiConfig,
  });
    console.log(response.text)
    if(response.text=='Invalid screening query. Please provide valid financial filters or a company name.')
      return [response.text];
  return parseTickers(response.text);
};
