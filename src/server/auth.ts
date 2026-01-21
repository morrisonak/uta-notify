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
    return { user: result.user };
  });

/**
 * Sign out
 */
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await signOut();
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
    return { success: true };
  });
