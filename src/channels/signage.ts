/**
 * Digital Signage Channel Adapter
 * Sends notifications to transit station digital signs
 * Supports multiple signage vendors: Penta WavWriter, Papercast, Daktronics
 */

import {
  BaseChannelAdapter,
  type ChannelConfig,
  type ChannelConstraints,
  type SendResult,
} from "./types";

export interface SignageConfig extends ChannelConfig {
  /** Signage vendor: 'penta', 'papercast', 'daktronics', 'generic' */
  vendor?: "penta" | "papercast" | "daktronics" | "generic";
  /** API endpoint URL */
  endpoint?: string;
  /** API key or authentication token */
  apiKey?: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
  /** Default message priority */
  defaultPriority?: "low" | "normal" | "high" | "emergency";
  /** Default display duration in seconds */
  defaultDuration?: number;
  /** Target sign IDs or groups */
  targetSigns?: string[];
}

export interface SignageMessage {
  id: string;
  content: string;
  priority: "low" | "normal" | "high" | "emergency";
  duration: number;
  locations: string[];
  startTime?: string;
  endTime?: string;
  formatting?: {
    fontSize?: "small" | "medium" | "large";
    scrollSpeed?: "slow" | "normal" | "fast";
    alignment?: "left" | "center" | "right";
  };
}

export class SignageAdapter extends BaseChannelAdapter {
  readonly type = "signage";

  readonly constraints: ChannelConstraints = {
    maxLength: 500, // Most signs have limited display
    supportsMedia: false,
    supportsHtml: false,
    rateLimit: 60, // 1 update per second
    requiredFields: ["endpoint"],
  };

  async send(
    content: string,
    recipients: string[], // Sign IDs or group names
    config: SignageConfig
  ): Promise<SendResult> {
    // Validate config
    if (!config.endpoint) {
      return { success: false, error: "Signage API endpoint is required" };
    }

    const vendor = config.vendor || "generic";
    const targetSigns = recipients.length > 0 ? recipients : config.targetSigns || [];

    if (targetSigns.length === 0) {
      return { success: false, error: "No target signs specified" };
    }

    // Validate content
    const validation = this.validateContent(content);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    try {
      switch (vendor) {
        case "penta":
          return await this.sendToPenta(content, targetSigns, config);
        case "papercast":
          return await this.sendToPapercast(content, targetSigns, config);
        case "daktronics":
          return await this.sendToDaktronics(content, targetSigns, config);
        default:
          return await this.sendToGeneric(content, targetSigns, config);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send to Penta WavWriter signage system
   */
  private async sendToPenta(
    content: string,
    targetSigns: string[],
    config: SignageConfig
  ): Promise<SendResult> {
    // Penta WavWriter uses XML-based messaging
    const messageXml = this.buildPentaMessage(content, targetSigns, config);

    const response = await fetch(`${config.endpoint}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      },
      body: messageXml,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Penta API error: ${error}` };
    }

    const result = await response.text();
    // Parse message ID from response
    const messageIdMatch = result.match(/<MessageId>([^<]+)<\/MessageId>/);

    return {
      success: true,
      providerId: messageIdMatch?.[1],
      response: result,
      recipientCount: targetSigns.length,
    };
  }

  /**
   * Build Penta WavWriter XML message
   */
  private buildPentaMessage(
    content: string,
    targetSigns: string[],
    config: SignageConfig
  ): string {
    const priority = this.mapPriorityToNumber(config.defaultPriority || "normal");
    const duration = config.defaultDuration || 30;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Message>
  <Content>${this.escapeXml(content)}</Content>
  <Priority>${priority}</Priority>
  <Duration>${duration}</Duration>
  <Destinations>
    ${targetSigns.map((sign) => `<Sign>${this.escapeXml(sign)}</Sign>`).join("\n    ")}
  </Destinations>
  <StartTime>${new Date().toISOString()}</StartTime>
</Message>`;
  }

  /**
   * Send to Papercast e-paper displays
   */
  private async sendToPapercast(
    content: string,
    targetSigns: string[],
    config: SignageConfig
  ): Promise<SendResult> {
    const response = await fetch(`${config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey || "",
      },
      body: JSON.stringify({
        text: content,
        priority: config.defaultPriority || "normal",
        duration: config.defaultDuration || 60,
        screens: targetSigns,
        display_options: {
          font_size: "medium",
          scroll: false,
          align: "center",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Papercast API error: ${error}` };
    }

    const data = (await response.json()) as { message_id: string };
    return {
      success: true,
      providerId: data.message_id,
      response: data,
      recipientCount: targetSigns.length,
    };
  }

  /**
   * Send to Daktronics displays
   */
  private async sendToDaktronics(
    content: string,
    targetSigns: string[],
    config: SignageConfig
  ): Promise<SendResult> {
    const response = await fetch(`${config.endpoint}/api/v2/presentations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        content: {
          type: "text",
          value: content,
        },
        priority: this.mapPriorityToNumber(config.defaultPriority || "normal"),
        duration_seconds: config.defaultDuration || 30,
        target_displays: targetSigns,
        immediate: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Daktronics API error: ${error}` };
    }

    const data = (await response.json()) as { presentation_id: string };
    return {
      success: true,
      providerId: data.presentation_id,
      response: data,
      recipientCount: targetSigns.length,
    };
  }

  /**
   * Send to generic HTTP signage API
   */
  private async sendToGeneric(
    content: string,
    targetSigns: string[],
    config: SignageConfig
  ): Promise<SendResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(config.endpoint!, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: content,
        priority: config.defaultPriority || "normal",
        duration: config.defaultDuration || 30,
        signs: targetSigns,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Signage API error: ${error}` };
    }

    const data = (await response.json()) as { id?: string };
    return {
      success: true,
      providerId: data.id || `sign_${Date.now()}`,
      response: data,
      recipientCount: targetSigns.length,
    };
  }

  /**
   * Map priority string to numeric value
   */
  private mapPriorityToNumber(priority: string): number {
    const priorities: Record<string, number> = {
      low: 1,
      normal: 2,
      high: 3,
      emergency: 4,
    };
    return priorities[priority] || 2;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  formatContent(content: string): string {
    let formatted = content.trim();

    // Remove excessive whitespace
    formatted = formatted.replace(/\s+/g, " ");

    // Signage typically uses ALL CAPS for visibility
    // formatted = formatted.toUpperCase();

    // Truncate for sign display
    if (formatted.length > this.constraints.maxLength) {
      formatted = formatted.substring(0, this.constraints.maxLength - 3) + "...";
    }

    return formatted;
  }

  async healthCheck(config: SignageConfig): Promise<{ healthy: boolean; message?: string }> {
    if (!config.endpoint) {
      return { healthy: false, message: "Signage endpoint not configured" };
    }

    try {
      // Try a simple status check
      const response = await fetch(`${config.endpoint}/health`, {
        headers: config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : {},
      });

      if (response.ok) {
        return { healthy: true, message: "Signage system connected" };
      }

      // Try root endpoint
      const rootResponse = await fetch(config.endpoint);
      return {
        healthy: rootResponse.ok,
        message: rootResponse.ok
          ? "Signage system reachable"
          : "Signage system unreachable",
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }
}

// Export singleton instance
export const signageAdapter = new SignageAdapter();
