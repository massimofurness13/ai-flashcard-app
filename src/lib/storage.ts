import { createClient } from "@supabase/supabase-js";

const BUCKET = "card-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

/**
 * Upload a card image to Supabase Storage.
 * Uses service role to bypass RLS — auth is validated in the API route.
 * Returns the public URL of the uploaded image.
 */
export async function uploadCardImage(
  userId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Invalid file type. Allowed: JPG, PNG, WebP, GIF" };
  }

  if (file.size > MAX_SIZE) {
    return { error: "File too large. Maximum size is 5MB" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { error: `Upload failed: ${error.message}` };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl };
}

/**
 * Delete a card image from Supabase Storage.
 */
export async function deleteCardImage(url: string): Promise<void> {
  if (!url || !url.includes(BUCKET)) return;

  const supabase = getStorageClient();

  // Extract path from URL: .../card-images/userId/filename.ext
  const pathMatch = url.split(`${BUCKET}/`)[1];
  if (!pathMatch) return;

  await supabase.storage.from(BUCKET).remove([pathMatch]);
}
