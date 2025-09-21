import express from "express";
import cors from "cors";
import {CLIENT_URI} from "./config/serverConfig.js"
import { connectDB } from "./config/dbConfig.js";
import fileRouter from "./routers/fileRouter.js";
import screenerRouter from "./routers/screenerRouter.js"
import errorHandler from "./middlewares/errorHandler.js";
import path from "path";

connectDB();

const app = express();
app.use(
  cors({
    origin: CLIENT_URI, 
    credentials: true,              
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/file", fileRouter);
app.use("/screener", screenerRouter)

app.use(errorHandler);

app.get("/", (req, res) => res.send("Backend running"));

export default app;
