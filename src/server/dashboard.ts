import { createServerFn } from "@tanstack/react-start";
import { getDB, getBucket } from "../utils/cloudflare";
import { requirePermission } from "../lib/auth";

/**
 * Dashboard server functions
 * Statistics and overview data for the dashboard
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DashboardStats {
  activeIncidents: number;
  messagesToday: number;
  deliveryRate: number | null;
  totalSubscribers: number;
}

export interface RecentActivity {
  id: string;
  type: "incident" | "message" | "subscriber" | "system";
  action: string;
  description: string;
  timestamp: string;
  actor?: string;
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  affected_modes: string | null;
}

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get dashboard statistics
 */
export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");

  let db: D1Database;
  try {
    db = getDB();
  } catch (e) {
    console.error("Database not available:", e);
    return {
      activeIncidents: 0,
      messagesToday: 0,
      deliveryRate: null,
      totalSubscribers: 0,
    };
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // Run all queries in parallel for better performance
    const [activeResult, messagesResult, deliveryResult, subscriberResult] = await Promise.all([
      // Get active incidents count
      db
        .prepare(
          `SELECT COUNT(*) as count FROM incidents WHERE status IN ('active', 'updated')`
        )
        .first<{ count: number }>(),

      // Get messages sent today
      db
        .prepare(
          `SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?`
        )
        .bind(today)
        .first<{ count: number }>(),

      // Get delivery stats
      db
        .prepare(
          `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
           FROM deliveries
           WHERE date(queued_at) = ?`
        )
        .bind(today)
        .first<{ total: number; delivered: number }>(),

      // Get subscriber count
      db
        .prepare(
          `SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'`
        )
        .first<{ count: number }>(),
    ]);

    const deliveryRate =
      deliveryResult && deliveryResult.total > 0
        ? Math.round((deliveryResult.delivered / deliveryResult.total) * 100)
        : null;

    return {
      activeIncidents: activeResult?.count || 0,
      messagesToday: messagesResult?.count || 0,
      deliveryRate,
      totalSubscribers: subscriberResult?.count || 0,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      activeIncidents: 0,
      messagesToday: 0,
      deliveryRate: null,
      totalSubscribers: 0,
    };
  }
});

/**
 * Get recent activity for the dashboard
 */
export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");
  const db = getDB();

  try {
    // Get recent incidents
    const incidents = await db
      .prepare(
        `SELECT id, title, status, created_at, created_by
         FROM incidents
         ORDER BY updated_at DESC
         LIMIT 5`
      )
      .all<{
        id: string;
        title: string;
        status: string;
        created_at: string;
        created_by: string;
      }>();

    // Get recent messages
    const messages = await db
      .prepare(
        `SELECT m.id, m.created_at, m.created_by, i.title as incident_title
         FROM messages m
         JOIN incidents i ON m.incident_id = i.id
         ORDER BY m.created_at DESC
         LIMIT 5`
      )
      .all<{
        id: string;
        created_at: string;
        created_by: string;
        incident_title: string;
      }>();

    // Combine and sort activities
    const activities: RecentActivity[] = [];

    for (const incident of incidents.results) {
      activities.push({
        id: incident.id,
        type: "incident",
        action: incident.status === "draft" ? "created" : "updated",
        description: `Incident: ${incident.title}`,
        timestamp: incident.created_at,
        actor: incident.created_by,
      });
    }

    for (const message of messages.results) {
      activities.push({
        id: message.id,
        type: "message",
        action: "sent",
        description: `Message for: ${message.incident_title}`,
        timestamp: message.created_at,
        actor: message.created_by,
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return { activities: activities.slice(0, 10) };
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return { activities: [] };
  }
});

/**
 * Get active incidents for dashboard display
 */
export const getActiveIncidentsSummary = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");
  const db = getDB();

  try {
    const result = await db
      .prepare(
        `SELECT id, title, severity, status, created_at, affected_modes
         FROM incidents
         WHERE status IN ('active', 'updated')
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           created_at DESC
         LIMIT 5`
      )
      .all<IncidentSummary>();

    return { incidents: result.results };
  } catch (error) {
    console.error("Error fetching active incidents:", error);
    return { incidents: [] };
  }
});

/**
 * Get channel health status
 */
export const getChannelHealth = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");
  const db = getDB();

  try {
    const channels = await db
      .prepare(
        `SELECT id, type, name, enabled, health_status, last_health_check
         FROM channels
         WHERE enabled = 1
         ORDER BY type`
      )
      .all<{
        id: string;
        type: string;
        name: string;
        enabled: number;
        health_status: string | null;
        last_health_check: string | null;
      }>();

    return { channels: channels.results };
  } catch (error) {
    console.error("Error fetching channel health:", error);
    return { channels: [] };
  }
});

/**
 * Get incidents by severity for charts
 */
export const getIncidentsBySeverity = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");
  const db = getDB();

  try {
    const result = await db
      .prepare(
        `SELECT severity, COUNT(*) as count
         FROM incidents
         WHERE status NOT IN ('archived')
         GROUP BY severity
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END`
      )
      .all<{ severity: string; count: number }>();

    return { data: result.results };
  } catch (error) {
    console.error("Error fetching incidents by severity:", error);
    return { data: [] };
  }
});

/**
 * Get messages by channel for charts
 */
export const getMessagesByChannel = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("messages.view");
  const db = getDB();

  try {
    const result = await db
      .prepare(
        `SELECT c.type as channel, COUNT(d.id) as count
         FROM deliveries d
         JOIN channels c ON d.channel_id = c.id
         WHERE d.status = 'delivered'
         GROUP BY c.type
         ORDER BY count DESC`
      )
      .all<{ channel: string; count: number }>();

    return { data: result.results };
  } catch (error) {
    console.error("Error fetching messages by channel:", error);
    return { data: [] };
  }
});

/**
 * Get storage usage from R2
 */
export const getStorageUsage = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("settings.view");
  try {
    const bucket = getBucket();
    const objects = await bucket.list({ prefix: "attachments/" });

    let totalSize = 0;
    let fileCount = 0;

    for (const obj of objects.objects) {
      totalSize += obj.size;
      fileCount++;
    }

    return {
      totalSize,
      fileCount,
      formattedSize: formatBytes(totalSize),
    };
  } catch (error) {
    console.error("Error fetching storage usage:", error);
    return {
      totalSize: 0,
      fileCount: 0,
      formattedSize: "0 B",
    };
  }
});

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
