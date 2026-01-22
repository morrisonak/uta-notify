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
import { getDashboardStats, getRecentActivity } from "../lib/server-functions";
import { getIncidents } from "../server/incidents";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";
import { Button, Badge, Card, CardContent, PageHeader, EmptyState, StatCard } from "../components/ui";

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
    <div className="h-full flex flex-col overflow-hidden p-6">
      <PageHeader
        title="Dashboard"
        description="Overview of active incidents and communication status"
        className="mb-6"
      />

      {/* Stats Grid */}
      <div className="flex-none mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Incidents"
          value={stats.activeIncidents.toString()}
          description={stats.activeIncidents > 0 ? "Requires attention" : "All clear"}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.activeIncidents > 0 ? "danger" : "default"}
          tooltip="Number of incidents currently in 'active' status that may require attention"
        />
        <StatCard
          title="Messages Today"
          value={stats.messagesToday.toString()}
          description={`${stats.messagesToday} sent today`}
          icon={<MessageSquare className="h-4 w-4" />}
          variant="default"
          tooltip="Total notifications sent across all channels (email, SMS, push) today"
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate !== null ? `${stats.deliveryRate}%` : "—"}
          description={stats.deliveryRate !== null ? "Today's rate" : "No data yet"}
          icon={<TrendingUp className="h-4 w-4" />}
          variant={stats.deliveryRate !== null && stats.deliveryRate >= 95 ? "success" : "default"}
          tooltip="Percentage of messages successfully delivered to recipients today"
        />
        <StatCard
          title="Subscribers"
          value={stats.totalSubscribers.toString()}
          description="Total active"
          icon={<Users className="h-4 w-4" />}
          variant="default"
          tooltip="Total number of active subscribers receiving notifications"
        />
      </div>

      {/* Main Content - Incidents & Activity */}
      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-2">
        {/* Active Incidents */}
        <Card className="flex flex-col min-h-0">
          <div className="flex-none flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Active Incidents</h2>
            <Link
              to="/incidents"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
            {incidents.length > 0 ? (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Bell className="h-6 w-6 text-muted-foreground" />}
                title="No active incidents"
                description="All systems operating normally"
                action={
                  <Button asChild size="sm">
                    <Link to="/incidents">
                      <Plus className="h-4 w-4" />
                      Create Incident
                    </Link>
                  </Button>
                }
                className="h-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col min-h-0">
          <div className="flex-none flex items-center justify-between border-b p-4">
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
              <EmptyState
                icon={<Clock className="h-6 w-6 text-muted-foreground" />}
                title="No recent activity"
                description="Activity will appear here as you use the system"
                className="h-full"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex-none mt-6">
        <h2 className="mb-3 font-semibold text-sm">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
  return (
    <Link
      to="/incidents/$incidentId"
      params={{ incidentId: incident.id }}
      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{incident.title}</p>
          <p className="text-xs text-muted-foreground">{incident.incident_type.replace(/_/g, " ")}</p>
        </div>
        <Badge severity={incident.severity as any}>
          {incident.severity}
        </Badge>
      </div>
    </Link>
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
      className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  );
}
