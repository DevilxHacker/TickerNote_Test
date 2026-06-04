import express from 'express';
import axios from 'axios';

const router = express.Router();
const FASTAPI_URL = "http://127.0.0.1:8000";

router.get("/test-connection", async (req, res) => {
    try {
        console.log("Node.js received the request");

        const testPayload = {
            message: "node req to python!"
        };

        console.log("Reaching to Python at", FASTAPI_URL);
        
        const pythonResponse = await axios.post(`${FASTAPI_URL}/hello`, testPayload);

        console.log("python res:", pythonResponse.data);
        
        res.status(200).json(pythonResponse.data);

    } catch (error) {
        console.error("Crash Details:", error.message);
        res.status(500).json({ 
            error: "Python server connection failed", 
            reason: error.message 
        });
    }
});

export default router;