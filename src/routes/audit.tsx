import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  Search,
  Filter,
  User,
  Clock,
  FileText,
  AlertTriangle,
  MessageSquare,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { getAuditLogs, getAuditStats, type AuditLogEntry } from "../server/audit";
import { requirePermissionFn } from "../server/auth";
import { formatRelativeTime } from "../lib/utils";

export const Route = createFileRoute("/audit")({
  beforeLoad: async () => {
    await requirePermissionFn({ data: { permission: "audit.view" } });
  },
  loader: async () => {
    const [logsData, stats] = await Promise.all([
      getAuditLogs({ data: { limit: 50, offset: 0 } }),
      getAuditStats(),
    ]);
    return { logsData, stats };
  },
  component: AuditLogPage,
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
  incident: <AlertTriangle className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  template: <FileText className="h-4 w-4" />,
  subscriber: <Users className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

function AuditLogPage() {
  const data = Route.useLoaderData() as {
    logsData: { logs: AuditLogEntry[]; total: number };
    stats: {
      total: number;
      today: number;
      byAction: { action: string; count: number }[];
      byResource: { resource_type: string; count: number }[];
      topUsers: { actor_id: string; actor_name: string; count: number }[];
    };
  };
  const { logsData, stats } = data;
  const [logs, setLogs] = useState<AuditLogEntry[]>(logsData.logs);
  const [total, setTotal] = useState(logsData.total);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const limit = 50;

  const loadLogs = async (newOffset: number = 0) => {
    setIsLoading(true);
    try {
      const result = await getAuditLogs({
        data: {
          limit,
          offset: newOffset,
          resourceType: resourceFilter || undefined,
          action: actionFilter || undefined,
        },
      });
      setLogs(result.logs);
      setTotal(result.total);
      setOffset(newOffset);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      loadLogs(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      loadLogs(offset + limit);
    }
  };

  const handleFilterChange = () => {
    loadLogs(0);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.actor_name?.toLowerCase().includes(query) ||
      log.resource_name?.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.resource_type.toLowerCase().includes(query)
    );
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Audit Log</h1>
              <p className="text-muted-foreground">
                Track all system activity and user actions
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-2xl font-bold">{stats.today.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Top Action (7d)</p>
            <p className="text-2xl font-bold capitalize">
              {stats.byAction[0]?.action || "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Top Resource (7d)</p>
            <p className="text-2xl font-bold capitalize">
              {stats.byResource[0]?.resource_type || "—"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setTimeout(handleFilterChange, 0);
            }}
            className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Resources</option>
            <option value="incident">Incidents</option>
            <option value="message">Messages</option>
            <option value="template">Templates</option>
            <option value="subscriber">Subscribers</option>
            <option value="user">Users</option>
            <option value="settings">Settings</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setTimeout(handleFilterChange, 0);
            }}
            className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="publish">Publish</option>
            <option value="resolve">Resolve</option>
            <option value="archive">Archive</option>
            <option value="send">Send</option>
            <option value="login">Login</option>
          </select>
          <button
            onClick={() => loadLogs(0)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(log.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="font-medium">
                            {log.actor_name || log.actor_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            actionColors[log.action] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {resourceIcons[log.resource_type] || <FileText className="h-4 w-4" />}
                          </span>
                          <span className="capitalize">{log.resource_type}</span>
                          {log.resource_name && (
                            <span className="text-muted-foreground">
                              "{log.resource_name}"
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {log.changes ? (
                          <span className="text-blue-600">Changed fields</span>
                        ) : log.details ? (
                          <span>Has details</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="font-medium">No audit logs found</p>
                        <p className="text-sm text-muted-foreground">
                          Activity will appear here as users interact with the system
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={offset === 0 || isLoading}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={offset + limit >= total || isLoading}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-background p-6 shadow-xl m-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Audit Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1 hover:bg-accent"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Timestamp
                    </p>
                    <p className="font-medium">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Actor
                    </p>
                    <p className="font-medium">
                      {selectedLog.actor_name || selectedLog.actor_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Action
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        actionColors[selectedLog.action] || "bg-gray-100"
                      }`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Resource
                    </p>
                    <p className="font-medium capitalize">
                      {selectedLog.resource_type}
                      {selectedLog.resource_name && `: ${selectedLog.resource_name}`}
                    </p>
                  </div>
                </div>

                {selectedLog.ip_address && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      IP Address
                    </p>
                    <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                  </div>
                )}

                {selectedLog.changes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Changes
                    </p>
                    <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(JSON.parse(selectedLog.changes), null, 2)}</pre>
                    </div>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Details
                    </p>
                    <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(JSON.parse(selectedLog.details), null, 2)}</pre>
                    </div>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      User Agent
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
