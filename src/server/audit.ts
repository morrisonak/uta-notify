import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { getCurrentUser } from "../lib/auth";

/**
 * Audit logging server functions
 * Records all significant user and system actions
 */

// ============================================
// TYPES
// ============================================

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "resolve"
  | "archive"
  | "send"
  | "login"
  | "logout"
  | "view"
  | "export"
  | "import";

export type ResourceType =
  | "incident"
  | "message"
  | "template"
  | "subscriber"
  | "user"
  | "settings"
  | "channel"
  | "automation";

export type ActorType = "user" | "system" | "automation" | "api";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_type: ActorType;
  actor_name: string | null;
  action: AuditAction;
  resource_type: ResourceType;
  resource_id: string | null;
  resource_name: string | null;
  details: string | null;
  changes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `aud_${timestamp}${random}`;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

// ============================================
// CORE AUDIT FUNCTION
// ============================================

interface LogAuditParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string | null;
  resourceName?: string | null;
  details?: Record<string, unknown>;
  changes?: Record<string, { old: unknown; new: unknown }>;
  actorType?: ActorType;
  actorId?: string | null;
  actorName?: string | null;
}

/**
 * Log an audit entry - call this from other server functions
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const db = getDB();
    const id = generateId();
    const requestId = generateRequestId();

    // Try to get current user if not specified
    let actorId = params.actorId;
    let actorName = params.actorName;
    let actorType = params.actorType || "user";

    if (!actorId && actorType === "user") {
      try {
        const user = await getCurrentUser();
        if (user) {
          actorId = user.id;
          actorName = user.name;
        }
      } catch {
        // No user context, continue without
      }
    }

    // Request info not available in server functions
    const ipAddress: string | null = null;
    const userAgent: string | null = null;

    await db
      .prepare(
        `INSERT INTO audit_log (
          id, actor_id, actor_type, actor_name, action, resource_type,
          resource_id, resource_name, details, changes, ip_address,
          user_agent, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        id,
        actorId || null,
        actorType,
        actorName || null,
        params.action,
        params.resourceType,
        params.resourceId || null,
        params.resourceName || null,
        params.details ? JSON.stringify(params.details) : null,
        params.changes ? JSON.stringify(params.changes) : null,
        ipAddress,
        userAgent,
        requestId
      )
      .run();
  } catch (error) {
    // Don't throw on audit failures - log and continue
    console.error("Audit logging failed:", error);
  }
}

// ============================================
// INPUT VALIDATORS
// ============================================

const GetAuditLogsInput = z.object({
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const GetAuditLogInput = z.object({
  id: z.string(),
});

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = createServerFn({ method: "GET" })
  .inputValidator(GetAuditLogsInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { resourceType, resourceId, actorId, action, startDate, endDate, limit, offset } = data;

    let query = "SELECT * FROM audit_log WHERE 1=1";
    const params: (string | number)[] = [];

    if (resourceType) {
      query += " AND resource_type = ?";
      params.push(resourceType);
    }

    if (resourceId) {
      query += " AND resource_id = ?";
      params.push(resourceId);
    }

    if (actorId) {
      query += " AND actor_id = ?";
      params.push(actorId);
    }

    if (action) {
      query += " AND action = ?";
      params.push(action);
    }

    if (startDate) {
      query += " AND created_at >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND created_at <= ?";
      params.push(endDate);
    }

    // Get total count
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
    const countResult = await db
      .prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>();

    // Get paginated results
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await db
      .prepare(query)
      .bind(...params)
      .all<AuditLogEntry>();

    return {
      logs: result.results || [],
      total: countResult?.count || 0,
      limit,
      offset,
    };
  });

/**
 * Get a single audit log entry
 */
export const getAuditLog = createServerFn({ method: "GET" })
  .inputValidator(GetAuditLogInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const log = await db
      .prepare("SELECT * FROM audit_log WHERE id = ?")
      .bind(data.id)
      .first<AuditLogEntry>();

    if (!log) {
      throw new Error("Audit log entry not found");
    }

    return { log };
  });

/**
 * Get audit log stats
 */
export const getAuditStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const db = getDB();

    // Get counts by action type (last 7 days)
    const actionStats = await db
      .prepare(
        `SELECT action, COUNT(*) as count
         FROM audit_log
         WHERE created_at >= datetime('now', '-7 days')
         GROUP BY action
         ORDER BY count DESC`
      )
      .all<{ action: string; count: number }>();

    // Get counts by resource type (last 7 days)
    const resourceStats = await db
      .prepare(
        `SELECT resource_type, COUNT(*) as count
         FROM audit_log
         WHERE created_at >= datetime('now', '-7 days')
         GROUP BY resource_type
         ORDER BY count DESC`
      )
      .all<{ resource_type: string; count: number }>();

    // Get most active users (last 7 days)
    const userStats = await db
      .prepare(
        `SELECT actor_id, actor_name, COUNT(*) as count
         FROM audit_log
         WHERE actor_type = 'user' AND created_at >= datetime('now', '-7 days')
         GROUP BY actor_id
         ORDER BY count DESC
         LIMIT 10`
      )
      .all<{ actor_id: string; actor_name: string; count: number }>();

    // Get total count
    const totalResult = await db
      .prepare("SELECT COUNT(*) as count FROM audit_log")
      .first<{ count: number }>();

    // Get today's count
    const todayResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM audit_log
         WHERE created_at >= datetime('now', 'start of day')`
      )
      .first<{ count: number }>();

    return {
      total: totalResult?.count || 0,
      today: todayResult?.count || 0,
      byAction: actionStats.results || [],
      byResource: resourceStats.results || [],
      topUsers: userStats.results || [],
    };
  }
);

/**
 * Get audit logs for a specific resource
 */
export const getResourceAuditHistory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ resourceType: z.string(), resourceId: z.string() }))
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db
      .prepare(
        `SELECT * FROM audit_log
         WHERE resource_type = ? AND resource_id = ?
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .bind(data.resourceType, data.resourceId)
      .all<AuditLogEntry>();

    return { logs: result.results || [] };
  });
