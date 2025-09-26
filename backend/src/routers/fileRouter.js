import express from "express";
import  upload  from "../middlewares/uploadMiddleware.js";
import { uploadFile, fetchFiles, viewPDF, downloadPDF} from "../controllers/fileController.js";

const router = express.Router();

router.post("/uploads", upload.single("file"), uploadFile);
router.get("/files", fetchFiles);
router.get("/view-pdf/:id", viewPDF);
router.get("/download-pdf/:id", downloadPDF)
export default router;
