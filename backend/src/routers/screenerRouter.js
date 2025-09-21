import express from "express";
import {getTickers} from "../controllers/screenerController.js"

const router = express.Router();

router.post("/query", getTickers);
export default router;