// src/routers/chatRouter.js
import express from "express";
import { sendMessage, getChatHistory, clearChat } from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const chatRouter = express.Router();

chatRouter.use(authMiddleware);

// POST /chat/:fileId  — send a message
chatRouter.post("/:fileId", sendMessage);

// GET  /chat/:fileId  — fetch history
chatRouter.get("/:fileId", getChatHistory);

// DELETE /chat/:fileId — clear history
chatRouter.delete("/:fileId", clearChat);

export default chatRouter;