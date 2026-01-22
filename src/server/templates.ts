import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { requirePermission } from "../lib/auth";
import { logAudit } from "./audit";

/**
 * Template server functions
 * CRUD operations for message templates
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Template {
  id: string;
  name: string;
  description: string | null;
  incident_type: string | null;
  channel_type: string | null;
  content: string;
  parameters: string | null;
  language: string;
  is_default: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// INPUT VALIDATORS
// ============================================

const CreateTemplateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  incidentType: z.string().optional(),
  channelType: z.enum(["email", "sms", "push", "twitter", "signage"]).optional(),
  content: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  language: z.string().default("en"),
  isDefault: z.boolean().default(false),
});

const GetTemplatesInput = z.object({
  incidentType: z.string().optional(),
  channelType: z.string().optional(),
  language: z.string().optional(),
  limit: z.number().optional(),
});

const GetTemplateInput = z.object({
  id: z.string(),
});

const UpdateTemplateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  incidentType: z.string().nullable().optional(),
  channelType: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  parameters: z.record(z.any()).optional(),
  language: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const DeleteTemplateInput = z.object({
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
 * Get all templates with optional filtering
 */
export const getTemplates = createServerFn({ method: "GET" })
  .inputValidator(GetTemplatesInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.view");
    const db = getDB();

    let query = `SELECT * FROM templates WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.incidentType) {
      query += ` AND (incident_type = ? OR incident_type IS NULL)`;
      params.push(data.incidentType);
    }

    if (data.channelType) {
      query += ` AND (channel_type = ? OR channel_type IS NULL)`;
      params.push(data.channelType);
    }

    if (data.language) {
      query += ` AND language = ?`;
      params.push(data.language);
    }

    query += ` ORDER BY is_default DESC, name ASC LIMIT ?`;
    params.push(data.limit || 100);

    const result = await db.prepare(query).bind(...params).all<Template>();

    return { templates: result.results };
  });

/**
 * Get a single template by ID
 */
export const getTemplate = createServerFn({ method: "GET" })
  .inputValidator(GetTemplateInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.view");
    const db = getDB();

    const result = await db
      .prepare(`SELECT * FROM templates WHERE id = ?`)
      .bind(data.id)
      .first<Template>();

    if (!result) {
      throw new Error("Template not found");
    }

    return { template: result };
  });

/**
 * Create a new template
 */
export const createTemplate = createServerFn({ method: "POST" })
  .inputValidator(CreateTemplateInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("templates.create");
    const db = getDB();
    const userId = auth.user.id;

    const id = generateId("tpl");

    // If this is being set as default, unset other defaults for same type/channel
    if (data.isDefault) {
      await db
        .prepare(
          `UPDATE templates SET is_default = 0
           WHERE (incident_type = ? OR (incident_type IS NULL AND ? IS NULL))
           AND (channel_type = ? OR (channel_type IS NULL AND ? IS NULL))`
        )
        .bind(
          data.incidentType || null,
          data.incidentType || null,
          data.channelType || null,
          data.channelType || null
        )
        .run();
    }

    const result = await db
      .prepare(
        `INSERT INTO templates (
          id, name, description, incident_type, channel_type,
          content, parameters, language, is_default, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        id,
        data.name,
        data.description || null,
        data.incidentType || null,
        data.channelType || null,
        data.content,
        data.parameters ? JSON.stringify(data.parameters) : null,
        data.language,
        data.isDefault ? 1 : 0,
        userId
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to create template");
    }

    // Log template creation
    await logAudit({
      action: "create",
      resourceType: "template",
      resourceId: id,
      resourceName: data.name,
      details: {
        incidentType: data.incidentType,
        channelType: data.channelType,
        language: data.language,
        isDefault: data.isDefault,
      },
    });

    return { success: true, id };
  });

/**
 * Update an existing template
 */
