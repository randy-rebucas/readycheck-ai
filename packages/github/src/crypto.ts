import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets stored in the database (GitHub tokens). The key
 * comes from READYCHECK_ENCRYPTION_KEY; the API (encrypts) and the worker
 * (decrypts) must share it. Output: base64 of iv(12) | tag(16) | ciphertext.
 */
function key(): Buffer {
  const value = process.env.READYCHECK_ENCRYPTION_KEY;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("READYCHECK_ENCRYPTION_KEY must be set in production.");
    }
    return createHash("sha256").update("dev-insecure-encryption-key").digest();
  }
  // Any string works; hashing gives a fixed 32-byte key.
  return createHash("sha256").update(value).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(sealed: string): string {
  const raw = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
