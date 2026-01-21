import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import {
  signIn,
  signOut,
  getCurrentUser,
  changePassword,
  setUserPassword,
  requireAuth,
} from "../lib/auth";
import { hasPermission, type Permission } from "../lib/permissions";
import { logAudit } from "./audit";
import { getDB } from "../utils/cloudflare";

/**
 * Auth server functions
 * Uses TanStack Start's built-in encrypted session cookies
 */

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get current session/user
 */
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  return { user };
});

/**
 * Check if user is authenticated - for route protection
 * Throws redirect to /login if not authenticated
 */
export const requireAuthFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();

  if (!user) {
    throw redirect({ to: "/login" });
  }

  return { user };
});

/**
 * Check if user has specific permission - for route protection
 * Throws redirect to /login if not authenticated, or throws error if not authorized
 */
export const requirePermissionFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ permission: z.string() }))
  .handler(async ({ data }) => {
    const user = await getCurrentUser();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!hasPermission(user, data.permission as Permission)) {
      throw new Error(`Forbidden: Missing permission '${data.permission}'`);
    }

    return { user };
  });

/**
 * Sign in with email and password
 */
export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password is required"),
  }))
  .handler(async ({ data }) => {
    const result = await signIn(data.email, data.password);

    // Log successful login
    await logAudit({
      action: "login",
      resourceType: "user",
      resourceId: result.user.id,
      resourceName: result.user.name,
      actorId: result.user.id,
      actorName: result.user.name,
      details: { email: data.email },
    });

    return { user: result.user };
  });

/**
 * Sign out
 */
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  // Get user before sign out to log their identity
  const user = await getCurrentUser();

  await signOut();

  // Log logout
  if (user) {
    await logAudit({
      action: "logout",
      resourceType: "user",
      resourceId: user.id,
      resourceName: user.name,
      actorId: user.id,
      actorName: user.name,
    });
  }

  return { success: true };
});

/**
 * Change current user's password
 */
export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }))
  .handler(async ({ data }) => {
    const auth = await requireAuth();
    await changePassword(auth.user.id, data.currentPassword, data.newPassword);

    // Log password change
    await logAudit({
      action: "update",
      resourceType: "user",
      resourceId: auth.user.id,
      resourceName: auth.user.name,
      details: { field: "password", changedBy: "self" },
    });

    return { success: true };
  });

/**
 * Set password for a user (admin only)
 */
export const setUserPasswordFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    userId: z.string(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }))
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    if (!hasPermission(user, "users.edit" as Permission)) {
      throw new Error("Forbidden: Missing permission to edit users");
    }
    await setUserPassword(data.userId, data.newPassword);

    // Get target user info for audit log
    const db = getDB();
    const targetUser = await db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .bind(data.userId)
      .first<{ id: string; name: string; email: string }>();

    // Log admin password reset
    await logAudit({
      action: "update",
      resourceType: "user",
      resourceId: data.userId,
      resourceName: targetUser?.name || data.userId,
      details: {
        field: "password",
        changedBy: "admin",
        targetEmail: targetUser?.email,
      },
    });

    return { success: true };
  });
