import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";

// Helper to get D1 database from Cloudflare env
function getDB(): D1Database {
  const typedEnv = env as Env;
  if (!typedEnv.DB) {
    throw new Error("Database binding not found");
  }
  return typedEnv.DB;
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
    const db = getDB();

    const id = `inc_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

    const result = await db.prepare(
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
        "usr_admin"
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
    const db = getDB();

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

    const result = await db.prepare(query).bind(...params).all<IncidentRow>();

    return { incidents: result.results };
  });

const GetIncidentInput = z.object({
  id: z.string(),
});

export const getIncident = createServerFn({ method: "GET" })
  .inputValidator(GetIncidentInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db.prepare(
      `SELECT * FROM incidents WHERE id = ?`
    )
      .bind(data.id)
      .first<IncidentRow>();

    if (!result) {
      throw new Error("Incident not found");
    }

    return { incident: result };
  });

const UpdateIncidentInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["draft", "active", "updated", "resolved", "archived"]).optional(),
  affectedModes: z.array(z.string()).optional(),
  affectedRoutes: z.array(z.string()).optional(),
  publicMessage: z.string().optional(),
  internalNotes: z.string().optional(),
  estimatedResolution: z.string().optional(),
});

export const updateIncident = createServerFn({ method: "POST" })
  .inputValidator(UpdateIncidentInput)
  .handler(async ({ data }) => {
    const db = getDB();

    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      params.push(data.title);
    }
    if (data.severity !== undefined) {
      updates.push("severity = ?");
      params.push(data.severity);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);

      // Set resolved_at if status is resolved
      if (data.status === "resolved") {
        updates.push("resolved_at = datetime('now')");
      }
      // Set archived_at if status is archived
      if (data.status === "archived") {
        updates.push("archived_at = datetime('now')");
      }
    }
    if (data.affectedModes !== undefined) {
      updates.push("affected_modes = ?");
      params.push(JSON.stringify(data.affectedModes));
    }
    if (data.affectedRoutes !== undefined) {
      updates.push("affected_routes = ?");
      params.push(JSON.stringify(data.affectedRoutes));
    }
    if (data.publicMessage !== undefined) {
      updates.push("public_message = ?");
      params.push(data.publicMessage);
    }
    if (data.internalNotes !== undefined) {
      updates.push("internal_notes = ?");
      params.push(data.internalNotes);
    }
    if (data.estimatedResolution !== undefined) {
      updates.push("estimated_resolution = ?");
      params.push(data.estimatedResolution);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push("updated_at = datetime('now')");

    params.push(data.id);

    const query = `UPDATE incidents SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update incident");
    }

    return { success: true };
  });

const DeleteIncidentInput = z.object({
  id: z.string(),
});

export const deleteIncident = createServerFn({ method: "POST" })
  .inputValidator(DeleteIncidentInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db
      .prepare("DELETE FROM incidents WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete incident");
    }

    return { success: true };
  });

// ============================================
// SUBSCRIBER SERVER FUNCTIONS
// ============================================

const CreateSubscriberInput = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  consentMethod: z.string().optional(),
  preferences: z.object({
    routes: z.array(z.string()).optional(),
    modes: z.array(z.string()).optional(),
    severity: z.array(z.string()).optional(),
  }).optional(),
});

interface SubscriberRow {
  id: string;
  email: string | null;
  phone: string | null;
  push_token: string | null;
  preferences: string;
  status: string;
  consent_method: string;
  consent_given_at: string;
  created_at: string;
  updated_at: string;
}

export const createSubscriber = createServerFn({ method: "POST" })
  .inputValidator(CreateSubscriberInput)
  .handler(async ({ data }) => {
    const db = getDB();

    if (!data.email && !data.phone) {
      throw new Error("Please provide at least an email or phone number");
    }

    const id = `sub_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const preferences = JSON.stringify(data.preferences || { routes: [], modes: [], severity: [] });

    const result = await db.prepare(
      `INSERT INTO subscribers (
        id, email, phone, preferences, status, consent_method, consent_given_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'), datetime('now'))`
    )
      .bind(
        id,
        data.email || null,
        data.phone || null,
        preferences,
        data.consentMethod || 'web_form'
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to create subscriber");
    }

    return { success: true, id };
  });

const GetSubscribersInput = z.object({
  status: z.string().optional(),
  limit: z.number().optional(),
});

