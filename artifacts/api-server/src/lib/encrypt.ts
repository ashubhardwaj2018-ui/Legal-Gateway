/**
 * AES-256-CBC encryption for storing API secrets in the database.
 * The encryption key is derived from SESSION_SECRET so secrets are
 * never stored in plaintext. Rotating SESSION_SECRET invalidates
 * all stored ciphertexts — re-enter keys after rotation.
 */
import crypto from "crypto";

const raw = process.env.SESSION_SECRET ?? "dev-key-replace-in-production-via-SESSION_SECRET";
const KEY = crypto.createHash("sha256").update(raw).digest(); // 32 bytes

/**
 * Encrypt a config object (all values are strings).
 * Returns "" for empty input.
 */
export function encryptConfig(obj: Record<string, string>): string {
  if (!obj || Object.keys(obj).length === 0) return "";
  const text = JSON.stringify(obj);
  const iv   = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  const enc  = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

/**
 * Decrypt a config blob. Returns {} on failure or empty input.
 */
export function decryptConfig(encStr: string): Record<string, string> {
  if (!encStr || !encStr.includes(":")) return {};
  try {
    const colonIdx = encStr.indexOf(":");
    const iv  = Buffer.from(encStr.slice(0, colonIdx), "hex");
    const enc = Buffer.from(encStr.slice(colonIdx + 1), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);
    const text = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return {};
  }
}
