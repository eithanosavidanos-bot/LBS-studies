// Invite code helpers. Pure functions (secrets are passed in) so they can be
// unit-tested; only server code imports this module.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// 32 characters without look-alikes (no I, O, 0, 1). 256 is a multiple of 32,
// so `byte % 32` is unbiased.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new code such as PMB-7KQ2-XM4D (40 bits of randomness). */
export function generateCode(prefix: string): string {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Uppercases and drops separators, so "pmb 7kq2-xm4d" matches "PMB-7KQ2-XM4D". */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Looks like PREFIX + 8 alphabet characters. Checked before touching the database. */
export function isWellFormed(input: string, prefix: string): boolean {
  const n = normalizeCode(input);
  const p = normalizeCode(prefix);
  if (!n.startsWith(p) || n.length !== p.length + 8) return false;
  return [...n.slice(p.length)].every((c) => CODE_ALPHABET.includes(c));
}

function subkey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

/** HMAC of the normalized code. This is what the database stores and looks up. */
export function hashCode(code: string, secret: string): string {
  return createHmac("sha256", subkey(secret, "invite-hash")).update(normalizeCode(code)).digest("hex");
}

export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Encrypts the plain code so the owner's admin list can show it again, while
 * the database itself never holds it in readable form.
 */
export function encryptCode(code: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subkey(secret, "invite-enc"), iv);
  const ct = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptCode(blob: string, secret: string): string | null {
  try {
    const raw = Buffer.from(blob, "base64");
    const decipher = createDecipheriv("aes-256-gcm", subkey(secret, "invite-enc"), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
