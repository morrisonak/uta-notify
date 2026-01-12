import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Plus, Search, Filter, X, Loader2 } from "lucide-react";
import { getIncidents, createIncident } from "../lib/server-functions";
import { formatRelativeTime } from "../lib/utils";

export const Route = createFileRoute("/incidents")({
  loader: async () => {
    try {
      const result = await getIncidents({ data: { limit: 50 } });
      return { incidents: result.incidents };
    } catch (error) {
      console.error("Incidents loader error:", error);
      return { incidents: [] };
    }
  },
  component: IncidentsPage,
});

function IncidentsPage() {
  const { incidents } = Route.useLoaderData();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIncidents = incidents.filter((incident) => {
    if (statusFilter && incident.status !== statusFilter) return false;
    if (severityFilter && incident.severity !== severityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        incident.title.toLowerCase().includes(query) ||
        incident.incident_type.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-muted-foreground">
            Manage and track transit incidents
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Incident
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="updated">Updated</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm hover:bg-accent">
            <Filter className="h-4 w-4" />
            More Filters
          </button>
        </div>
      </div>

      {/* Incidents List */}
      <div className="rounded-xl border bg-card">
        {filteredIncidents.length > 0 ? (
          <div className="divide-y">
            {filteredIncidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No incidents found</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              {searchQuery || statusFilter || severityFilter
                ? "Try adjusting your filters to find what you're looking for."
                : "Create your first incident to start tracking and communicating about transit disruptions."}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create First Incident
            </button>
          </div>
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            router.invalidate();
          }}
        />
      )}
    </div>
  );
}

interface IncidentRowProps {
  incident: {
    id: string;
    title: string;
    severity: string;
    status: string;
    incident_type: string;
    created_at: string;
    affected_modes: string | null;
    affected_routes: string | null;
  };
}

function IncidentRow({ incident }: IncidentRowProps) {
  const severityColors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    active: "bg-red-100 text-red-800",
    updated: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-800",
    archived: "bg-gray-100 text-gray-500",
  };

  const affectedModes = incident.affected_modes
    ? JSON.parse(incident.affected_modes)
    : [];
  const affectedRoutes = incident.affected_routes
    ? JSON.parse(incident.affected_routes)
    : [];

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium truncate">{incident.title}</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[incident.status]}`}
          >
            {incident.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{incident.incident_type}</span>
          {affectedModes.length > 0 && (
            <span className="flex items-center gap-1">
              {affectedModes.join(", ")}
            </span>
          )}
          {affectedRoutes.length > 0 && (
            <span>Routes: {affectedRoutes.join(", ")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColors[incident.severity]}`}
        >
          {incident.severity}
        </span>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(incident.created_at)}
        </span>
      </div>
    </div>
  );
}

interface CreateIncidentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateIncidentModal({ onClose, onSuccess }: CreateIncidentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    incidentType: "service_disruption",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    affectedModes: [] as string[],
    affectedRoutes: "",
    publicMessage: "",
    internalNotes: "",
  });

  const incidentTypes = [
    { value: "service_disruption", label: "Service Disruption" },
    { value: "delay", label: "Delay" },
    { value: "detour", label: "Detour" },
    { value: "station_closure", label: "Station Closure" },
    { value: "safety_issue", label: "Safety Issue" },
    { value: "weather", label: "Weather Related" },
    { value: "special_event", label: "Special Event" },
    { value: "maintenance", label: "Planned Maintenance" },
  ];

  const transitModes = [
    { value: "bus", label: "Bus" },
    { value: "trax", label: "TRAX" },
    { value: "frontrunner", label: "FrontRunner" },
    { value: "streetcar", label: "Streetcar" },
    { value: "paratransit", label: "Paratransit" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await createIncident({
        data: {
          title: formData.title,
          incidentType: formData.incidentType,
          severity: formData.severity,
          affectedModes: formData.affectedModes.length > 0 ? formData.affectedModes : undefined,
          affectedRoutes: formData.affectedRoutes
            ? formData.affectedRoutes.split(",").map((r) => r.trim())
            : undefined,
          publicMessage: formData.publicMessage || undefined,
          internalNotes: formData.internalNotes || undefined,
        },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = (mode: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedModes: prev.affectedModes.includes(mode)
        ? prev.affectedModes.filter((m) => m !== mode)
        : [...prev.affectedModes, mode],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-background shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Create New Incident</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Incident Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the incident"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Type and Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Incident Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.incidentType}
                onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {incidentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.severity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    severity: e.target.value as "low" | "medium" | "high" | "critical",
                  })
                }
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Affected Modes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Affected Transit Modes
            </label>
            <div className="flex flex-wrap gap-2">
              {transitModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleMode(mode.value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    formData.affectedModes.includes(mode.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Affected Routes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Affected Routes
            </label>
            <input
              type="text"
              value={formData.affectedRoutes}
              onChange={(e) => setFormData({ ...formData, affectedRoutes: e.target.value })}
              placeholder="e.g., 2, 35, 72, Red Line (comma separated)"
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Public Message */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Public Message
            </label>
            <textarea
              rows={3}
              value={formData.publicMessage}
              onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
              placeholder="Message to be shared with the public..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Internal Notes
            </label>
            <textarea
              rows={2}
              value={formData.internalNotes}
              onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              placeholder="Notes visible only to staff..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Actions */}
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
              Create Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
