import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  MessageSquare,
  Send,
  User,
  FileText,
  ChevronDown,
  Star,
  Sparkles,
} from "lucide-react";
import {
  getIncident,
  updateIncident,
  deleteIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  type IncidentUpdate,
} from "../../server/incidents";
import { getCurrentUserProfile } from "../../server/users";
import { hasPermission } from "../../lib/permissions";
import { publishIncidentWithNotifications } from "../../lib/server-functions";
import {
  getTemplatesForIncident,
  renderTemplateWithIncident,
} from "../../server/templates";
import { formatRelativeTime } from "../../lib/utils";
import { UTA_ROUTES, TRANSIT_MODES } from "../../data/uta-routes";
import {
  Button,
  Badge,
  Input,
  Textarea,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Alert,
} from "../../components/ui";

export const Route = createFileRoute("/incidents/$incidentId")({
  loader: async ({ params }) => {
    const [incidentResult, updatesResult, userProfile] = await Promise.all([
      getIncident({ data: { id: params.incidentId } }),
      getIncidentUpdates({ data: { incidentId: params.incidentId } }),
      getCurrentUserProfile().catch(() => ({ user: null, permissions: [] })),
    ]);
    return {
      incident: incidentResult.incident,
      updates: updatesResult.updates,
      currentUser: userProfile.user,
    };
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

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  channel_type: string | null;
  content: string;
  is_default: number;
}

interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "operator" | "viewer";
  permissions: string | null;
}

function IncidentDetailPage() {
  const { incident, updates, currentUser } = Route.useLoaderData() as {
    incident: Incident;
    updates: IncidentUpdate[];
    currentUser: SafeUser | null;
  };
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeSearch, setRouteSearch] = useState("");
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isRenderingTemplate, setIsRenderingTemplate] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
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

  const canAddUpdates = currentUser && hasPermission(currentUser, "incidents.edit");

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

  useEffect(() => {
    if (showPublishDialog) {
      loadTemplates();
    }
  }, [showPublishDialog]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const result = await getTemplatesForIncident({
        data: { incidentType: incident.incident_type },
      });
      setTemplates(result.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId("");
      return;
    }

    setSelectedTemplateId(templateId);
    setShowTemplateDropdown(false);
    setIsRenderingTemplate(true);

    try {
      const result = await renderTemplateWithIncident({
        data: {
          templateId,
          incidentId: incident.id,
        },
      });
      setFormData({ ...formData, publicMessage: result.rendered });
    } catch (err) {
      console.error("Failed to render template:", err);
    } finally {
      setIsRenderingTemplate(false);
    }
  };

  const handleStatusChange = async (
    newStatus: "active" | "updated" | "resolved" | "archived"
  ) => {
    if (incident.status === "draft" && newStatus === "active") {
      setShowPublishDialog(true);
      setSelectedTemplateId("");
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
      await publishIncidentWithNotifications({
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
          { label: "Publish", status: "active" as const, icon: <Play className="h-4 w-4" />, variant: "default" as const },
        ];
      case "active":
        return [
          { label: "Post Update", status: "updated" as const, icon: <RefreshCw className="h-4 w-4" />, variant: "secondary" as const },
          { label: "Resolve", status: "resolved" as const, icon: <CheckCircle className="h-4 w-4" />, variant: "default" as const },
        ];
      case "updated":
        return [
          { label: "Post Update", status: "updated" as const, icon: <RefreshCw className="h-4 w-4" />, variant: "secondary" as const },
          { label: "Resolve", status: "resolved" as const, icon: <CheckCircle className="h-4 w-4" />, variant: "default" as const },
        ];
      case "resolved":
        return [
          { label: "Reopen", status: "active" as const, icon: <RefreshCw className="h-4 w-4" />, variant: "secondary" as const },
          { label: "Archive", status: "archived" as const, icon: <Archive className="h-4 w-4" />, variant: "outline" as const },
        ];
      case "archived":
        return [
          { label: "Restore", status: "resolved" as const, icon: <RefreshCw className="h-4 w-4" />, variant: "secondary" as const },
        ];
      default:
        return [];
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdateContent.trim()) return;

    setIsAddingUpdate(true);
    setError(null);
    try {
      await addIncidentUpdate({
        data: {
          incidentId: incident.id,
          content: newUpdateContent.trim(),
        },
      });
      setNewUpdateContent("");
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add update");
    } finally {
      setIsAddingUpdate(false);
    }
  };

  const formatUpdateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const affectedModes = incident.affected_modes ? JSON.parse(incident.affected_modes) : [];
  const affectedRoutes = incident.affected_routes ? JSON.parse(incident.affected_routes) : [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={incident.status}>{incident.status}</Badge>
          <Badge severity={incident.severity}>{incident.severity}</Badge>
          <span className="text-sm text-muted-foreground">
            {incident.incident_type.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Edit">
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isUpdating} className="text-red-500" title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">{error}</Alert>
      )}

      {/* Status Actions */}
      {!isEditing && (
        <Card className="p-4 mb-6 bg-muted/50">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Actions:</span>
            {getStatusActions().map((action) => (
              <Button
                key={action.status}
                variant={action.variant}
                onClick={() => handleStatusChange(action.status)}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {isEditing ? (
        /* Edit Mode */
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                      <Badge key={routeId} variant="secondary" className="gap-1">
                        {routeId} - {route?.name || "Unknown"}
                        <button type="button" onClick={() => toggleRoute(routeId)} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  onFocus={() => setShowRouteDropdown(true)}
                  placeholder="Search routes..."
                  className="pl-10"
                />
                {showRouteDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border bg-background shadow-lg">
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
              <Textarea
                rows={3}
                value={formData.publicMessage}
                onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Internal Notes</label>
              <Textarea
                rows={2}
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges} disabled={isUpdating}>
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* View Mode */
        <div className="space-y-4">
          <Card className="p-4">
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
          </Card>

          {(affectedModes.length > 0 || affectedRoutes.length > 0) && (
            <Card className="p-4">
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
                      <Badge key={routeId} variant="default">
                        {routeId} {route && `- ${route.name}`}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {incident.public_message && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Public Message</h3>
              <p className="text-sm whitespace-pre-wrap">{incident.public_message}</p>
            </Card>
          )}

          {incident.internal_notes && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <h3 className="text-sm font-semibold mb-2 text-amber-800">Internal Notes</h3>
              <p className="text-sm text-amber-700 whitespace-pre-wrap">{incident.internal_notes}</p>
            </Card>
          )}

          {/* Updates Section */}
          <Card>
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Updates ({updates.length})
              </h3>
            </div>

            {updates.length > 0 && (
              <div className="divide-y">
                {updates.map((update) => (
                  <div key={update.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{update.created_by_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatUpdateTime(update.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{update.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {updates.length === 0 && !canAddUpdates && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No updates yet
              </div>
            )}

            {canAddUpdates && (
              <div className="p-4 border-t bg-muted/30">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Textarea
                      value={newUpdateContent}
                      onChange={(e) => setNewUpdateContent(e.target.value)}
                      placeholder="Add an update..."
                      rows={2}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        onClick={handleAddUpdate}
                        disabled={isAddingUpdate || !newUpdateContent.trim()}
                      >
                        {isAddingUpdate ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Post Update
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4 text-sm">
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
          </Card>
        </div>
      )}

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Incident</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Publishing this incident will make it active and visible to the public.
          </p>

          <div className="space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="flex items-start gap-3">
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
            </Card>

            {sendNotifications && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Message Template
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                      disabled={isLoadingTemplates || isUpdating}
                      className="w-full h-10 rounded-lg border bg-background px-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {isLoadingTemplates ? (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading templates...
                        </span>
                      ) : selectedTemplateId ? (
                        <span className="flex items-center gap-2 truncate">
                          {templates.find((t) => t.id === selectedTemplateId)?.is_default ? (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                          ) : null}
                          {templates.find((t) => t.id === selectedTemplateId)?.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {templates.length > 0 ? "Select a template..." : "No templates available"}
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>

                    {showTemplateDropdown && templates.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTemplateDropdown(false)} />
                        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border bg-background shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId("");
                              setShowTemplateDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-sm text-left hover:bg-accent text-muted-foreground"
                          >
                            No template (write custom)
                          </button>
                          <div className="border-t" />
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => handleTemplateSelect(template.id)}
                              className={`w-full px-3 py-2 text-sm text-left hover:bg-accent ${
                                selectedTemplateId === template.id ? "bg-accent" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {template.is_default ? (
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                                ) : null}
                                <span className="font-medium truncate">{template.name}</span>
                                {template.channel_type && (
                                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                                    {template.channel_type}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notification Message</label>
                  {isRenderingTemplate ? (
                    <div className="w-full h-20 rounded-lg border bg-muted/50 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Applying template...
                      </span>
                    </div>
                  ) : (
                    <Textarea
                      rows={4}
                      value={formData.publicMessage}
                      onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
                      placeholder="Message to send to subscribers..."
                    />
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formData.publicMessage.length} characters
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowPublishDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Publish Incident
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