export const getSubscribers = createServerFn({ method: "GET" })
  .inputValidator(GetSubscribersInput)
  .handler(async ({ data }) => {
    const db = getDB();

    let query = `SELECT * FROM subscribers WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.status) {
      query += ` AND status = ?`;
      params.push(data.status);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(data.limit || 100);

    const result = await db.prepare(query).bind(...params).all<SubscriberRow>();

    const statsResult = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) as email,
        SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) as sms,
        SUM(CASE WHEN push_token IS NOT NULL THEN 1 ELSE 0 END) as push,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
      FROM subscribers
    `).first<{ total: number; email: number; sms: number; push: number; active: number; unsubscribed: number }>();

    return {
      subscribers: result.results,
      stats: statsResult || { total: 0, email: 0, sms: 0, push: 0, active: 0, unsubscribed: 0 }
    };
  });

// ============================================
// DASHBOARD STATS
// ============================================

// ============================================
// ACTIVITY SERVER FUNCTIONS
// ============================================

interface ActivityItem {
  id: string;
  type: "incident_created" | "incident_updated" | "incident_resolved" | "message_sent" | "subscriber_added";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const getRecentActivity = createServerFn({ method: "GET" }).handler(
  async () => {
    const db = getDB();

    try {
      // Fetch recent incidents (created, updated, resolved)
      const recentIncidents = await db
        .prepare(
          `SELECT id, title, status, severity, created_at, updated_at, resolved_at
           FROM incidents
           ORDER BY updated_at DESC
           LIMIT 10`
        )
        .all<{
          id: string;
          title: string;
          status: string;
          severity: string;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        }>();

      // Fetch recent messages
      const recentMessages = await db
        .prepare(
          `SELECT m.id, m.content, m.created_at, i.title as incident_title
           FROM messages m
           LEFT JOIN incidents i ON m.incident_id = i.id
           ORDER BY m.created_at DESC
           LIMIT 5`
        )
        .all<{
          id: string;
          content: string;
          created_at: string;
          incident_title: string | null;
        }>();

      // Fetch recent subscribers
      const recentSubscribers = await db
        .prepare(
          `SELECT id, email, phone, created_at
           FROM subscribers
           ORDER BY created_at DESC
           LIMIT 5`
        )
        .all<{
          id: string;
          email: string | null;
          phone: string | null;
          created_at: string;
        }>();

      // Combine and format activities
      const activities: ActivityItem[] = [];

      // Add incident activities
      for (const incident of recentIncidents.results) {
        if (incident.resolved_at) {
          activities.push({
            id: `inc_resolved_${incident.id}`,
            type: "incident_resolved",
            title: "Incident resolved",
            description: incident.title,
            timestamp: incident.resolved_at,
            metadata: { incidentId: incident.id, severity: incident.severity },
          });
        }

        // If updated_at is significantly different from created_at, it's an update
        const created = new Date(incident.created_at).getTime();
        const updated = new Date(incident.updated_at).getTime();

        if (updated - created > 60000) { // More than 1 minute difference
          activities.push({
            id: `inc_updated_${incident.id}_${updated}`,
            type: "incident_updated",
            title: "Incident updated",
            description: incident.title,
            timestamp: incident.updated_at,
            metadata: { incidentId: incident.id, status: incident.status },
          });
        }

        activities.push({
          id: `inc_created_${incident.id}`,
          type: "incident_created",
          title: "Incident created",
          description: incident.title,
          timestamp: incident.created_at,
          metadata: { incidentId: incident.id, severity: incident.severity },
        });
      }

      // Add message activities
      for (const message of recentMessages.results) {
        activities.push({
          id: `msg_${message.id}`,
          type: "message_sent",
          title: "Message sent",
          description: message.incident_title || message.content.substring(0, 50) + "..." || "Notification sent",
          timestamp: message.created_at,
          metadata: { messageId: message.id },
        });
      }

      // Add subscriber activities
      for (const subscriber of recentSubscribers.results) {
        const contact = subscriber.email || subscriber.phone || "New subscriber";
        activities.push({
          id: `sub_${subscriber.id}`,
          type: "subscriber_added",
          title: "New subscriber",
          description: contact,
          timestamp: subscriber.created_at,
          metadata: { subscriberId: subscriber.id },
        });
      }

      // Sort by timestamp descending and take top 10
      activities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return { activities: activities.slice(0, 10) };
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      return { activities: [] };
    }
  }
);

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const db = getDB();

    try {
      const activeResult = await db.prepare(
        `SELECT COUNT(*) as count FROM incidents WHERE status IN ('active', 'updated')`
      ).first<{ count: number }>();

      const today = new Date().toISOString().split("T")[0];
      const messagesResult = await db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?`
      )
        .bind(today)
        .first<{ count: number }>();

      const deliveryResult = await db.prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
         FROM deliveries
         WHERE date(queued_at) = ?`
      )
        .bind(today)
        .first<{ total: number; delivered: number }>();

