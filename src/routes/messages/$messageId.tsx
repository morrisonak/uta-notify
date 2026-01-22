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
import { Button, Badge, Card, StatCard, EmptyState, Alert } from "../../components/ui";

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
    <div className="p-6">
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
            <Button onClick={handleSendToChannels} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Send to {channels.length} Channel{channels.length !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
        {sendError && (
          <Alert variant="destructive" className="mt-3">{sendError}</Alert>
        )}
      </div>

      {/* Message Content */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-semibold mb-2">Message Content</h2>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </Card>

      {/* Delivery Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Deliveries"
          value={deliveryStats.total}
        />
        <StatCard
          title="Delivered"
          value={deliveryStats.delivered}
          variant="success"
        />
        <StatCard
          title="Failed"
          value={deliveryStats.failed}
          variant="danger"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
        />
      </div>

      {/* Deliveries List */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold">Delivery Details</h3>
        </div>
        {deliveries.length > 0 ? (
          <div className="divide-y">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="p-4">
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
                  <Badge delivery={delivery.status}>{delivery.status}</Badge>
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
          <EmptyState
            icon={<Send className="h-6 w-6 text-muted-foreground" />}
            title="No deliveries yet"
            description="Delivery tracking will appear here once the message is sent."
            className="py-8"
          />
        )}
      </Card>

      {/* Message Metadata */}
      <Card className="mt-6 p-4 text-sm">
        <h3 className="font-semibold mb-4">Message Details</h3>
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
      </Card>
    </div>
  );
}
