import User from "../schema/userSchema.js";
import { summarizePDFwithGemini } from "../services/aiService.js";
import { markdownToPDFBuffer } from "../services/pdfService.js";
import { saveFile, getAllFiles, getFileById, getFileByName } from "../repositories/fileRepository.js";
import { uploadBufferToS3, uploadJsonToS3 } from "../services/s3Service.js";
import { filePythonRouter } from "../routers/Python/fileToPython.js";
import { callPythonIngest, callPythonDeleteChunks } from "../services/pythonChatService.js";
import { Chat } from "../schema/chatSchema.js";

   function parseJsonlForIngest(buffer) {
  const text = buffer instanceof Buffer ? buffer.toString("utf-8") : String(buffer);
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

export const uploadFile = async (req, res) => {
  try {
    const docBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    if (!docBuffer || mimeType !== "application/pdf") {
      return res.status(400).send("Please upload a valid PDF file.");
    }
    console.log("File received:", req.file.originalname);

    // checking duplicate
    const user= req.user._id;
    const existingFile = await getFileByName(req.file.originalname,user);
    if (existingFile) {
      console.log("File already exists in DB:", req.file.originalname);
      return res.status(200).json({
        message: "File already exists, skipping processing",
      });
    }

    // 2. Build form for python to convert pdf to json
    const fileBlob = new Blob([docBuffer], { type: mimeType });
    const pdfToJson = await filePythonRouter(fileBlob, req.file.originalname);

    const originalName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const s3FileName = `processed_json/${originalName}_${Date.now()}_chunks.jsonl`;
    await uploadJsonToS3(pdfToJson, s3FileName);

  //summarize
    const summary = await summarizePDFwithGemini(pdfToJson);
    console.log('summary type:', typeof summary);
    console.log('summary length:', summary?.length);
    console.log('summary preview:', summary?.slice(0, 200));
    const pdfBuffer = await markdownToPDFBuffer(summary);
    const summaryFilename = `summary-${req.file.originalname}-${req.user.fullName.firstName}.pdf`;

    //save to supabase
    const s3length = await uploadBufferToS3(pdfBuffer, summaryFilename);
    const s3lengthToKb = (s3length / 1024).toFixed(2);
    console.log("PDF uploaded to Supabase:", s3lengthToKb, "KB");

    // 5. Save to MongoDB
    
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

 

    // RAG 
    const documentId = String(savedFile._id);
    const chunksForIngest = parseJsonlForIngest(pdfToJson);
    callPythonIngest({ document_id: documentId, chunks: chunksForIngest })
      .then((r) => console.log(`RAG ingest OK: ${r.chunks_stored} chunks stored for ${documentId}`))
      .catch((e) => console.error("RAG ingest failed (non-fatal):", e.message));

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

export const deleteFile = async (req, res) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (String(file.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const documentId = String(file._id);

    // Remove RAG vectors — fire and forget
    callPythonDeleteChunks(documentId)
      .catch((e) => console.error("RAG delete failed:", e.message));

    // Remove chat history for this file
    await Chat.deleteMany({ file: req.params.id });

    // Remove file doc + user reference
    await file.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $pull: { files: file._id } });

    res.json({ message: "File and associated data deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting file", error: err.message });
  }
};