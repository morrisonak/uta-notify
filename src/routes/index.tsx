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
import { getDashboardStats, getIncidents } from "../lib/server-functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const [stats, incidentsData] = await Promise.all([
        getDashboardStats(),
        getIncidents({ data: { status: "active", limit: 5 } }),
      ]);
      return { stats, incidents: incidentsData.incidents };
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
      };
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { stats, incidents } = Route.useLoaderData();

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of active incidents and communication status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Incidents"
          value={stats.activeIncidents.toString()}
          change={stats.activeIncidents > 0 ? "Requires attention" : "All clear"}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={stats.activeIncidents > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Messages Today"
          value={stats.messagesToday.toString()}
          change={`${stats.messagesToday} sent today`}
          icon={<MessageSquare className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate !== null ? `${stats.deliveryRate}%` : "—"}
          change={stats.deliveryRate !== null ? "Today's rate" : "No data yet"}
          icon={<TrendingUp className="h-5 w-5" />}
          variant={stats.deliveryRate !== null && stats.deliveryRate >= 95 ? "success" : "default"}
        />
        <StatCard
          title="Subscribers"
          value={stats.totalSubscribers.toString()}
          change="Total active"
          icon={<Users className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Incidents */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Active Incidents</h2>
            <Link
              to="/incidents"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-4">
            {incidents.length > 0 ? (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-3">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mb-2 font-medium">No active incidents</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  All systems operating normally
                </p>
                <Link
                  to="/incidents"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Create Incident
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y">
            <ActivityItem
              title="System initialized"
              description="UTA Notify platform is ready for use"
              time="Just now"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            />
            <ActivityItem
              title="Database configured"
              description="D1 database schema applied"
              time="Just now"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            />
            <ActivityItem
              title="Channels initialized"
              description="All communication channels ready"
              time="Just now"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title="New Incident"
            description="Create a new incident report"
            href="/incidents"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <QuickActionCard
            title="Send Message"
            description="Broadcast to subscribers"
            href="/messages"
            icon={<MessageSquare className="h-5 w-5" />}
          />
          <QuickActionCard
            title="Manage Templates"
            description="Edit message templates"
            href="/templates"
            icon={<Bell className="h-5 w-5" />}
          />
          <QuickActionCard
            title="View Reports"
            description="Analytics and exports"
            href="/reports"
            icon={<TrendingUp className="h-5 w-5" />}
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
      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{incident.title}</p>
          <p className="text-sm text-muted-foreground">{incident.incident_type}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[incident.severity] || severityColors.medium}`}
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
    <div className={`rounded-xl border p-6 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="rounded-lg bg-muted p-2">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{change}</p>
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
    <div className="flex items-start gap-4 p-4">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
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
      className="group flex items-start gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
