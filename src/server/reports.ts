import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";

/**
 * Reports and Analytics server functions
 * Aggregated data for dashboards and exports
 */

// ============================================
// INPUT VALIDATORS
// ============================================

const DateRangeInput = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get overall report statistics
 */
export const getReportStats = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const [incidents, messages, subscribers, deliveries] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as count FROM incidents
           WHERE date(created_at) BETWEEN ? AND ?`
        )
        .bind(startDate, endDate)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count FROM messages
           WHERE date(created_at) BETWEEN ? AND ?`
        )
        .bind(startDate, endDate)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) as count FROM subscribers
           WHERE date(created_at) BETWEEN ? AND ?`
        )
        .bind(startDate, endDate)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
           FROM deliveries
           WHERE date(queued_at) BETWEEN ? AND ?`
        )
        .bind(startDate, endDate)
        .first<{ total: number; delivered: number; failed: number }>(),
    ]);

    const deliveryRate =
      deliveries && deliveries.total > 0
        ? Math.round((deliveries.delivered / deliveries.total) * 100)
        : 0;

    return {
      totalIncidents: incidents?.count || 0,
      totalMessages: messages?.count || 0,
      newSubscribers: subscribers?.count || 0,
      deliveryRate,
      dateRange: { startDate, endDate },
    };
  });

/**
 * Get incidents over time (for chart)
 */
export const getIncidentsOverTime = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           date(created_at) as date,
           COUNT(*) as count
         FROM incidents
         WHERE date(created_at) BETWEEN ? AND ?
         GROUP BY date(created_at)
         ORDER BY date(created_at) ASC`
      )
      .bind(startDate, endDate)
      .all<{ date: string; count: number }>();

    return { data: result.results };
  });

/**
 * Get messages by channel (for chart)
 */
export const getMessagesByChannel = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           c.type as channel,
           COUNT(d.id) as count
         FROM deliveries d
         JOIN channels c ON d.channel_id = c.id
         WHERE date(d.queued_at) BETWEEN ? AND ?
         GROUP BY c.type
         ORDER BY count DESC`
      )
      .bind(startDate, endDate)
      .all<{ channel: string; count: number }>();

    return { data: result.results };
  });

/**
 * Get incidents by severity (for chart)
 */
export const getIncidentsBySeverity = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           severity,
           COUNT(*) as count
         FROM incidents
         WHERE date(created_at) BETWEEN ? AND ?
         GROUP BY severity
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END`
      )
      .bind(startDate, endDate)
      .all<{ severity: string; count: number }>();

    return { data: result.results };
  });

/**
 * Get incidents by transit mode (for chart)
 */
export const getIncidentsByMode = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    // Since affected_modes is JSON, we need to parse and count
    const result = await db
      .prepare(
        `SELECT affected_modes FROM incidents
         WHERE date(created_at) BETWEEN ? AND ?
         AND affected_modes IS NOT NULL`
      )
      .bind(startDate, endDate)
      .all<{ affected_modes: string }>();

    // Count modes
    const modeCounts: Record<string, number> = {};
    for (const row of result.results) {
      try {
        const modes = JSON.parse(row.affected_modes) as string[];
        for (const mode of modes) {
          modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    const data_ = Object.entries(modeCounts)
      .map(([mode, count]) => ({ mode, count }))
      .sort((a, b) => b.count - a.count);

    return { data: data_ };
  });

/**
 * Get delivery performance over time
 */
export const getDeliveryPerformance = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           date(queued_at) as date,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
         FROM deliveries
         WHERE date(queued_at) BETWEEN ? AND ?
         GROUP BY date(queued_at)
         ORDER BY date(queued_at) ASC`
      )
      .bind(startDate, endDate)
      .all<{ date: string; total: number; delivered: number; failed: number }>();

    return { data: result.results };
  });

/**
 * Get subscriber growth over time
 */
export const getSubscriberGrowth = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           date(created_at) as date,
           COUNT(*) as new_subscribers,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
         FROM subscribers
         WHERE date(created_at) BETWEEN ? AND ?
         GROUP BY date(created_at)
         ORDER BY date(created_at) ASC`
      )
      .bind(startDate, endDate)
      .all<{ date: string; new_subscribers: number; active: number }>();

    return { data: result.results };
  });

/**
 * Get top affected routes
 */
export const getTopAffectedRoutes = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT affected_routes FROM incidents
         WHERE date(created_at) BETWEEN ? AND ?
         AND affected_routes IS NOT NULL`
      )
      .bind(startDate, endDate)
      .all<{ affected_routes: string }>();

    // Count routes
    const routeCounts: Record<string, number> = {};
    for (const row of result.results) {
      try {
        const routes = JSON.parse(row.affected_routes) as string[];
        for (const route of routes) {
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    const data_ = Object.entries(routeCounts)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { data: data_ };
  });

/**
 * Export incidents data as CSV
 */
export const exportIncidentsCSV = createServerFn({ method: "GET" })
  .inputValidator(DateRangeInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const { startDate, endDate } = data.startDate && data.endDate
      ? { startDate: data.startDate, endDate: data.endDate }
      : getDefaultDateRange();

    const result = await db
      .prepare(
        `SELECT
           id, incident_type, severity, status, title,
           affected_modes, affected_routes, public_message,
           created_at, updated_at
         FROM incidents
         WHERE date(created_at) BETWEEN ? AND ?
         ORDER BY created_at DESC`
      )
      .bind(startDate, endDate)
      .all();

    // Convert to CSV
    const headers = [
      "ID",
      "Type",
      "Severity",
      "Status",
      "Title",
      "Affected Modes",
      "Affected Routes",
      "Public Message",
      "Created At",
      "Updated At",
    ];

    const rows = result.results.map((row: any) => [
      row.id,
      row.incident_type,
      row.severity,
      row.status,
      `"${(row.title || "").replace(/"/g, '""')}"`,
      row.affected_modes || "",
      row.affected_routes || "",
      `"${(row.public_message || "").replace(/"/g, '""')}"`,
      row.created_at,
      row.updated_at,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return { csv, filename: `incidents_${startDate}_${endDate}.csv` };
  });
