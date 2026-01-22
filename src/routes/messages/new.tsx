import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Send, Loader2, FileText, ChevronDown, Star, Sparkles } from "lucide-react";
import { createMessage } from "../../server/messages";
import { getIncidents } from "../../server/incidents";
import {
  getTemplatesForIncident,
  renderTemplateWithIncident,
} from "../../server/templates";
import { requirePermissionFn } from "../../server/auth";
import { Button, Textarea, Card, PageHeader } from "../../components/ui";

export const Route = createFileRoute("/messages/new")({
  beforeLoad: async () => {
    await requirePermissionFn({ data: { permission: "messages.create" } });
  },
  loader: async () => {
    const incidentsData = await getIncidents({ data: { limit: 100 } });
    return { incidents: incidentsData.incidents };
  },
  component: NewMessagePage,
});

interface IncidentListItem {
  id: string;
  title: string;
  status: string;
  incident_type: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  channel_type: string | null;
  content: string;
  is_default: number;
}

function NewMessagePage() {
  const { incidents } = Route.useLoaderData() as { incidents: IncidentListItem[] };
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    incidentId: "",
    content: "",
  });

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isRenderingTemplate, setIsRenderingTemplate] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const availableIncidents = incidents.filter((i) =>
    ["draft", "active", "updated"].includes(i.status)
  );

  const selectedIncident = availableIncidents.find((i) => i.id === formData.incidentId);

  useEffect(() => {
    if (selectedIncident) {
      loadTemplates(selectedIncident.incident_type);
    } else {
      setTemplates([]);
      setSelectedTemplateId("");
    }
  }, [selectedIncident?.id]);

  const loadTemplates = async (incidentType: string) => {
    setIsLoadingTemplates(true);
    try {
      const result = await getTemplatesForIncident({ data: { incidentType } });
      setTemplates(result.templates);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!formData.incidentId || !templateId) return;

    setSelectedTemplateId(templateId);
    setShowTemplateDropdown(false);
    setIsRenderingTemplate(true);
    setError(null);

    try {
      const result = await renderTemplateWithIncident({
        data: {
          templateId,
          incidentId: formData.incidentId,
        },
      });
      setFormData({ ...formData, content: result.rendered });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render template");
    } finally {
      setIsRenderingTemplate(false);
    }
  };

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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="p-6">
      <PageHeader
        title="Compose Message"
        description="Send a new message to subscribers for an incident"
      />

      <form onSubmit={handleSubmit}>
        <Card className="p-4">
          <div className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Related Incident <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.incidentId}
                onChange={(e) => {
                  setFormData({ ...formData, incidentId: e.target.value, content: "" });
                  setSelectedTemplateId("");
                }}
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

            {/* Template Selector */}
            {formData.incidentId && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Message Template
                  </span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    disabled={isLoadingTemplates || isSubmitting}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    {isLoadingTemplates ? (
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading templates...
                      </span>
                    ) : selectedTemplate ? (
                      <span className="flex items-center gap-2">
                        {selectedTemplate.is_default ? (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        ) : null}
                        {selectedTemplate.name}
                        {selectedTemplate.channel_type && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {selectedTemplate.channel_type}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {templates.length > 0
                          ? "Select a template (optional)..."
                          : "No templates available"}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {showTemplateDropdown && templates.length > 0 && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowTemplateDropdown(false)}
                      />
                      <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border bg-background shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId("");
                            setShowTemplateDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-accent text-muted-foreground"
                        >
                          No template (write custom message)
                        </button>
                        <div className="border-t" />
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleTemplateSelect(template.id)}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-start gap-2 ${
                              selectedTemplateId === template.id ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
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
                              {template.description && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Templates auto-fill incident data like title, routes, and severity
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Message Content <span className="text-red-500">*</span>
              </label>
              {isRenderingTemplate ? (
                <div className="w-full h-36 rounded-lg border bg-muted/50 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Applying template...
                  </span>
                </div>
              ) : (
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter your message to subscribers..."
                  rows={8}
                  disabled={isSubmitting}
                />
              )}
              <div className="flex justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {formData.content.length} characters
                </p>
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground">
                    Using: {selectedTemplate.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.navigate({ to: "/messages" })}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || availableIncidents.length === 0 || isRenderingTemplate}
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
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