export const updateTemplate = createServerFn({ method: "POST" })
  .inputValidator(UpdateTemplateInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.edit");
    const db = getDB();

    // Get original template for change tracking
    const original = await db
      .prepare("SELECT * FROM templates WHERE id = ?")
      .bind(data.id)
      .first<Template>();

    if (!original) {
      throw new Error("Template not found");
    }

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description || null);
    }
    if (data.incidentType !== undefined) {
      updates.push("incident_type = ?");
      params.push(data.incidentType);
    }
    if (data.channelType !== undefined) {
      updates.push("channel_type = ?");
      params.push(data.channelType);
    }
    if (data.content !== undefined) {
      updates.push("content = ?");
      params.push(data.content);
    }
    if (data.parameters !== undefined) {
      updates.push("parameters = ?");
      params.push(JSON.stringify(data.parameters));
    }
    if (data.language !== undefined) {
      updates.push("language = ?");
      params.push(data.language);
    }
    if (data.isDefault !== undefined) {
      updates.push("is_default = ?");
      params.push(data.isDefault ? 1 : 0);

      // If setting as default, unset others
      if (data.isDefault) {
        const template = await db
          .prepare("SELECT incident_type, channel_type FROM templates WHERE id = ?")
          .bind(data.id)
          .first<{ incident_type: string | null; channel_type: string | null }>();

        if (template) {
          await db
            .prepare(
              `UPDATE templates SET is_default = 0
               WHERE id != ?
               AND (incident_type = ? OR (incident_type IS NULL AND ? IS NULL))
               AND (channel_type = ? OR (channel_type IS NULL AND ? IS NULL))`
            )
            .bind(
              data.id,
              template.incident_type,
              template.incident_type,
              template.channel_type,
              template.channel_type
            )
            .run();
        }
      }
    }

    params.push(data.id);

    const query = `UPDATE templates SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update template");
    }

    // Build changes object for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (data.name !== undefined && data.name !== original.name) {
      changes.name = { old: original.name, new: data.name };
    }
    if (data.content !== undefined && data.content !== original.content) {
      changes.content = { old: "...", new: "..." }; // Don't log full content
    }
    if (data.incidentType !== undefined && data.incidentType !== original.incident_type) {
      changes.incidentType = { old: original.incident_type, new: data.incidentType };
    }
    if (data.channelType !== undefined && data.channelType !== original.channel_type) {
      changes.channelType = { old: original.channel_type, new: data.channelType };
    }
    if (data.isDefault !== undefined && (data.isDefault ? 1 : 0) !== original.is_default) {
      changes.isDefault = { old: !!original.is_default, new: data.isDefault };
    }

    // Log template update if there were changes
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "update",
        resourceType: "template",
        resourceId: data.id,
        resourceName: data.name || original.name,
        changes,
      });
    }

    return { success: true };
  });

/**
 * Delete a template
 */
export const deleteTemplate = createServerFn({ method: "POST" })
  .inputValidator(DeleteTemplateInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.delete");
    const db = getDB();

    // Get template before deletion for audit log
    const template = await db
      .prepare("SELECT id, name, incident_type, channel_type FROM templates WHERE id = ?")
      .bind(data.id)
      .first<{ id: string; name: string; incident_type: string | null; channel_type: string | null }>();

    const result = await db
      .prepare("DELETE FROM templates WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete template");
    }

    // Log template deletion
    await logAudit({
      action: "delete",
      resourceType: "template",
      resourceId: data.id,
      resourceName: template?.name || data.id,
      details: {
        incidentType: template?.incident_type,
        channelType: template?.channel_type,
      },
    });

    return { success: true };
  });

/**
 * Duplicate a template
 */
export const duplicateTemplate = createServerFn({ method: "POST" })
  .inputValidator(GetTemplateInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("templates.create");
    const db = getDB();
    const userId = auth.user.id;

    // Get existing template
    const existing = await db
      .prepare("SELECT * FROM templates WHERE id = ?")
      .bind(data.id)
      .first<Template>();

    if (!existing) {
      throw new Error("Template not found");
    }

    const newId = generateId("tpl");

    const result = await db
      .prepare(
        `INSERT INTO templates (
          id, name, description, incident_type, channel_type,
          content, parameters, language, is_default, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        newId,
        `${existing.name} (Copy)`,
        existing.description,
        existing.incident_type,
        existing.channel_type,
        existing.content,
        existing.parameters,
        existing.language,
        userId
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to duplicate template");
    }

    // Log template duplication
    await logAudit({
      action: "create",
      resourceType: "template",
      resourceId: newId,
      resourceName: `${existing.name} (Copy)`,
      details: {
        duplicatedFrom: data.id,
        originalName: existing.name,
      },
    });

    return { success: true, id: newId };
  });