      const subscriberResult = await db.prepare(
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

// ============================================
// PUBLISH INCIDENT WITH NOTIFICATIONS
// ============================================

const PublishIncidentInput = z.object({
  id: z.string(),
  sendNotifications: z.boolean().default(false),
  notificationMessage: z.string().optional(),
});

interface SubscriberForNotification {
  id: string;
  email: string | null;
  phone: string | null;
  push_token: string | null;
  preferences: string;
}

export const publishIncidentWithNotifications = createServerFn({ method: "POST" })
  .inputValidator(PublishIncidentInput)
  .handler(async ({ data }) => {
    const db = getDB();

    // Get the incident
    const incident = await db.prepare(
      `SELECT * FROM incidents WHERE id = ?`
    ).bind(data.id).first<{
      id: string;
      title: string;
      incident_type: string;
      severity: string;
      status: string;
      affected_modes: string | null;
      affected_routes: string | null;
      public_message: string | null;
      current_version: number;
    }>();

    if (!incident) {
      throw new Error("Incident not found");
    }

    if (incident.status !== "draft") {
      throw new Error("Only draft incidents can be published");
    }

    // Update incident status to active
    await db.prepare(
      `UPDATE incidents SET status = 'active', updated_at = datetime('now') WHERE id = ?`
    ).bind(data.id).run();

    let notificationsSent = 0;
    let messageId: string | null = null;

    if (data.sendNotifications) {
      const messageContent = data.notificationMessage || incident.public_message || incident.title;

      // Create a message for this notification
      const msgId = `msg_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
      messageId = msgId;

      await db.prepare(
        `INSERT INTO messages (id, incident_id, incident_version, content, created_by, created_at)
         VALUES (?, ?, ?, ?, 'usr_admin', datetime('now'))`
      ).bind(msgId, data.id, incident.current_version, messageContent).run();

      // Get matching subscribers based on incident criteria
      const subscribers = await db.prepare(
        `SELECT id, email, phone, push_token, preferences FROM subscribers WHERE status = 'active'`
      ).all<SubscriberForNotification>();

      const affectedModes = incident.affected_modes ? JSON.parse(incident.affected_modes) : [];
      const affectedRoutes = incident.affected_routes ? JSON.parse(incident.affected_routes) : [];

      // Get enabled channels
      const channels = await db.prepare(
        `SELECT id, type FROM channels WHERE enabled = 1`
      ).all<{ id: string; type: string }>();

      for (const subscriber of subscribers.results) {
        // Parse subscriber preferences
        let prefs: { routes?: string[]; modes?: string[]; severity?: string[] } = {};
        try {
          prefs = JSON.parse(subscriber.preferences);
        } catch {
          prefs = {};
        }

        // Check if subscriber matches notification criteria
        let shouldNotify = true;

        // Check severity preference
        if (prefs.severity && prefs.severity.length > 0) {
          if (!prefs.severity.includes(incident.severity)) {
            shouldNotify = false;
          }
        }

        // Check route preference (if subscriber has specific routes, incident must affect them)
        if (shouldNotify && prefs.routes && prefs.routes.length > 0 && affectedRoutes.length > 0) {
          const hasMatchingRoute = prefs.routes.some((r: string) => affectedRoutes.includes(r));
          if (!hasMatchingRoute) {
            shouldNotify = false;
          }
        }

        // Check mode preference
        if (shouldNotify && prefs.modes && prefs.modes.length > 0 && affectedModes.length > 0) {
          const hasMatchingMode = prefs.modes.some((m: string) => affectedModes.includes(m));
          if (!hasMatchingMode) {
            shouldNotify = false;
          }
        }

        if (shouldNotify) {
          // Queue deliveries for this subscriber
          for (const channel of channels.results) {
            // Check if subscriber can receive this channel type
            let canReceive = false;
            if (channel.type === "email" && subscriber.email) canReceive = true;
            if (channel.type === "sms" && subscriber.phone) canReceive = true;
            if (channel.type === "push" && subscriber.push_token) canReceive = true;

            if (canReceive) {
              const deliveryId = `del_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

              await db.prepare(
                `INSERT INTO deliveries (id, message_id, channel_id, status, queued_at)
                 VALUES (?, ?, ?, 'queued', datetime('now'))`
              ).bind(deliveryId, msgId, channel.id).run();

              // Track subscriber delivery
              const subDelId = `sd_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
              await db.prepare(
                `INSERT INTO subscriber_deliveries (id, subscriber_id, delivery_id, channel, status, sent_at)
                 VALUES (?, ?, ?, ?, 'sent', datetime('now'))`
              ).bind(subDelId, subscriber.id, deliveryId, channel.type).run();

              notificationsSent++;
            }
          }
        }
      }
    }

    return {
      success: true,
      notificationsSent,
      messageId
    };
  });
