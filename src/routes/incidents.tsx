import { createFileRoute, Outlet, Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { getIncidents } from "../server/incidents";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";
import { Button, Input, EmptyState, Select } from "../components/ui";

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
        <div className="flex-none p-6 border-b">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Incidents</h1>
              <p className="text-sm text-muted-foreground">
                {filteredIncidents.length} incidents
              </p>
            </div>
            {canCreate && (
              <Button asChild>
                <Link to="/incidents/new">
                  <Plus className="h-4 w-4" />
                  New
                </Link>
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 flex-1"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="updated">Updated</option>
              <option value="resolved">Resolved</option>
              <option value="archived">Archived</option>
            </Select>
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 flex-1"
            >
              <option value="">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
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
            <EmptyState
              icon={<AlertTriangle className="h-6 w-6 text-muted-foreground" />}
              title="No incidents found"
              description={
                searchQuery || statusFilter || severityFilter
                  ? "Try adjusting your filters"
                  : canCreate
                    ? "Create your first incident"
                    : "No incidents to display"
              }
              action={
                canCreate ? (
                  <Button asChild>
                    <Link to="/incidents/new">
                      <Plus className="h-4 w-4" />
                      Create Incident
                    </Link>
                  </Button>
                ) : undefined
              }
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Right Panel - Detail View / Child Route */}
      <div className={`${isChildRoute ? "flex" : "hidden lg:flex"} flex-1 flex-col bg-muted/30`}>
        {isChildRoute ? (
          <>
            {/* Mobile back button */}
            <div className="lg:hidden flex-none p-3 border-b bg-background">
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
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}
            title="Select an incident"
            description={
              canCreate
                ? "Choose an incident from the list to view details, or create a new one."
                : "Choose an incident from the list to view details."
            }
            action={
              canCreate ? (
                <Button asChild>
                  <Link to="/incidents/new">
                    <Plus className="h-4 w-4" />
                    New Incident
                  </Link>
                </Button>
              ) : undefined
            }
            className="h-full"
          />
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
