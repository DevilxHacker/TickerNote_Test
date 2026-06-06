import express from "express";
import cors from "cors";
import { CLIENT_URI } from "./config/serverConfig.js";
import { connectDB } from "./config/dbConfig.js";
import fileRouter from "./routers/fileRouter.js";
import pythonRoutes from "./routers/testFile.js";
import chatRouter from "./routers/chatRouter.js";
import errorHandler from "./middlewares/errorHandler.js";
import path from "path";
import userRoutes from "../src/routers/userRouter.js";
import { execSync } from 'child_process';
connectDB();
import puppeteer from 'puppeteer';

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://tickernote-tau.vercel.app",
  CLIENT_URI,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/file", fileRouter);
app.use("/api/users", userRoutes);
app.use("/python", pythonRoutes);
app.use("/chat", chatRouter);
app.get('/find-chrome', (req, res) => {
  try {
    const result = execSync('find /opt/render/.cache/puppeteer -type f -name "chrome" 2>/dev/null || echo "NOT FOUND"').toString();
    const exists = require('fs').existsSync(puppeteer.executablePath());
    res.json({ 
      foundPaths: result.trim().split('\n').filter(Boolean),
      puppeteerSays: puppeteer.executablePath(),
      fileExists: exists  // ← this tells us if the file is actually there
    });
  } catch (err) {
    res.json({ error: err.message, puppeteerSays: puppeteer.executablePath() });
  }
});

app.get("/", (req, res) => res.send("Backend running"));

app.use(errorHandler);

export default app;