// Example: routes/python.js
import express from "express";
import axios from "axios";
const router = express.Router();

router.get('/test-python', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:8000/');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Python server not running" });
    }
});

router.post('/hello-python', async (req, res) => {
    try {
        const response = await axios.post('http://localhost:8000/hello', {
            message: req.body.message || "Hello from MERN!"
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;