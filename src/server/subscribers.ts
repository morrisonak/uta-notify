import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { requirePermission } from "../lib/auth";
import { logAudit } from "./audit";

/**
 * Subscriber server functions
 * CRUD operations for subscriber management
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Subscriber {
  id: string;
  email: string | null;
  phone: string | null;
  push_token: string | null;
  push_platform: "ios" | "android" | "web" | null;
  preferences: string;
  language: string;
  consent_given_at: string;
  consent_method: string;
  consent_ip: string | null;
  status: "active" | "unsubscribed" | "bounced" | "complained";
  unsubscribed_at: string | null;
  bounce_count: number;
  last_bounce_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriberPreferences {
  routes?: string[];
  modes?: string[];
  areas?: string[];
  severity?: string[];
  channels?: string[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

// ============================================
// INPUT VALIDATORS
// ============================================

const CreateSubscriberInput = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pushToken: z.string().optional(),
  pushPlatform: z.enum(["ios", "android", "web"]).optional(),
  preferences: z.object({
    routes: z.array(z.string()).optional(),
    modes: z.array(z.string()).optional(),
    areas: z.array(z.string()).optional(),
    severity: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
  }).optional(),
  language: z.string().optional(),
  consentMethod: z.string(),
  consentIp: z.string().optional(),
});

const UpdateSubscriberInput = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  preferences: z.object({
    routes: z.array(z.string()).optional(),
    modes: z.array(z.string()).optional(),
    areas: z.array(z.string()).optional(),
    severity: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
  }).optional(),
  language: z.string().optional(),
  status: z.enum(["active", "unsubscribed", "bounced", "complained"]).optional(),
});

const GetSubscribersInput = z.object({
  status: z.string().optional(),
  channel: z.enum(["email", "sms", "push"]).optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const GetSubscriberInput = z.object({
  id: z.string(),
});

const DeleteSubscriberInput = z.object({
  id: z.string(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get all subscribers with optional filtering
 */
