import { summarizePDFwithGemini } from "../services/aiService.js";
import { markdownToPDFBuffer } from "../services/pdfService.js";
import { saveFile, getAllFiles, getFileById, getFileByName } from "../repositories/fileRepository.js";
import {uploadBufferToS3} from "../services/s3Service.js"

export const uploadFile = async (req, res) => {
  
  try {
    const docBuffer = req.file.buffer; // This is the in-memory Buffer!
    const mimeType = req.file.mimetype; // 'application/pdf'
    if (!docBuffer || mimeType !== 'application/pdf') {
      return res.status(400).send('Please upload a valid PDF file.');
    }
    console.log("✅ File received:", req.file.originalname);

const existingFile = await getFileByName(req.file.originalname);
console.log(existingFile);
if (existingFile) {
  console.log("⚠️ File already exists in DB:", req.file.filename);
  return res.status(200).json({
    message: "⚠️ File already exists, skipping processing",
  });
}

const summary = await summarizePDFwithGemini( docBuffer, mimeType);
const pdfBuffer = await markdownToPDFBuffer(summary);
const summaryFilename = `summary-${req.file.originalname}.pdf`;
const s3lenght = await uploadBufferToS3(pdfBuffer, summaryFilename);
const s3lengthtToKb= (s3lenght / 1024).toFixed(2);
 console.log("✅ PDF uploaded to S3:", s3lengthtToKb);

    const savedFile = await saveFile({
      originalName: req.file.originalname,
      s3Key: summaryFilename,
      size: s3lengthtToKb,    // Multer-S3 provides this
      result: summary,
    });
   console.log("✅ Meta Data saved to MongoDB");
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