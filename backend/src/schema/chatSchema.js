import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: [
      {
        section: String,
        pages:   [Number],
        score:   Number,
      },
    ],
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      required: true,
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "File",
      required: true,
    },
    messages: [messageSchema],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// one chat per user
chatSchema.index({ user: 1, file: 1 }, { unique: true });

export const Chat = mongoose.model("Chat", chatSchema);