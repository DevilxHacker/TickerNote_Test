import fs from "fs";
import path from "path";
import { summarizePDFwithGemini } from "../services/aiService.js";
import { markdownToPDFBuffer } from "../services/pdfService.js";
import { saveFile, getAllFiles, getFileById, getFileByName } from "../repositories/fileRepository.js";
import { uploadDir } from "../middlewares/uploadMiddleware.js";

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "❌ No file uploaded" });
    console.log("✅ File received:", req.file.originalname);

const existingFile = await getFileByName(req.file.originalname);
console.log(req.file.filename);
console.log(existingFile);
if (existingFile) {
  console.log("⚠️ File already exists in DB:", req.file.filename);
  return res.status(200).json({
    message: "⚠️ File already exists, skipping processing",
  });
}

    const summary = await summarizePDFwithGemini(uploadDir, req.file.filename);
    const pdfBuffer = await markdownToPDFBuffer(summary);

    const summaryFilename = `summary-${req.file.filename}.pdf`;
    fs.writeFileSync(path.join(uploadDir, summaryFilename), pdfBuffer);
        console.log("✅ Summary PDF saved locally:", summaryFilename);

    const savedFile = await saveFile({
      filename: req.file.filename,
      originalname: req.file.originalname,
      summaryPDF: Buffer.from(pdfBuffer),
      summaryPDFName: summaryFilename,
    });
   console.log("✅ File saved to MongoDB");
    res.json({ message: "✅ File uploaded and summarized", file: savedFile, summaryFile: `/uploads/${summaryFilename}` });
  } catch (err) {
    console.error("❌ Error processing file:", err.message);
    res.status(500).json({ message: "❌ Error processing file", error: err.message });
  }
};

export const fetchFiles = async (req, res) => {
  try {
    const files = await getAllFiles();
    res.json(files || []);
  } catch (err) {
    res.status(500).json({ message: "❌ Error fetching files", error: err.message });
  }
};

export const viewPDF = async (req, res) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file || !file.summaryPDF) return res.status(404).json({ message: "❌ PDF not found" });

    res.set({ "Content-Type": "application/pdf" });
    if (req.query.download === "true") {
      res.set("Content-Disposition", `attachment; filename="${file.summaryPDFName}"`);
    }
    res.send(file.summaryPDF);
  } catch (err) {
    res.status(500).json({ message: "❌ Error serving PDF", error: err.message });
  }
};

export const downloadPDF = async (req, res) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file || !file.summaryPDF) {
      return res.status(404).json({ message: "❌ PDF not found" });
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.summaryPDFName || "file.pdf"}"`
    });

    res.send(file.summaryPDF); // assuming Buffer / Binary data
  } catch (err) {
    res.status(500).json({ message: "❌ Error downloading PDF", error: err.message });
  }
};
