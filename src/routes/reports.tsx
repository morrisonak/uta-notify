import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
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

export const Route = createFileRoute("/reports")({
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
  const { stats, overTime, bySeverity, byMode, topRoutes } =
    Route.useLoaderData();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportIncidentsCSV({ data: {} });
      // Download the CSV
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            View incident statistics and communication performance
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {stats.dateRange.startDate} - {stats.dateRange.endDate}
            </span>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalIncidents}</p>
              <p className="text-xs text-muted-foreground">Total Incidents</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalMessages}</p>
              <p className="text-xs text-muted-foreground">Messages Sent</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.newSubscribers}</p>
              <p className="text-xs text-muted-foreground">New Subscribers</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.deliveryRate > 0 ? `${stats.deliveryRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Delivery Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Incidents Over Time */}
        <div className="rounded-xl border bg-card">
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
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, item.count * 10)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Incidents by Severity */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Incidents by Severity</h2>
          </div>
          <div className="p-4">
            {bySeverity.length > 0 ? (
              <div className="space-y-3">
                {bySeverity.map((item) => (
                  <div key={item.severity} className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${severityColors[item.severity] || "bg-gray-500"}`}
                    />
                    <span className="w-20 text-sm capitalize">
                      {item.severity}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${severityColors[item.severity] || "bg-gray-500"}`}
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(...bySeverity.map((s) => s.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Affected Transit Modes */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Affected Transit Modes</h2>
          </div>
          <div className="p-4">
            {byMode.length > 0 ? (
              <div className="space-y-3">
                {byMode.map((item) => (
                  <div key={item.mode} className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${modeColors[item.mode.toLowerCase()] || "bg-gray-500"}`}
                    />
                    <span className="w-24 text-sm capitalize">{item.mode}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${modeColors[item.mode.toLowerCase()] || "bg-gray-500"}`}
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(...byMode.map((m) => m.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Top Affected Routes */}
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Top Affected Routes</h2>
          </div>
          <div className="p-4">
            {topRoutes.length > 0 ? (
              <div className="space-y-3">
                {topRoutes.slice(0, 8).map((item, index) => (
                  <div key={item.route} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="w-24 text-sm font-medium truncate">
                      {item.route}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(...topRoutes.map((r) => r.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No data available yet</p>
      </div>
    </div>
  );
}
