import { File } from "../schema/fileSchema.js";
import {getPresignedUrl} from "../services/s3Service.js"

export const saveFile = async (fileData) => {
  const newFile = new File(fileData);
  return await newFile.save();
};

// Only return data, no res
export const getAllFiles = async () => {
  const files = await File.find().sort({ createdAt: -1 });

  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const url = await getPresignedUrl(file.s3Key, 3600); // 1 hour
      return { 
        id: file._id,
        originalName: file.originalName,
        result: file.result || "",
        url,
      };
    })
  );

  return filesWithUrls;
};


export const getFileById = async (id) => await File.findById(id);

export const getFileByName = async (originalname) => {
  try {
    return await File.findOne({ originalname });
  } catch (err) {
    console.error("❌ Error fetching file by name:", err.message);
    throw err;
  }
};
