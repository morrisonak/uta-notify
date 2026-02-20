import { getDB, getEnvVar } from "../utils/cloudflare";
import { useSession, clearSession } from "@tanstack/react-start/server";
import type { SessionConfig } from "@tanstack/react-start/server";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

/**
 * Authentication module for UTA Notify
 * Uses TanStack Start's built-in encrypted session cookies
 * Supports email/password authentication with PBKDF2 hashing
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "operator" | "viewer";
  permissions: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** User without sensitive fields (for client-side use) */
export type SafeUser = Omit<User, "password_hash">;

export interface SessionData {
  userId: string;
}

export interface AuthResult {
  user: SafeUser;
}

// Session duration: 7 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

// ============================================
// SESSION CONFIG
// ============================================

function getSessionConfig(): SessionConfig {
  return {
    password: getEnvVar("SESSION_SECRET") || (() => { throw new Error("SESSION_SECRET environment variable is required"); })(),
    cookieName: "uta_session",
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDB();
  const user = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<User>();
  return user;
}

/**
 * Get a user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const db = getDB();
  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<User>();
  return user;
}

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Create a new user with password
 */
export async function createUser(
  email: string,
  name: string,
  password: string,
  role: User["role"] = "viewer"
): Promise<SafeUser> {
  // Validate password strength
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const db = getDB();
  const id = generateId("usr");
  const passwordHash = await hashPassword(password);

  await db
    .prepare(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(id, email, name, role, passwordHash)
    .run();

  const user = await getUserById(id);
  if (!user) {
    throw new Error("Failed to create user");
  }
  return toSafeUser(user);
}

/**
 * Remove sensitive fields from user object
 */
export function toSafeUser(user: User): SafeUser {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Update user's last login timestamp
 */
async function updateLastLogin(userId: string): Promise<void> {
  const db = getDB();
  await db
    .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
    .bind(userId)
    .run();
}

// ============================================
// SESSION MANAGEMENT (TanStack Start)
// ============================================

/**
 * Get current session data
 */
export async function getSessionData(): Promise<SessionData | null> {
  try {
    const session = await useSession<SessionData>(getSessionConfig());
    if (session.data.userId) {
      return { userId: session.data.userId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set session data (sign in)
 */
export async function setSessionData(userId: string): Promise<void> {
  const session = await useSession<SessionData>(getSessionConfig());
  await session.update({ userId });
}

/**
 * Clear session data (sign out)
 */
export async function clearSessionData(): Promise<void> {
  await clearSession(getSessionConfig());
}

// ============================================
// AUTH MIDDLEWARE / HELPERS
// ============================================

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const sessionData = await getSessionData();

  if (!sessionData?.userId) {
    throw new Error("Unauthorized: No session");
  }

  const user = await getUserById(sessionData.userId);

  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  return { user: toSafeUser(user) };
}

/**
 * Get current user if authenticated, null otherwise
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const sessionData = await getSessionData();

  if (!sessionData?.userId) {
    return null;
  }

  const user = await getUserById(sessionData.userId);
  return user ? toSafeUser(user) : null;
}

/**
 * Check if user has required role
 */
export function hasRole(user: User, requiredRoles: User["role"][]): boolean {
  return requiredRoles.includes(user.role);
}

/**
 * Require specific role - throws if user doesn't have role
 */
export async function requireRole(requiredRoles: User["role"][]): Promise<AuthResult> {
  const auth = await requireAuth();

  if (!hasRole(auth.user, requiredRoles)) {
    throw new Error(`Forbidden: Requires one of roles: ${requiredRoles.join(", ")}`);
  }

  return auth;
}

// ============================================
// SIGN IN / SIGN OUT
// ============================================

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    // Use generic message to prevent user enumeration
    throw new Error("Invalid email or password");
  }

  // Check if user has a password set
  if (!user.password_hash) {
    throw new Error("Password not set for this account. Please contact an administrator.");
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Update last login
  await updateLastLogin(user.id);

  // Set session
  await setSessionData(user.id);

  return { user: toSafeUser(user) };
}

/**
 * Sign out - clear session
 */
export async function signOut(): Promise<void> {
  await clearSessionData();
}

/**
 * Change a user's password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Verify current password if user has one set
  if (user.password_hash) {
    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }
  }

  // Validate new password strength
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  // Hash and store new password
  const newHash = await hashPassword(newPassword);
  const db = getDB();
  await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newHash, userId)
    .run();
}

/**
 * Set password for a user (admin function, doesn't require current password)
 */
export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  // Validate new password strength
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  // Hash and store new password
  const newHash = await hashPassword(newPassword);
  const db = getDB();
  const result = await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newHash, userId)
    .run();

  if (!result.meta.changes) {
    throw new Error("User not found");
  }
}

/**
 * Check if a user has a password set
 */
export async function hasPasswordSet(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  return user ? !!user.password_hash : false;
}

// ============================================
// PERMISSION-BASED AUTH
// ============================================

import { hasPermission, hasAllPermissions, hasAnyPermission, type Permission } from "./permissions";

/**
 * Require a specific permission - throws if user doesn't have it
 */
export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const auth = await requireAuth();

  if (!hasPermission(auth.user, permission)) {
    throw new Error(`Forbidden: Missing permission '${permission}'`);
  }

  return auth;
}

/**
 * Require ALL of the specified permissions
 */
export async function requireAllPermissions(permissions: Permission[]): Promise<AuthResult> {
  const auth = await requireAuth();

  if (!hasAllPermissions(auth.user, permissions)) {
    const missing = permissions.filter((p) => !hasPermission(auth.user, p));
    throw new Error(`Forbidden: Missing permissions '${missing.join("', '")}'`);
  }

  return auth;
}

/**
 * Require ANY of the specified permissions
 */
export async function requireAnyPermission(permissions: Permission[]): Promise<AuthResult> {
  const auth = await requireAuth();

  if (!hasAnyPermission(auth.user, permissions)) {
    throw new Error(`Forbidden: Requires one of permissions '${permissions.join("', '")}'`);
  }

  return auth;
}
