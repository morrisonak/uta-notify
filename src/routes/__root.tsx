import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  BarChart3,
} from "lucide-react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "UTA Notify - Incident Communications" },
      {
        name: "description",
        content:
          "Incident Communications Management Platform for Utah Transit Authority",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "UTA Notify - Incident Communications" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="h-full">
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
            <div className="flex h-16 items-center gap-2 border-b px-6">
              <Bell className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">UTA Notify</span>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              <NavLink to="/" icon={<LayoutDashboard className="h-4 w-4" />}>
                Dashboard
              </NavLink>
              <NavLink to="/incidents" icon={<AlertTriangle className="h-4 w-4" />}>
                Incidents
              </NavLink>
              <NavLink to="/messages" icon={<MessageSquare className="h-4 w-4" />}>
                Messages
              </NavLink>
              <NavLink to="/templates" icon={<FileText className="h-4 w-4" />}>
                Templates
              </NavLink>
              <NavLink to="/subscribers" icon={<Users className="h-4 w-4" />}>
                Subscribers
              </NavLink>
              <NavLink to="/reports" icon={<BarChart3 className="h-4 w-4" />}>
                Reports
              </NavLink>
              <div className="pt-4">
                <NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>
                  Settings
                </NavLink>
              </div>
            </nav>
            <div className="border-t p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">AD</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Admin User</p>
                  <p className="text-xs text-muted-foreground truncate">
                    admin@uta.org
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
      activeProps={{ className: "active" }}
    >
      {icon}
      {children}
    </Link>
  );
}

function RootComponent() {
  return <Outlet />;
}
