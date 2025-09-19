import mongoose from "mongoose";
import {MONGO_URI} from './serverConfig.js';
export const connectDB = async () => {
  const mongourl = MONGO_URI || "mongodb://localhost:27017/mydb";
  try {
    await mongoose.connect(mongourl);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};
