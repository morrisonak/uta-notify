import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, Search, X, FileText } from "lucide-react";
import { createIncident } from "../../server/incidents";
import { getTemplatesForIncident } from "../../server/templates";
import { requirePermissionFn } from "../../server/auth";
import { UTA_ROUTES, TRANSIT_MODES } from "../../data/uta-routes";

export const Route = createFileRoute("/incidents/new")({
  beforeLoad: async () => {
    await requirePermissionFn({ data: { permission: "incidents.create" } });
  },
  component: NewIncidentPage,
});

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  channel_type: string | null;
  content: string;
  is_default: number;
}

function NewIncidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    incidentType: "service_disruption",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    affectedModes: [] as string[],
    affectedRoutes: [] as string[],
    publicMessage: "",
    internalNotes: "",
  });
  const [routeSearch, setRouteSearch] = useState("");
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const loadTemplates = async (incidentType: string) => {
    setLoadingTemplates(true);
    try {
      const result = await getTemplatesForIncident({ data: { incidentType } });
      setTemplates(result.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates(formData.incidentType);
  }, [formData.incidentType]);

  const applyTemplate = (template: TemplateOption) => {
    let content = template.content;
    const routesList = formData.affectedRoutes.length > 0
      ? formData.affectedRoutes.map(id => {
          const route = UTA_ROUTES.find(r => r.id === id);
          return route ? `${id} (${route.name})` : id;
        }).join(", ")
      : "{{routes}}";

    content = content.replace(/\{\{\s*routes\s*\}\}/gi, routesList);
    content = content.replace(/\{\{\s*title\s*\}\}/gi, formData.title || "{{title}}");
    content = content.replace(/\{\{\s*severity\s*\}\}/gi, formData.severity);

    setFormData(prev => ({ ...prev, publicMessage: content }));
    setShowTemplateDropdown(false);
  };

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

  const filteredRoutes = UTA_ROUTES.filter((route) => {
    if (formData.affectedModes.length > 0) {
      const modeMatches = formData.affectedModes.some((mode) => {
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
      return route.id.toLowerCase().includes(query) || route.name.toLowerCase().includes(query);
    }
    return true;
  });

  const toggleRoute = (routeId: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedRoutes: prev.affectedRoutes.includes(routeId)
        ? prev.affectedRoutes.filter((r) => r !== routeId)
        : [...prev.affectedRoutes, routeId],
    }));
  };

  const toggleMode = (mode: string) => {
    setFormData((prev) => ({
      ...prev,
      affectedModes: prev.affectedModes.includes(mode)
        ? prev.affectedModes.filter((m) => m !== mode)
        : [...prev.affectedModes, mode],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createIncident({
        data: {
          title: formData.title,
          incidentType: formData.incidentType,
          severity: formData.severity,
          affectedModes: formData.affectedModes.length > 0 ? formData.affectedModes : undefined,
          affectedRoutes: formData.affectedRoutes.length > 0 ? formData.affectedRoutes : undefined,
          publicMessage: formData.publicMessage || undefined,
          internalNotes: formData.internalNotes || undefined,
        },
      });
      router.navigate({ to: "/incidents/$incidentId", params: { incidentId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Create New Incident</h1>
        <p className="text-sm text-muted-foreground">Fill in the details below to create a new incident</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-background rounded-lg border p-4">
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
                <option key={type.value} value={type.value}>{type.label}</option>
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
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
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

        {/* Affected Routes */}
        <div>
          <label className="block text-sm font-medium mb-1">Affected Routes</label>
          {formData.affectedRoutes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {formData.affectedRoutes.map((routeId) => {
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
              placeholder="Search routes by number or name..."
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
                {filteredRoutes.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No routes found</div>}
              </div>
            )}
          </div>
          {showRouteDropdown && <button type="button" onClick={() => setShowRouteDropdown(false)} className="fixed inset-0 z-0" aria-hidden="true" />}
        </div>

        {/* Public Message with Template */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Public Message</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (templates.length === 0) loadTemplates(formData.incidentType);
                  setShowTemplateDropdown(!showTemplateDropdown);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="h-3 w-3" />
                {loadingTemplates ? "Loading..." : "Use Template"}
              </button>
              {showTemplateDropdown && templates.length > 0 && (
                <div className="absolute right-0 z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg">
                  <div className="p-2 border-b"><span className="text-xs font-medium text-muted-foreground">Select a template</span></div>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        {template.is_default === 1 && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>}
                      </div>
                      {template.description && <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>}
                    </button>
                  ))}
                </div>
              )}
              {showTemplateDropdown && <button type="button" onClick={() => setShowTemplateDropdown(false)} className="fixed inset-0 z-10" aria-hidden="true" />}
            </div>
          </div>
          <textarea
            rows={4}
            value={formData.publicMessage}
            onChange={(e) => setFormData({ ...formData, publicMessage: e.target.value })}
            placeholder="Message to be shared with the public..."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Internal Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">Internal Notes</label>
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
            onClick={() => router.navigate({ to: "/incidents" })}
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
  );
}
