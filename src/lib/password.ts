/**
 * Password hashing utilities using Web Crypto API
 * Compatible with Cloudflare Workers runtime
 */

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // bytes
const HASH_LENGTH = 32; // bytes
const ALGORITHM = "PBKDF2";
const HASH_ALGORITHM = "SHA-256";

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive a key from password and salt using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as a key
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    ALGORITHM,
    false,
    ["deriveBits"]
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    baseKey,
    HASH_LENGTH * 8 // bits
  );

  return derivedBits;
}

/**
 * Hash a password with a new random salt
 * Returns format: "salt:hash" (both hex encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${bufferToHex(salt)}:${bufferToHex(hash)}`;
}

/**
 * Verify a password against a stored hash
 * @param password - The plaintext password to verify
 * @param storedHash - The stored hash in format "salt:hash"
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = storedHash.split(":");
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = hexToBuffer(saltHex);
    const expectedHash = hexToBuffer(hashHex);
    const actualHash = await deriveKey(password, salt);

    // Constant-time comparison to prevent timing attacks
    const actualBytes = new Uint8Array(actualHash);
    if (actualBytes.length !== expectedHash.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < actualBytes.length; i++) {
      result |= actualBytes[i] ^ expectedHash[i];
    }
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 * Returns null if valid, or an error message if invalid
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (password.length > 128) {
    return "Password must be less than 128 characters";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
}

/**
 * Generate a temporary password (for initial user creation or reset)
 */
export function generateTemporaryPassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const array = crypto.getRandomValues(new Uint8Array(12));
  let password = "";
  for (let i = 0; i < array.length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}
