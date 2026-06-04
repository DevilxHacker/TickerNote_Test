// src/controllers/chatController.js
import { Chat } from "../schema/chatSchema.js";
import { getFileById } from "../repositories/fileRepository.js";
import { callPythonChat } from "../services/pythonChatService.js";

const MAX_HISTORY_MESSAGES = 4;   // last 4 message as history
const MAX_HISTORY_CHAR_LEN = 400; // max length of each history

/**
 * POST /chat/:fileId
 * Body: { message: string }
 */
export const sendMessage = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // checking if user has this file
    const file = await getFileById(fileId);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (String(file.user) !== String(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // create chat session
    let chat = await Chat.findOne({ user: userId, file: fileId });
    if (!chat) {
      chat = new Chat({ user: userId, file: fileId, messages: [] });
    }


    chat.messages.push({ role: "user", content: message.trim() });

// messafe history
    const history = chat.messages
      .slice(-(MAX_HISTORY_MESSAGES + 1), -1)
      .map((m) => ({
        role:    m.role,
        content: m.content.slice(0, MAX_HISTORY_CHAR_LEN),
      }));

    // Calling RAG 
    const result = await callPythonChat({
      query:        message.trim(),
      document_id:  String(file._id),
      chat_history: history,
    });


    const assistantMsg = {
      role:    "assistant",
      content: result.answer,
      sources: result.sources || [],
    };
    chat.messages.push(assistantMsg);
    chat.updatedAt = new Date();
    await chat.save();

    res.json({
      message:   assistantMsg.content,
      sources:   assistantMsg.sources,
      messageId: chat.messages[chat.messages.length - 1]._id,
    });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ message: "Chat failed", error: err.message });
  }
};

/**
 * GET /chat/:fileId
 */
export const getChatHistory = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ user: userId, file: fileId });
    if (!chat) return res.json({ messages: [] });

    res.json({ messages: chat.messages });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch history", error: err.message });
  }
};

/**
 * DELETE /chat/:fileId
 */
export const clearChat = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    await Chat.findOneAndDelete({ user: userId, file: fileId });
    res.json({ message: "Chat history cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear chat", error: err.message });
  }
};