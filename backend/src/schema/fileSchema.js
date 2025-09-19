import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  uploadedAt: { type: Date, default: Date.now },
  summaryPDF: Buffer,
  summaryPDFName: String,
});

export const File = mongoose.model("File", fileSchema);