/**
 * Get template statistics
 */
export const getTemplateStats = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("templates.view");
  const db = getDB();

  const [total, byChannel, byType] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM templates").first<{ count: number }>(),
    db
      .prepare(
        `SELECT channel_type, COUNT(*) as count FROM templates
         GROUP BY channel_type`
      )
      .all<{ channel_type: string | null; count: number }>(),
    db
      .prepare(
        `SELECT incident_type, COUNT(*) as count FROM templates
         GROUP BY incident_type`
      )
      .all<{ incident_type: string | null; count: number }>(),
  ]);

  return {
    total: total?.count || 0,
    byChannel: byChannel.results,
    byType: byType.results,
  };
});

/**
 * Render a template with variables
 */
const RenderTemplateInput = z.object({
  templateId: z.string(),
  variables: z.record(z.string()),
});

export const renderTemplate = createServerFn({ method: "POST" })
  .inputValidator(RenderTemplateInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.view");
    const db = getDB();

    const template = await db
      .prepare("SELECT content FROM templates WHERE id = ?")
      .bind(data.templateId)
      .first<{ content: string }>();

    if (!template) {
      throw new Error("Template not found");
    }

    // Replace {{variable}} placeholders with values
    let rendered = template.content;
    for (const [key, value] of Object.entries(data.variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      rendered = rendered.replace(regex, value);
    }

    return { rendered };
  });

/**
 * Seed default templates (admin only)
 */
