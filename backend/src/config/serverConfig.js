import dotenv from 'dotenv';
dotenv.config();
export const GEMINI_API_KEY=process.env.Gemini_API_KEY;
export const PORT = process.env.PORT || 5000;
export const CLIENT_URI = process.env.CLIENT_URI;
export const MONGO_URI = process.env.MONGO_URI;

