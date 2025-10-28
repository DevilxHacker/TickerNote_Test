// import { GoogleGenAI } from "@google/genai";
// import dotenv from "dotenv";
// dotenv.config();

// // Configure the client
// const ai = new GoogleGenAI({
//       apiKey:process.env.GEMINI_API_KEY 
// });

// // Define the grounding tool
// const groundingTool = {
//   googleSearch: {},
// };

// // Configure generation settings
// const config = {
//   tools: [groundingTool],
// };

// // Make the request
// async function main(){
//   let prompt="downloadable link for tcs annual report 2024"
//   const response = await ai.models.generateContent({
//     model: "gemini-live-2.5-flash-preview",
//   contents: prompt,
//   config,
// });

// console.log(response.text);

// }
// await main();


// index.js

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
// Initialize the GoogleGenAI client
// Ensure your GEMINI_API_KEY is set in your environment variables
const ai = new GoogleGenAI({});

async function getTCSAnnualReportLinks() {
  const prompt = "Give me the direct downloadable PDF links for the last three Tata Consultancy Services (TCS) Integrated Annual Reports from their official investor relations page.";

  try {
    console.log("Searching for TCS Annual Report links...");

    // Call the model with the prompt and the Google Search tool
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Good model for tool use
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable the Google Search tool
      },
    });

    // The model will use the search tool and provide the answer
    const resultText = response.text;

    console.log("\n--- Gemini API Response ---");
    console.log(resultText);
    console.log("---------------------------\n");

    // Note: The model's response will ideally contain the formatted table/links.
    // In a real application, you might use regex or a parser to extract
    // the specific links if the model's output isn't perfectly structured.

    console.log("Task Completed.");
    
  } catch (error) {
    console.error("An error occurred during the Gemini API call:", error);
  }
}

getTCSAnnualReportLinks();