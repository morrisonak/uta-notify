import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Plus, Search, Mail, Phone, Bell, Download, Upload, X, Loader2 } from "lucide-react";
import { createSubscriber, getSubscribers } from "../lib/server-functions";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";
import {
  Button,
  Input,
  Card,
  Badge,
  PageHeader,
  EmptyState,
  StatCard,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui";

export const Route = createFileRoute("/subscribers")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
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
  const { user } = useSession();
  const canCreate = hasPermission(user, "subscribers.create");
  const canExport = hasPermission(user, "subscribers.export");
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
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Subscribers"
        description="Manage notification subscribers and their preferences"
        actions={
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="outline">
                <Upload className="h-4 w-4" />
                Import
              </Button>
            )}
            {canExport && (
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" />
                Add Subscriber
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Subscribers"
          value={stats.total}
          icon={<Users className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Email"
          value={stats.email}
          icon={<Mail className="h-4 w-4 text-green-600" />}
          variant="success"
        />
        <StatCard
          title="SMS"
          value={stats.sms}
          icon={<Phone className="h-4 w-4 text-purple-600" />}
        />
        <StatCard
          title="Push"
          value={stats.push}
          icon={<Bell className="h-4 w-4 text-amber-600" />}
          variant="warning"
        />
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search subscribers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Subscribers List */}
      <Card>
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
                  <Badge status={subscriber.status === "active" ? "active" : "archived"}>
                    {subscriber.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-8 w-8 text-muted-foreground" />}
            title="No subscribers yet"
            description={
              canCreate
                ? "Add subscribers manually or import them from a CSV file to start sending notifications."
                : "No subscribers to display."
            }
            action={
              canCreate ? (
                <div className="flex gap-3">
                  <Button variant="outline">
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4" />
                    Add Subscriber
                  </Button>
                </div>
              ) : undefined
            }
            className="py-16"
          />
        )}
      </Card>

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
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Subscriber</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="subscriber@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Provide at least one contact method (email or phone).
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Subscriber
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
