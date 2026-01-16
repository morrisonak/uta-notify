import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { requirePermission } from "../lib/auth";
import { logAudit } from "./audit";
import { getAdapter } from "../channels";

/**
 * Message delivery orchestration
 * Handles queuing and tracking message delivery across channels
 */

// ============================================
// TYPES
// ============================================

export type DeliveryStatus = "queued" | "sending" | "delivered" | "failed" | "partial";
export type ChannelType = "email" | "sms" | "push" | "twitter" | "signage";

export interface Delivery {
  id: string;
  message_id: string;
  channel_id: string;
  status: DeliveryStatus;
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

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  enabled: number;
  config: string | null;
}

export interface SubscriberDelivery {
  id: string;
  subscriber_id: string;
  delivery_id: string;
  channel: string;
  status: "sent" | "delivered" | "failed" | "opened" | "clicked";
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

// ============================================
// INPUT VALIDATORS
// ============================================

const QueueDeliveryInput = z.object({
  messageId: z.string(),
  channelTypes: z.array(z.enum(["email", "sms", "push", "twitter", "signage"])).optional(),
});

const GetDeliveriesInput = z.object({
  messageId: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const RetryDeliveryInput = z.object({
  deliveryId: z.string(),
});

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * Get all configured channels
 */
export const getChannels = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDB();

  const result = await db
    .prepare("SELECT * FROM channels ORDER BY type, name")
    .all<Channel>();

  return { channels: result.results || [] };
});

/**
 * Get enabled channels
 */
export const getEnabledChannels = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDB();

  const result = await db
    .prepare("SELECT * FROM channels WHERE enabled = 1 ORDER BY type, name")
    .all<Channel>();

  return { channels: result.results || [] };
});

/**
 * Create or update a channel
 */
export const upsertChannel = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().optional(),
      type: z.enum(["email", "sms", "push", "twitter", "signage"]),
      name: z.string(),
      enabled: z.boolean().default(true),
      config: z.record(z.unknown()).optional(),
    })
  )
  .handler(async ({ data }) => {
    await requirePermission("settings.edit");
    const db = getDB();

    const id = data.id || generateId("ch");

    await db
      .prepare(
        `INSERT INTO channels (id, type, name, enabled, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           enabled = excluded.enabled,
           config = excluded.config,
           updated_at = datetime('now')`
      )
      .bind(
        id,
        data.type,
        data.name,
        data.enabled ? 1 : 0,
        data.config ? JSON.stringify(data.config) : null
      )
      .run();

    await logAudit({
      action: data.id ? "update" : "create",
      resourceType: "channel",
      resourceId: id,
      resourceName: data.name,
      details: { type: data.type, enabled: data.enabled },
    });

    return { success: true, id };
  });

// ============================================
// DELIVERY ORCHESTRATION
// ============================================

/**
 * Queue a message for delivery to selected channels
 */
export const queueMessageDelivery = createServerFn({ method: "POST" })
  .inputValidator(QueueDeliveryInput)
  .handler(async ({ data }) => {
    await requirePermission("messages.send");
    const db = getDB();

    // Get the message
    const message = await db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .bind(data.messageId)
      .first<{ id: string; content: string; incident_id: string }>();

    if (!message) {
      throw new Error("Message not found");
    }

    // Get enabled channels (or filter by requested types)
    let channelQuery = "SELECT * FROM channels WHERE enabled = 1";
    const channelParams: string[] = [];

    if (data.channelTypes && data.channelTypes.length > 0) {
      const placeholders = data.channelTypes.map(() => "?").join(", ");
      channelQuery += ` AND type IN (${placeholders})`;
      channelParams.push(...data.channelTypes);
    }

    const channelsResult = await db
      .prepare(channelQuery)
      .bind(...channelParams)
      .all<Channel>();

    const channels = channelsResult.results || [];

    if (channels.length === 0) {
      throw new Error("No enabled channels found for delivery");
    }

    // Create delivery records for each channel
    const deliveryIds: string[] = [];

    for (const channel of channels) {
      const deliveryId = generateId("dlv");
      deliveryIds.push(deliveryId);

      await db
        .prepare(
          `INSERT INTO deliveries (id, message_id, channel_id, status, queued_at)
           VALUES (?, ?, ?, 'queued', datetime('now'))`
        )
        .bind(deliveryId, data.messageId, channel.id)
        .run();
    }

    await logAudit({
      action: "send",
      resourceType: "message",
      resourceId: data.messageId,
      details: {
        channelCount: channels.length,
        channelTypes: channels.map((c) => c.type),
        deliveryIds,
      },
    });

    return {
      success: true,
      deliveryIds,
      channelCount: channels.length,
    };
  });

