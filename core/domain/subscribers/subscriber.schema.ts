import { z } from "zod";

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const SubscriberStatus = z.enum(["active", "unsubscribed", "bounced", "complained"]);
export type SubscriberStatus = z.infer<typeof SubscriberStatus>;

export const ConsentMethod = z.enum(["web_form", "sms_keyword", "api", "import"]);
export type ConsentMethod = z.infer<typeof ConsentMethod>;

export const PushPlatform = z.enum(["ios", "android", "web"]);
export type PushPlatform = z.infer<typeof PushPlatform>;

// ============================================
// PREFERENCE SCHEMAS
// ============================================

/**
 * Subscriber notification preferences
 */
export const SubscriberPreferencesSchema = z.object({
  routes: z.array(z.string()).optional(), // Specific routes to receive alerts for
  modes: z.array(z.string()).optional(), // Transit modes (rail, bus, etc.)
  areas: z
    .array(
      z.object({
        name: z.string(),
        polygon: z.array(z.tuple([z.number(), z.number()])).optional(),
        radius: z.number().optional(), // Radius in meters from center point
        center: z.tuple([z.number(), z.number()]).optional(),
      })
    )
    .optional(),
  severity: z.array(z.enum(["low", "medium", "high", "critical"])).optional(), // Min severity
  quietHours: z
    .object({
      enabled: z.boolean(),
      start: z.string(), // HH:mm format
      end: z.string(),
      timezone: z.string(),
    })
    .optional(),
  channels: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(false),
    })
    .optional(),
});
export type SubscriberPreferences = z.infer<typeof SubscriberPreferencesSchema>;

// ============================================
// SUBSCRIBER SCHEMAS
// ============================================

/**
 * Create subscriber input (public signup)
 */
export const CreateSubscriberSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
      .optional(),
    pushToken: z.string().optional(),
    pushPlatform: PushPlatform.optional(),
    preferences: SubscriberPreferencesSchema,
    language: z.string().default("en"),
    consentMethod: ConsentMethod,
  })
  .refine((data) => data.email || data.phone || data.pushToken, {
    message: "At least one contact method (email, phone, or push token) is required",
  });
export type CreateSubscriberInput = z.infer<typeof CreateSubscriberSchema>;

/**
 * Update subscriber input
 */
export const UpdateSubscriberSchema = z.object({
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  pushToken: z.string().optional(),
  pushPlatform: PushPlatform.optional(),
  preferences: SubscriberPreferencesSchema.optional(),
  language: z.string().optional(),
});
export type UpdateSubscriberInput = z.infer<typeof UpdateSubscriberSchema>;

/**
 * Subscriber response (from database)
 */
export const SubscriberSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  pushToken: z.string().nullable(),
  pushPlatform: PushPlatform.nullable(),
  preferences: SubscriberPreferencesSchema,
  language: z.string(),
  consentGivenAt: z.string().datetime(),
  consentMethod: ConsentMethod,
  consentIp: z.string().nullable(),
  status: SubscriberStatus,
  unsubscribedAt: z.string().datetime().nullable(),
  bounceCount: z.number().int().nonnegative(),
  lastBounceAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Subscriber = z.infer<typeof SubscriberSchema>;

// ============================================
// SUBSCRIPTION ACTIONS
// ============================================

/**
 * Unsubscribe input
 */
export const UnsubscribeSchema = z.object({
  subscriberId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  token: z.string().optional(), // One-click unsubscribe token
  reason: z.string().max(500).optional(),
});
export type UnsubscribeInput = z.infer<typeof UnsubscribeSchema>;

/**
 * Bounce notification
 */
export const BounceNotificationSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  bounceType: z.enum(["hard", "soft", "complaint"]),
  bounceSubType: z.string().optional(),
  timestamp: z.string().datetime(),
  rawPayload: z.record(z.unknown()).optional(),
});
export type BounceNotification = z.infer<typeof BounceNotificationSchema>;

// ============================================
// LIST & FILTER SCHEMAS
// ============================================

export const SubscriberListFiltersSchema = z.object({
  status: z.array(SubscriberStatus).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  hasPush: z.boolean().optional(),
  routes: z.array(z.string()).optional(),
  modes: z.array(z.string()).optional(),
  language: z.string().optional(),
  search: z.string().optional(), // Email or phone search
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});
export type SubscriberListFilters = z.infer<typeof SubscriberListFiltersSchema>;

export const SubscriberListParamsSchema = z.object({
  filters: SubscriberListFiltersSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type SubscriberListParams = z.infer<typeof SubscriberListParamsSchema>;

// ============================================
// IMPORT/EXPORT
// ============================================

/**
 * Subscriber import row
 */
export const SubscriberImportRowSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
  routes: z.string().optional(), // Comma-separated
  modes: z.string().optional(), // Comma-separated
});
export type SubscriberImportRow = z.infer<typeof SubscriberImportRowSchema>;

/**
 * Import result
 */
export const ImportResultSchema = z.object({
  total: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      row: z.number().int(),
      error: z.string(),
    })
  ),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

// ============================================
// SUBSCRIBER TARGETING
// ============================================

/**
 * Target criteria for message delivery
 */
export const TargetCriteriaSchema = z.object({
  allSubscribers: z.boolean().default(false),
  routes: z.array(z.string()).optional(),
  modes: z.array(z.string()).optional(),
  minSeverity: z.enum(["low", "medium", "high", "critical"]).optional(),
  languages: z.array(z.string()).optional(),
  channels: z.array(z.enum(["email", "sms", "push"])).optional(),
});
export type TargetCriteria = z.infer<typeof TargetCriteriaSchema>;

/**
 * Target count result
 */
export const TargetCountSchema = z.object({
  total: z.number().int().nonnegative(),
  byChannel: z.object({
    email: z.number().int().nonnegative(),
    sms: z.number().int().nonnegative(),
    push: z.number().int().nonnegative(),
  }),
});
export type TargetCount = z.infer<typeof TargetCountSchema>;
