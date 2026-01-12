import { BaseChannelAdapter, type ChannelConfig, type FormattedMessage } from "../adapter";
import {
  type ChannelType,
  type DeliveryResult,
  type ChannelConstraints,
} from "../../domain/messages/message.schema";
import type { Incident } from "../../domain/incidents/incident.schema";

// ============================================
// TWITTER ADAPTER
// ============================================

/**
 * Twitter/X API adapter for posting tweets
 * Uses Twitter API v2
 */
export class TwitterAdapter extends BaseChannelAdapter {
  readonly type: ChannelType = "twitter";
  readonly name = "Twitter/X";
  readonly constraints: ChannelConstraints = {
    maxLength: 280,
    supportsMedia: true,
    supportedMediaTypes: ["image/jpeg", "image/png", "image/gif", "video/mp4"],
    maxMediaSize: 5 * 1024 * 1024, // 5MB for images
    rateLimit: { requests: 300, windowSeconds: 900 }, // 300 per 15 min
  };

  /**
   * Format message for Twitter
   * Adds hashtags and handles @mentions appropriately
   */
  override formatMessage(content: string, incident: Incident): string {
    let formatted = content;

    // Add relevant hashtags based on incident data
    const hashtags: string[] = [];

    if (incident.affectedModes?.includes("mode_rail")) {
      hashtags.push("#TRAX", "#FrontRunner");
    }
    if (incident.affectedModes?.includes("mode_bus")) {
      hashtags.push("#UTABus");
    }
    if (incident.severity === "critical" || incident.severity === "high") {
      hashtags.push("#UTAAlert");
    }

    // Calculate available space for hashtags
    const hashtagString = hashtags.length > 0 ? " " + hashtags.join(" ") : "";
    const maxContentLength = this.constraints.maxLength! - hashtagString.length;

    // Truncate content if needed
    if (formatted.length > maxContentLength) {
      formatted = formatted.substring(0, maxContentLength - 3) + "...";
    }

    // Append hashtags
    if (hashtagString) {
      formatted += hashtagString;
    }

    return formatted;
  }

  /**
   * Send tweet via Twitter API v2
   */
  async send(message: FormattedMessage, config: ChannelConfig): Promise<DeliveryResult> {
    // In test mode, use the test adapter behavior
    if (config.testMode) {
      console.log("[TWITTER TEST] Would post tweet:", message.content);
      return this.successResult(`test_tweet_${Date.now()}`);
    }

    const credentials = config.credentials as unknown as TwitterCredentials;

    try {
      // Build the request
      const body: TwitterPostBody = {
        text: message.content,
      };

      // Add media if present
      if (message.mediaUrls && message.mediaUrls.length > 0) {
        // Note: In a real implementation, you'd first upload media
        // and get media IDs, then attach them here
        // body.media = { media_ids: [...] };
      }

      // Make the API call
      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        const errorMessage = (error as { detail?: string }).detail || response.statusText;

        // Check if retryable based on status code
        const retryable = response.status >= 500 || response.status === 429;

        return this.failureResult(`Twitter API error: ${errorMessage}`, retryable);
      }

      const data = (await response.json()) as TwitterPostResponse;

      return this.successResult(data.data.id, {
        tweetUrl: `https://twitter.com/user/status/${data.data.id}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.failureResult(`Twitter API error: ${message}`, true);
    }
  }

  /**
   * Test Twitter API connection
   */
  async testConnection(config: ChannelConfig): Promise<{ ok: boolean; error?: string }> {
    if (config.testMode) {
      return { ok: true };
    }

    const credentials = config.credentials as unknown as TwitterCredentials;

    try {
      // Verify credentials by getting the authenticated user
      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        return { ok: false, error: `Twitter API returned ${response.status}` };
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { ok: false, error: message };
    }
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

interface TwitterPostBody {
  text: string;
  media?: {
    media_ids: string[];
  };
  reply?: {
    in_reply_to_tweet_id: string;
  };
}

interface TwitterPostResponse {
  data: {
    id: string;
    text: string;
  };
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a new Twitter adapter instance
 */
export function createTwitterAdapter(): TwitterAdapter {
  return new TwitterAdapter();
}
