import { File } from "../schema/fileSchema.js";
import {getPresignedUrl} from "../services/s3Service.js"

export const saveFile = async (fileData) => {
  const newFile = new File(fileData);
  return await newFile.save();
};


export const getAllFiles = async (userId) => {
  const files = await File.find({ user: userId }).sort({ createdAt: -1 });

  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      let url = "";
      try {
        url = await getPresignedUrl(file.s3Key, 3600);
      } catch (err) {
        console.error("Presigned URL error for", file.s3Key, err.message); 
        url = "";
      }

      return {
        id: file._id,
        originalName: file.originalName,
        result: file.result || "",
        size: file.size,
        uploadedAt: file.uploadedAt,
        url,
      };
    })
  );

  return filesWithUrls;
};


export const getFileById = async (id) => await File.findById(id);

export const getFileByName = async (originalName) => {
  try {
    return await File.findOne({ originalName }); 
  } catch (err) {
    console.error("Error fetching file by name:", err.message);
    throw err;
  }
}
