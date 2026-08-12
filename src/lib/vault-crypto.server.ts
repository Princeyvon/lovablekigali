const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey() {
  const raw = process.env["VAULT_ENCRYPTION_KEY"];
  if (!raw) throw new Error("VAULT_ENCRYPTION_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptSecret(plain: string) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(payload: string) {
  if (!payload.startsWith("v1.")) return "";
  const [, ivPart, ctPart] = payload.split(".");
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivPart!) },
    key,
    unb64(ctPart!),
  );
  return dec.decode(pt);
}