/**
 * Process queued deliveries (called by worker/cron)
 */
export const processQueuedDeliveries = createServerFn({ method: "POST" }).handler(
  async () => {
    const db = getDB();

    // Get queued deliveries ready to send
    const deliveries = await db
      .prepare(
        `SELECT d.*, c.type as channel_type, c.config as channel_config, c.name as channel_name,
                m.content as message_content, m.incident_id
         FROM deliveries d
         JOIN channels c ON d.channel_id = c.id
         JOIN messages m ON d.message_id = m.id
         WHERE d.status = 'queued'
           OR (d.status = 'failed' AND d.retry_count < 3 AND d.next_retry_at <= datetime('now'))
         ORDER BY d.queued_at ASC
         LIMIT 10`
      )
      .all<Delivery & { channel_type: string; channel_config: string; message_content: string }>();

    const results: { deliveryId: string; success: boolean; error?: string }[] = [];

    for (const delivery of deliveries.results || []) {
      try {
        // Mark as sending
        await db
          .prepare(
            `UPDATE deliveries SET status = 'sending', sent_at = datetime('now') WHERE id = ?`
          )
          .bind(delivery.id)
          .run();

        // Process based on channel type
        const result = await processChannelDelivery(delivery);

        if (result.success) {
          await db
            .prepare(
              `UPDATE deliveries
               SET status = 'delivered',
                   delivered_at = datetime('now'),
                   provider_message_id = ?,
                   provider_response = ?
               WHERE id = ?`
            )
            .bind(
              result.providerId || null,
              result.response ? JSON.stringify(result.response) : null,
              delivery.id
            )
            .run();

          results.push({ deliveryId: delivery.id, success: true });
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Calculate next retry time with exponential backoff
        const retryCount = delivery.retry_count + 1;
        const backoffMinutes = Math.pow(2, retryCount) * 5; // 10, 20, 40 minutes

        await db
          .prepare(
            `UPDATE deliveries
             SET status = 'failed',
                 failed_at = datetime('now'),
                 failure_reason = ?,
                 retry_count = ?,
                 next_retry_at = datetime('now', '+' || ? || ' minutes')
             WHERE id = ?`
          )
          .bind(errorMessage, retryCount, backoffMinutes, delivery.id)
          .run();

        results.push({ deliveryId: delivery.id, success: false, error: errorMessage });
      }
    }

    return { processed: results.length, results };
  }
);

/**
 * Process delivery for a specific channel type
 */
async function processChannelDelivery(delivery: {
  id: string;
  channel_type: string;
  channel_config: string | null;
  message_content: string;
}): Promise<{ success: boolean; providerId?: string; response?: unknown; error?: string }> {
  const config = delivery.channel_config ? JSON.parse(delivery.channel_config) : {};

  // Try to get adapter from registry
  const adapter = getAdapter(delivery.channel_type);

  if (adapter) {
    // Use the proper adapter
    const result = await adapter.send(
      delivery.message_content,
      config.recipients || [],
      config
    );
    return result;
  }

  // Fallback for channels without adapters yet
  switch (delivery.channel_type) {
    case "sms":
      return await sendSmsDelivery(delivery.message_content, config);
    case "push":
      return await sendPushDelivery(delivery.message_content, config);
    case "twitter":
      return await sendTwitterDelivery(delivery.message_content, config);
    case "signage":
      return await sendSignageDelivery(delivery.message_content, config);
    default:
      return { success: false, error: `Unknown channel type: ${delivery.channel_type}` };
  }
}

// ============================================
// PLACEHOLDER CHANNEL IMPLEMENTATIONS
// (Will be replaced with proper adapters)
// ============================================

async function sendSmsDelivery(
  content: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; providerId?: string; response?: unknown; error?: string }> {
  // TODO: Implement actual SMS sending via Twilio/etc
  console.log("[SMS] Would send:", content.substring(0, 160));

  return {
    success: true,
    providerId: `sms_${Date.now()}`,
    response: { simulated: true },
  };
}

async function sendPushDelivery(
  content: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; providerId?: string; response?: unknown; error?: string }> {
  // TODO: Implement push notifications via FCM/etc
  console.log("[PUSH] Would send:", content.substring(0, 100));

  return {
    success: true,
    providerId: `push_${Date.now()}`,
    response: { simulated: true },
  };
}

async function sendTwitterDelivery(
  content: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; providerId?: string; response?: unknown; error?: string }> {
  // TODO: Implement Twitter/X posting
  // Note: Twitter has 280 char limit
  const truncated = content.length > 280 ? content.substring(0, 277) + "..." : content;
  console.log("[TWITTER] Would post:", truncated);

  return {
    success: true,
    providerId: `tweet_${Date.now()}`,
    response: { simulated: true },
  };
}

async function sendSignageDelivery(
  content: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; providerId?: string; response?: unknown; error?: string }> {
  // TODO: Implement digital signage integration
  console.log("[SIGNAGE] Would display:", content.substring(0, 100));

  return {
    success: true,
    providerId: `sign_${Date.now()}`,
    response: { simulated: true },
  };
}

// ============================================
// DELIVERY QUERIES
// ============================================

/**
 * Get deliveries with filtering
 */
export const getDeliveries = createServerFn({ method: "GET" })
  .inputValidator(GetDeliveriesInput)
  .handler(async ({ data }) => {
    await requirePermission("messages.view");
    const db = getDB();

    let query = `
      SELECT d.*, c.type as channel_type, c.name as channel_name
      FROM deliveries d
      JOIN channels c ON d.channel_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (data.messageId) {
      query += " AND d.message_id = ?";
      params.push(data.messageId);
    }

    if (data.status) {
      query += " AND d.status = ?";
      params.push(data.status);
    }

    // Get total count
    const countQuery = query.replace(
      "SELECT d.*, c.type as channel_type, c.name as channel_name",
      "SELECT COUNT(*) as count"
    );
    const countResult = await db
      .prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>();

    // Get paginated results
    query += " ORDER BY d.queued_at DESC LIMIT ? OFFSET ?";
    params.push(data.limit, data.offset);

    const result = await db.prepare(query).bind(...params).all<Delivery>();

    return {
      deliveries: result.results || [],
      total: countResult?.count || 0,
    };
  });

/**
 * Get delivery stats
 */
export const getDeliveryStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDB();

  const stats = await db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as sending,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial
      FROM deliveries
      WHERE queued_at >= datetime('now', '-24 hours')`
    )
    .first<{
      total: number;
      queued: number;
      sending: number;
      delivered: number;
      failed: number;
      partial: number;
    }>();

  return {
    total: stats?.total || 0,
    queued: stats?.queued || 0,
    sending: stats?.sending || 0,
    delivered: stats?.delivered || 0,
    failed: stats?.failed || 0,
    partial: stats?.partial || 0,
    successRate:
      stats && stats.total > 0
        ? Math.round((stats.delivered / stats.total) * 100)
        : 0,
  };
});

/**
 * Retry a failed delivery
 */
export const retryDelivery = createServerFn({ method: "POST" })
  .inputValidator(RetryDeliveryInput)
  .handler(async ({ data }) => {
    await requirePermission("messages.send");
    const db = getDB();

    // Reset delivery to queued
    await db
      .prepare(
        `UPDATE deliveries
         SET status = 'queued',
             failure_reason = NULL,
             next_retry_at = NULL
         WHERE id = ? AND status = 'failed'`
      )
      .bind(data.deliveryId)
      .run();

    return { success: true };
  });
