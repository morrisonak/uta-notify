import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Copy, Edit, Trash2 } from "lucide-react";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
});

const sampleTemplates = [
  {
    id: "1",
    name: "Service Disruption",
    description: "General template for service disruptions",
    category: "Incident",
    lastUpdated: "2024-01-15",
  },
  {
    id: "2",
    name: "Delay Notification",
    description: "Template for delay announcements",
    category: "Incident",
    lastUpdated: "2024-01-10",
  },
  {
    id: "3",
    name: "Service Restored",
    description: "Notification when service is back to normal",
    category: "Resolution",
    lastUpdated: "2024-01-08",
  },
  {
    id: "4",
    name: "Planned Maintenance",
    description: "Advance notice for scheduled maintenance",
    category: "Planned",
    lastUpdated: "2024-01-05",
  },
];

function TemplatesPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground">
            Manage reusable message templates for quick incident communications
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sampleTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-xl border bg-card p-4 hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {template.category}
              </span>
            </div>
            <h3 className="font-semibold mb-1">{template.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {template.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Updated {template.lastUpdated}
              </span>
              <div className="flex gap-1">
                <button className="rounded p-1.5 hover:bg-accent" title="Duplicate">
                  <Copy className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 hover:bg-accent" title="Edit">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 hover:bg-accent text-red-500" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Template Card */}
        <button className="rounded-xl border-2 border-dashed bg-card p-4 hover:border-primary hover:bg-accent/50 transition-colors flex flex-col items-center justify-center min-h-[180px]">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="font-medium">Create New Template</span>
          <span className="text-sm text-muted-foreground">
            Build a reusable message template
          </span>
        </button>
      </div>
    </div>
  );
}
