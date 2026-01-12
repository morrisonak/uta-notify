import { z } from "zod";

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const IncidentSeverity = z.enum(["low", "medium", "high", "critical"]);
export type IncidentSeverity = z.infer<typeof IncidentSeverity>;

export const IncidentStatus = z.enum(["draft", "active", "updated", "resolved", "archived"]);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const IncidentChangeType = z.enum([
  "create",
  "update",
  "status_change",
  "resolve",
  "archive",
]);
export type IncidentChangeType = z.infer<typeof IncidentChangeType>;

// Default incident types (matches seed data)
export const DefaultIncidentTypes = [
  "type_delay",
  "type_detour",
  "type_suspension",
  "type_accident",
  "type_weather",
  "type_maintenance",
  "type_security",
  "type_other",
] as const;

// Default transit modes (matches seed data)
export const DefaultTransitModes = [
  "mode_rail",
  "mode_bus",
  "mode_streetcar",
  "mode_paratransit",
  "mode_ski",
] as const;

// ============================================
// SUB-SCHEMAS
// ============================================

export const GeographicScopeSchema = z.object({
  stops: z.array(z.string()).optional(),
  stations: z.array(z.string()).optional(),
  polygon: z
    .array(z.tuple([z.number(), z.number()])) // [lat, lng] pairs
    .min(3)
    .optional(),
});
export type GeographicScope = z.infer<typeof GeographicScopeSchema>;

export const IncidentAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  r2Key: z.string(),
  uploadedBy: z.string(),
  createdAt: z.string().datetime(),
});
export type IncidentAttachment = z.infer<typeof IncidentAttachmentSchema>;

// ============================================
// INCIDENT SCHEMAS
// ============================================

/**
 * Base incident fields (shared between create/update/response)
 */
const IncidentBaseFields = {
  incidentType: z.string().min(1, "Incident type is required"),
  severity: IncidentSeverity,
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  affectedModes: z.array(z.string()).optional(),
  affectedRoutes: z.array(z.string()).optional(),
  geographicScope: GeographicScopeSchema.optional(),
  startTime: z.string().datetime().optional().nullable(),
  estimatedResolution: z.string().datetime().optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
  publicMessage: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
};

/**
 * Create incident input
 */
export const CreateIncidentSchema = z.object({
  ...IncidentBaseFields,
  // Status defaults to 'draft' on creation
  status: IncidentStatus.optional().default("draft"),
});
export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;

/**
 * Update incident input
 */
export const UpdateIncidentSchema = z
  .object({
    ...IncidentBaseFields,
    status: IncidentStatus.optional(),
    changeReason: z.string().max(500).optional(),
  })
  .partial();
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>;

/**
 * Incident response (from database)
 */
export const IncidentSchema = z.object({
  id: z.string(),
  incidentNumber: z.number().int().positive().nullable(),
  incidentType: z.string(),
  severity: IncidentSeverity,
  status: IncidentStatus,
  title: z.string(),
  affectedModes: z.array(z.string()).nullable(),
  affectedRoutes: z.array(z.string()).nullable(),
  geographicScope: GeographicScopeSchema.nullable(),
  startTime: z.string().datetime().nullable(),
  estimatedResolution: z.string().datetime().nullable(),
  actualResolution: z.string().datetime().nullable(),
  internalNotes: z.string().nullable(),
  publicMessage: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  currentVersion: z.number().int().positive(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
});
export type Incident = z.infer<typeof IncidentSchema>;

/**
 * Incident with additional relations
 */
export const IncidentWithRelationsSchema = IncidentSchema.extend({
  createdByUser: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .optional(),
  attachments: z.array(IncidentAttachmentSchema).optional(),
  latestVersion: z
    .object({
      version: z.number(),
      changedAt: z.string().datetime(),
      changedBy: z.string(),
      changeReason: z.string().nullable(),
    })
    .optional(),
});
export type IncidentWithRelations = z.infer<typeof IncidentWithRelationsSchema>;

/**
 * Incident version history entry
 */
export const IncidentVersionSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  version: z.number().int().positive(),
  snapshot: z.record(z.unknown()), // Full incident state
  publicMessage: z.string().nullable(),
  changedBy: z.string(),
  changedAt: z.string().datetime(),
  changeReason: z.string().nullable(),
  changeType: IncidentChangeType.nullable(),
});
export type IncidentVersion = z.infer<typeof IncidentVersionSchema>;

// ============================================
// LIST & FILTER SCHEMAS
// ============================================

export const IncidentListFiltersSchema = z.object({
  status: z.array(IncidentStatus).optional(),
  severity: z.array(IncidentSeverity).optional(),
  incidentType: z.array(z.string()).optional(),
  affectedModes: z.array(z.string()).optional(),
  affectedRoutes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  createdBy: z.string().optional(),
});
export type IncidentListFilters = z.infer<typeof IncidentListFiltersSchema>;

export const IncidentListParamsSchema = z.object({
  filters: IncidentListFiltersSchema.optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "severity", "status", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type IncidentListParams = z.infer<typeof IncidentListParamsSchema>;

export const IncidentListResponseSchema = z.object({
  incidents: z.array(IncidentSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type IncidentListResponse = z.infer<typeof IncidentListResponseSchema>;

// ============================================
// ACTION SCHEMAS
// ============================================

export const ActivateIncidentSchema = z.object({
  publicMessage: z.string().min(1, "Public message is required to activate"),
});
export type ActivateIncidentInput = z.infer<typeof ActivateIncidentSchema>;

export const ResolveIncidentSchema = z.object({
  resolutionNotes: z.string().max(2000).optional(),
  publicMessage: z.string().optional(),
});
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentSchema>;

// ============================================
// HELPER TYPES
// ============================================

/**
 * Incident summary for lists and dashboards
 */
export interface IncidentSummary {
  id: string;
  incidentNumber: number | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  incidentType: string;
  affectedModes: string[] | null;
  affectedRoutes: string[] | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Incident counts by status
 */
export interface IncidentStatusCounts {
  draft: number;
  active: number;
  updated: number;
  resolved: number;
  archived: number;
  total: number;
}

/**
 * Severity configuration
 */
export const SeverityConfig: Record<
  IncidentSeverity,
  { label: string; color: string; priority: number }
> = {
  low: { label: "Low", color: "green", priority: 1 },
  medium: { label: "Medium", color: "amber", priority: 2 },
  high: { label: "High", color: "orange", priority: 3 },
  critical: { label: "Critical", color: "red", priority: 4 },
};

/**
 * Status configuration
 */
export const StatusConfig: Record<
  IncidentStatus,
  { label: string; color: string; allowedTransitions: IncidentStatus[] }
> = {
  draft: {
    label: "Draft",
    color: "gray",
    allowedTransitions: ["active"],
  },
  active: {
    label: "Active",
    color: "red",
    allowedTransitions: ["updated", "resolved"],
  },
  updated: {
    label: "Updated",
    color: "amber",
    allowedTransitions: ["updated", "resolved"],
  },
  resolved: {
    label: "Resolved",
    color: "green",
    allowedTransitions: ["active", "archived"],
  },
  archived: {
    label: "Archived",
    color: "gray",
    allowedTransitions: [],
  },
};
