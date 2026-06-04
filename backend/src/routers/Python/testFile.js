// Example: routes/python.js
import express from "express";
import axios from "axios";
import { PYTHON_API_URL } from "../../config/serverConfig.js";
const router = express.Router();
const port = PYTHON_API_URL || 'http://localhost:8000';
router.get('/test-python', async (req, res) => {
    try {
        const response = await axios.get(port);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Python server not running" });
    }
});

router.post('/hello-python', async (req, res) => {
    try {
        const response = await axios.post(`${port}/hello`, {
            message: req.body.message || "Hello from MERN!"
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;