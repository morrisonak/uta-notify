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
  LogOut,
  MessageSquare,
  Settings,
  Users,
  BarChart3,
  Shield,
  Menu,
} from "lucide-react";
import { useSession, signOut, SessionProvider } from "../lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "../components/ui/sidebar";

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

const mainNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/templates", icon: FileText, label: "Templates" },
  { to: "/subscribers", icon: Users, label: "Subscribers" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

const secondaryNavItems = [
  { to: "/audit", icon: Shield, label: "Audit Log" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="h-full">
        <SessionProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
                <MobileMenuButton />
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <span className="font-semibold">UTA Notify</span>
                </div>
              </header>
              <main className="flex-1 overflow-hidden">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </SessionProvider>
        <Scripts />
      </body>
    </html>
  );
}

function MobileMenuButton() {
  const { setOpenMobile } = useSidebar();
  return (
    <button
      onClick={() => setOpenMobile(true)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Open menu</span>
    </button>
  );
}

function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-center border-b px-4">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <Bell className="h-6 w-6 text-primary flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-lg font-bold whitespace-nowrap">UTA Notify</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <Link
                    to={item.to}
                    className="[&.active]:bg-accent [&.active]:text-accent-foreground"
                    activeProps={{ className: "active" }}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarMenu>
            {secondaryNavItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <Link
                    to={item.to}
                    className="[&.active]:bg-accent [&.active]:text-accent-foreground"
                    activeProps={{ className: "active" }}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex items-center justify-center">
          <SidebarTrigger />
        </div>
        <UserCard />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserCard() {
  const { user, isLoading } = useSession();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="p-2">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded mt-1" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-2">
        <Link
          to="/login"
          className={`flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 ${
            isCollapsed ? "p-2" : ""
          }`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Sign In</span>}
        </Link>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-2">
      <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-primary">{initials}</span>
        </div>
        {!isCollapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RootComponent() {
  return <Outlet />;
}
