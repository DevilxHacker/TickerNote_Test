import {BUCKET_NAME, BUCKET_REGION, ACCESS_KEY, SECRET_KEY} from "../config/serverConfig.js"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: BUCKET_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

export async function uploadBufferToS3(buffer, filename) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,                // e.g., "summary-report.pdf"
    Body: buffer,                 // your pdfBuffer
    ContentType: "application/pdf",
  };

  try {
    await s3.send(new PutObjectCommand(params));
    // return `https://${BUCKET_NAME}.s3.${BUCKET_REGION}.amazonaws.com/${filename}`;
    return buffer.length; 
  } catch (err) {
    console.error("❌ S3 Upload Error:", err);
    throw err;
  }
}


export const getPresignedUrl = async (s3Key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
};