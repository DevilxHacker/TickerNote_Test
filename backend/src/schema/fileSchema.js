import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  s3Key: { type: String, required: true },       // S3 file key
size:{type: Number, reuired: true},
  result: { type: String },                      // Could store AI summary / text / analysis
  uploadedAt: { type: Date, default: Date.now },
});

export const File = mongoose.model("File", fileSchema);
