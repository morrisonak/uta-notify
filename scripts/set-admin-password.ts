#!/usr/bin/env bun
/**
 * Script to set a password for the admin user
 * Usage: bun scripts/set-admin-password.ts <password>
 */

// PBKDF2 configuration (must match src/lib/password.ts)
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    HASH_LENGTH * 8
  );

  return derivedBits;
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${bufferToHex(salt)}:${bufferToHex(hash)}`;
}

// Main
const password = process.argv[2];
if (!password) {
  console.error("Usage: bun scripts/set-admin-password.ts <password>");
  process.exit(1);
}

const hash = await hashPassword(password);
console.log("\nGenerated password hash:");
console.log(hash);
console.log("\nRun this SQL command to update the admin user:");
console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@uta.org';`);
