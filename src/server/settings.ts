import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import { requirePermission } from "../lib/auth";

/**
 * Settings server functions
 * CRUD operations for application settings
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ============================================
// INPUT VALIDATORS
// ============================================

const GetSettingInput = z.object({
  key: z.string(),
});

const GetSettingsInput = z.object({
  prefix: z.string().optional(),
});

const UpdateSettingInput = z.object({
  key: z.string(),
  value: z.any(),
  description: z.string().optional(),
});

const UpdateSettingsInput = z.object({
  settings: z.array(
    z.object({
      key: z.string(),
      value: z.any(),
    })
  ),
});

// ============================================
// SERVER FUNCTIONS
// ============================================

/**
 * Get a single setting by key
 */
export const getSetting = createServerFn({ method: "GET" })
  .inputValidator(GetSettingInput)
  .handler(async ({ data }) => {
    await requirePermission("settings.view");
    const db = getDB();

    const result = await db
      .prepare("SELECT * FROM settings WHERE key = ?")
      .bind(data.key)
      .first<Setting>();

    if (!result) {
      return { setting: null, value: null };
    }

    let parsedValue;
    try {
      parsedValue = JSON.parse(result.value);
    } catch {
      parsedValue = result.value;
    }

    return { setting: result, value: parsedValue };
  });

/**
 * Get all settings, optionally filtered by prefix
 */
export const getSettings = createServerFn({ method: "GET" })
  .inputValidator(GetSettingsInput)
  .handler(async ({ data }) => {
    await requirePermission("settings.view");
    const db = getDB();

    let query = "SELECT * FROM settings";
    const params: string[] = [];

    if (data.prefix) {
      query += " WHERE key LIKE ?";
      params.push(`${data.prefix}%`);
    }

    query += " ORDER BY key ASC";

    const result = await db.prepare(query).bind(...params).all<Setting>();

    // Parse JSON values
    const settings = result.results.map((s) => {
      let parsedValue;
      try {
        parsedValue = JSON.parse(s.value);
      } catch {
        parsedValue = s.value;
      }
      return { ...s, parsedValue };
    });

    return { settings };
  });

/**
 * Update a single setting
 */
export const updateSetting = createServerFn({ method: "POST" })
  .inputValidator(UpdateSettingInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("settings.edit");
    const db = getDB();
    const userId = auth.user.id;

    const valueStr =
      typeof data.value === "string"
        ? data.value
        : JSON.stringify(data.value);

    // Upsert the setting
    const result = await db
      .prepare(
        `INSERT INTO settings (key, value, description, updated_by, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           description = COALESCE(excluded.description, settings.description),
           updated_by = excluded.updated_by,
           updated_at = datetime('now')`
      )
      .bind(data.key, valueStr, data.description || null, userId)
      .run();

    if (!result.success) {
      throw new Error("Failed to update setting");
    }

    return { success: true };
  });

/**
 * Update multiple settings at once
 */
export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(UpdateSettingsInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("settings.edit");
    const db = getDB();
    const userId = auth.user.id;

    // Use a transaction via batch
    const statements = data.settings.map((s) => {
      const valueStr =
        typeof s.value === "string" ? s.value : JSON.stringify(s.value);
      return db
        .prepare(
          `INSERT INTO settings (key, value, updated_by, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')`
        )
        .bind(s.key, valueStr, userId);
    });

    const results = await db.batch(statements);
    const allSuccessful = results.every((r) => r.success);

    if (!allSuccessful) {
      throw new Error("Failed to update some settings");
    }

    return { success: true };
  });

/**
 * Delete a setting
 */
export const deleteSetting = createServerFn({ method: "POST" })
  .inputValidator(GetSettingInput)
  .handler(async ({ data }) => {
    await requirePermission("settings.edit");
    const db = getDB();

    const result = await db
      .prepare("DELETE FROM settings WHERE key = ?")
      .bind(data.key)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete setting");
    }

    return { success: true };
  });

/**
 * Get notification settings
 */
