import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../server/settings";

export const Route = createFileRoute("/settings")({
  loader: async () => {
    const settings = await getNotificationSettings();
    return { settings };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { settings } = Route.useLoaderData();
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

          {activeTab !== "notifications" && (
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
    </div>
  );
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
