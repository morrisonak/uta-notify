import { useState, useEffect, useCallback } from "react";
import type { User, Session } from "./auth";

/**
 * Client-side authentication hooks and utilities
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SessionData {
  user: User;
  session: Session;
}

interface UseSessionResult {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// API FUNCTIONS
// ============================================

const getBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

/**
 * Get current session from server
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/auth/session`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error("Failed to fetch session");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching session:", error);
    return null;
  }
}

/**
 * Sign in with email (development mode)
 */
export async function signIn(email: string): Promise<SessionData> {
  const response = await fetch(`${getBaseUrl()}/api/auth/sign-in`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Sign in failed" }));
    throw new Error(error.message || "Sign in failed");
  }

  return response.json();
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const response = await fetch(`${getBaseUrl()}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Sign out failed");
  }

  // Redirect to login page
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * Hook to manage session state
 */
export function useSession(): UseSessionResult {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getSession();
      if (data) {
        setUser(data.user);
        setSession(data.session);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch session"));
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    error,
    refetch,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(): UseSessionResult {
  const sessionData = useSession();

  useEffect(() => {
    if (!sessionData.isLoading && !sessionData.isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [sessionData.isLoading, sessionData.isAuthenticated]);

  return sessionData;
}

/**
 * Hook to check if user has required role
 */
export function useHasRole(requiredRoles: User["role"][]): boolean {
  const { user } = useSession();

  if (!user) return false;
  return requiredRoles.includes(user.role);
}
