import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Plus, Search, Mail, Phone, Bell, Download, Upload, X, Loader2 } from "lucide-react";
import { createSubscriber, getSubscribers } from "../lib/server-functions";

export const Route = createFileRoute("/subscribers")({
  loader: async () => {
    try {
      const result = await getSubscribers({ data: {} });
      return result;
    } catch (error) {
      console.error("Subscribers loader error:", error);
      return {
        subscribers: [],
        stats: { total: 0, email: 0, sms: 0, push: 0, active: 0, unsubscribed: 0 }
      };
    }
  },
  component: SubscribersPage,
});

function SubscribersPage() {
  const { subscribers, stats } = Route.useLoaderData();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSubscribers = subscribers.filter((subscriber) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      subscriber.email?.toLowerCase().includes(query) ||
      subscriber.phone?.includes(query)
    );
  });

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscribers</h1>
          <p className="text-muted-foreground">
            Manage notification subscribers and their preferences
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Subscriber
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Subscribers</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Mail className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.email}</p>
              <p className="text-xs text-muted-foreground">Email</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Phone className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.sms}</p>
              <p className="text-xs text-muted-foreground">SMS</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.push}</p>
              <p className="text-xs text-muted-foreground">Push</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search subscribers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Subscribers List or Empty State */}
      <div className="rounded-xl border bg-card">
        {filteredSubscribers.length > 0 ? (
          <div className="divide-y">
            {filteredSubscribers.map((subscriber) => (
              <div key={subscriber.id} className="p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-muted p-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {subscriber.email || subscriber.phone || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {subscriber.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        )}
                        {subscriber.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> SMS
                          </span>
                        )}
                        {subscriber.push_token && (
                          <span className="flex items-center gap-1">
                            <Bell className="h-3 w-3" /> Push
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    subscriber.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {subscriber.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No subscribers yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Add subscribers manually or import them from a CSV file to start sending notifications.
            </p>
            <div className="flex gap-3">
              <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Subscriber
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <AddSubscriberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={async () => {
            setShowAddModal(false);
            await router.invalidate();
          }}
        />
      )}
    </div>
  );
}

interface AddSubscriberModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddSubscriberModal({ onClose, onSuccess }: AddSubscriberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    consentMethod: "web_form",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.email && !formData.phone) {
      setError("Please provide at least an email or phone number");
      setIsSubmitting(false);
      return;
    }

    try {
      await createSubscriber({
        data: {
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          consentMethod: formData.consentMethod,
        },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subscriber");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-background shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Add Subscriber</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="subscriber@example.com"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Provide at least one contact method (email or phone).
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Subscriber
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
