import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Plus,
  Copy,
  Edit,
  Trash2,
  X,
  Loader2,
  Star,
  Mail,
  MessageSquare,
  Smartphone,
  Twitter,
  Monitor,
} from "lucide-react";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  seedDefaultTemplates,
  type Template,
} from "../server/templates";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";
import {
  Button,
  Input,
  Textarea,
  Card,
  PageHeader,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
  Select,
  Alert,
} from "../components/ui";

export const Route = createFileRoute("/templates")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    const result = await getTemplates({ data: { limit: 100 } });
    return { templates: result.templates };
  },
  component: TemplatesPage,
});

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  push: <Smartphone className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  signage: <Monitor className="h-4 w-4" />,
};

const incidentTypes = [
  "service_disruption",
  "delay",
  "closure",
  "safety_alert",
  "weather",
  "maintenance",
  "special_event",
];

const channelTypes = ["email", "sms", "push", "twitter", "signage"];

function TemplatesPage() {
  const { templates } = Route.useLoaderData();
  const { user } = useSession();
  const canCreate = hasPermission(user, "templates.create");
  const canEdit = hasPermission(user, "templates.edit");
  const canDelete = hasPermission(user, "templates.delete");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate({ data: { id } });
      window.location.reload();
    } catch (err) {
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate({ data: { id } });
      window.location.reload();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  };

  const handleSeedTemplates = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDefaultTemplates();
      toast({ title: "Success", description: `Successfully added ${result.inserted} default templates!`, variant: "success" });
      window.location.reload();
    } catch (err) {
      toast({ title: "Error", description: "Failed to seed templates", variant: "destructive" });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Message Templates"
        description="Manage reusable message templates for quick incident communications"
        actions={
          <div className="flex gap-2">
            {templates.length === 0 && canCreate && (
              <Button variant="outline" onClick={handleSeedTemplates} disabled={isSeeding}>
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Load Default Templates
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            )}
          </div>
        }
      />

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onEdit={() => setEditingTemplate(template)}
            onDuplicate={() => handleDuplicate(template.id)}
            onDelete={() => handleDelete(template.id)}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}

        {/* Add New Template Card */}
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl border-2 border-dashed bg-card p-4 hover:border-primary hover:bg-accent/50 transition-colors flex flex-col items-center justify-center min-h-[180px]"
          >
            <div className="rounded-full bg-muted p-3 mb-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="font-medium">Create New Template</span>
            <span className="text-sm text-muted-foreground">
              Build a reusable message template
            </span>
          </button>
        )}
      </div>

      {templates.length === 0 && !canCreate && (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
          title="No templates found"
          description="No message templates have been created yet."
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <TemplateModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit Modal */}
      {editingTemplate && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  canCreate,
  canEdit,
  canDelete,
}: TemplateCardProps) {
  const channelIcon = template.channel_type
    ? channelIcons[template.channel_type]
    : null;

  return (
    <Card className="p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          {template.is_default === 1 && (
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          )}
          {channelIcon && (
            <span className="rounded-full bg-muted p-1">{channelIcon}</span>
          )}
          {template.incident_type && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {template.incident_type.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>
      <h3 className="font-semibold mb-1">{template.name}</h3>
      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
        {template.description || template.content.substring(0, 80) + "..."}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Updated {new Date(template.updated_at).toLocaleDateString()}
        </span>
        <div className="flex gap-1">
          {canCreate && (
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500" title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

interface TemplateModalProps {
  template?: Template;
  onClose: () => void;
}

function TemplateModal({ template, onClose }: TemplateModalProps) {
  const isEditing = !!template;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    incidentType: template?.incident_type || "",
    channelType: template?.channel_type || "",
    content: template?.content || "",
    isDefault: template?.is_default === 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        throw new Error("Please enter a template name");
      }
      if (!formData.content.trim()) {
        throw new Error("Please enter template content");
      }

      if (isEditing) {
        await updateTemplate({
          data: {
            id: template.id,
            name: formData.name,
            description: formData.description || undefined,
            incidentType: formData.incidentType || null,
            channelType: formData.channelType || null,
            content: formData.content,
            isDefault: formData.isDefault,
          },
        });
      } else {
        await createTemplate({
          data: {
            name: formData.name,
            description: formData.description || undefined,
            incidentType: formData.incidentType || undefined,
            channelType: formData.channelType as any || undefined,
            content: formData.content,
            isDefault: formData.isDefault,
          },
        });
      }

      onClose();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">{error}</Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Template Name *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Service Disruption Alert"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Incident Type
              </label>
              <Select
                value={formData.incidentType}
                onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">All Types</option>
                {incidentTypes.map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Channel Type</label>
              <Select
                value={formData.channelType}
                onChange={(e) => setFormData({ ...formData, channelType: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">All Channels</option>
                {channelTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border"
                disabled={isSubmitting}
              />
              <label htmlFor="isDefault" className="text-sm font-medium">
                Set as default template
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of when to use this template"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Template Content *</label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter your template content. Use {{variable}} for dynamic placeholders..."
              rows={8}
              className="font-mono"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use {"{{variable}}"} syntax for placeholders. Common variables:
              route, time, description, severity, affected_area
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Template"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
