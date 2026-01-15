import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { getCurrentUser } from "../lib/auth";

/**
 * Message server functions
 * CRUD operations for message management and delivery tracking
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Message {
  id: string;
  incident_id: string;
  incident_version: number;
  content: string;
  channel_overrides: string | null;
  media_attachments: string | null;
  created_by: string;
  created_at: string;
}

export interface Delivery {
  id: string;
  message_id: string;
  channel_id: string;
  status: "queued" | "sending" | "delivered" | "failed" | "partial";
  provider_message_id: string | null;
  provider_response: string | null;
  failure_reason: string | null;
  retry_count: number;
  next_retry_at: string | null;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
}

// ============================================
// INPUT VALIDATORS
// ============================================

const CreateMessageInput = z.object({
  incidentId: z.string(),
  content: z.string().min(1),
  channelOverrides: z.record(z.string()).optional(),
  mediaAttachments: z.array(z.string()).optional(),
});

const GetMessagesInput = z.object({
  incidentId: z.string().optional(),
  limit: z.number().optional(),
});

const GetMessageInput = z.object({
  id: z.string(),
});

const UpdateMessageInput = z.object({
  id: z.string(),
  content: z.string().min(1).optional(),
  channelOverrides: z.record(z.string()).optional(),
});

const DeleteMessageInput = z.object({
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
 * Get all messages with optional filtering
 */
export const getMessages = createServerFn({ method: "GET" })
  .inputValidator(GetMessagesInput)
  .handler(async ({ data }) => {
    const db = getDB();

    let query = `SELECT * FROM messages WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.incidentId) {
      query += ` AND incident_id = ?`;
      params.push(data.incidentId);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(data.limit || 50);

    const result = await db.prepare(query).bind(...params).all<Message>();

    return { messages: result.results };
  });

/**
 * Get a single message by ID
 */
export const getMessage = createServerFn({ method: "GET" })
  .inputValidator(GetMessageInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db
      .prepare(`SELECT * FROM messages WHERE id = ?`)
      .bind(data.id)
      .first<Message>();

    if (!result) {
      throw new Error("Message not found");
    }

    return { message: result };
  });

/**
 * Create a new message
 */
export const createMessage = createServerFn({ method: "POST" })
  .inputValidator(CreateMessageInput)
  .handler(async ({ data }) => {
    const db = getDB();
    const user = await getCurrentUser();
    const userId = user?.id || "usr_admin";

    // Get current incident version
    const incident = await db
      .prepare("SELECT current_version FROM incidents WHERE id = ?")
      .bind(data.incidentId)
      .first<{ current_version: number }>();

    if (!incident) {
      throw new Error("Incident not found");
    }

    const id = generateId("msg");

    const result = await db
      .prepare(
        `INSERT INTO messages (
          id, incident_id, incident_version, content,
          channel_overrides, media_attachments, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        id,
        data.incidentId,
        incident.current_version,
        data.content,
        data.channelOverrides ? JSON.stringify(data.channelOverrides) : null,
        data.mediaAttachments ? JSON.stringify(data.mediaAttachments) : null,
        userId
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to create message");
    }

    return { success: true, id };
  });

/**
 * Update an existing message
 */
export const updateMessage = createServerFn({ method: "POST" })
  .inputValidator(UpdateMessageInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.content !== undefined) {
      updates.push("content = ?");
      params.push(data.content);
    }
    if (data.channelOverrides !== undefined) {
      updates.push("channel_overrides = ?");
      params.push(JSON.stringify(data.channelOverrides));
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    params.push(data.id);

    const query = `UPDATE messages SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update message");
    }

    return { success: true };
  });

/**
 * Delete a message
 */
export const deleteMessage = createServerFn({ method: "POST" })
  .inputValidator(DeleteMessageInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db
      .prepare("DELETE FROM messages WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete message");
    }

    return { success: true };
  });

/**
 * Get message delivery status
 */
export const getMessageDeliveries = createServerFn({ method: "GET" })
  .inputValidator(GetMessageInput)
  .handler(async ({ data }) => {
    const db = getDB();

    const result = await db
      .prepare(
        `SELECT d.*, c.name as channel_name, c.type as channel_type
         FROM deliveries d
         JOIN channels c ON d.channel_id = c.id
         WHERE d.message_id = ?
         ORDER BY d.queued_at DESC`
      )
      .bind(data.id)
      .all<Delivery & { channel_name: string; channel_type: string }>();

    return { deliveries: result.results };
  });

/**
 * Get messages sent today
 */
export const getMessagesToday = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDB();
  const today = new Date().toISOString().split("T")[0];

  const result = await db
    .prepare(
      `SELECT * FROM messages
       WHERE date(created_at) = ?
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .bind(today)
    .all<Message>();

  return { messages: result.results };
});

/**
 * Get message statistics
 */
export const getMessageStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDB();
  const today = new Date().toISOString().split("T")[0];

  const [sentToday, pending, delivered, failed] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?")
      .bind(today)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM deliveries WHERE status IN ('queued', 'sending')")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM deliveries WHERE status = 'delivered' AND date(delivered_at) = ?")
      .bind(today)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM deliveries WHERE status = 'failed' AND date(failed_at) = ?")
      .bind(today)
      .first<{ count: number }>(),
  ]);

  return {
    sentToday: sentToday?.count || 0,
    pending: pending?.count || 0,
    delivered: delivered?.count || 0,
    failed: failed?.count || 0,
  };
});
