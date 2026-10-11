import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getMasterKey(): Buffer {
  const secret = process.env.VAULT_ENCRYPTION_KEY;
  if (!secret) throw new Error("Vault encryption key is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext secret.
 * Returns formatted ciphertext: v1:iv:tag:ciphertext (base64)
 */
export async function encryptSecret(plainText: string): Promise<string> {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string.
 * Gracefully returns original string if not encrypted with v1 prefix.
 */
export async function decryptSecret(cipherText: string): Promise<string> {
  if (!cipherText) return "";
  if (!cipherText.startsWith("v1:")) {
    return cipherText;
  }
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return cipherText;
    const [, ivB64, tagB64, encB64] = parts;
    if (!ivB64 || !tagB64 || !encB64) return cipherText;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const decipher = crypto.createDecipheriv(ALGO, getMasterKey(), iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encB64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt secret:", err);
    return cipherText;
  }
}
