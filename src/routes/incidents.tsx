import { createFileRoute, Outlet, Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { getIncidents } from "../lib/server-functions";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";

export const Route = createFileRoute("/incidents")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    try {
      const result = await getIncidents({ data: { limit: 50 } });
      return { incidents: result.incidents };
    } catch (error) {
      console.error("Incidents loader error:", error);
      return { incidents: [] };
    }
  },
  component: IncidentsLayout,
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

function IncidentsLayout() {
  const { incidents } = Route.useLoaderData() as { incidents: Incident[] };
  const matches = useMatches();
  const { user } = useSession();
  const canCreate = hasPermission(user, "incidents.create");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Check if we're on a child route (detail or new)
  const isChildRoute = matches.some(
    (match) => match.routeId === "/incidents/$incidentId" || match.routeId === "/incidents/new"
  );

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
    <div className="h-full flex overflow-hidden">
      {/* Left Panel - Incidents List */}
      <div className={`${isChildRoute ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 border-r bg-background`}>
        {/* Header */}
        <div className="flex-none p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Incidents</h1>
              <p className="text-sm text-muted-foreground">
                {filteredIncidents.length} incidents
              </p>
            </div>
            {canCreate && (
              <Link
                to="/incidents/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New
              </Link>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 flex-1 rounded-lg border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="h-8 flex-1 rounded-lg border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Incidents List */}
        <div className="flex-1 overflow-y-auto">
          {filteredIncidents.length > 0 ? (
            <div className="divide-y">
              {filteredIncidents.map((incident) => (
                <IncidentListItem key={incident.id} incident={incident} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <div className="mb-3 rounded-full bg-muted p-3">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-1 font-medium">No incidents found</p>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery || statusFilter || severityFilter
                  ? "Try adjusting your filters"
                  : canCreate
                    ? "Create your first incident"
                    : "No incidents to display"}
              </p>
              {canCreate && (
                <Link
                  to="/incidents/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Create Incident
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detail View / Child Route */}
      <div className={`${isChildRoute ? "flex" : "hidden lg:flex"} flex-1 flex-col bg-muted/30`}>
        {isChildRoute ? (
          <>
            {/* Mobile back button */}
            <div className="lg:hidden flex-none p-2 border-b bg-background">
              <Link
                to="/incidents"
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
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="mb-4 rounded-full bg-muted p-4">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Select an incident</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreate
                ? "Choose an incident from the list to view details, or create a new one."
                : "Choose an incident from the list to view details."}
            </p>
            {canCreate && (
              <Link
                to="/incidents/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New Incident
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface IncidentListItemProps {
  incident: Incident;
}

function IncidentListItem({ incident }: IncidentListItemProps) {
  const severityColors: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-amber-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };

  const statusColors: Record<string, string> = {
    draft: "text-gray-500",
    active: "text-red-600",
    updated: "text-amber-600",
    resolved: "text-green-600",
    archived: "text-gray-400",
  };

  return (
    <Link
      to="/incidents/$incidentId"
      params={{ incidentId: incident.id }}
      className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
      activeProps={{ className: "bg-accent" }}
    >
      <div className={`w-2 h-2 rounded-full ${severityColors[incident.severity]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{incident.title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={statusColors[incident.status]}>{incident.status}</span>
          <span>&bull;</span>
          <span>{formatRelativeTime(incident.created_at)}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
    </Link>
  );
}
