import { createFileRoute } from "@tanstack/react-router";
import { Settings, Bell, Mail, MessageSquare, Shield, Database, Globe, Key } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-6 lg:p-8">
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
            <SettingsNavItem icon={<Bell />} label="Notifications" active />
            <SettingsNavItem icon={<Mail />} label="Email Channel" />
            <SettingsNavItem icon={<MessageSquare />} label="SMS Channel" />
            <SettingsNavItem icon={<Globe />} label="Social Media" />
            <SettingsNavItem icon={<Database />} label="Integrations" />
            <SettingsNavItem icon={<Shield />} label="Access Control" />
            <SettingsNavItem icon={<Key />} label="API Keys" />
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-2">
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
                    defaultChecked
                  />
                  <ToggleSetting
                    label="SMS Notifications"
                    description="Send incident updates via SMS"
                    defaultChecked
                  />
                  <ToggleSetting
                    label="Push Notifications"
                    description="Send push notifications to mobile apps"
                  />
                  <ToggleSetting
                    label="Twitter/X Updates"
                    description="Post incident updates to Twitter"
                  />
                </div>
              </div>

              {/* Severity Thresholds */}
              <div>
                <h3 className="text-sm font-medium mb-3">Auto-Publish Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Auto-publish critical incidents</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically publish incidents marked as critical severity
                      </p>
                    </div>
                    <input type="checkbox" className="h-5 w-5 rounded" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Require approval for drafts</p>
                      <p className="text-sm text-muted-foreground">
                        Draft incidents must be approved before publishing
                      </p>
                    </div>
                    <input type="checkbox" className="h-5 w-5 rounded" defaultChecked />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsNavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function SettingsNavItem({ icon, label, active }: SettingsNavItemProps) {
  return (
    <button
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <span className="h-4 w-4">{icon}</span>
      {label}
    </button>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  defaultChecked?: boolean;
}

function ToggleSetting({ label, description, defaultChecked }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        className="h-5 w-5 rounded"
        defaultChecked={defaultChecked}
      />
    </div>
  );
}
