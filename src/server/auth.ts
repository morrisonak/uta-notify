import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  signIn,
  signOut,
  validateSession,
  getSessionToken,
  createSession,
  getUserByEmail,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/auth";

/**
 * Auth server functions
 * Exposes authentication operations as TanStack server functions
 */

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get current session
 */
export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    return { user: null, session: null };
  }

  const result = await validateSession(sessionToken);

  if (!result) {
    return { user: null, session: null };
  }

  return { user: result.user, session: result.session };
});

/**
 * Sign in with email (development mode)
 */
export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const user = await getUserByEmail(data.email);

    if (!user) {
      throw new Error("User not found");
    }

    const session = await createSession(user.id);

    // Return session cookie header for client to set
    return {
      user,
      session,
      setCookie: setSessionCookie(session.id),
    };
  });

/**
 * Sign out
 */
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await signOut();

  return {
    success: true,
    setCookie: clearSessionCookie(),
  };
});
