#!/usr/bin/env bun
/**
 * Set demo passwords for all user accounts
 *
 * Usage:
 *   bun scripts/set-demo-passwords.ts              # Output SQL
 *   bun scripts/set-demo-passwords.ts --execute     # Run against remote D1
 */

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
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    HASH_LENGTH * 8
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${bufferToHex(salt)}:${bufferToHex(hash)}`;
}

// Demo accounts - same password for all: "Demo1234"
const DEMO_PASSWORD = "Demo1234";

const demoUsers = [
  { id: "usr_admin", email: "admin@uta.org", name: "System Administrator", role: "admin" },
  { id: "usr_editor", email: "editor@uta.org", name: "Sarah Mitchell", role: "editor" },
  { id: "usr_operator", email: "operator@uta.org", name: "James Rivera", role: "operator" },
  { id: "usr_viewer", email: "viewer@uta.org", name: "Emily Chen", role: "viewer" },
];

const sql: string[] = [];

for (const user of demoUsers) {
  const hash = await hashPassword(DEMO_PASSWORD);
  sql.push(`UPDATE users SET password_hash = '${hash}' WHERE id = '${user.id}';`);
}

const output = sql.join("\n");

if (process.argv.includes("--execute")) {
  const tmpFile = `/tmp/uta-demo-passwords-${Date.now()}.sql`;
  await Bun.write(tmpFile, output);
  console.log("Setting demo passwords for all users...");
  const proc = Bun.spawn(
    ["npx", "wrangler", "d1", "execute", "uta-notify-db", `--file=${tmpFile}`, "--remote", "--config", "/dev/null"],
    { cwd: import.meta.dir + "/..", stdout: "inherit", stderr: "inherit" }
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  console.log("\nDemo credentials set:");
  for (const user of demoUsers) {
    console.log(`  ${user.role.padEnd(10)} ${user.email.padEnd(20)} ${DEMO_PASSWORD}`);
  }
} else {
  console.log(output);
  console.log("\nDemo credentials:");
  for (const user of demoUsers) {
    console.log(`  ${user.role.padEnd(10)} ${user.email.padEnd(20)} ${DEMO_PASSWORD}`);
  }
}
