import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

// Configure the client
const ai = new GoogleGenAI({
      apiKey:process.env.GEMINI_API_KEY 
});

// Define the grounding tool
const groundingTool = {
  googleSearch: {},
};

// Configure generation settings
const config = {
  tools: [groundingTool],
};

// Make the request
async function main(){
  let tickerName= "List the ticker name of Indain companies which"
  let prompt="have market cap greater than 10,00,00,00,953 and PE ratio less than 25"
let table="in table"
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
  contents: tickerName+prompt+table,
  config,
});

// Print the grounded response
const tickers = response.text
  .split("\n")
  .filter(line => line.startsWith("|")) // only table rows
  .filter(line => !line.includes("Ticker Name") && !line.includes("-")) // remove header + separator
  .map(line => line.replace(/\|/g, "").trim()); // clean up

console.log(tickers);

}
await main();