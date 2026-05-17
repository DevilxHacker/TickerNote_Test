import { BUCKET_NAME, SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../config/serverConfig.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function uploadBufferToS3(buffer, filename) {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: "application/pdf",
        upsert: true,               
      });

    if (error) throw error;

    return buffer.length;         
  } catch (err) {
    console.error("Supabase Upload Error:", err);
    throw err;
  }
}

export const getPresignedUrl = async (s3Key, expiresIn = 3600) => {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(s3Key, expiresIn);

  if (error) throw error;

  return data.signedUrl;         
};