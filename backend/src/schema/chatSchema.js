// models/Chat.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sourcedChunkIndices: {
      type: [Number],
      default: [],
    },
  },
  { _id: true, timestamps: false }
);

const chatSchema = new mongoose.Schema(
  {
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Chat",
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);



export const Chat = mongoose.model("Chat", chatSchema);