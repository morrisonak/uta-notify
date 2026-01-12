import { z } from "zod";

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const DeliveryStatus = z.enum(["queued", "sending", "delivered", "failed", "partial"]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;

export const ChannelType = z.enum([
  "twitter",
  "email",
  "sms",
  "push",
  "signage",
  "gtfs",
  "website",
]);
export type ChannelType = z.infer<typeof ChannelType>;

// ============================================
// CHANNEL OVERRIDE SCHEMAS
// ============================================

/**
 * Per-channel content customization
 */
export const ChannelOverrideSchema = z.object({
  channelType: ChannelType,
  content: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ChannelOverride = z.infer<typeof ChannelOverrideSchema>;

// ============================================
// MESSAGE SCHEMAS
// ============================================

/**
 * Create message input
 */
export const CreateMessageSchema = z.object({
  incidentId: z.string().min(1),
  content: z.string().min(1, "Message content is required").max(5000),
  channelOverrides: z.array(ChannelOverrideSchema).optional(),
  mediaAttachments: z.array(z.string()).optional(), // Attachment IDs
  targetChannels: z.array(ChannelType).min(1, "Select at least one channel"),
});
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;

/**
 * Message response (from database)
 */
export const MessageSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  incidentVersion: z.number().int().positive(),
  content: z.string(),
  channelOverrides: z.array(ChannelOverrideSchema).nullable(),
  mediaAttachments: z.array(z.string()).nullable(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

/**
 * Message with delivery status
 */
export const MessageWithDeliveriesSchema = MessageSchema.extend({
  deliveries: z.array(
    z.object({
      id: z.string(),
      channelId: z.string(),
      channelType: ChannelType,
      channelName: z.string(),
      status: DeliveryStatus,
      providerMessageId: z.string().nullable(),
      failureReason: z.string().nullable(),
      retryCount: z.number().int(),
      queuedAt: z.string().datetime(),
      sentAt: z.string().datetime().nullable(),
      deliveredAt: z.string().datetime().nullable(),
    })
  ),
  createdByUser: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
});
export type MessageWithDeliveries = z.infer<typeof MessageWithDeliveriesSchema>;

// ============================================
// DELIVERY SCHEMAS
// ============================================

/**
 * Delivery record (from database)
 */
export const DeliverySchema = z.object({
  id: z.string(),
  messageId: z.string(),
  channelId: z.string(),
  status: DeliveryStatus,
  providerMessageId: z.string().nullable(),
  providerResponse: z.record(z.unknown()).nullable(),
  failureReason: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().nullable(),
  queuedAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
});
export type Delivery = z.infer<typeof DeliverySchema>;

/**
 * Delivery result from channel adapter
 */
export const DeliveryResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
  retryable: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});
export type DeliveryResult = z.infer<typeof DeliveryResultSchema>;

// ============================================
// CHANNEL SCHEMAS
// ============================================

/**
 * Channel constraints
 */
export const ChannelConstraintsSchema = z.object({
  maxLength: z.number().int().positive().optional(),
  supportsMedia: z.boolean().default(false),
  supportedMediaTypes: z.array(z.string()).optional(),
  maxMediaSize: z.number().int().positive().optional(),
  rateLimit: z
    .object({
      requests: z.number().int().positive(),
      windowSeconds: z.number().int().positive(),
    })
    .optional(),
  requiresApproval: z.boolean().optional(),
});
export type ChannelConstraints = z.infer<typeof ChannelConstraintsSchema>;

/**
 * Channel configuration (from database)
 */
export const ChannelSchema = z.object({
  id: z.string(),
  type: ChannelType,
  name: z.string(),
  provider: z.string().nullable(),
  config: z.record(z.unknown()), // Encrypted in DB
  constraints: ChannelConstraintsSchema.nullable(),
  enabled: z.boolean(),
  testMode: z.boolean(),
  lastHealthCheck: z.string().datetime().nullable(),
  healthStatus: z.enum(["healthy", "degraded", "unhealthy", "unknown"]).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Channel = z.infer<typeof ChannelSchema>;

/**
 * Create/update channel input
 */
export const UpsertChannelSchema = z.object({
  type: ChannelType,
  name: z.string().min(1).max(100),
  provider: z.string().optional(),
  config: z.record(z.unknown()),
  constraints: ChannelConstraintsSchema.optional(),
  enabled: z.boolean().default(true),
  testMode: z.boolean().default(false),
});
export type UpsertChannelInput = z.infer<typeof UpsertChannelSchema>;

// ============================================
// MESSAGE PREVIEW SCHEMAS
// ============================================

/**
 * Channel preview for message composition
 */
export const ChannelPreviewSchema = z.object({
  channelType: ChannelType,
  channelName: z.string(),
  formattedContent: z.string(),
  characterCount: z.number().int().nonnegative(),
  maxLength: z.number().int().positive().nullable(),
  isValid: z.boolean(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type ChannelPreview = z.infer<typeof ChannelPreviewSchema>;

/**
 * Message preview request
 */
export const MessagePreviewRequestSchema = z.object({
  content: z.string(),
  incidentId: z.string().optional(),
  targetChannels: z.array(ChannelType),
});
export type MessagePreviewRequest = z.infer<typeof MessagePreviewRequestSchema>;

// ============================================
// DELIVERY STATS
// ============================================

export interface DeliveryStats {
  total: number;
  queued: number;
  sending: number;
  delivered: number;
  failed: number;
  partial: number;
  successRate: number;
}

export interface ChannelDeliveryStats extends DeliveryStats {
  channelType: ChannelType;
  channelName: string;
  averageDeliveryTimeMs: number | null;
}

// ============================================
// CHANNEL CONSTRAINTS DEFAULTS
// ============================================

export const DefaultChannelConstraints: Record<ChannelType, ChannelConstraints> = {
  twitter: {
    maxLength: 280,
    supportsMedia: true,
    supportedMediaTypes: ["image/jpeg", "image/png", "image/gif", "video/mp4"],
    maxMediaSize: 5 * 1024 * 1024, // 5MB for images
    rateLimit: { requests: 300, windowSeconds: 900 }, // 300 per 15 min
  },
  email: {
    maxLength: 100000,
    supportsMedia: true,
    supportedMediaTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
    maxMediaSize: 25 * 1024 * 1024, // 25MB
  },
  sms: {
    maxLength: 160, // Single SMS segment
    supportsMedia: false,
    rateLimit: { requests: 100, windowSeconds: 60 },
  },
  push: {
    maxLength: 178, // iOS notification limit
    supportsMedia: true,
    supportedMediaTypes: ["image/jpeg", "image/png"],
    maxMediaSize: 1024 * 1024, // 1MB
  },
  signage: {
    maxLength: 500, // Varies by device
    supportsMedia: false,
  },
  gtfs: {
    maxLength: 5000,
    supportsMedia: false,
  },
  website: {
    maxLength: 10000,
    supportsMedia: true,
    supportedMediaTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    maxMediaSize: 10 * 1024 * 1024,
  },
};
