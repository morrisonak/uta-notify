import { createFileRoute, Outlet, Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  Search,
  User,
  FileText,
  AlertTriangle,
  MessageSquare,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { getAuditLogs, getAuditStats, type AuditLogEntry } from "../server/audit";
import { requirePermissionFn } from "../server/auth";
import { formatRelativeTime } from "../lib/utils";
import { Button, Input, Card, EmptyState, StatCard, Select } from "../components/ui";

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
  component: AuditLayout,
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

function AuditLayout() {
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
  const matches = useMatches();
  const [logs, setLogs] = useState<AuditLogEntry[]>(logsData.logs);
  const [total, setTotal] = useState(logsData.total);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const limit = 50;

  const isChildRoute = matches.some(
    (match) => match.routeId === "/audit/$auditId"
  );

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
    <div className="h-full flex overflow-hidden">
      {/* Left Panel - Audit Logs List */}
      <div className={`${isChildRoute ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 border-r bg-background`}>
        {/* Header */}
        <div className="flex-none p-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Audit Log</h1>
              <p className="text-sm text-muted-foreground">
                {stats.total.toLocaleString()} total events
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard
              title="Today"
              value={stats.today.toLocaleString()}
            />
            <StatCard
              title="Top Action"
              value={stats.byAction[0]?.action || "—"}
            />
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setTimeout(handleFilterChange, 0);
              }}
              className="h-9 flex-1"
            >
              <option value="">All Resources</option>
              <option value="incident">Incidents</option>
              <option value="message">Messages</option>
              <option value="template">Templates</option>
              <option value="subscriber">Subscribers</option>
              <option value="user">Users</option>
            </Select>
            <Select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setTimeout(handleFilterChange, 0);
              }}
              className="h-9 flex-1"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="publish">Publish</option>
              <option value="resolve">Resolve</option>
              <option value="send">Send</option>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadLogs(0)}
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto">
          {filteredLogs.length > 0 ? (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <AuditLogListItem key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Shield className="h-6 w-6 text-muted-foreground" />}
              title="No audit logs found"
              description={
                searchQuery || resourceFilter || actionFilter
                  ? "Try adjusting your filters"
                  : "Activity will appear here"
              }
              className="h-full"
            />
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex-none flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {offset + 1} - {Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPage}
                disabled={offset === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPage}
                disabled={offset + limit >= total || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Detail View / Child Route */}
      <div className={`${isChildRoute ? "flex" : "hidden lg:flex"} flex-1 flex-col bg-muted/30`}>
        {isChildRoute ? (
          <>
            {/* Mobile back button */}
            <div className="lg:hidden flex-none p-3 border-b bg-background">
              <Link
                to="/audit"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Shield className="h-8 w-8 text-muted-foreground" />}
            title="Select an audit log entry"
            description="Choose an entry from the list to view full details"
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

interface AuditLogListItemProps {
  log: AuditLogEntry;
}

function AuditLogListItem({ log }: AuditLogListItemProps) {
  return (
    <Link
      to="/audit/$auditId"
      params={{ auditId: log.id }}
      className="flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors"
      activeProps={{ className: "bg-accent" }}
    >
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
        {resourceIcons[log.resource_type] || <FileText className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium capitalize ${
              actionColors[log.action] || "bg-gray-100 text-gray-800"
            }`}
          >
            {log.action}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {log.resource_type}
          </span>
        </div>
        <p className="text-sm font-medium truncate">
          {log.resource_name || `${log.resource_type} ${log.resource_id?.slice(0, 8) || ""}`}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{log.actor_name || log.actor_type}</span>
          <span>&bull;</span>
          <span>{formatRelativeTime(log.created_at)}</span>
        </div>
      </div>
      <ChevronDown className="h-4 w-4 text-muted-foreground flex-none rotate-[-90deg]" />
    </Link>
  );
}
