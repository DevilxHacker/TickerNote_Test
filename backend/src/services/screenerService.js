import { ai, aiConfig } from "../config/aiConfig.js";
import { parseTickers } from "../utilities/parser.js";

export const fetchTickers = async ( prompt) => {
  let tickerName= "List the ticker name of Indian companies which have"
  let table= "in table"
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: tickerName + prompt + table,
    config: aiConfig,
  });
    console.log(response.text)
  return parseTickers(response.text);
};
