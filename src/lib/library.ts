import { supabase } from "@/integrations/supabase/client";

export const LIBRARY_BUCKET = "library";

/** Signed URL for a private Library object (1 hour). */
export async function signedUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Uploads a file to the Library bucket under a folder and returns its storage path. */
export async function uploadToLibrary(folder: string, file: File) {
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${crypto.randomUUID()}-${clean}`;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function removeFromLibrary(path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(LIBRARY_BUCKET).remove([path]);
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

/** Copies an image to the clipboard, falling back to copying its URL. */
export async function copyImage(url: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const png = blob.type === "image/png" ? blob : new Blob([blob], { type: blob.type });
    await navigator.clipboard.write([new ClipboardItem({ [png.type]: png })]);
    return "image" as const;
  } catch {
    await navigator.clipboard.writeText(url);
    return "url" as const;
  }
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
