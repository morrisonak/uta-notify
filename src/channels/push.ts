/**
 * Push Notification Channel Adapter
 * Sends notifications via Firebase Cloud Messaging (FCM)
 */

import {
  BaseChannelAdapter,
  type ChannelConfig,
  type ChannelConstraints,
  type SendResult,
} from "./types";

export interface PushConfig extends ChannelConfig {
  /** Firebase project ID */
  projectId?: string;
  /** Firebase service account private key (JSON string or object) */
  serviceAccountKey?: string | ServiceAccountKey;
  /** Default notification icon URL */
  defaultIcon?: string;
  /** Default click action URL */
  defaultClickAction?: string;
  /** Default sound */
  defaultSound?: string;
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

interface FcmMessage {
  token?: string;
  topic?: string;
  condition?: string;
  notification: {
    title: string;
    body: string;
    image?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: "normal" | "high";
    notification?: {
      icon?: string;
      color?: string;
      sound?: string;
      click_action?: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        alert?: {
          title: string;
          body: string;
        };
        sound?: string;
        badge?: number;
      };
    };
  };
  webpush?: {
    notification?: {
      icon?: string;
      badge?: string;
    };
    fcm_options?: {
      link?: string;
    };
  };
}

interface FcmResponse {
  name?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export class PushAdapter extends BaseChannelAdapter {
  readonly type = "push";

  readonly constraints: ChannelConstraints = {
    maxLength: 4096, // FCM data payload limit
    supportsMedia: true,
    supportsHtml: false,
    rateLimit: 500, // FCM allows 500 messages/second
    requiredFields: ["projectId", "serviceAccountKey"],
  };

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async send(
    content: string,
    recipients: string[], // FCM tokens or topic names
    config: PushConfig
  ): Promise<SendResult> {
    // Validate config
    if (!config.projectId || !config.serviceAccountKey) {
      return { success: false, error: "Firebase configuration is required" };
    }

    if (recipients.length === 0) {
      return { success: false, error: "At least one recipient is required" };
    }

    try {
      // Get access token
      const token = await this.getAccessToken(config);

      // Parse content for title and body
      const { title, body } = this.parseContent(content);

      // Send to all recipients
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          this.sendToRecipient(recipient, title, body, config, token)
        )
      );

      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      );
      const failed = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)
      );

      if (failed.length === 0) {
        return {
          success: true,
          recipientCount: recipients.length,
          response: results,
        };
      }

      if (successful.length === 0) {
        const firstError = failed[0];
        const errorMessage =
          firstError.status === "rejected"
            ? firstError.reason?.message
            : (firstError as PromiseFulfilledResult<SendResult>).value.error;
        return {
          success: false,
          error: `All messages failed: ${errorMessage}`,
          recipientCount: 0,
        };
      }

      // Partial success
      return {
        success: true,
        recipientCount: successful.length,
        error: `${failed.length} of ${recipients.length} messages failed`,
        response: results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendToRecipient(
    recipient: string,
    title: string,
    body: string,
    config: PushConfig,
    accessToken: string
  ): Promise<SendResult> {
    const url = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;

    // Determine if recipient is a token or topic
    const isTopic = recipient.startsWith("/topics/") || !recipient.includes(":");

    const message: FcmMessage = {
      notification: {
        title,
        body,
      },
      data: {
        type: "transit_alert",
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: "high",
        notification: {
          icon: config.defaultIcon,
          color: "#1e40af",
          sound: config.defaultSound || "default",
          click_action: config.defaultClickAction,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: config.defaultSound || "default",
          },
        },
      },
      webpush: {
        notification: {
          icon: config.defaultIcon,
        },
        fcm_options: {
          link: config.defaultClickAction,
        },
      },
    };

    if (isTopic) {
      message.topic = recipient.replace("/topics/", "");
    } else {
      message.token = recipient;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = (await response.json()) as FcmResponse;

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || `FCM API error: ${response.status}`,
      };
    }

    return {
      success: true,
      providerId: data.name,
      response: data,
    };
  }

  /**
   * Get OAuth2 access token for FCM API
   */
  private async getAccessToken(config: PushConfig): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const serviceAccount =
      typeof config.serviceAccountKey === "string"
        ? (JSON.parse(config.serviceAccountKey) as ServiceAccountKey)
        : config.serviceAccountKey;

    if (!serviceAccount) {
      throw new Error("Service account key is required");
    }

    // Create JWT for service account
    const jwt = await this.createServiceAccountJwt(serviceAccount);

    // Exchange JWT for access token
    const response = await fetch(serviceAccount.token_uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  /**
   * Create JWT for Google service account authentication
   */
  private async createServiceAccountJwt(
    serviceAccount: ServiceAccountKey
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600, // 1 hour
    };

    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Sign with private key
    const signature = await this.signWithPrivateKey(
      unsignedToken,
      serviceAccount.private_key
    );

    return `${unsignedToken}.${signature}`;
  }

  /**
   * Sign data with RSA private key using Web Crypto API
   */
  private async signWithPrivateKey(
    data: string,
    privateKeyPem: string
  ): Promise<string> {
    // Convert PEM to binary
    const pemContents = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");

    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    // Sign
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      encoder.encode(data)
    );

    return this.base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );
  }

  /**
   * Base64 URL encode (RFC 4648)
   */
  private base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * Parse content into title and body
   */
  private parseContent(content: string): { title: string; body: string } {
    const lines = content.split("\n").filter((l) => l.trim());

    if (lines.length === 0) {
      return { title: "UTA Transit Alert", body: content };
    }

    // First line is title (max 65 chars for iOS)
    let title = lines[0].trim();
    if (title.length > 65) {
      title = title.substring(0, 62) + "...";
    }

    // Rest is body (max 240 chars for good display)
    const bodyLines = lines.slice(1);
    let body = bodyLines.join("\n").trim() || title;
    if (body.length > 240) {
      body = body.substring(0, 237) + "...";
    }

    return { title, body };
  }

  formatContent(content: string): string {
    // Push notifications should be concise
    let formatted = content.trim();

    // Keep it short for notification previews
    if (formatted.length > 300) {
      formatted = formatted.substring(0, 297) + "...";
    }

    return formatted;
  }

  /**
   * Subscribe a token to a topic
   */
  async subscribeToTopic(
    tokens: string[],
    topic: string,
    config: PushConfig
  ): Promise<SendResult> {
    const accessToken = await this.getAccessToken(config);
    const url = `https://iid.googleapis.com/iid/v1:batchAdd`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: `/topics/${topic}`,
        registration_tokens: tokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to subscribe: ${error}` };
    }

    return { success: true, recipientCount: tokens.length };
  }

  /**
   * Unsubscribe a token from a topic
   */
  async unsubscribeFromTopic(
    tokens: string[],
    topic: string,
    config: PushConfig
  ): Promise<SendResult> {
    const accessToken = await this.getAccessToken(config);
    const url = `https://iid.googleapis.com/iid/v1:batchRemove`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: `/topics/${topic}`,
        registration_tokens: tokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to unsubscribe: ${error}` };
    }

    return { success: true, recipientCount: tokens.length };
  }

  async healthCheck(config: PushConfig): Promise<{ healthy: boolean; message?: string }> {
    if (!config.projectId || !config.serviceAccountKey) {
      return { healthy: false, message: "Firebase configuration not set" };
    }

    try {
      // Try to get an access token
      await this.getAccessToken(config);
      return { healthy: true, message: "Firebase connected" };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }
}

// Export singleton instance
export const pushAdapter = new PushAdapter();
