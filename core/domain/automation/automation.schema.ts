import { z } from "zod";
import { IncidentSeverity, IncidentStatus } from "../incidents/incident.schema";
import { ChannelType } from "../messages/message.schema";

// ============================================
// TRIGGER TYPES
// ============================================

export const TriggerType = z.enum([
  "severity_threshold", // When severity >= threshold
  "delay_duration", // When delay exceeds duration
  "incident_created", // When incident is created
  "incident_status_changed", // When status changes
  "incident_type_match", // When incident matches type
  "schedule", // Cron-based schedule
  "time_elapsed", // Time since incident created/updated
  "no_update_timeout", // No updates for X minutes
]);
export type TriggerType = z.infer<typeof TriggerType>;

// ============================================
// TRIGGER CONFIGURATION SCHEMAS
// ============================================

export const SeverityThresholdConfigSchema = z.object({
  minSeverity: IncidentSeverity,
  modes: z.array(z.string()).optional(),
  routes: z.array(z.string()).optional(),
});

export const DelayDurationConfigSchema = z.object({
  minMinutes: z.number().int().positive(),
  modes: z.array(z.string()).optional(),
  routes: z.array(z.string()).optional(),
});

export const IncidentCreatedConfigSchema = z.object({
  incidentTypes: z.array(z.string()).optional(),
  severities: z.array(IncidentSeverity).optional(),
  modes: z.array(z.string()).optional(),
});

export const StatusChangedConfigSchema = z.object({
  fromStatus: z.array(IncidentStatus).optional(),
  toStatus: z.array(IncidentStatus),
});

export const ScheduleConfigSchema = z.object({
  cron: z.string(), // Cron expression
  timezone: z.string().default("America/Denver"),
});

export const TimeElapsedConfigSchema = z.object({
  minutes: z.number().int().positive(),
  fromEvent: z.enum(["created", "updated", "activated"]),
  onlyStatus: z.array(IncidentStatus).optional(),
});

export const NoUpdateTimeoutConfigSchema = z.object({
  minutes: z.number().int().positive(),
  onlyStatus: z.array(IncidentStatus).optional(),
  severities: z.array(IncidentSeverity).optional(),
});

// Union of all trigger configs
export const TriggerConfigSchema = z.union([
  SeverityThresholdConfigSchema,
  DelayDurationConfigSchema,
  IncidentCreatedConfigSchema,
  StatusChangedConfigSchema,
  ScheduleConfigSchema,
  TimeElapsedConfigSchema,
  NoUpdateTimeoutConfigSchema,
]);
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

// ============================================
// ACTION TYPES
// ============================================

export const ActionType = z.enum([
  "send_notification", // Send to channels
  "send_email", // Send specific email
  "escalate", // Escalate to users
  "update_status", // Update incident status
  "add_tag", // Add tag to incident
  "webhook", // Call external webhook
  "create_task", // Create follow-up task
]);
export type ActionType = z.infer<typeof ActionType>;

// ============================================
// ACTION CONFIGURATION SCHEMAS
// ============================================

export const SendNotificationActionSchema = z.object({
  type: z.literal("send_notification"),
  channels: z.array(ChannelType),
  templateId: z.string().optional(),
  customMessage: z.string().optional(),
  targetSubscribers: z.boolean().default(true),
});

export const SendEmailActionSchema = z.object({
  type: z.literal("send_email"),
  to: z.array(z.string().email()),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export const EscalateActionSchema = z.object({
  type: z.literal("escalate"),
  userIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  message: z.string(),
  channels: z.array(z.enum(["email", "sms"])).default(["email"]),
});

export const UpdateStatusActionSchema = z.object({
  type: z.literal("update_status"),
  newStatus: IncidentStatus,
  reason: z.string().optional(),
});

export const AddTagActionSchema = z.object({
  type: z.literal("add_tag"),
  tags: z.array(z.string()),
});

export const WebhookActionSchema = z.object({
  type: z.literal("webhook"),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT"]).default("POST"),
  headers: z.record(z.string()).optional(),
  includeIncidentData: z.boolean().default(true),
});

// Union of all action configs
export const ActionSchema = z.union([
  SendNotificationActionSchema,
  SendEmailActionSchema,
  EscalateActionSchema,
  UpdateStatusActionSchema,
  AddTagActionSchema,
  WebhookActionSchema,
]);
export type Action = z.infer<typeof ActionSchema>;

// ============================================
// AUTOMATION RULE SCHEMAS
// ============================================

/**
 * Create automation rule input
 */
export const CreateAutomationRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  triggerType: TriggerType,
  triggerConfig: TriggerConfigSchema,
  conditions: z.record(z.unknown()).optional(), // Additional conditions
  actions: z.array(ActionSchema).min(1, "At least one action is required"),
  priority: z.number().int().min(0).max(100).default(0),
  enabled: z.boolean().default(true),
});
export type CreateAutomationRuleInput = z.infer<typeof CreateAutomationRuleSchema>;

/**
 * Update automation rule input
 */
export const UpdateAutomationRuleSchema = CreateAutomationRuleSchema.partial();
export type UpdateAutomationRuleInput = z.infer<typeof UpdateAutomationRuleSchema>;

/**
 * Automation rule response (from database)
 */
export const AutomationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  triggerType: TriggerType,
  triggerConfig: TriggerConfigSchema,
  conditions: z.record(z.unknown()).nullable(),
  actions: z.array(ActionSchema),
  priority: z.number().int(),
  enabled: z.boolean(),
  lastTriggeredAt: z.string().datetime().nullable(),
  triggerCount: z.number().int().nonnegative(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

// ============================================
// EXECUTION SCHEMAS
// ============================================

/**
 * Automation execution result
 */
export const AutomationExecutionSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  incidentId: z.string().nullable(),
  triggerData: z.record(z.unknown()).nullable(),
  actionsExecuted: z.array(
    z.object({
      action: ActionSchema,
      success: z.boolean(),
      result: z.unknown().optional(),
      error: z.string().optional(),
    })
  ),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
  executionTimeMs: z.number().int().nonnegative().nullable(),
  executedAt: z.string().datetime(),
});
export type AutomationExecution = z.infer<typeof AutomationExecutionSchema>;

// ============================================
// LIST & FILTER
// ============================================

export const AutomationRuleListFiltersSchema = z.object({
  triggerType: z.array(TriggerType).optional(),
  enabled: z.boolean().optional(),
  search: z.string().optional(),
});
export type AutomationRuleListFilters = z.infer<typeof AutomationRuleListFiltersSchema>;

// ============================================
// TEST/SIMULATE
// ============================================

/**
 * Test rule input
 */
export const TestAutomationRuleSchema = z.object({
  ruleId: z.string(),
  incidentId: z.string().optional(),
  mockData: z.record(z.unknown()).optional(),
  dryRun: z.boolean().default(true), // Don't actually execute actions
});
export type TestAutomationRuleInput = z.infer<typeof TestAutomationRuleSchema>;

/**
 * Test result
 */
export const TestResultSchema = z.object({
  wouldTrigger: z.boolean(),
  triggerReason: z.string().optional(),
  actionsToExecute: z.array(ActionSchema),
  warnings: z.array(z.string()),
});
export type TestResult = z.infer<typeof TestResultSchema>;
