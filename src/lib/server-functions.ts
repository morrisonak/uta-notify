import { createServerFn } from "@tanstack/react-start";
import { getEvent } from "vinxi/http";
import { z } from "zod";

// ============================================
// TYPE DEFINITIONS
// ============================================

// Cloudflare context is available via request event
interface CloudflareEnv {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  DELIVERY_QUEUE: Queue;
  KV: KVNamespace;
  ENVIRONMENT: string;
}

interface CloudflareContext {
  env: CloudflareEnv;
  ctx: ExecutionContext;
  cf: IncomingRequestCfProperties;
}

// Helper to get Cloudflare env from the current request
function getCloudflareEnv(): CloudflareEnv | null {
  try {
    const event = getEvent();
    // The Cloudflare plugin attaches env to event.context.cloudflare.env
    const cf = (event as any)?.context?.cloudflare as CloudflareContext | undefined;
    if (cf?.env) {
      return cf.env;
    }
    // Fallback: check if env is directly on context
    const directEnv = (event as any)?.context?.env as CloudflareEnv | undefined;
    if (directEnv?.DB) {
      return directEnv;
    }
    console.log("Cloudflare context structure:", JSON.stringify(Object.keys((event as any)?.context || {})));
    return null;
  } catch (e) {
    console.error("Error getting Cloudflare env:", e);
    return null;
  }
}

// ============================================
// INCIDENT SERVER FUNCTIONS
// ============================================

const CreateIncidentInput = z.object({
  title: z.string().min(1).max(200),
  incidentType: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedModes: z.array(z.string()).optional(),
  affectedRoutes: z.array(z.string()).optional(),
  publicMessage: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const createIncident = createServerFn({ method: "POST" })
  .inputValidator(CreateIncidentInput)
  .handler(async ({ data }) => {
    const env = getCloudflareEnv();
    if (!env?.DB) {
      throw new Error("Database not available");
    }

    const id = `inc_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

    const result = await env.DB.prepare(
      `INSERT INTO incidents (
        id, incident_type, severity, status, title,
        affected_modes, affected_routes, public_message, internal_notes,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        id,
        data.incidentType,
        data.severity,
        "draft",
        data.title,
        data.affectedModes ? JSON.stringify(data.affectedModes) : null,
        data.affectedRoutes ? JSON.stringify(data.affectedRoutes) : null,
        data.publicMessage || null,
        data.internalNotes || null,
        "usr_admin" // TODO: Get from session
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to create incident");
    }

    return { success: true, id };
  });

const GetIncidentsInput = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  limit: z.number().optional(),
});

// Define incident type for return value
interface IncidentRow {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  affected_modes: string | null;
  affected_routes: string | null;
  public_message: string | null;
  internal_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const getIncidents = createServerFn({ method: "GET" })
  .inputValidator(GetIncidentsInput)
  .handler(async ({ data }) => {
    const env = getCloudflareEnv();
    if (!env?.DB) {
      throw new Error("Database not available");
    }

    let query = `SELECT * FROM incidents WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.status) {
      query += ` AND status = ?`;
      params.push(data.status);
    }

    if (data.severity) {
      query += ` AND severity = ?`;
      params.push(data.severity);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(data.limit || 50);

    const result = await env.DB.prepare(query).bind(...params).all<IncidentRow>();

    return { incidents: result.results };
  });

const GetIncidentInput = z.object({
  id: z.string(),
});

export const getIncident = createServerFn({ method: "GET" })
  .inputValidator(GetIncidentInput)
  .handler(async ({ data }) => {
    const env = getCloudflareEnv();
    if (!env?.DB) {
      throw new Error("Database not available");
    }

    const result = await env.DB.prepare(
      `SELECT * FROM incidents WHERE id = ?`
    )
      .bind(data.id)
      .first<IncidentRow>();

    if (!result) {
      throw new Error("Incident not found");
    }

    return { incident: result };
  });

// ============================================
// DASHBOARD STATS
// ============================================

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = getCloudflareEnv();
    if (!env?.DB) {
      // Return mock data if no database
      return {
        activeIncidents: 0,
        messagesToday: 0,
        deliveryRate: null as number | null,
        totalSubscribers: 0,
      };
    }

    try {
      // Get active incidents count
      const activeResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM incidents WHERE status IN ('active', 'updated')`
      ).first<{ count: number }>();

      // Get messages sent today
      const today = new Date().toISOString().split("T")[0];
      const messagesResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?`
      )
        .bind(today)
        .first<{ count: number }>();

      // Get delivery stats
      const deliveryResult = await env.DB.prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
         FROM deliveries
         WHERE date(queued_at) = ?`
      )
        .bind(today)
        .first<{ total: number; delivered: number }>();

      // Get subscriber count
      const subscriberResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'`
      ).first<{ count: number }>();

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
        deliveryRate: null as number | null,
        totalSubscribers: 0,
      };
    }
  }
);
