import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  User,
  FileText,
  AlertTriangle,
  MessageSquare,
  Users,
  Settings,
  ArrowRight,
} from "lucide-react";
import { getAuditLog, type AuditLogEntry } from "../../server/audit";
import { requirePermissionFn } from "../../server/auth";
import { Badge, Card } from "../../components/ui";

export const Route = createFileRoute("/audit/$auditId")({
  beforeLoad: async () => {
    await requirePermissionFn({ data: { permission: "audit.view" } });
  },
  loader: async ({ params }) => {
    const result = await getAuditLog({ data: { id: params.auditId } });
    return { log: result.log };
  },
  component: AuditDetailPage,
});

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  publish: "bg-purple-100 text-purple-800",
  resolve: "bg-emerald-100 text-emerald-800",
  archive: "bg-gray-100 text-gray-800",
  send: "bg-amber-100 text-amber-800",
  login: "bg-indigo-100 text-indigo-800",
  logout: "bg-slate-100 text-slate-800",
  export: "bg-cyan-100 text-cyan-800",
  import: "bg-teal-100 text-teal-800",
};

const resourceIcons: Record<string, React.ReactNode> = {
  incident: <AlertTriangle className="h-5 w-5" />,
  message: <MessageSquare className="h-5 w-5" />,
  template: <FileText className="h-5 w-5" />,
  subscriber: <Users className="h-5 w-5" />,
  user: <User className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
};

const resourceRoutes: Record<string, string> = {
  incident: "/incidents/$incidentId",
  message: "/messages/$messageId",
  template: "/templates",
  subscriber: "/subscribers",
};

function AuditDetailPage() {
  const { log } = Route.useLoaderData() as { log: AuditLogEntry };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const parsedChanges = log.changes ? JSON.parse(log.changes) : null;
  const parsedDetails = log.details ? JSON.parse(log.details) : null;

  const resourceRoute = resourceRoutes[log.resource_type];
  const canLinkToResource = resourceRoute && log.resource_id;

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            {resourceIcons[log.resource_type] || <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  actionColors[log.action] || "bg-gray-100 text-gray-800"
                }`}
              >
                {log.action}
              </span>
              <span className="text-sm text-muted-foreground capitalize">
                {log.resource_type}
              </span>
            </div>
            <h1 className="text-xl font-bold mb-1">
              {log.resource_name || `${log.resource_type} operation`}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatDate(log.created_at)}
            </p>
          </div>
        </div>

        {canLinkToResource && (
          <Link
            to={resourceRoute}
            params={{
              incidentId: log.resource_type === "incident" ? log.resource_id! : undefined,
              messageId: log.resource_type === "message" ? log.resource_id! : undefined,
            }}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View {log.resource_type}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Details Grid */}
      <div className="space-y-6">
        {/* Actor Information */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Actor Information
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Name</p>
              <p className="font-medium">{log.actor_name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Type</p>
              <p className="font-medium capitalize">{log.actor_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Actor ID</p>
              <p className="font-mono text-sm">{log.actor_id || "—"}</p>
            </div>
            {log.ip_address && (
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">IP Address</p>
                <p className="font-mono text-sm">{log.ip_address}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Resource Information */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold flex items-center gap-2">
              {resourceIcons[log.resource_type] || <FileText className="h-4 w-4" />}
              Resource Information
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Type</p>
              <p className="font-medium capitalize">{log.resource_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Name</p>
              <p className="font-medium">{log.resource_name || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase mb-1">Resource ID</p>
              <p className="font-mono text-sm break-all">{log.resource_id || "—"}</p>
            </div>
          </div>
        </Card>

        {/* Changes */}
        {parsedChanges && Object.keys(parsedChanges).length > 0 && (
          <Card>
            <div className="border-b p-4">
              <h2 className="font-semibold">Changes</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {Object.entries(parsedChanges).map(([field, change]: [string, any]) => (
                  <div key={field} className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground uppercase mb-2">{field}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-red-600 mb-1">Previous</p>
                        <div className="rounded-lg bg-red-50 p-3 text-sm">
                          {typeof change.old === "object"
                            ? JSON.stringify(change.old, null, 2)
                            : String(change.old ?? "—")}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-600 mb-1">New</p>
                        <div className="rounded-lg bg-green-50 p-3 text-sm">
                          {typeof change.new === "object"
                            ? JSON.stringify(change.new, null, 2)
                            : String(change.new ?? "—")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Details */}
        {parsedDetails && Object.keys(parsedDetails).length > 0 && (
          <Card>
            <div className="border-b p-4">
              <h2 className="font-semibold">Additional Details</h2>
            </div>
            <div className="p-4">
              <div className="rounded-xl border bg-muted/50 p-4 font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(parsedDetails, null, 2)}</pre>
              </div>
            </div>
          </Card>
        )}

        {/* Request Information */}
        {(log.request_id || log.user_agent) && (
          <Card>
            <div className="border-b p-4">
              <h2 className="font-semibold">Request Information</h2>
            </div>
            <div className="p-4 space-y-4">
              {log.request_id && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Request ID</p>
                  <p className="font-mono text-sm">{log.request_id}</p>
                </div>
              )}
              {log.user_agent && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">User Agent</p>
                  <p className="text-xs text-muted-foreground break-all">{log.user_agent}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold">Metadata</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase mb-1">Audit Log ID</p>
              <p className="font-mono text-sm break-all">{log.id}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase mb-1">Timestamp (ISO)</p>
              <p className="font-mono text-sm">{log.created_at}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
