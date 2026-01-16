import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import {
  signIn,
  signOut,
  getCurrentUser,
} from "../lib/auth";

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
 * Sign in with email
 */
export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const result = await signIn(data.email);
    return { user: result.user };
  });

/**
 * Sign out
 */
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await signOut();
  return { success: true };
});
