import { z } from "zod";

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const UserRole = z.enum(["admin", "editor", "operator", "viewer"]);
export type UserRole = z.infer<typeof UserRole>;

/**
 * Available permissions in the system
 */
export const Permission = z.enum([
  // Incidents
  "incidents.create",
  "incidents.read",
  "incidents.update",
  "incidents.delete",
  "incidents.publish",
  "incidents.resolve",
  "incidents.archive",

  // Messages
  "messages.create",
  "messages.read",
  "messages.send",

  // Templates
  "templates.create",
  "templates.read",
  "templates.update",
  "templates.delete",

  // Subscribers
  "subscribers.create",
  "subscribers.read",
  "subscribers.update",
  "subscribers.delete",
  "subscribers.export",

  // Automation
  "automation.create",
  "automation.read",
  "automation.update",
  "automation.delete",
  "automation.execute",

  // Channels
  "channels.read",
  "channels.configure",

  // Reports
  "reports.read",
  "reports.export",

  // Audit
  "audit.read",

  // Users
  "users.read",
  "users.manage",

  // Settings
  "settings.read",
  "settings.update",
]);
export type Permission = z.infer<typeof Permission>;

// ============================================
// ROLE PERMISSIONS MATRIX
// ============================================

/**
 * Default permissions for each role
 */
export const RolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // All permissions
    "incidents.create",
    "incidents.read",
    "incidents.update",
    "incidents.delete",
    "incidents.publish",
    "incidents.resolve",
    "incidents.archive",
    "messages.create",
    "messages.read",
    "messages.send",
    "templates.create",
    "templates.read",
    "templates.update",
    "templates.delete",
    "subscribers.create",
    "subscribers.read",
    "subscribers.update",
    "subscribers.delete",
    "subscribers.export",
    "automation.create",
    "automation.read",
    "automation.update",
    "automation.delete",
    "automation.execute",
    "channels.read",
    "channels.configure",
    "reports.read",
    "reports.export",
    "audit.read",
    "users.read",
    "users.manage",
    "settings.read",
    "settings.update",
  ],
  editor: [
    "incidents.create",
    "incidents.read",
    "incidents.update",
    "incidents.publish",
    "incidents.resolve",
    "messages.create",
    "messages.read",
    "messages.send",
    "templates.create",
    "templates.read",
    "templates.update",
    "subscribers.read",
    "automation.read",
    "channels.read",
    "reports.read",
    "audit.read",
  ],
  operator: [
    "incidents.create",
    "incidents.read",
    "incidents.update",
    "incidents.publish",
    "incidents.resolve",
    "messages.create",
    "messages.read",
    "messages.send",
    "templates.read",
    "subscribers.read",
    "channels.read",
    "reports.read",
  ],
  viewer: [
    "incidents.read",
    "messages.read",
    "templates.read",
    "subscribers.read",
    "channels.read",
    "reports.read",
  ],
};

// ============================================
// USER SCHEMAS
// ============================================

/**
 * User response (from database)
 */
export const UserSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  email: z.string().email(),
  name: z.string(),
  role: UserRole,
  permissions: z.array(Permission).nullable(), // Override permissions
  avatarUrl: z.string().url().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

/**
 * Create user input
 */
export const CreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  role: UserRole,
  externalId: z.string().optional(),
  permissions: z.array(Permission).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * Update user input
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: UserRole.optional(),
  permissions: z.array(Permission).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================
// SESSION SCHEMAS
// ============================================

/**
 * Session data
 */
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.string().datetime(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Session = z.infer<typeof SessionSchema>;

/**
 * Session with user data
 */
export const SessionWithUserSchema = SessionSchema.extend({
  user: UserSchema,
});
export type SessionWithUser = z.infer<typeof SessionWithUserSchema>;

// ============================================
// AUTH SCHEMAS (Mock Auth)
// ============================================

/**
 * Mock login input
 */
export const MockLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  // In mock auth, we use email only; password is optional for dev
  password: z.string().optional(),
});
export type MockLoginInput = z.infer<typeof MockLoginSchema>;

/**
 * Login response
 */
export const LoginResponseSchema = z.object({
  user: UserSchema,
  session: SessionSchema,
  token: z.string(), // Session token for auth header
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: User, permission: Permission): boolean {
  // Check override permissions first
  if (user.permissions?.includes(permission)) {
    return true;
  }

  // Fall back to role-based permissions
  const rolePermissions = RolePermissions[user.role];
  return rolePermissions.includes(permission);
}

/**
 * Get all effective permissions for a user
 */
export function getEffectivePermissions(user: User): Permission[] {
  const rolePermissions = RolePermissions[user.role];
  const overridePermissions = user.permissions ?? [];

  // Merge and deduplicate
  return [...new Set([...rolePermissions, ...overridePermissions])];
}

/**
 * Check if a user can perform an action requiring multiple permissions
 */
export function hasAllPermissions(user: User, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

/**
 * Check if a user can perform an action requiring any of the permissions
 */
export function hasAnyPermission(user: User, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

// ============================================
// MOCK USERS FOR DEVELOPMENT
// ============================================

export const MockUsers: Array<Omit<User, "createdAt" | "updatedAt" | "lastLoginAt">> = [
  {
    id: "usr_admin",
    externalId: null,
    email: "admin@uta.org",
    name: "System Administrator",
    role: "admin",
    permissions: null,
    avatarUrl: null,
  },
  {
    id: "usr_editor",
    externalId: null,
    email: "editor@uta.org",
    name: "Content Editor",
    role: "editor",
    permissions: null,
    avatarUrl: null,
  },
  {
    id: "usr_operator",
    externalId: null,
    email: "operator@uta.org",
    name: "Incident Operator",
    role: "operator",
    permissions: null,
    avatarUrl: null,
  },
  {
    id: "usr_viewer",
    externalId: null,
    email: "viewer@uta.org",
    name: "Report Viewer",
    role: "viewer",
    permissions: null,
    avatarUrl: null,
  },
];