export const getNotificationSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    await requirePermission("settings.view");
    const db = getDB();

    const result = await db
      .prepare("SELECT * FROM settings WHERE key LIKE 'notifications.%'")
      .all<Setting>();

    const settings: Record<string, any> = {};
    for (const row of result.results) {
      const key = row.key.replace("notifications.", "");
      try {
        settings[key] = JSON.parse(row.value);
      } catch {
        settings[key] = row.value;
      }
    }

    return {
      emailEnabled: settings.email_enabled ?? true,
      smsEnabled: settings.sms_enabled ?? true,
      pushEnabled: settings.push_enabled ?? true,
      autoPublishDraft: settings.auto_publish_draft ?? false,
      autoPublishActive: settings.auto_publish_active ?? true,
      quietHoursEnabled: settings.quiet_hours_enabled ?? false,
      quietHoursStart: settings.quiet_hours_start ?? "22:00",
      quietHoursEnd: settings.quiet_hours_end ?? "06:00",
    };
  }
);

/**
 * Update notification settings
 */
export const updateNotificationSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      emailEnabled: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      autoPublishDraft: z.boolean().optional(),
      autoPublishActive: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().optional(),
      quietHoursEnd: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const auth = await requirePermission("settings.edit");
    const db = getDB();
    const userId = auth.user.id;

    const settingsToUpdate: Array<{ key: string; value: string }> = [];

    if (data.emailEnabled !== undefined) {
      settingsToUpdate.push({
        key: "notifications.email_enabled",
        value: JSON.stringify(data.emailEnabled),
      });
    }
    if (data.smsEnabled !== undefined) {
      settingsToUpdate.push({
        key: "notifications.sms_enabled",
        value: JSON.stringify(data.smsEnabled),
      });
    }
    if (data.pushEnabled !== undefined) {
      settingsToUpdate.push({
        key: "notifications.push_enabled",
        value: JSON.stringify(data.pushEnabled),
      });
    }
    if (data.autoPublishDraft !== undefined) {
      settingsToUpdate.push({
        key: "notifications.auto_publish_draft",
        value: JSON.stringify(data.autoPublishDraft),
      });
    }
    if (data.autoPublishActive !== undefined) {
      settingsToUpdate.push({
        key: "notifications.auto_publish_active",
        value: JSON.stringify(data.autoPublishActive),
      });
    }
    if (data.quietHoursEnabled !== undefined) {
      settingsToUpdate.push({
        key: "notifications.quiet_hours_enabled",
        value: JSON.stringify(data.quietHoursEnabled),
      });
    }
    if (data.quietHoursStart !== undefined) {
      settingsToUpdate.push({
        key: "notifications.quiet_hours_start",
        value: JSON.stringify(data.quietHoursStart),
      });
    }
    if (data.quietHoursEnd !== undefined) {
      settingsToUpdate.push({
        key: "notifications.quiet_hours_end",
        value: JSON.stringify(data.quietHoursEnd),
      });
    }

    if (settingsToUpdate.length === 0) {
      return { success: true };
    }

    const statements = settingsToUpdate.map((s) =>
      db
        .prepare(
          `INSERT INTO settings (key, value, updated_by, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_by = excluded.updated_by,
             updated_at = datetime('now')`
        )
        .bind(s.key, s.value, userId)
    );

    const results = await db.batch(statements);
    const allSuccessful = results.every((r) => r.success);

    if (!allSuccessful) {
      throw new Error("Failed to update notification settings");
    }

    return { success: true };
  });

/**
 * Get app info settings
 */
export const getAppInfo = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("settings.view");
  const db = getDB();

  const result = await db
    .prepare("SELECT * FROM settings WHERE key LIKE 'app.%'")
    .all<Setting>();

  const settings: Record<string, any> = {};
  for (const row of result.results) {
    const key = row.key.replace("app.", "");
    try {
      settings[key] = JSON.parse(row.value);
    } catch {
      settings[key] = row.value;
    }
  }

  return {
    name: settings.name ?? "UTA Notify",
    timezone: settings.timezone ?? "America/Denver",
    supportEmail: settings.support_email ?? "support@uta.org",
  };
});
