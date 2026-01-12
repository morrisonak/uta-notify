import { z } from "zod";
import { ChannelType } from "../messages/message.schema";

// ============================================
// TEMPLATE PARAMETER SCHEMAS
// ============================================

/**
 * Template parameter type
 */
export const TemplateParameterType = z.enum(["string", "number", "date", "list", "boolean"]);
export type TemplateParameterType = z.infer<typeof TemplateParameterType>;

/**
 * Template parameter definition
 */
export const TemplateParameterSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid parameter name"),
  type: TemplateParameterType,
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(true),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string()).optional(), // For list type
  format: z.string().optional(), // For date type (e.g., "YYYY-MM-DD")
});
export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;

// ============================================
// TEMPLATE SCHEMAS
// ============================================

/**
 * Create template input
 */
export const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  incidentType: z.string().optional(), // null = all types
  channelType: ChannelType.optional(), // null = all channels
  content: z.string().min(1, "Content is required").max(10000),
  parameters: z.array(TemplateParameterSchema).optional(),
  language: z.string().default("en"),
  isDefault: z.boolean().default(false),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

/**
 * Update template input
 */
export const UpdateTemplateSchema = CreateTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;

/**
 * Template response (from database)
 */
export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  incidentType: z.string().nullable(),
  channelType: ChannelType.nullable(),
  content: z.string(),
  parameters: z.array(TemplateParameterSchema).nullable(),
  language: z.string(),
  isDefault: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Template = z.infer<typeof TemplateSchema>;

// ============================================
// TEMPLATE RENDERING
// ============================================

/**
 * Template render input
 */
export const RenderTemplateSchema = z.object({
  templateId: z.string(),
  parameters: z.record(z.unknown()),
  channelType: ChannelType.optional(), // For channel-specific formatting
});
export type RenderTemplateInput = z.infer<typeof RenderTemplateSchema>;

/**
 * Template render result
 */
export const RenderResultSchema = z.object({
  content: z.string(),
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  missingParameters: z.array(z.string()),
});
export type RenderResult = z.infer<typeof RenderResultSchema>;

// ============================================
// LIST & FILTER SCHEMAS
// ============================================

export const TemplateListFiltersSchema = z.object({
  incidentType: z.string().optional(),
  channelType: ChannelType.optional(),
  language: z.string().optional(),
  search: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type TemplateListFilters = z.infer<typeof TemplateListFiltersSchema>;

// ============================================
// PREDEFINED TEMPLATE VARIABLES
// ============================================

/**
 * System-provided variables available in all templates
 */
export const SystemTemplateVariables = {
  // Incident variables
  incident_id: { type: "string" as const, description: "Incident ID" },
  incident_number: { type: "number" as const, description: "Incident number" },
  incident_title: { type: "string" as const, description: "Incident title" },
  incident_type: { type: "string" as const, description: "Incident type name" },
  incident_severity: { type: "string" as const, description: "Severity level" },
  incident_status: { type: "string" as const, description: "Current status" },
  affected_routes: { type: "list" as const, description: "List of affected routes" },
  affected_modes: { type: "list" as const, description: "List of affected modes" },
  start_time: { type: "date" as const, description: "Incident start time" },
  estimated_resolution: { type: "date" as const, description: "Estimated resolution time" },
  public_message: { type: "string" as const, description: "Public message content" },

  // Formatting helpers
  current_date: { type: "date" as const, description: "Current date" },
  current_time: { type: "date" as const, description: "Current time" },
  agency_name: { type: "string" as const, description: "Transit agency name (UTA)" },
  agency_phone: { type: "string" as const, description: "Agency contact phone" },
  agency_website: { type: "string" as const, description: "Agency website URL" },
} as const;

/**
 * Example templates for different scenarios
 */
export const ExampleTemplates = {
  delay: {
    name: "Service Delay Notice",
    content: `Service Alert: {{incident_title}}

{{public_message}}

Affected: {{affected_routes}}
Estimated Resolution: {{estimated_resolution}}

For real-time updates, visit {{agency_website}} or call {{agency_phone}}.`,
    parameters: [],
  },
  detour: {
    name: "Detour Notice",
    content: `Detour in Effect: {{incident_title}}

{{public_message}}

Routes Affected: {{affected_routes}}

Please allow extra time for your trip. Check {{agency_website}} for detour maps.`,
    parameters: [],
  },
  resolved: {
    name: "Service Restored",
    content: `Service Restored: {{incident_title}}

Normal service has resumed for {{affected_routes}}.

Thank you for your patience.`,
    parameters: [],
  },
};
