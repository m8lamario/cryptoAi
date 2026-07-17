import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_BYTES = 32;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hash a plaintext password using scrypt.
 * Returns a self-describing string: scrypt:N:r:p:<saltHex>:<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
    throw new Error(`Password must be ${MIN_PASSWORD_LEN}-${MAX_PASSWORD_LEN} characters`);
  }
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, rawN, rawR, rawP, saltHex, hashHex] = parts;
  if (!rawN || !rawR || !rawP || !saltHex || !hashHex) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || storedHash.length === 0) {
    return false;
  }
  try {
    const hash = await scryptAsync(password, salt, storedHash.length, {
      N: parseInt(rawN, 10),
      r: parseInt(rawR, 10),
      p: parseInt(rawP, 10),
    });
    return timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically random opaque session token (64 hex chars).
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a session token with SHA-256 for safe storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
