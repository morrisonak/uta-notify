import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { requirePermission, getCurrentUser } from "../lib/auth";
import { hasPermission } from "../lib/permissions";
import { logAudit } from "./audit";

/**
 * Incident server functions
 * CRUD operations for incident management
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Incident {
  id: string;
  incident_number: number | null;
  incident_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "updated" | "resolved" | "archived";
  title: string;
  affected_modes: string | null;
  affected_routes: string | null;
  geographic_scope: string | null;
  start_time: string | null;
  estimated_resolution: string | null;
  actual_resolution: string | null;
  internal_notes: string | null;
  public_message: string | null;
  tags: string | null;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  archived_at: string | null;
}

// ============================================
// INPUT VALIDATORS
// ============================================

const CreateIncidentInput = z.object({
  title: z.string().min(1).max(200),
  incidentType: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedModes: z.array(z.string()).optional(),
  affectedRoutes: z.array(z.string()).optional(),
  publicMessage: z.string().optional(),
  internalNotes: z.string().optional(),
  startTime: z.string().optional(),
  estimatedResolution: z.string().optional(),
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

const GetIncidentsInput = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  limit: z.number().optional(),
});

const GetIncidentInput = z.object({
  id: z.string(),
});

const DeleteIncidentInput = z.object({
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
 * Get all incidents with optional filtering
 */
export const getIncidents = createServerFn({ method: "GET" })
  .inputValidator(GetIncidentsInput)
  .handler(async ({ data }) => {
    await requirePermission("incidents.view");
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

    const result = await db.prepare(query).bind(...params).all<Incident>();

    return { incidents: result.results };
  });

/**
 * Get a single incident by ID
 */
export const getIncident = createServerFn({ method: "GET" })
  .inputValidator(GetIncidentInput)
  .handler(async ({ data }) => {
    await requirePermission("incidents.view");
    const db = getDB();

    const result = await db
      .prepare(`SELECT * FROM incidents WHERE id = ?`)
      .bind(data.id)
      .first<Incident>();

    if (!result) {
      throw new Error("Incident not found");
    }

    return { incident: result };
  });

/**
 * Create a new incident
 */
export const createIncident = createServerFn({ method: "POST" })
  .inputValidator(CreateIncidentInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("incidents.create");
    const db = getDB();
    const userId = auth.user.id;

    const id = generateId("inc");
    const auditId = `aud_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const requestId = `req_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const createdAt = new Date().toISOString();

    // Use batch to make both operations atomic
    const incidentStmt = db
      .prepare(
        `INSERT INTO incidents (
          id, incident_type, severity, status, title,
          affected_modes, affected_routes, public_message, internal_notes,
          start_time, estimated_resolution, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
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
        data.startTime || null,
        data.estimatedResolution || null,
        userId
      );

    const auditStmt = db
      .prepare(
        `INSERT INTO audit_log (
          id, actor_id, actor_type, actor_name, action, resource_type,
          resource_id, resource_name, details, changes, ip_address,
          user_agent, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        auth.user.id,
        "user",
        auth.user.name,
        "create",
        "incident",
        id,
        data.title,
        JSON.stringify({
          incidentType: data.incidentType,
          severity: data.severity,
          affectedModes: data.affectedModes,
          affectedRoutes: data.affectedRoutes,
        }),
        null,
        null,
        null,
        requestId,
        createdAt
      );

    const results = await db.batch([incidentStmt, auditStmt]);

    if (!results[0].success) {
      throw new Error("Failed to create incident");
    }

    return { success: true, id };
  });

/**
 * Update an existing incident
 */
export const updateIncident = createServerFn({ method: "POST" })
  .inputValidator(UpdateIncidentInput)
  .handler(async ({ data }) => {
    // Base permission to edit incidents
    const auth = await requirePermission("incidents.edit");
    const db = getDB();

    // Fetch original for audit trail
    const original = await db
      .prepare("SELECT * FROM incidents WHERE id = ?")
      .bind(data.id)
      .first<Incident>();

    if (!original) {
      throw new Error("Incident not found");
    }

    // Check status-specific permissions
    if (data.status !== undefined) {
      // Publishing (activating) an incident requires publish permission
      if (data.status === "active") {
        if (!hasPermission(auth.user, "incidents.publish")) {
          throw new Error("Forbidden: Missing permission to publish incidents");
        }
      }
      // Resolving an incident requires resolve permission
      if (data.status === "resolved") {
        if (!hasPermission(auth.user, "incidents.resolve")) {
          throw new Error("Forbidden: Missing permission to resolve incidents");
        }
      }
      // Archiving an incident requires archive permission
      if (data.status === "archived") {
        if (!hasPermission(auth.user, "incidents.archive")) {
          throw new Error("Forbidden: Missing permission to archive incidents");
        }
      }
    }

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
    updates.push("current_version = current_version + 1");

    params.push(data.id);

    const query = `UPDATE incidents SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update incident");
    }

    // Build changes object for audit
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (data.title !== undefined && data.title !== original.title) {
      changes.title = { old: original.title, new: data.title };
    }
    if (data.severity !== undefined && data.severity !== original.severity) {
      changes.severity = { old: original.severity, new: data.severity };
    }
    if (data.status !== undefined && data.status !== original.status) {
      changes.status = { old: original.status, new: data.status };
    }
    if (data.publicMessage !== undefined && data.publicMessage !== original.public_message) {
      changes.publicMessage = { old: original.public_message, new: data.publicMessage };
    }

    // Determine action type
    let action: "update" | "publish" | "resolve" | "archive" = "update";
    if (data.status === "active" && original.status !== "active") {
      action = "publish";
    } else if (data.status === "resolved") {
      action = "resolve";
    } else if (data.status === "archived") {
      action = "archive";
    }

    await logAudit({
      action,
      resourceType: "incident",
      resourceId: data.id,
      resourceName: original.title,
      actorId: auth.user.id,
      actorName: auth.user.name,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    });

    return { success: true };
  });

/**
 * Delete an incident
 */
export const deleteIncident = createServerFn({ method: "POST" })
  .inputValidator(DeleteIncidentInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("incidents.delete");
    const db = getDB();

    // Fetch incident for audit trail before deletion
    const incident = await db
      .prepare("SELECT * FROM incidents WHERE id = ?")
      .bind(data.id)
      .first<Incident>();

    const result = await db
      .prepare("DELETE FROM incidents WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete incident");
    }

    await logAudit({
      action: "delete",
      resourceType: "incident",
      resourceId: data.id,
      resourceName: incident?.title || "Unknown",
      actorId: auth.user.id,
      actorName: auth.user.name,
      details: incident ? {
        severity: incident.severity,
        status: incident.status,
        incidentType: incident.incident_type,
      } : undefined,
    });

    return { success: true };
  });

/**
 * Get active incidents for dashboard
 */
export const getActiveIncidents = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("incidents.view");
  const db = getDB();

  const result = await db
    .prepare(
      `SELECT * FROM incidents
       WHERE status IN ('active', 'updated')
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         created_at DESC
       LIMIT 10`
    )
    .all<Incident>();

  return { incidents: result.results };
});
