import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "./serverConfig.js";

export const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// Define the grounding tool
export const groundingTool = {
  googleSearch: {},
};

// Generation settings
export const aiConfig = {
  tools: [groundingTool],
};