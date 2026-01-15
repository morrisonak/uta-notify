import { getDB, getKV, getEnvVar } from "../utils/cloudflare";
import { getWebRequest } from "vinxi/http";

/**
 * Authentication module for UTA Notify
 * Uses Web Crypto API for password hashing and secure session management
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

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuthResult {
  user: User;
  session: Session;
}

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================
// PASSWORD HASHING (Web Crypto API)
// ============================================

/**
 * Hash a password using SHA-256 with a secret salt
 */
export async function hashPassword(password: string): Promise<string> {
  const secret = getEnvVar("COOKIE_SECRET") || "***REDACTED***";
  const data = new TextEncoder().encode(password + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${random}`;
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
 * Create a new user (for development/testing)
 * In production, users would typically be created via SSO
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
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<Session> {
  const db = getDB();
  const id = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(id, userId, expiresAt, ipAddress || null, userAgent || null)
    .run();

  // Update last login
  await updateLastLogin(userId);

  const session = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(id)
    .first<Session>();

  if (!session) {
    throw new Error("Failed to create session");
  }

  return session;
}

/**
 * Get session by token ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getDB();
  const session = await db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first<Session>();
  return session;
}

/**
 * Validate a session token and return user if valid
 */
export async function validateSession(sessionId: string): Promise<AuthResult | null> {
  const db = getDB();

  // Get session with user data
  const result = await db
    .prepare(
      `SELECT s.*, u.id as user_id, u.email, u.name, u.role, u.permissions,
              u.avatar_url, u.last_login_at, u.created_at as user_created_at,
              u.updated_at as user_updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .bind(sessionId)
    .first<any>();

  if (!result) {
    return null;
  }

  const user: User = {
    id: result.user_id,
    email: result.email,
    name: result.name,
    role: result.role,
    permissions: result.permissions,
    avatar_url: result.avatar_url,
    last_login_at: result.last_login_at,
    created_at: result.user_created_at,
    updated_at: result.user_updated_at,
  };

  const session: Session = {
    id: result.id,
    user_id: result.user_id,
    expires_at: result.expires_at,
    ip_address: result.ip_address,
    user_agent: result.user_agent,
    created_at: result.created_at,
  };

  return { user, session };
}

/**
 * Delete a session (sign out)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDB();
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const db = getDB();
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = getDB();
  const result = await db
    .prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
    .run();
  return result.meta.changes || 0;
}

// ============================================
// COOKIE UTILITIES
// ============================================

const COOKIE_NAME = "uta_session";

/**
 * Get session token from request cookies
 */
export function getSessionToken(): string | null {
  try {
    const request = getWebRequest();
    const cookieHeader = request?.headers?.get?.("cookie") || "";

    const cookies = parseCookies(cookieHeader);
    return cookies[COOKIE_NAME] || null;
  } catch {
    return null;
  }
}

/**
 * Parse cookie string into key-value object
 */
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;

  cookieString.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = rest.join("=");
    }
  });

  return cookies;
}

/**
 * Create a Set-Cookie header value for session
 */
export function setSessionCookie(sessionId: string): string {
  const expires = new Date(Date.now() + SESSION_DURATION_MS).toUTCString();
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

/**
 * Create a Set-Cookie header to clear the session
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ============================================
// AUTH MIDDLEWARE / HELPERS
// ============================================

/**
 * Require authentication - throws if not authenticated
 * Use in server functions that require auth
 */
export async function requireAuth(): Promise<AuthResult> {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    throw new Error("Unauthorized: No session token");
  }

  const result = await validateSession(sessionToken);

  if (!result) {
    throw new Error("Unauthorized: Invalid or expired session");
  }

  return result;
}

/**
 * Get current user if authenticated, null otherwise
 * Use in server functions where auth is optional
 */
export async function getCurrentUser(): Promise<User | null> {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    return null;
  }

  const result = await validateSession(sessionToken);
  return result?.user || null;
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
// SIGN IN / SIGN OUT (for development)
// ============================================

/**
 * Sign in as a user (development mode - mock auth)
 * In production, this would validate against SSO
 */
export async function signIn(email: string): Promise<AuthResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  const session = await createSession(user.id);

  return { user, session };
}

/**
 * Sign out - delete current session
 */
export async function signOut(): Promise<void> {
  const sessionToken = getSessionToken();

  if (sessionToken) {
    await deleteSession(sessionToken);
  }
}
