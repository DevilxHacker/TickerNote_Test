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
  let prompt="downloadable link for tcs annual report 2024"
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
  contents: prompt,
  config,
});

console.log(response.text);

}
await main();