export const getSubscribers = createServerFn({ method: "GET" })
  .inputValidator(GetSubscribersInput)
  .handler(async ({ data }) => {
    await requirePermission("subscribers.view");
    const db = getDB();

    let query = `SELECT * FROM subscribers WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.status) {
      query += ` AND status = ?`;
      params.push(data.status);
    }

    if (data.channel === "email") {
      query += ` AND email IS NOT NULL`;
    } else if (data.channel === "sms") {
      query += ` AND phone IS NOT NULL`;
    } else if (data.channel === "push") {
      query += ` AND push_token IS NOT NULL`;
    }

    if (data.search) {
      query += ` AND (email LIKE ? OR phone LIKE ?)`;
      const searchTerm = `%${data.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(data.limit || 50, data.offset || 0);

    const result = await db.prepare(query).bind(...params).all<Subscriber>();

    return { subscribers: result.results };
  });

/**
 * Get a single subscriber by ID
 */
export const getSubscriber = createServerFn({ method: "GET" })
  .inputValidator(GetSubscriberInput)
  .handler(async ({ data }) => {
    await requirePermission("subscribers.view");
    const db = getDB();

    const result = await db
      .prepare(`SELECT * FROM subscribers WHERE id = ?`)
      .bind(data.id)
      .first<Subscriber>();

    if (!result) {
      throw new Error("Subscriber not found");
    }

    return { subscriber: result };
  });

/**
 * Create a new subscriber
 */
export const createSubscriber = createServerFn({ method: "POST" })
  .inputValidator(CreateSubscriberInput)
  .handler(async ({ data }) => {
    await requirePermission("subscribers.create");
    const db = getDB();

    // Require at least one contact method
    if (!data.email && !data.phone && !data.pushToken) {
      throw new Error("At least one contact method (email, phone, or push token) is required");
    }

    const id = generateId("sub");
    const preferences = JSON.stringify(data.preferences || {});

    const result = await db
      .prepare(
        `INSERT INTO subscribers (
          id, email, phone, push_token, push_platform,
          preferences, language, consent_given_at, consent_method,
          consent_ip, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 'active', datetime('now'), datetime('now'))`
      )
      .bind(
        id,
        data.email || null,
        data.phone || null,
        data.pushToken || null,
        data.pushPlatform || null,
        preferences,
        data.language || "en",
        data.consentMethod,
        data.consentIp || null
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to create subscriber");
    }

    // Log subscriber creation (mask PII)
    await logAudit({
      action: "create",
      resourceType: "subscriber",
      resourceId: id,
      details: {
        hasEmail: !!data.email,
        hasPhone: !!data.phone,
        hasPush: !!data.pushToken,
        language: data.language || "en",
        consentMethod: data.consentMethod,
      },
    });

    return { success: true, id };
  });

/**
 * Update an existing subscriber
 */
export const updateSubscriber = createServerFn({ method: "POST" })
  .inputValidator(UpdateSubscriberInput)
  .handler(async ({ data }) => {
    await requirePermission("subscribers.edit");
    const db = getDB();

    // Get original subscriber for change tracking
    const original = await db
      .prepare("SELECT * FROM subscribers WHERE id = ?")
      .bind(data.id)
      .first<Subscriber>();

    if (!original) {
      throw new Error("Subscriber not found");
    }

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.email !== undefined) {
      updates.push("email = ?");
      params.push(data.email);
    }
    if (data.phone !== undefined) {
      updates.push("phone = ?");
      params.push(data.phone);
    }
    if (data.preferences !== undefined) {
      updates.push("preferences = ?");
      params.push(JSON.stringify(data.preferences));
    }
    if (data.language !== undefined) {
      updates.push("language = ?");
      params.push(data.language);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);

      if (data.status === "unsubscribed") {
        updates.push("unsubscribed_at = datetime('now')");
      }
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push("updated_at = datetime('now')");
    params.push(data.id);

    const query = `UPDATE subscribers SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update subscriber");
    }

    // Build changes object for audit log (mask PII)
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (data.email !== undefined && data.email !== original.email) {
      changes.email = { old: "***", new: "***" }; // Mask PII
    }
    if (data.phone !== undefined && data.phone !== original.phone) {
      changes.phone = { old: "***", new: "***" }; // Mask PII
    }
    if (data.status !== undefined && data.status !== original.status) {
      changes.status = { old: original.status, new: data.status };
    }
    if (data.language !== undefined && data.language !== original.language) {
      changes.language = { old: original.language, new: data.language };
    }
    if (data.preferences !== undefined) {
      changes.preferences = { old: "...", new: "..." };
    }

    // Log subscriber update if there were changes
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "update",
        resourceType: "subscriber",
        resourceId: data.id,
        changes,
      });
    }

    return { success: true };
  });

/**
 * Delete a subscriber
 */
export const deleteSubscriber = createServerFn({ method: "POST" })
  .inputValidator(DeleteSubscriberInput)
  .handler(async ({ data }) => {
    await requirePermission("subscribers.delete");
    const db = getDB();

    // Get subscriber info before deletion (mask PII in audit)
    const subscriber = await db
      .prepare("SELECT id, status, language FROM subscribers WHERE id = ?")
      .bind(data.id)
      .first<{ id: string; status: string; language: string }>();

    const result = await db
      .prepare("DELETE FROM subscribers WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete subscriber");
    }

    // Log subscriber deletion
    await logAudit({
      action: "delete",
      resourceType: "subscriber",
      resourceId: data.id,
      details: {
        status: subscriber?.status,
        language: subscriber?.language,
      },
    });

    return { success: true };
  });

/**
 * Get subscriber statistics by channel
 */
export const getSubscriberStats = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("subscribers.view");
  const db = getDB();

  const [total, email, sms, push, active, unsubscribed] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM subscribers").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE email IS NOT NULL AND status = 'active'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE phone IS NOT NULL AND status = 'active'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE push_token IS NOT NULL AND status = 'active'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'unsubscribed'").first<{ count: number }>(),
  ]);

  return {
    total: total?.count || 0,
    email: email?.count || 0,
    sms: sms?.count || 0,
    push: push?.count || 0,
    active: active?.count || 0,
    unsubscribed: unsubscribed?.count || 0,
  };
});

/**
 * Unsubscribe a subscriber by email or phone
 */
export const unsubscribe = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const db = getDB();

    if (!data.email && !data.phone) {
      throw new Error("Email or phone is required");
    }

    // Get subscriber ID before unsubscribe
    let subscriberId: string | null = null;
    if (data.email) {
      const sub = await db
        .prepare("SELECT id FROM subscribers WHERE email = ?")
        .bind(data.email)
        .first<{ id: string }>();
      subscriberId = sub?.id || null;
    } else if (data.phone) {
      const sub = await db
        .prepare("SELECT id FROM subscribers WHERE phone = ?")
        .bind(data.phone)
        .first<{ id: string }>();
      subscriberId = sub?.id || null;
    }

    let query = `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now'), updated_at = datetime('now') WHERE `;

    if (data.email) {
      query += `email = ?`;
      await db.prepare(query).bind(data.email).run();
    } else if (data.phone) {
      query += `phone = ?`;
      await db.prepare(query).bind(data.phone).run();
    }

    // Log self-service unsubscribe
    if (subscriberId) {
      await logAudit({
        action: "update",
        resourceType: "subscriber",
        resourceId: subscriberId,
        actorType: "system",
        details: {
          action: "self-service-unsubscribe",
          method: data.email ? "email" : "phone",
        },
        changes: {
          status: { old: "active", new: "unsubscribed" },
        },
      });
    }

    return { success: true };
  });