export const seedDefaultTemplates = createServerFn({ method: "POST" }).handler(
  async () => {
    const auth = await requirePermission("templates.create");
    const db = getDB();
    const userId = auth.user.id;

    const defaultTemplates = [
      // Service Disruption Templates
      {
        id: "tpl_disruption_general",
        name: "Service Disruption - General",
        description: "General service disruption announcement",
        incident_type: "service_disruption",
        channel_type: null,
        content: `UTA Service Alert: {{title}}

{{routes}} service is currently experiencing disruptions.

Impact: {{description}}

We apologize for the inconvenience. Updates will be provided as more information becomes available.

For trip planning assistance, visit rideuta.com or call 801-RIDE-UTA.`,
        is_default: 1,
      },
      {
        id: "tpl_disruption_sms",
        name: "Service Disruption - SMS",
        description: "Short disruption alert for SMS",
        incident_type: "service_disruption",
        channel_type: "sms",
        content: `UTA Alert: {{routes}} disruption - {{title}}. Check rideuta.com for updates.`,
        is_default: 1,
      },

      // Delay Templates
      {
        id: "tpl_delay_general",
        name: "Delay Notice - General",
        description: "Service delay notification",
        incident_type: "delay",
        channel_type: null,
        content: `UTA Delay Notice: {{title}}

{{routes}} is experiencing delays of approximately {{delay_time}}.

Reason: {{description}}

We recommend allowing extra travel time. Normal service is expected to resume {{resolution_time}}.

Thank you for your patience.`,
        is_default: 1,
      },
      {
        id: "tpl_delay_sms",
        name: "Delay Notice - SMS",
        description: "Short delay alert for SMS",
        incident_type: "delay",
        channel_type: "sms",
        content: `UTA: {{routes}} delayed ~{{delay_time}}. {{title}}. Allow extra time.`,
        is_default: 1,
      },

      // Detour Templates
      {
        id: "tpl_detour_general",
        name: "Detour Notice - General",
        description: "Route detour notification",
        incident_type: "detour",
        channel_type: null,
        content: `UTA Detour Notice: {{title}}

{{routes}} is currently on detour.

Affected stops: {{affected_stops}}
Temporary stops: {{temp_stops}}

Reason: {{description}}

Detour expected until: {{resolution_time}}

Plan your trip at rideuta.com for updated route information.`,
        is_default: 1,
      },
      {
        id: "tpl_detour_sms",
        name: "Detour Notice - SMS",
        description: "Short detour alert for SMS",
        incident_type: "detour",
        channel_type: "sms",
        content: `UTA: {{routes}} on detour. {{title}}. Check rideuta.com for temp stops.`,
        is_default: 1,
      },

      // Station Closure Templates
      {
        id: "tpl_closure_general",
        name: "Station/Stop Closure - General",
        description: "Station or stop closure notification",
        incident_type: "station_closure",
        channel_type: null,
        content: `UTA Station Closure: {{title}}

{{station_name}} is temporarily closed.

Affected services: {{routes}}
Alternative: {{alternative}}

Reason: {{description}}

Expected reopening: {{resolution_time}}

We apologize for any inconvenience.`,
        is_default: 1,
      },

      // Weather Templates
      {
        id: "tpl_weather_general",
        name: "Weather Impact - General",
        description: "Weather-related service impact",
        incident_type: "weather",
        channel_type: null,
        content: `UTA Weather Alert: {{title}}

Due to {{weather_condition}}, the following services are affected:
{{routes}}

Impact: {{description}}

For your safety, please:
• Allow extra travel time
• Check rideuta.com before traveling
• Consider delaying non-essential trips

Updates will be provided as conditions change.`,
        is_default: 1,
      },
      {
        id: "tpl_weather_sms",
        name: "Weather Impact - SMS",
        description: "Short weather alert for SMS",
        incident_type: "weather",
        channel_type: "sms",
        content: `UTA Weather: {{routes}} affected by {{weather_condition}}. Expect delays. Check rideuta.com.`,
        is_default: 1,
      },

      // Safety Alert Templates
      {
        id: "tpl_safety_general",
        name: "Safety Alert - General",
        description: "Safety-related announcement",
        incident_type: "safety_issue",
        channel_type: null,
        content: `UTA Safety Notice: {{title}}

{{description}}

Affected services: {{routes}}

Please follow instructions from UTA personnel and local authorities.

For emergencies, call 911.
For UTA assistance, call 801-RIDE-UTA.`,
        is_default: 1,
      },

      // Maintenance Templates
      {
        id: "tpl_maintenance_general",
        name: "Planned Maintenance - General",
        description: "Scheduled maintenance notification",
        incident_type: "maintenance",
        channel_type: null,
        content: `UTA Planned Maintenance: {{title}}

Date: {{maintenance_date}}
Time: {{maintenance_time}}

Affected services: {{routes}}
Impact: {{description}}

Alternative service: {{alternative}}

We appreciate your understanding as we work to improve your transit experience.`,
        is_default: 1,
      },

      // Special Event Templates
      {
        id: "tpl_event_general",
        name: "Special Event - General",
        description: "Special event service notification",
        incident_type: "special_event",
        channel_type: null,
        content: `UTA Special Event Service: {{title}}

Event: {{event_name}}
Date: {{event_date}}

Service adjustments:
{{description}}

Affected routes: {{routes}}

For event service details, visit rideuta.com/events.`,
        is_default: 1,
      },

      // Resolution Templates
      {
        id: "tpl_resolved_general",
        name: "Service Restored - General",
        description: "Incident resolved notification",
        incident_type: null,
        channel_type: null,
        content: `UTA Service Update: {{title}} - RESOLVED

Normal service has resumed on {{routes}}.

Thank you for your patience during this disruption.

For real-time updates, follow @RideUTA or visit rideuta.com.`,
        is_default: 0,
      },
      {
        id: "tpl_resolved_sms",
        name: "Service Restored - SMS",
        description: "Short resolution alert for SMS",
        incident_type: null,
        channel_type: "sms",
        content: `UTA: {{routes}} service restored. {{title}} resolved. Thank you for your patience.`,
        is_default: 0,
      },

      // Update Templates
      {
        id: "tpl_update_general",
        name: "Incident Update - General",
        description: "Ongoing incident update",
        incident_type: null,
        channel_type: null,
        content: `UTA Incident Update: {{title}}

Current status: {{status}}
Affected services: {{routes}}

Update: {{description}}

Estimated resolution: {{resolution_time}}

We will continue to provide updates. Thank you for your patience.`,
        is_default: 0,
      },
    ];

    let inserted = 0;
    for (const template of defaultTemplates) {
      try {
        await db
          .prepare(
            `INSERT OR IGNORE INTO templates (
              id, name, description, incident_type, channel_type,
              content, language, is_default, created_by,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'en', ?, ?, datetime('now'), datetime('now'))`
          )
          .bind(
            template.id,
            template.name,
            template.description,
            template.incident_type,
            template.channel_type,
            template.content,
            template.is_default,
            userId
          )
          .run();
        inserted++;
      } catch (err) {
        // Template may already exist, continue
        console.error(`Failed to insert template ${template.id}:`, err);
      }
    }

    return { success: true, inserted };
  }
);

