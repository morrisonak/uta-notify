import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { createMessage } from "../../server/messages";
import { getIncidents } from "../../server/incidents";

export const Route = createFileRoute("/messages/new")({
  loader: async () => {
    const incidentsData = await getIncidents({ data: { limit: 100 } });
    return { incidents: incidentsData.incidents };
  },
  component: NewMessagePage,
});

interface Incident {
  id: string;
  title: string;
  status: string;
}

function NewMessagePage() {
  const { incidents } = Route.useLoaderData() as { incidents: Incident[] };
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    incidentId: "",
    content: "",
  });

  // Filter to only show active/draft incidents that can have messages
  const availableIncidents = incidents.filter((i) =>
    ["draft", "active", "updated"].includes(i.status)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.incidentId) {
        throw new Error("Please select an incident");
      }
      if (!formData.content.trim()) {
        throw new Error("Please enter message content");
      }

      const result = await createMessage({
        data: {
          incidentId: formData.incidentId,
          content: formData.content,
        },
      });

      router.navigate({ to: "/messages/$messageId", params: { messageId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Compose Message</h1>
        <p className="text-sm text-muted-foreground">
          Send a new message to subscribers for an incident
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-background rounded-lg border p-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Related Incident <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.incidentId}
            onChange={(e) => setFormData({ ...formData, incidentId: e.target.value })}
            className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSubmitting}
          >
            <option value="">Select an incident...</option>
            {availableIncidents.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.title} ({incident.status})
              </option>
            ))}
          </select>
          {availableIncidents.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No active incidents. Create an incident first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Message Content <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter your message to subscribers..."
            rows={6}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {formData.content.length} characters
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.navigate({ to: "/messages" })}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={isSubmitting || availableIncidents.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Message
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
