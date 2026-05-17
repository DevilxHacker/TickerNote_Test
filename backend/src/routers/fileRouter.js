import express from "express";
import  upload  from "../middlewares/uploadMiddleware.js";
import { uploadFile, fetchFiles, viewPDF, downloadPDF} from "../controllers/fileController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/uploads", authMiddleware, upload.single("file"), authMiddleware, uploadFile);
router.get("/files", authMiddleware, fetchFiles);
router.get("/view-pdf/:id", authMiddleware, viewPDF);
router.get("/download-pdf/:id", authMiddleware, downloadPDF)
export default router;
