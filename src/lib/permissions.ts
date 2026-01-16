/**
 * Role-based permissions for UTA Notify
 *
 * Role Hierarchy:
 * - admin: Full system access, user management, settings
 * - editor: Create/edit/publish incidents and messages, manage templates
 * - operator: Create/edit incidents and messages (no publish without approval)
 * - viewer: Read-only access to incidents and reports
 */

import type { User } from "./auth";

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export const PERMISSIONS = {
  // Incident permissions
  "incidents.view": "View incidents",
  "incidents.create": "Create new incidents",
  "incidents.edit": "Edit existing incidents",
  "incidents.delete": "Delete incidents",
  "incidents.publish": "Publish/activate incidents",
  "incidents.resolve": "Resolve incidents",
  "incidents.archive": "Archive incidents",

  // Message permissions
  "messages.view": "View messages",
  "messages.create": "Create new messages",
  "messages.edit": "Edit messages",
  "messages.delete": "Delete messages",
  "messages.send": "Send messages to channels",

  // Template permissions
  "templates.view": "View templates",
  "templates.create": "Create new templates",
  "templates.edit": "Edit templates",
  "templates.delete": "Delete templates",

  // Subscriber permissions
  "subscribers.view": "View subscribers",
  "subscribers.create": "Add new subscribers",
  "subscribers.edit": "Edit subscriber details",
  "subscribers.delete": "Remove subscribers",
  "subscribers.export": "Export subscriber data",

  // Report permissions
  "reports.view": "View reports and analytics",
  "reports.export": "Export report data",

  // Settings permissions
  "settings.view": "View system settings",
  "settings.edit": "Modify system settings",

  // User management permissions
  "users.view": "View user list",
  "users.create": "Create new users",
  "users.edit": "Edit user details",
  "users.delete": "Delete users",
  "users.manage_roles": "Change user roles",

  // Automation permissions
  "automation.view": "View automation rules",
  "automation.create": "Create automation rules",
  "automation.edit": "Edit automation rules",
  "automation.delete": "Delete automation rules",

  // Audit log permissions
  "audit.view": "View audit logs",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================
// ROLE PERMISSION MATRIX
// ============================================

export const ROLE_PERMISSIONS: Record<User["role"], Permission[]> = {
  admin: [
    // Full access to everything
    "incidents.view",
    "incidents.create",
    "incidents.edit",
    "incidents.delete",
    "incidents.publish",
    "incidents.resolve",
    "incidents.archive",
    "messages.view",
    "messages.create",
    "messages.edit",
    "messages.delete",
    "messages.send",
    "templates.view",
    "templates.create",
    "templates.edit",
    "templates.delete",
    "subscribers.view",
    "subscribers.create",
    "subscribers.edit",
    "subscribers.delete",
    "subscribers.export",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.edit",
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "users.manage_roles",
    "automation.view",
    "automation.create",
    "automation.edit",
    "automation.delete",
    "audit.view",
  ],

  editor: [
    // Can manage content but not system settings or users
    "incidents.view",
    "incidents.create",
    "incidents.edit",
    "incidents.publish",
    "incidents.resolve",
    "incidents.archive",
    "messages.view",
    "messages.create",
    "messages.edit",
    "messages.send",
    "templates.view",
    "templates.create",
    "templates.edit",
    "templates.delete",
    "subscribers.view",
    "subscribers.create",
    "subscribers.edit",
    "subscribers.export",
    "reports.view",
    "reports.export",
    "settings.view",
    "automation.view",
    "automation.create",
    "automation.edit",
    "audit.view",
  ],

  operator: [
    // Can create/edit but limited publish capabilities
    "incidents.view",
    "incidents.create",
    "incidents.edit",
    "incidents.resolve",
    "messages.view",
    "messages.create",
    "messages.edit",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
    "automation.view",
  ],

  viewer: [
    // Read-only access
    "incidents.view",
    "messages.view",
    "templates.view",
    "subscribers.view",
    "reports.view",
    "settings.view",
  ],
};

// ============================================
// PERMISSION CHECK UTILITIES
// ============================================

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // Check custom permission overrides (stored in user.permissions as JSON)
  if (user.permissions) {
    try {
      const customPermissions = JSON.parse(user.permissions) as {
        granted?: Permission[];
        denied?: Permission[];
      };

      // Explicit deny takes precedence
      if (customPermissions.denied?.includes(permission)) {
        return false;
      }

      // Explicit grant
      if (customPermissions.granted?.includes(permission)) {
        return true;
      }
    } catch {
      // Invalid permissions JSON, fall through to role check
    }
  }

  return false;
}

/**
 * Check if a user has ALL of the specified permissions
 */
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

/**
 * Check if a user has ANY of the specified permissions
 */
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

/**
 * Get all permissions for a user (including custom overrides)
 */
export function getUserPermissions(user: User | null): Permission[] {
  if (!user) return [];

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  const permissions = new Set<Permission>(rolePermissions);

  // Apply custom overrides
  if (user.permissions) {
    try {
      const customPermissions = JSON.parse(user.permissions) as {
        granted?: Permission[];
        denied?: Permission[];
      };

      // Add granted permissions
      customPermissions.granted?.forEach((p) => permissions.add(p));

      // Remove denied permissions
      customPermissions.denied?.forEach((p) => permissions.delete(p));
    } catch {
      // Invalid permissions JSON, use role permissions only
    }
  }

  return Array.from(permissions);
}

/**
 * Get display label for a permission
 */
export function getPermissionLabel(permission: Permission): string {
  return PERMISSIONS[permission] || permission;
}

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<string, { permission: Permission; label: string }[]> {
  const categories: Record<string, { permission: Permission; label: string }[]> = {};

  for (const [permission, label] of Object.entries(PERMISSIONS)) {
    const category = permission.split(".")[0];
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({
      permission: permission as Permission,
      label,
    });
  }

  return categories;
}

// ============================================
// ROLE UTILITIES
// ============================================

export const ROLE_LABELS: Record<User["role"], string> = {
  admin: "Administrator",
  editor: "Editor",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<User["role"], string> = {
  admin: "Full system access including user management and settings",
  editor: "Can create, edit, and publish incidents and messages",
  operator: "Can create and edit incidents, limited publishing",
  viewer: "Read-only access to incidents and reports",
};

/**
 * Get roles that a user can assign to others
 * Admins can assign any role, others cannot assign roles
 */
export function getAssignableRoles(user: User | null): User["role"][] {
  if (!user || !hasPermission(user, "users.manage_roles")) {
    return [];
  }

  // Admins can assign any role
  if (user.role === "admin") {
    return ["admin", "editor", "operator", "viewer"];
  }

  // Others cannot assign roles
  return [];
}
