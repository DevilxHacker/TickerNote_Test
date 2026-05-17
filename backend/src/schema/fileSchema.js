
import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,        
    },
    originalName: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,        
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",  
    },
    result: {
      type: String,         
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const File = mongoose.model("File", fileSchema);