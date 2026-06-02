import User from "../schema/userSchema.js";
import { summarizePDFwithGemini } from "../services/aiService.js";
import { markdownToPDFBuffer } from "../services/pdfService.js";
import { saveFile, getAllFiles, getFileById, getFileByName } from "../repositories/fileRepository.js";
import { uploadBufferToS3, uploadJsonToS3 } from "../services/s3Service.js";
import axios from "axios";

export const uploadFile = async (req, res) => {
  try {
    const docBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    if (!docBuffer || mimeType !== "application/pdf") {
      return res.status(400).send("Please upload a valid PDF file.");
    }
    console.log("File received:", req.file.originalname);

    // 1. Check for duplicate BEFORE doing any work
    const existingFile = await getFileByName(req.file.originalname);
    if (existingFile) {
      console.log("File already exists in DB:", req.file.originalname);
      return res.status(200).json({
        message: "File already exists, skipping processing",
      });
    }

    // 2. Build form and forward to Python — collect full response (no streaming)
    const fileBlob = new Blob([docBuffer], { type: mimeType });
    const form = new FormData();
    form.append("file", fileBlob, req.file.originalname);

    const FASTAPI_URL = "http://127.0.0.1:8000";
    console.log(`Forwarding ${req.file.originalname} to Python...`);

    let fullJsonlData = "";
    try {
      const pythonResponse = await axios.post(`${FASTAPI_URL}/upload-pdf`, form);
      fullJsonlData =
        typeof pythonResponse.data === "string"
          ? pythonResponse.data
          : JSON.stringify(pythonResponse.data);
      console.log("✅ Python processing complete. JSONL data received.");
    } catch (error) {
      console.error("❌ Error forwarding to Python:", error.message);
      return res.status(500).json({ error: "Failed to process PDF" });
    }

    // 3. Upload raw JSONL to Supabase
    const jsonBuffer = Buffer.from(fullJsonlData, "utf-8");
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const s3FileName = `processed_json/${originalName}_${Date.now()}_chunks.jsonl`;
    await uploadJsonToS3(jsonBuffer, s3FileName);

    // 4. Summarize, convert to PDF, upload summary to Supabase
    const summary = await summarizePDFwithGemini(jsonBuffer);
    console.log('summary type:', typeof summary);
console.log('summary length:', summary?.length);
console.log('summary preview:', summary?.slice(0, 200)); 
    const pdfBuffer = await markdownToPDFBuffer(summary);
    const summaryFilename = `summary-${req.file.originalname}.pdf`;
    const s3length = await uploadBufferToS3(pdfBuffer, summaryFilename);
    const s3lengthToKb = (s3length / 1024).toFixed(2);
    console.log("PDF uploaded to Supabase:", s3lengthToKb, "KB");

    // 5. Save metadata to MongoDB
    const savedFile = await saveFile({
      user: req.user._id,
      originalName: req.file.originalname,
      s3Key: summaryFilename,
      size: s3lengthToKb,
      result: summary,
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: { files: savedFile._id },
    });

    console.log("Metadata saved to MongoDB");
    res.json({
      message: "File uploaded and summarized",
      file: savedFile,
      summaryFile: `/uploads/${summaryFilename}`,
    });
  } catch (err) {
    console.error("Error processing file:", err.message);
    res.status(500).json({ message: "Error processing file", error: err.message });
  }
};

export const fetchFiles = async (req, res) => {
  try {
    const files = await getAllFiles(req.user._id);
    res.json(files || []);
  } catch (err) {
    res.status(500).json({ message: "Error fetching files", error: err.message });
  }
};

export const downloadPDF = async (req, res) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file || !file.summaryPDF) {
      return res.status(404).json({ message: "PDF not found" });
    }
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.summaryPDFName || "file.pdf"}"`,
    });
    res.send(file.summaryPDF);
  } catch (err) {
    res.status(500).json({ message: "Error downloading PDF", error: err.message });
  }
};

export const viewPDF = async (req, res) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file || !file.summaryPDF) {
      return res.status(404).json({ message: "PDF not found" });
    }
    res.set({ "Content-Type": "application/pdf" });
    if (req.query.download === "true") {
      res.set("Content-Disposition", `attachment; filename="${file.summaryPDFName}"`);
    }
    res.send(file.summaryPDF);
  } catch (err) {
    res.status(500).json({ message: "Error serving PDF", error: err.message });
  }
};