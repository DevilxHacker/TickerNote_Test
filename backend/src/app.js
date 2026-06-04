import express from "express";
import cors from "cors";
import {CLIENT_URI} from "./config/serverConfig.js"
import { connectDB } from "./config/dbConfig.js";
import fileRouter from "./routers/fileRouter.js";
import pythonRoutes from "./routers/testFile.js";
import chatRouter from "./routers/chatRouter.js";
import errorHandler from "./middlewares/errorHandler.js";
import path from "path";
import userRoutes from '../src/routers/userRouter.js'
// import chatrouter from '../src/routers/chatRouter.js'
connectDB();

const app = express();
app.use(
  cors({
    origin:  "http://localhost:5173" ,CLIENT_URI , 
    credentials: true,              
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/file", fileRouter);
app.use('/api/users', userRoutes);
app.use("/python", pythonRoutes);
app.use("/chat", chatRouter);
app.use(errorHandler);
// app.use("/chat", chatrouter);

app.get("/", (req, res) => res.send("Backend running"));

export default app;