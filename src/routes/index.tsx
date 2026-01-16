import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  MessageSquare,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { getDashboardStats, getIncidents, getRecentActivity } from "../lib/server-functions";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    try {
      const [stats, incidentsData, activityData] = await Promise.all([
        getDashboardStats(),
        getIncidents({ data: { status: "active", limit: 5 } }),
        getRecentActivity(),
      ]);
      return {
        stats,
        incidents: incidentsData.incidents,
        activities: activityData.activities,
      };
    } catch (error) {
      console.error("Dashboard loader error:", error);
      // Return default values on error
      return {
        stats: {
          activeIncidents: 0,
          messagesToday: 0,
          deliveryRate: null,
          totalSubscribers: 0,
        },
        incidents: [],
        activities: [],
      };
    }
  },
  component: DashboardPage,
});

interface Activity {
  id: string;
  type: "incident_created" | "incident_updated" | "incident_resolved" | "message_sent" | "subscriber_added";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "incident_created":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "incident_updated":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "incident_resolved":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "message_sent":
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    case "subscriber_added":
      return <Users className="h-4 w-4 text-cyan-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

function DashboardPage() {
  const { stats, incidents, activities } = Route.useLoaderData() as {
    stats: {
      activeIncidents: number;
      messagesToday: number;
      deliveryRate: number | null;
      totalSubscribers: number;
    };
    incidents: any[];
    activities: Activity[];
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 lg:p-6">
      {/* Header */}
      <div className="flex-none mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of active incidents and communication status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="flex-none mb-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Incidents"
          value={stats.activeIncidents.toString()}
          change={stats.activeIncidents > 0 ? "Requires attention" : "All clear"}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.activeIncidents > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Messages Today"
          value={stats.messagesToday.toString()}
          change={`${stats.messagesToday} sent today`}
          icon={<MessageSquare className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate !== null ? `${stats.deliveryRate}%` : "—"}
          change={stats.deliveryRate !== null ? "Today's rate" : "No data yet"}
          icon={<TrendingUp className="h-4 w-4" />}
          variant={stats.deliveryRate !== null && stats.deliveryRate >= 95 ? "success" : "default"}
        />
        <StatCard
          title="Subscribers"
          value={stats.totalSubscribers.toString()}
          change="Total active"
          icon={<Users className="h-4 w-4" />}
          variant="default"
        />
      </div>

      {/* Main Content - Incidents & Activity (fills remaining space) */}
      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-2">
        {/* Active Incidents */}
        <div className="rounded-xl border bg-card flex flex-col min-h-0">
          <div className="flex-none flex items-center justify-between border-b p-3">
            <h2 className="font-semibold">Active Incidents</h2>
            <Link
              to="/incidents"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {incidents.length > 0 ? (
              <div className="space-y-2">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mb-1 font-medium">No active incidents</p>
                <p className="mb-3 text-sm text-muted-foreground">
                  All systems operating normally
                </p>
                <Link
                  to="/incidents"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Create Incident
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border bg-card flex flex-col min-h-0">
          <div className="flex-none flex items-center justify-between border-b p-3">
            <h2 className="font-semibold">Recent Activity</h2>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  title={activity.title}
                  description={activity.description}
                  time={formatRelativeTime(activity.timestamp)}
                  icon={getActivityIcon(activity.type)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mb-1 font-medium">No recent activity</p>
                <p className="text-sm text-muted-foreground">
                  Activity will appear here as you use the system
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex-none mt-4">
        <h2 className="mb-2 font-semibold text-sm">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title="New Incident"
            description="Create a new incident report"
            href="/incidents"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <QuickActionCard
            title="Send Message"
            description="Broadcast to subscribers"
            href="/messages"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <QuickActionCard
            title="Manage Templates"
            description="Edit message templates"
            href="/templates"
            icon={<Bell className="h-4 w-4" />}
          />
          <QuickActionCard
            title="View Reports"
            description="Analytics and exports"
            href="/reports"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}

interface IncidentCardProps {
  incident: {
    id: string;
    title: string;
    severity: string;
    status: string;
    incident_type: string;
    created_at: string;
  };
}

function IncidentCard({ incident }: IncidentCardProps) {
  const severityColors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  return (
    <Link
      to="/incidents"
      className="block rounded-lg border p-2.5 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{incident.title}</p>
          <p className="text-xs text-muted-foreground">{incident.incident_type.replace(/_/g, " ")}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${severityColors[incident.severity] || severityColors.medium}`}
        >
          {incident.severity}
        </span>
      </div>
    </Link>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  variant: "default" | "warning" | "success" | "danger";
}

function StatCard({ title, value, change, icon, variant }: StatCardProps) {
  const variantStyles = {
    default: "bg-card",
    warning: "bg-amber-50 border-amber-200",
    success: "bg-green-50 border-green-200",
    danger: "bg-red-50 border-red-200",
  };

  return (
    <div className={`rounded-lg border p-3 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className="rounded-md bg-muted p-1.5">{icon}</div>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{change}</p>
    </div>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
}

function ActivityItem({ title, description, time, icon }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function QuickActionCard({ title, description, href, icon }: QuickActionCardProps) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="rounded-md bg-primary/10 p-1.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  );
}
