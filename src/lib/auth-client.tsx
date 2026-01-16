import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import type { User } from "./auth";
import { signInFn, signOutFn, getSessionFn } from "../server/auth";

/**
 * Client-side authentication hooks and utilities
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseSessionResult {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get current user from server
 */
export async function getSession(): Promise<User | null> {
  try {
    const result = await getSessionFn();
    return result.user || null;
  } catch (error) {
    console.error("Error fetching session:", error);
    return null;
  }
}

/**
 * Sign in with email
 */
export async function signIn(email: string): Promise<User> {
  const result = await signInFn({ data: { email } });
  return result.user;
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await signOutFn();

  // Redirect to login page
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ============================================
// SESSION CONTEXT
// ============================================

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Session Provider component
 * Wraps the app to provide global session state
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedUser = await getSession();
      setUser(fetchedUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch session"));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ user, isLoading, isAuthenticated: !!user, error, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to use session context
 */
export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * Hook to manage session state
 * Uses SessionContext when available for shared state across components
 */
export function useSession(): UseSessionResult {
  const context = useContext(SessionContext);

  // If we have a context, use it (preferred - shared state)
  if (context) {
    return {
      user: context.user,
      isLoading: context.isLoading,
      isAuthenticated: context.isAuthenticated,
      error: context.error,
      refetch: context.refresh,
    };
  }

  // Fallback to standalone state (for cases without provider)
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedUser = await getSession();
      setUser(fetchedUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch session"));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    user,
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
