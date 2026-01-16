import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Zap,
} from "lucide-react";
import { getMessage, getMessageDeliveries } from "../../server/messages";
import { queueMessageDelivery, getEnabledChannels } from "../../server/delivery";
import { formatRelativeTime } from "../../lib/utils";
import { useSession } from "../../lib/auth-client";
import { hasPermission } from "../../lib/permissions";

export const Route = createFileRoute("/messages/$messageId")({
  loader: async ({ params }) => {
    const [messageData, deliveriesData, channelsData] = await Promise.all([
      getMessage({ data: { id: params.messageId } }),
      getMessageDeliveries({ data: { id: params.messageId } }),
      getEnabledChannels().catch(() => ({ channels: [] })),
    ]);
    return {
      message: messageData.message,
      deliveries: deliveriesData.deliveries,
      channels: channelsData.channels,
    };
  },
  component: MessageDetailPage,
});

interface Message {
  id: string;
  incident_id: string;
  incident_version: number;
  content: string;
  channel_overrides: string | null;
  media_attachments: string | null;
  created_by: string;
  created_at: string;
}

interface Delivery {
  id: string;
  message_id: string;
  channel_id: string;
  channel_name: string;
  channel_type: string;
  status: "queued" | "sending" | "delivered" | "failed" | "partial";
  provider_message_id: string | null;
  failure_reason: string | null;
  retry_count: number;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
}

interface Channel {
  id: string;
  type: string;
  name: string;
  enabled: number;
}

function MessageDetailPage() {
  const router = useRouter();
  const { message, deliveries, channels } = Route.useLoaderData() as {
    message: Message;
    deliveries: Delivery[];
    channels: Channel[];
  };
  const { user } = useSession();
  const canSend = hasPermission(user, "messages.send");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendToChannels = async () => {
    if (!canSend) return;

    setIsSending(true);
    setSendError(null);

    try {
      await queueMessageDelivery({ data: { messageId: message.id } });
      // Refresh the page to show new deliveries
      await router.invalidate();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to queue message");
    } finally {
      setIsSending(false);
    }
  };

  const statusIcons: Record<string, React.ReactNode> = {
    queued: <Clock className="h-4 w-4 text-amber-500" />,
    sending: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
    delivered: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    partial: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  };

  const statusColors: Record<string, string> = {
    queued: "bg-amber-100 text-amber-800",
    sending: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    partial: "bg-amber-100 text-amber-800",
  };

  // Calculate delivery stats
  const deliveryStats = {
    total: deliveries.length,
    delivered: deliveries.filter((d) => d.status === "delivered").length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    pending: deliveries.filter((d) => ["queued", "sending"].includes(d.status)).length,
  };

  const successRate = deliveryStats.total > 0
    ? Math.round((deliveryStats.delivered / deliveryStats.total) * 100)
    : 0;

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Send className="h-4 w-4" />
              <span>Message</span>
              <span>&bull;</span>
              <span>{formatRelativeTime(message.created_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/incidents/$incidentId"
                params={{ incidentId: message.incident_id }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Incident
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {canSend && channels.length > 0 && (
            <button
              onClick={handleSendToChannels}
              disabled={isSending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Send to {channels.length} Channel{channels.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
        {sendError && (
          <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {sendError}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="bg-background rounded-lg border p-4 mb-6">
        <h2 className="text-sm font-semibold mb-2">Message Content</h2>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>

      {/* Delivery Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-background rounded-lg border p-3">
          <p className="text-2xl font-bold">{deliveryStats.total}</p>
          <p className="text-xs text-muted-foreground">Total Deliveries</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-3">
          <p className="text-2xl font-bold text-green-600">{deliveryStats.delivered}</p>
          <p className="text-xs text-green-600">Delivered</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-3">
          <p className="text-2xl font-bold text-red-600">{deliveryStats.failed}</p>
          <p className="text-xs text-red-600">Failed</p>
        </div>
        <div className="bg-background rounded-lg border p-3">
          <p className="text-2xl font-bold">{successRate}%</p>
          <p className="text-xs text-muted-foreground">Success Rate</p>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="bg-background rounded-lg border">
        <div className="p-3 border-b">
          <h3 className="font-semibold">Delivery Details</h3>
        </div>
        {deliveries.length > 0 ? (
          <div className="divide-y">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcons[delivery.status]}
                    <span className="font-medium text-sm capitalize">
                      {delivery.channel_type}
                    </span>
                    {delivery.channel_name && (
                      <span className="text-sm text-muted-foreground">
                        ({delivery.channel_name})
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[delivery.status]}`}>
                    {delivery.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Queued: {new Date(delivery.queued_at).toLocaleString()}</p>
                  {delivery.sent_at && (
                    <p>Sent: {new Date(delivery.sent_at).toLocaleString()}</p>
                  )}
                  {delivery.delivered_at && (
                    <p>Delivered: {new Date(delivery.delivered_at).toLocaleString()}</p>
                  )}
                  {delivery.failed_at && (
                    <p className="text-red-600">
                      Failed: {new Date(delivery.failed_at).toLocaleString()}
                    </p>
                  )}
                  {delivery.failure_reason && (
                    <p className="text-red-600">Reason: {delivery.failure_reason}</p>
                  )}
                  {delivery.retry_count > 0 && (
                    <p>Retries: {delivery.retry_count}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mb-3 rounded-full bg-muted p-3 mx-auto w-fit">
              <Send className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">No deliveries yet</p>
            <p className="text-sm text-muted-foreground">
              Delivery tracking will appear here once the message is sent.
            </p>
          </div>
        )}
      </div>

      {/* Message Metadata */}
      <div className="mt-6 bg-background rounded-lg border p-4 text-sm">
        <h3 className="font-semibold mb-3">Message Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground">Message ID:</span>
            <span className="ml-2 font-mono text-xs">{message.id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Incident:</span>
            <span className="ml-2 font-mono text-xs">{message.incident_id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Version:</span>
            <span className="ml-2">{message.incident_version}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>
            <span className="ml-2">{new Date(message.created_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
