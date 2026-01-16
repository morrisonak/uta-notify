import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../utils/cloudflare";
import {
  requirePermission,
  requireAuth,
  getCurrentUser,
  type User,
} from "../lib/auth";
import { hasPermission, getAssignableRoles } from "../lib/permissions";

/**
 * User management server functions
 * CRUD operations for user administration
 */

// ============================================
// INPUT VALIDATORS
// ============================================

const GetUsersInput = z.object({
  role: z.enum(["admin", "editor", "operator", "viewer"]).optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const GetUserInput = z.object({
  id: z.string(),
});

const CreateUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "editor", "operator", "viewer"]),
});

const UpdateUserInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "editor", "operator", "viewer"]).optional(),
  permissions: z
    .object({
      granted: z.array(z.string()).optional(),
      denied: z.array(z.string()).optional(),
    })
    .optional(),
});

const DeleteUserInput = z.object({
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
 * Get all users with optional filtering
 */
export const getUsers = createServerFn({ method: "GET" })
  .inputValidator(GetUsersInput)
  .handler(async ({ data }) => {
    await requirePermission("users.view");
    const db = getDB();

    let query = `SELECT id, email, name, role, permissions, avatar_url, last_login_at, created_at, updated_at FROM users WHERE 1=1`;
    const params: (string | number)[] = [];

    if (data.role) {
      query += ` AND role = ?`;
      params.push(data.role);
    }

    if (data.search) {
      query += ` AND (email LIKE ? OR name LIKE ?)`;
      params.push(`%${data.search}%`, `%${data.search}%`);
    }

    query += ` ORDER BY created_at DESC`;

    if (data.limit) {
      query += ` LIMIT ?`;
      params.push(data.limit);

      if (data.offset) {
        query += ` OFFSET ?`;
        params.push(data.offset);
      }
    }

    const result = await db.prepare(query).bind(...params).all<User>();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as count FROM users WHERE 1=1`;
    const countParams: string[] = [];

    if (data.role) {
      countQuery += ` AND role = ?`;
      countParams.push(data.role);
    }

    if (data.search) {
      countQuery += ` AND (email LIKE ? OR name LIKE ?)`;
      countParams.push(`%${data.search}%`, `%${data.search}%`);
    }

    const countResult = await db
      .prepare(countQuery)
      .bind(...countParams)
      .first<{ count: number }>();

    return {
      users: result.results,
      total: countResult?.count || 0,
    };
  });

/**
 * Get a single user by ID
 */
export const getUser = createServerFn({ method: "GET" })
  .inputValidator(GetUserInput)
  .handler(async ({ data }) => {
    await requirePermission("users.view");
    const db = getDB();

    const user = await db
      .prepare(
        `SELECT id, email, name, role, permissions, avatar_url, last_login_at, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .bind(data.id)
      .first<User>();

    if (!user) {
      throw new Error("User not found");
    }

    return { user };
  });

/**
 * Create a new user
 */
export const createUser = createServerFn({ method: "POST" })
  .inputValidator(CreateUserInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("users.create");
    const db = getDB();

    // Check if the current user can assign the requested role
    const assignableRoles = getAssignableRoles(auth.user);
    if (!assignableRoles.includes(data.role)) {
      throw new Error(`Forbidden: Cannot assign role '${data.role}'`);
    }

    // Check if email already exists
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(data.email)
      .first();

    if (existing) {
      throw new Error("A user with this email already exists");
    }

    const id = generateId("usr");

    const result = await db
      .prepare(
        `INSERT INTO users (id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(id, data.email, data.name, data.role)
      .run();

    if (!result.success) {
      throw new Error("Failed to create user");
    }

    return { success: true, id };
  });

/**
 * Update an existing user
 */
export const updateUser = createServerFn({ method: "POST" })
  .inputValidator(UpdateUserInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("users.edit");
    const db = getDB();

    // Get the user to be updated
    const targetUser = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(data.id)
      .first<User>();

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Prevent self-demotion for last admin
    if (data.role && data.role !== targetUser.role && targetUser.role === "admin") {
      const adminCount = await db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
        .first<{ count: number }>();

      if (adminCount?.count === 1 && auth.user.id === data.id) {
        throw new Error("Cannot demote the last administrator");
      }
    }

    // Check role assignment permission
    if (data.role && data.role !== targetUser.role) {
      if (!hasPermission(auth.user, "users.manage_roles")) {
        throw new Error("Forbidden: Cannot change user roles");
      }

      const assignableRoles = getAssignableRoles(auth.user);
      if (!assignableRoles.includes(data.role)) {
        throw new Error(`Forbidden: Cannot assign role '${data.role}'`);
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }

    if (data.role !== undefined) {
      updates.push("role = ?");
      params.push(data.role);
    }

    if (data.permissions !== undefined) {
      updates.push("permissions = ?");
      params.push(JSON.stringify(data.permissions));
    }

    if (updates.length === 0) {
      return { success: true };
    }

    updates.push("updated_at = datetime('now')");
    params.push(data.id);

    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    const result = await db.prepare(query).bind(...params).run();

    if (!result.success) {
      throw new Error("Failed to update user");
    }

    return { success: true };
  });

/**
 * Delete a user
 */
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(DeleteUserInput)
  .handler(async ({ data }) => {
    const auth = await requirePermission("users.delete");
    const db = getDB();

    // Prevent self-deletion
    if (auth.user.id === data.id) {
      throw new Error("Cannot delete your own account");
    }

    // Get the user to be deleted
    const targetUser = await db
      .prepare("SELECT role FROM users WHERE id = ?")
      .bind(data.id)
      .first<{ role: string }>();

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Prevent deleting the last admin
    if (targetUser.role === "admin") {
      const adminCount = await db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
        .first<{ count: number }>();

      if (adminCount?.count === 1) {
        throw new Error("Cannot delete the last administrator");
      }
    }

    const result = await db
      .prepare("DELETE FROM users WHERE id = ?")
      .bind(data.id)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete user");
    }

    return { success: true };
  });

/**
 * Get current user's profile and permissions
 */
export const getCurrentUserProfile = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await getCurrentUser();

    if (!user) {
      return { user: null, permissions: [] };
    }

    // Get permissions dynamically
    const { getUserPermissions } = await import("../lib/permissions");
    const permissions = getUserPermissions(user);

    return { user, permissions };
  }
);

/**
 * Get available roles for assignment (based on current user's permissions)
 */
export const getAssignableRolesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = await requireAuth();
    const assignableRoles = getAssignableRoles(auth.user);

    return { roles: assignableRoles };
  }
);

/**
 * Get user statistics
 */
export const getUserStats = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("users.view");
  const db = getDB();

  const stats = await db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'editor' THEN 1 ELSE 0 END) as editors,
        SUM(CASE WHEN role = 'operator' THEN 1 ELSE 0 END) as operators,
        SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewers,
        SUM(CASE WHEN last_login_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as active_last_week
       FROM users`
    )
    .first<{
      total: number;
      admins: number;
      editors: number;
      operators: number;
      viewers: number;
      active_last_week: number;
    }>();

  return {
    total: stats?.total || 0,
    byRole: {
      admin: stats?.admins || 0,
      editor: stats?.editors || 0,
      operator: stats?.operators || 0,
      viewer: stats?.viewers || 0,
    },
    activeLastWeek: stats?.active_last_week || 0,
  };
});
