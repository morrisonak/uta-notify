import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Play,
  CheckCircle,
  Archive,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Search,
  Clock,
} from "lucide-react";
import {
  getIncident,
  updateIncident,
  deleteIncident,
} from "../../server/incidents";
import { publishIncidentWithNotifications } from "../../lib/server-functions";
import { formatRelativeTime } from "../../lib/utils";
import { UTA_ROUTES, TRANSIT_MODES } from "../../data/uta-routes";

export const Route = createFileRoute("/incidents/$incidentId")({
  loader: async ({ params }) => {
    const result = await getIncident({ data: { id: params.incidentId } });
    return { incident: result.incident };
  },
  component: IncidentDetailPage,
});

interface Incident {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "updated" | "resolved" | "archived";
  incident_type: string;
  created_at: string;
  updated_at: string;
  affected_modes: string | null;
  affected_routes: string | null;
  public_message: string | null;
  internal_notes: string | null;
  estimated_resolution: string | null;
}

function IncidentDetailPage() {
  const { incident } = Route.useLoaderData() as { incident: Incident };
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeSearch, setRouteSearch] = useState("");
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [formData, setFormData] = useState({
    title: incident.title,
    severity: incident.severity,
    publicMessage: incident.public_message || "",
    internalNotes: incident.internal_notes || "",
    affectedModes: incident.affected_modes
      ? JSON.parse(incident.affected_modes)
      : [],
    affectedRoutes: incident.affected_routes
      ? JSON.parse(incident.affected_routes)
      : [],
  });

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

  const filteredRoutes = UTA_ROUTES.filter((route) => {
    if (formData.affectedModes.length > 0) {
      const modeMatches = formData.affectedModes.some((mode: string) => {
        if (mode === "bus") return route.type === "bus";
        if (mode === "trax") return route.type === "trax";
        if (mode === "frontrunner") return route.type === "frontrunner";
        if (mode === "streetcar") return route.type === "streetcar";
        if (mode === "flex") return route.type === "flex";
        if (mode === "express") return route.type === "express";
        if (mode === "ski") return route.type === "ski";
        return false;
      });
      if (!modeMatches) return false;
    }
    if (routeSearch) {
      const query = routeSearch.toLowerCase();
      return (
        route.id.toLowerCase().includes(query) ||
        route.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const toggleRoute = (routeId: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedRoutes: prev.affectedRoutes.includes(routeId)
        ? prev.affectedRoutes.filter((r: string) => r !== routeId)
        : [...prev.affectedRoutes, routeId],
    }));
  };

  const toggleMode = (mode: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedModes: prev.affectedModes.includes(mode)
        ? prev.affectedModes.filter((m: string) => m !== mode)
        : [...prev.affectedModes, mode],
    }));
  };

  const handleStatusChange = async (
    newStatus: "active" | "updated" | "resolved" | "archived"
  ) => {
    if (incident.status === "draft" && newStatus === "active") {
      setShowPublishDialog(true);
      return;
    }

    setIsUpdating(true);
    setError(null);
    try {
      await updateIncident({
        data: { id: incident.id, status: newStatus },
      });
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update incident");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePublish = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await publishIncidentWithNotifications({
        data: {
          id: incident.id,
          sendNotifications,
          notificationMessage: formData.publicMessage || undefined,
        },
      });
      setShowPublishDialog(false);
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish incident");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      await updateIncident({
        data: {
          id: incident.id,
          title: formData.title,
          severity: formData.severity,
          publicMessage: formData.publicMessage,
          internalNotes: formData.internalNotes,
          affectedModes: formData.affectedModes.length > 0 ? formData.affectedModes : undefined,
          affectedRoutes: formData.affectedRoutes.length > 0 ? formData.affectedRoutes : undefined,
        },
      });
      setIsEditing(false);
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this incident?")) return;
    setIsUpdating(true);
    try {
      await deleteIncident({ data: { id: incident.id } });
      router.navigate({ to: "/incidents" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete incident");
      setIsUpdating(false);
    }
  };

  const getStatusActions = () => {
    switch (incident.status) {
      case "draft":
        return [
          { label: "Publish", status: "active" as const, icon: <Play className="h-4 w-4" />, className: "bg-green-600 hover:bg-green-700 text-white" },
        ];
      case "active":
        return [
          { label: "Post Update", status: "updated" as const, icon: <RefreshCw className="h-4 w-4" />, className: "bg-amber-600 hover:bg-amber-700 text-white" },
          { label: "Resolve", status: "resolved" as const, icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-600 hover:bg-green-700 text-white" },
        ];
      case "updated":
        return [
          { label: "Post Update", status: "updated" as const, icon: <RefreshCw className="h-4 w-4" />, className: "bg-amber-600 hover:bg-amber-700 text-white" },
          { label: "Resolve", status: "resolved" as const, icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-600 hover:bg-green-700 text-white" },
        ];
      case "resolved":
        return [
          { label: "Reopen", status: "active" as const, icon: <RefreshCw className="h-4 w-4" />, className: "bg-amber-600 hover:bg-amber-700 text-white" },
          { label: "Archive", status: "archived" as const, icon: <Archive className="h-4 w-4" />, className: "bg-gray-600 hover:bg-gray-700 text-white" },
        ];
      case "archived":
        return [
          { label: "Restore", status: "resolved" as const, icon: <RefreshCw className="h-4 w-4" />, className: "bg-blue-600 hover:bg-blue-700 text-white" },
        ];
      default:
        return [];
    }
  };

  const affectedModes = incident.affected_modes ? JSON.parse(incident.affected_modes) : [];
  const affectedRoutes = incident.affected_routes ? JSON.parse(incident.affected_routes) : [];

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[incident.status]}`}>
            {incident.status}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityColors[incident.severity]}`}>
            {incident.severity}
          </span>
          <span className="text-sm text-muted-foreground">
            {incident.incident_type.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="rounded-lg p-2 hover:bg-accent" title="Edit">
              <Edit className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleDelete} className="rounded-lg p-2 hover:bg-accent text-red-500" title="Delete" disabled={isUpdating}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Status Actions */}
      {!isEditing && (
        <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg mb-6">
          <span className="text-sm font-medium text-muted-foreground mr-2 self-center">Actions:</span>
          {getStatusActions().map((action) => (
            <button
              key={action.status}
              onClick={() => handleStatusChange(action.status)}
              disabled={isUpdating}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${action.className}`}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {isEditing ? (
        /* Edit Mode */
        <div className="space-y-4 bg-background rounded-lg border p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Affected Transit Modes</label>
            <div className="flex flex-wrap gap-2">
              {TRANSIT_MODES.map((mode) => (
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

          <div>
            <label className="block text-sm font-medium mb-1">Affected Routes</label>
            {formData.affectedRoutes.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {formData.affectedRoutes.map((routeId: string) => {
                  const route = UTA_ROUTES.find((r) => r.id === routeId);
                  return (
                    <span key={routeId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {routeId} - {route?.name || "Unknown"}
                      <button type="button" onClick={() => toggleRoute(routeId)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                onFocus={() => setShowRouteDropdown(true)}
                placeholder="Search routes..."
                className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {showRouteDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border bg-background shadow-lg">
                  {filteredRoutes.slice(0, 15).map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => { toggleRoute(route.id); setRouteSearch(""); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent ${formData.affectedRoutes.includes(route.id) ? "bg-primary/10" : ""}`}
                    >
                      <span><span className="font-medium">{route.id}</span> <span className="text-muted-foreground">{route.name}</span></span>
                      <span className="text-xs text-muted-foreground capitalize">{route.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showRouteDropdown && <button type="button" onClick={() => setShowRouteDropdown(false)} className="fixed inset-0 z-0" aria-hidden="true" />}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Public Message</label>
            <textarea
              rows={3}
              value={formData.publicMessage}
              onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={formData.internalNotes}
              onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
            <button onClick={handleSaveChanges} disabled={isUpdating} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="space-y-4">
          <div className="bg-background rounded-lg border p-4">
            <h2 className="text-xl font-semibold mb-2">{incident.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Created {formatRelativeTime(incident.created_at)}</span>
              {incident.updated_at !== incident.created_at && (
                <>
                  <span>&bull;</span>
                  <span>Updated {formatRelativeTime(incident.updated_at)}</span>
                </>
              )}
            </div>
          </div>

          {(affectedModes.length > 0 || affectedRoutes.length > 0) && (
            <div className="bg-background rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Affected Services</h3>
              {affectedModes.length > 0 && (
                <div className="mb-2">
                  <span className="text-sm text-muted-foreground">Modes: </span>
                  <span className="text-sm">{affectedModes.join(", ")}</span>
                </div>
              )}
              {affectedRoutes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {affectedRoutes.map((routeId: string) => {
                    const route = UTA_ROUTES.find(r => r.id === routeId);
                    return (
                      <span key={routeId} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {routeId} {route && `- ${route.name}`}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {incident.public_message && (
            <div className="bg-background rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-2">Public Message</h3>
              <p className="text-sm whitespace-pre-wrap">{incident.public_message}</p>
            </div>
          )}

          {incident.internal_notes && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <h3 className="text-sm font-semibold mb-2 text-amber-800">Internal Notes</h3>
              <p className="text-sm text-amber-700 whitespace-pre-wrap">{incident.internal_notes}</p>
            </div>
          )}

          <div className="bg-background rounded-lg border p-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2">{new Date(incident.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>
                <span className="ml-2">{new Date(incident.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-background rounded-xl p-6 shadow-xl m-4">
            <h3 className="text-lg font-semibold mb-4">Publish Incident</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Publishing this incident will make it active and visible to the public.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <input
                  type="checkbox"
                  id="sendNotifications"
                  checked={sendNotifications}
                  onChange={(e) => setSendNotifications(e.target.checked)}
                  className="h-4 w-4 mt-1 rounded border"
                />
                <div>
                  <label htmlFor="sendNotifications" className="font-medium">Send notifications to subscribers</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify subscribers who match this incident's affected routes, modes, and severity level.
                  </p>
                </div>
              </div>

              {sendNotifications && (
                <div>
                  <label className="block text-sm font-medium mb-1">Notification Message</label>
                  <textarea
                    rows={3}
                    value={formData.publicMessage}
                    onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
                    placeholder="Message to send to subscribers..."
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowPublishDialog(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent" disabled={isUpdating}>
                Cancel
              </button>
              <button onClick={handlePublish} disabled={isUpdating} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Publish Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