/**
 * Get templates for incident type (for dropdown)
 */
export const getTemplatesForIncident = createServerFn({ method: "GET" })
  .inputValidator(z.object({ incidentType: z.string() }))
  .handler(async ({ data }) => {
    await requirePermission("templates.view");
    const db = getDB();

    const result = await db
      .prepare(
        `SELECT id, name, description, channel_type, content, is_default
         FROM templates
         WHERE incident_type = ? OR incident_type IS NULL
         ORDER BY
           CASE WHEN incident_type = ? THEN 0 ELSE 1 END,
           is_default DESC,
           name ASC`
      )
      .bind(data.incidentType, data.incidentType)
      .all<{
        id: string;
        name: string;
        description: string | null;
        channel_type: string | null;
        content: string;
        is_default: number;
      }>();

    return { templates: result.results };
  });

/**
 * Render a template with incident data
 * Automatically substitutes incident fields into template variables
 */
const RenderTemplateWithIncidentInput = z.object({
  templateId: z.string(),
  incidentId: z.string(),
  additionalVariables: z.record(z.string()).optional(),
});

export const renderTemplateWithIncident = createServerFn({ method: "POST" })
  .inputValidator(RenderTemplateWithIncidentInput)
  .handler(async ({ data }) => {
    await requirePermission("templates.view");
    const db = getDB();

    // Get template
    const template = await db
      .prepare("SELECT content FROM templates WHERE id = ?")
      .bind(data.templateId)
      .first<{ content: string }>();

    if (!template) {
      throw new Error("Template not found");
    }

    // Get incident
    const incident = await db
      .prepare("SELECT * FROM incidents WHERE id = ?")
      .bind(data.incidentId)
      .first<{
        id: string;
        incident_number: number | null;
        incident_type: string;
        severity: string;
        status: string;
        title: string;
        affected_modes: string | null;
        affected_routes: string | null;
        start_time: string | null;
        estimated_resolution: string | null;
        public_message: string | null;
      }>();

    if (!incident) {
      throw new Error("Incident not found");
    }

    // Parse JSON fields
    const affectedModes = incident.affected_modes
      ? JSON.parse(incident.affected_modes).join(", ")
      : "";
    const affectedRoutes = incident.affected_routes
      ? JSON.parse(incident.affected_routes).join(", ")
      : "";

    // Build variables from incident data
    const variables: Record<string, string> = {
      // Incident fields
      title: incident.title,
      incident_title: incident.title,
      incident_type: incident.incident_type.replace(/_/g, " "),
      severity: incident.severity,
      status: incident.status,
      routes: affectedRoutes,
      affected_routes: affectedRoutes,
      modes: affectedModes,
      affected_modes: affectedModes,
      description: incident.public_message || "",
      public_message: incident.public_message || "",
      start_time: incident.start_time
        ? new Date(incident.start_time).toLocaleString()
        : "",
      resolution_time: incident.estimated_resolution
        ? new Date(incident.estimated_resolution).toLocaleString()
        : "TBD",
      estimated_resolution: incident.estimated_resolution
        ? new Date(incident.estimated_resolution).toLocaleString()
        : "TBD",
      incident_number: incident.incident_number?.toString() || "",
      incident_id: incident.id,

      // Agency info
      agency_name: "UTA",
      agency_phone: "801-RIDE-UTA",
      agency_website: "rideuta.com",

      // Current date/time
      current_date: new Date().toLocaleDateString(),
      current_time: new Date().toLocaleTimeString(),

      // Merge any additional variables
      ...(data.additionalVariables || {}),
    };

    // Replace {{variable}} placeholders with values
    let rendered = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      rendered = rendered.replace(regex, value);
    }

    return { rendered, variables };
  });
