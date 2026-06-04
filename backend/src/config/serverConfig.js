import dotenv from 'dotenv';
dotenv.config();
export const GEMINI_API_KEY=process.env.GEMINI_API_KEY;
export const PORT = process.env.PORT || 5000;
export const CLIENT_URI = process.env.CLIENT_URI;
export const MONGO_URI = process.env.MONGO_URI;
export const BUCKET_NAME=process.env.BUCKET_NAME;
export const SUPABASE_URL=process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;
export const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID;
export const BUCKET_NAME_JSON = process.env.BUCKET_NAME_JSON;
export const PYTHON_API_URL = process.env.PYTHON_API_URL
// aws
// export const BUCKET_REGION=process.env.BUCKET_REGION;
// export const ACCESS_KEY=process.env.ACCESS_KEY;
// export const SECRET_KEY=process.env.SECRET_KEY;


