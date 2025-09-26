// import multer from "multer";
// import fs from "fs";
// import path from "path";

// const uploadDir = "./uploads";
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadDir),
//   filename: (req, file, cb) =>
//     cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
// });

// export const upload = multer({ storage });
// export { uploadDir };

// upload.js
import multer from "multer";

const storage = multer.memoryStorage();  // File stays in memory as Buffer
const upload = multer({ storage });

export default upload;
