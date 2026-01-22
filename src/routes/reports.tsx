import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Users,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  getReportStats,
  getIncidentsOverTime,
  getIncidentsBySeverity,
  getIncidentsByMode,
  getTopAffectedRoutes,
  exportIncidentsCSV,
} from "../server/reports";
import { requireAuthFn } from "../server/auth";
import { Button, Card, PageHeader, StatCard, EmptyState, toast } from "../components/ui";

export const Route = createFileRoute("/reports")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    const [stats, overTime, bySeverity, byMode, topRoutes] = await Promise.all([
      getReportStats({ data: {} }),
      getIncidentsOverTime({ data: {} }),
      getIncidentsBySeverity({ data: {} }),
      getIncidentsByMode({ data: {} }),
      getTopAffectedRoutes({ data: {} }),
    ]);
    return {
      stats,
      overTime: overTime.data,
      bySeverity: bySeverity.data,
      byMode: byMode.data,
      topRoutes: topRoutes.data,
    };
  },
  component: ReportsPage,
});

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

const modeColors: Record<string, string> = {
  bus: "bg-blue-500",
  rail: "bg-green-500",
  trax: "bg-purple-500",
  frontrunner: "bg-red-500",
  streetcar: "bg-amber-500",
  paratransit: "bg-cyan-500",
};

function ReportsPage() {
  const { stats, overTime, bySeverity, byMode, topRoutes } = Route.useLoaderData();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportIncidentsCSV({ data: {} });
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Report exported successfully", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to export report", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Reports & Analytics"
        description="View incident statistics and communication performance"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{stats.dateRange.startDate} - {stats.dateRange.endDate}</span>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Report
            </Button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Incidents"
          value={stats.totalIncidents}
          icon={<Calendar className="h-4 w-4 text-blue-600" />}
          tooltip="Total number of incidents created during the selected date range"
        />
        <StatCard
          title="Messages Sent"
          value={stats.totalMessages}
          icon={<MessageSquare className="h-4 w-4 text-green-600" />}
          variant="success"
          tooltip="Total notifications sent across email, SMS, and push channels"
        />
        <StatCard
          title="New Subscribers"
          value={stats.newSubscribers}
          icon={<Users className="h-4 w-4 text-amber-600" />}
          variant="warning"
          tooltip="Number of new subscribers added during the selected period"
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate > 0 ? `${stats.deliveryRate}%` : "—"}
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          tooltip="Average percentage of messages successfully delivered to recipients"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Incidents Over Time */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold">Incidents Over Time</h2>
          </div>
          <div className="p-4">
            {overTime.length > 0 ? (
              <div className="space-y-2">
                {overTime.slice(-14).map((item) => (
                  <div key={item.date} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, item.count * 10)}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>

        {/* Incidents by Severity */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold">Incidents by Severity</h2>
          </div>
          <div className="p-4">
            {bySeverity.length > 0 ? (
              <div className="space-y-3">
                {bySeverity.map((item) => (
                  <div key={item.severity} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${severityColors[item.severity] || "bg-gray-500"}`} />
                    <span className="w-20 text-sm capitalize">{item.severity}</span>
                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                      <div
                        className={`h-full transition-all ${severityColors[item.severity] || "bg-gray-500"}`}
                        style={{ width: `${Math.min(100, (item.count / Math.max(...bySeverity.map((s) => s.count))) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>

        {/* Affected Transit Modes */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold">Affected Transit Modes</h2>
          </div>
          <div className="p-4">
            {byMode.length > 0 ? (
              <div className="space-y-3">
                {byMode.map((item) => (
                  <div key={item.mode} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${modeColors[item.mode.toLowerCase()] || "bg-gray-500"}`} />
                    <span className="w-24 text-sm capitalize">{item.mode}</span>
                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                      <div
                        className={`h-full transition-all ${modeColors[item.mode.toLowerCase()] || "bg-gray-500"}`}
                        style={{ width: `${Math.min(100, (item.count / Math.max(...byMode.map((m) => m.count))) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>

        {/* Top Affected Routes */}
        <Card>
          <div className="border-b p-4">
            <h2 className="font-semibold">Top Affected Routes</h2>
          </div>
          <div className="p-4">
            {topRoutes.length > 0 ? (
              <div className="space-y-3">
                {topRoutes.slice(0, 8).map((item, index) => (
                  <div key={item.route} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-muted-foreground">#{index + 1}</span>
                    <span className="w-24 text-sm font-medium truncate">{item.route}</span>
                    <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (item.count / Math.max(...topRoutes.map((r) => r.count))) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
      title="No data available"
      description="Data will appear here once there are incidents to analyze."
      className="py-8"
    />
  );
}
