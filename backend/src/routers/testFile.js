import express from 'express';
import axios from 'axios';

const router = express.Router();
const FASTAPI_URL = "http://127.0.0.1:8000";

// Using .get so you can just click the link in your browser
router.get("/test-connection", async (req, res) => {
    try {
        console.log("1. Node.js received the request...");

        // We hardcode the data here to guarantee it doesn't crash
        const testPayload = {
            message: "node req to python!"
        };

        console.log("2. Reaching out to Python at", FASTAPI_URL);
        
        // Send the request to FastAPI
        const pythonResponse = await axios.post(`${FASTAPI_URL}/hello`, testPayload);

        console.log("3. python res:", pythonResponse.data);
        
        // Send Python's response to your browser
        res.status(200).json(pythonResponse.data);

    } catch (error) {
        // If it fails, we send the exact error to the browser so you can see it
        console.error("🚨 Crash Details:", error.message);
        res.status(500).json({ 
            error: "Python server connection failed", 
            reason: error.message 
        });
    }
});

export default router;