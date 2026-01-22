import { createFileRoute, Outlet, Link, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  ChevronRight,
  ArrowLeft,
  Search,
} from "lucide-react";
import { getMessages, getMessageStats } from "../server/messages";
import { formatRelativeTime } from "../lib/utils";
import { requireAuthFn } from "../server/auth";
import { useSession } from "../lib/auth-client";
import { hasPermission } from "../lib/permissions";
import { Button, Input, EmptyState, StatCard } from "../components/ui";

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
        <div className="flex-none p-6 border-b">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Messages</h1>
              <p className="text-sm text-muted-foreground">
                {messages.length} messages
              </p>
            </div>
            {canCreate && (
              <Button asChild>
                <Link to="/messages/new">
                  <Plus className="h-4 w-4" />
                  New
                </Link>
              </Button>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl bg-blue-50 p-2 text-center">
              <p className="text-lg font-bold text-blue-600">{stats.sentToday}</p>
              <p className="text-[10px] text-blue-600">Today</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-center">
              <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
              <p className="text-[10px] text-amber-600">Pending</p>
            </div>
            <div className="rounded-xl bg-green-50 p-2 text-center">
              <p className="text-lg font-bold text-green-600">{stats.delivered}</p>
              <p className="text-[10px] text-green-600">Delivered</p>
            </div>
            <div className="rounded-xl bg-red-50 p-2 text-center">
              <p className="text-lg font-bold text-red-600">{stats.failed}</p>
              <p className="text-[10px] text-red-600">Failed</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
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
            <EmptyState
              icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
              title="No messages found"
              description={
                searchQuery
                  ? "Try a different search"
                  : canCreate
                    ? "Send your first message"
                    : "No messages to display"
              }
              action={
                canCreate ? (
                  <Button asChild>
                    <Link to="/messages/new">
                      <Plus className="h-4 w-4" />
                      Compose Message
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
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
            title="Select a message"
            description={
              canCreate
                ? "Choose a message from the list to view details, or compose a new one."
                : "Choose a message from the list to view details."
            }
            action={
              canCreate ? (
                <Button asChild>
                  <Link to="/messages/new">
                    <Plus className="h-4 w-4" />
                    Compose Message
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
