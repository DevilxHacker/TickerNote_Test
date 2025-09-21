import { File } from "../schema/fileSchema.js";

export const saveFile = async (fileData) => {
  const newFile = new File(fileData);
  return await newFile.save();
};

export const getAllFiles = async () => await File.find();

export const getFileById = async (id) => await File.findById(id);

export const getFileByName = async (originalname) => {
  try {
    return await File.findOne({ originalname });
  } catch (err) {
    console.error("❌ Error fetching file by name:", err.message);
    throw err;
  }
};
