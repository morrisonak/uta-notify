import { getDB, getEnvVar } from "../utils/cloudflare";
import { useSession, clearSession } from "@tanstack/react-start/server";
import type { SessionConfig } from "@tanstack/react-start/server";

/**
 * Authentication module for UTA Notify
 * Uses TanStack Start's built-in encrypted session cookies
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
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionData {
  userId: string;
}

export interface AuthResult {
  user: User;
}

// Session duration: 7 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

// ============================================
// SESSION CONFIG
// ============================================

function getSessionConfig(): SessionConfig {
  return {
    password: getEnvVar("SESSION_SECRET") || "***REDACTED***",
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
 * Create a new user
 */
export async function createUser(
  email: string,
  name: string,
  role: User["role"] = "viewer"
): Promise<User> {
  const db = getDB();
  const id = generateId("usr");

  await db
    .prepare(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(id, email, name, role)
    .run();

  const user = await getUserById(id);
  if (!user) {
    throw new Error("Failed to create user");
  }
  return user;
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

  return { user };
}

/**
 * Get current user if authenticated, null otherwise
 */
export async function getCurrentUser(): Promise<User | null> {
  const sessionData = await getSessionData();

  if (!sessionData?.userId) {
    return null;
  }

  return getUserById(sessionData.userId);
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
 * Sign in as a user
 */
export async function signIn(email: string): Promise<AuthResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  // Update last login
  await updateLastLogin(user.id);

  // Set session
  await setSessionData(user.id);

  return { user };
}

/**
 * Sign out - clear session
 */
export async function signOut(): Promise<void> {
  await clearSessionData();
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
