import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Shield,
  Database,
  Globe,
  Key,
  Loader2,
  Check,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../server/settings";
import {
  getUsers,
  getUserStats,
  createUser,
  updateUser,
  deleteUser,
} from "../server/users";
import { getCurrentUserProfile } from "../server/users";
import { requireAuthFn } from "../server/auth";
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  hasPermission,
} from "../lib/permissions";
import type { User } from "../lib/auth";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    const [settings, usersData, userStats, currentUserProfile] = await Promise.all([
      getNotificationSettings(),
      getUsers({ data: {} }).catch(() => ({ users: [], total: 0 })),
      getUserStats().catch(() => ({ total: 0, byRole: { admin: 0, editor: 0, operator: 0, viewer: 0 }, activeLastWeek: 0 })),
      getCurrentUserProfile().catch(() => ({ user: null, permissions: [] })),
    ]);
    return { settings, usersData, userStats, currentUserProfile };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, usersData, userStats, currentUserProfile } = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState("notifications");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    emailEnabled: settings.emailEnabled,
    smsEnabled: settings.smsEnabled,
    pushEnabled: settings.pushEnabled,
    autoPublishDraft: settings.autoPublishDraft,
    autoPublishActive: settings.autoPublishActive,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
  });

  // User management state
  const [users, setUsers] = useState(usersData.users || []);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ email: "", name: "", role: "viewer" as User["role"] });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const canManageUsers = currentUserProfile.user && hasPermission(currentUserProfile.user, "users.view");
  const canCreateUsers = currentUserProfile.user && hasPermission(currentUserProfile.user, "users.create");
  const canEditUsers = currentUserProfile.user && hasPermission(currentUserProfile.user, "users.edit");
  const canDeleteUsers = currentUserProfile.user && hasPermission(currentUserProfile.user, "users.delete");

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await updateNotificationSettings({ data: formData });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const refreshUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers({ data: {} });
      setUsers(result.users || []);
    } catch (err) {
      console.error("Failed to refresh users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateUser = async () => {
    setUserError(null);
    try {
      await createUser({ data: userForm });
      setShowUserModal(false);
      setUserForm({ email: "", name: "", role: "viewer" });
      await refreshUsers();
    } catch (err: any) {
      setUserError(err.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setUserError(null);
    try {
      await updateUser({
        data: {
          id: editingUser.id,
          name: userForm.name,
          role: userForm.role,
        },
      });
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ email: "", name: "", role: "viewer" });
      await refreshUsers();
    } catch (err: any) {
      setUserError(err.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser({ data: { id: userId } });
      await refreshUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setUserForm({ email: user.email, name: user.name, role: user.role });
    setUserError(null);
    setShowUserModal(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setUserForm({ email: "", name: "", role: "viewer" });
    setUserError(null);
    setShowUserModal(true);
  };

  const tabs = [
    { id: "notifications", icon: <Bell className="h-4 w-4" />, label: "Notifications" },
    { id: "email", icon: <Mail className="h-4 w-4" />, label: "Email Channel" },
    { id: "sms", icon: <MessageSquare className="h-4 w-4" />, label: "SMS Channel" },
    { id: "social", icon: <Globe className="h-4 w-4" />, label: "Social Media" },
    { id: "integrations", icon: <Database className="h-4 w-4" />, label: "Integrations" },
    { id: "access", icon: <Shield className="h-4 w-4" />, label: "Access Control" },
    { id: "api", icon: <Key className="h-4 w-4" />, label: "API Keys" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure channels, integrations, and system preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-2">
          {activeTab === "notifications" && (
            <div className="rounded-xl border bg-card">
              <div className="border-b p-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </h2>
              </div>
              <div className="p-4 space-y-6">
                {/* Default Channels */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Default Channels</h3>
                  <div className="space-y-3">
                    <ToggleSetting
                      label="Email Notifications"
                      description="Send incident updates via email"
                      checked={formData.emailEnabled}
                      onChange={(checked) =>
                        setFormData({ ...formData, emailEnabled: checked })
                      }
                    />
                    <ToggleSetting
                      label="SMS Notifications"
                      description="Send incident updates via SMS"
                      checked={formData.smsEnabled}
                      onChange={(checked) =>
                        setFormData({ ...formData, smsEnabled: checked })
                      }
                    />
                    <ToggleSetting
                      label="Push Notifications"
                      description="Send push notifications to mobile apps"
                      checked={formData.pushEnabled}
                      onChange={(checked) =>
                        setFormData({ ...formData, pushEnabled: checked })
                      }
                    />
                  </div>
                </div>

                {/* Auto-Publish Settings */}
                <div>
                  <h3 className="text-sm font-medium mb-3">
                    Auto-Publish Settings
                  </h3>
                  <div className="space-y-3">
                    <ToggleSetting
                      label="Auto-publish draft incidents"
                      description="Automatically publish incidents when created as drafts"
                      checked={formData.autoPublishDraft}
                      onChange={(checked) =>
                        setFormData({ ...formData, autoPublishDraft: checked })
                      }
                    />
                    <ToggleSetting
                      label="Auto-publish active incidents"
                      description="Automatically publish updates to active incidents"
                      checked={formData.autoPublishActive}
                      onChange={(checked) =>
                        setFormData({ ...formData, autoPublishActive: checked })
                      }
                    />
                  </div>
                </div>

                {/* Quiet Hours */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Quiet Hours</h3>
                  <div className="space-y-3">
                    <ToggleSetting
                      label="Enable quiet hours"
                      description="Suppress non-critical notifications during specified hours"
                      checked={formData.quietHoursEnabled}
                      onChange={(checked) =>
                        setFormData({ ...formData, quietHoursEnabled: checked })
                      }
                    />
                    {formData.quietHoursEnabled && (
                      <div className="flex gap-4 p-3 rounded-lg bg-muted/50">
                        <div>
                          <label className="text-sm font-medium">Start</label>
                          <input
                            type="time"
                            value={formData.quietHoursStart}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                quietHoursStart: e.target.value,
                              })
                            }
                            className="block mt-1 h-9 rounded-lg border bg-background px-3 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">End</label>
                          <input
                            type="time"
                            value={formData.quietHoursEnd}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                quietHoursEnd: e.target.value,
                              })
                            }
                            className="block mt-1 h-9 rounded-lg border bg-background px-3 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : saved ? (
                      <>
                        <Check className="h-4 w-4" />
                        Saved!
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-6">
              {/* User Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-2xl font-bold">{userStats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-2xl font-bold">{userStats.byRole.admin}</div>
                  <div className="text-sm text-muted-foreground">Admins</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-2xl font-bold">{userStats.byRole.editor + userStats.byRole.operator}</div>
                  <div className="text-sm text-muted-foreground">Editors/Operators</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-2xl font-bold">{userStats.activeLastWeek}</div>
                  <div className="text-sm text-muted-foreground">Active This Week</div>
                </div>
              </div>

              {/* User List */}
              <div className="rounded-xl border bg-card">
                <div className="border-b p-4 flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </h2>
                  {canCreateUsers && (
                    <button
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Add User
                    </button>
                  )}
                </div>
                <div className="divide-y">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    users.map((user: User) => (
                      <div key={user.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {ROLE_LABELS[user.role]}
                          </span>
                          <div className="flex items-center gap-1">
                            {canEditUsers && (
                              <button
                                onClick={() => openEditModal(user)}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDeleteUsers && currentUserProfile.user?.id !== user.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Role Descriptions */}
              <div className="rounded-xl border bg-card">
                <div className="border-b p-4">
                  <h2 className="font-semibold">Role Descriptions</h2>
                </div>
                <div className="p-4 space-y-3">
                  {(Object.keys(ROLE_LABELS) as User["role"][]).map((role) => (
                    <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(role)}`}>
                        {ROLE_LABELS[role]}
                      </span>
                      <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab !== "notifications" && activeTab !== "access" && (
            <div className="rounded-xl border bg-card">
              <div className="border-b p-4">
                <h2 className="font-semibold">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
              </div>
              <div className="flex items-center justify-center p-16 text-center">
                <div>
                  <div className="mx-auto mb-4 rounded-full bg-muted p-4 w-fit">
                    {tabs.find((t) => t.id === activeTab)?.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    This section is under development. Check back later for{" "}
                    {tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}{" "}
                    configuration options.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border shadow-lg w-full max-w-md mx-4">
            <div className="border-b p-4 flex items-center justify-between">
              <h3 className="font-semibold">
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 rounded-lg hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {userError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {userError}
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  disabled={!!editingUser}
                  placeholder="user@example.com"
                  className="mt-1 w-full h-10 rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Full Name"
                  className="mt-1 w-full h-10 rounded-lg border bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User["role"] })}
                  className="mt-1 w-full h-10 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROLE_DESCRIPTIONS[userForm.role]}
                </p>
              </div>
            </div>
            <div className="border-t p-4 flex justify-end gap-2">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                {editingUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRoleBadgeColor(role: User["role"]): string {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "editor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "operator":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "viewer":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
