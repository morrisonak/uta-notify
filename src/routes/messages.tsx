import { createFileRoute, Outlet, Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Search,
} from "lucide-react";
import { getMessages, getMessageStats } from "../server/messages";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";

export const Route = createFileRoute("/messages")({
  beforeLoad: async () => {
    await requireAuthFn();
  },
  loader: async () => {
    const [messagesData, statsData] = await Promise.all([
      getMessages({ data: { limit: 50 } }),
      getMessageStats(),
    ]);
    return {
      messages: messagesData.messages,
      stats: statsData,
    };
  },
  component: MessagesLayout,
});

interface Message {
  id: string;
  incident_id: string;
  content: string;
  created_at: string;
  created_by: string;
}

function MessagesLayout() {
  const { messages, stats } = Route.useLoaderData() as {
    messages: Message[];
    stats: { sentToday: number; pending: number; delivered: number; failed: number };
  };
  const matches = useMatches();
  const { user } = useSession();
  const canCreate = hasPermission(user, "messages.create");
  const [searchQuery, setSearchQuery] = useState("");

  const isChildRoute = matches.some(
    (match) => match.routeId === "/messages/$messageId" || match.routeId === "/messages/new"
  );

  const filteredMessages = messages.filter((message) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        message.content.toLowerCase().includes(query) ||
        message.incident_id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Panel - Messages List */}
      <div className={`${isChildRoute ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 border-r bg-background`}>
        {/* Header */}
        <div className="flex-none p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Messages</h1>
              <p className="text-sm text-muted-foreground">
                {messages.length} messages
              </p>
            </div>
            {canCreate && (
              <Link
                to="/messages/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New
              </Link>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg bg-blue-50 p-2 text-center">
              <p className="text-lg font-bold text-blue-600">{stats.sentToday}</p>
              <p className="text-[10px] text-blue-600">Today</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-center">
              <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
              <p className="text-[10px] text-amber-600">Pending</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2 text-center">
              <p className="text-lg font-bold text-green-600">{stats.delivered}</p>
              <p className="text-[10px] text-green-600">Delivered</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2 text-center">
              <p className="text-lg font-bold text-red-600">{stats.failed}</p>
              <p className="text-[10px] text-red-600">Failed</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length > 0 ? (
            <div className="divide-y">
              {filteredMessages.map((message) => (
                <MessageListItem key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <div className="mb-3 rounded-full bg-muted p-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-1 font-medium">No messages found</p>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery
                  ? "Try a different search"
                  : canCreate
                    ? "Send your first message"
                    : "No messages to display"}
              </p>
              {canCreate && (
                <Link
                  to="/messages/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Compose Message
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
                to="/messages"
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
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Select a message</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreate
                ? "Choose a message from the list to view details, or compose a new one."
                : "Choose a message from the list to view details."}
            </p>
            {canCreate && (
              <Link
                to="/messages/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Compose Message
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageListItemProps {
  message: Message;
}

function MessageListItem({ message }: MessageListItemProps) {
  return (
    <Link
      to="/messages/$messageId"
      params={{ messageId: message.id }}
      className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
      activeProps={{ className: "bg-accent" }}
    >
      <div className="rounded-full bg-primary/10 p-2">
        <Send className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {message.content.length > 50
            ? `${message.content.substring(0, 50)}...`
            : message.content}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{message.incident_id}</span>
          <span>&bull;</span>
          <span>{formatRelativeTime(message.created_at)}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
    </Link>
  );
}
