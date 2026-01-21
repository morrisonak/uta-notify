/**
 * SMS Channel Adapter
 * Sends notifications via SMS using Twilio
 */

import {
  BaseChannelAdapter,
  type ChannelConfig,
  type ChannelConstraints,
  type SendResult,
} from "./types";

export interface SmsConfig extends ChannelConfig {
  /** Twilio Account SID */
  accountSid?: string;
  /** Twilio Auth Token */
  authToken?: string;
  /** From phone number (E.164 format) */
  fromNumber?: string;
  /** Messaging Service SID (alternative to fromNumber) */
  messagingServiceSid?: string;
  /** Status callback URL for delivery receipts */
  statusCallback?: string;
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  error_code?: number;
  error_message?: string;
}

export class SmsAdapter extends BaseChannelAdapter {
  readonly type = "sms";

  readonly constraints: ChannelConstraints = {
    maxLength: 1600, // Twilio supports up to 1600 chars (concatenated)
    supportsMedia: false,
    supportsHtml: false,
    rateLimit: 100, // 100 messages per second for Twilio
    requiredFields: ["accountSid", "authToken"],
  };

  /**
   * Get the number of SMS segments for a message
   */
  getSegmentCount(content: string): number {
    // GSM-7 encoding: 160 chars per segment, 153 for concatenated
    // Unicode: 70 chars per segment, 67 for concatenated
    const hasUnicode = /[^\x00-\x7F]/.test(content);

    if (hasUnicode) {
      return content.length <= 70 ? 1 : Math.ceil(content.length / 67);
    } else {
      return content.length <= 160 ? 1 : Math.ceil(content.length / 153);
    }
  }

  async send(
    content: string,
    recipients: string[],
    config: SmsConfig
  ): Promise<SendResult> {
    // Validate config
    if (!config.accountSid || !config.authToken) {
      return { success: false, error: "Twilio credentials are required" };
    }

    if (!config.fromNumber && !config.messagingServiceSid) {
      return { success: false, error: "From number or Messaging Service SID is required" };
    }

    if (recipients.length === 0) {
      return { success: false, error: "At least one recipient is required" };
    }

    // Validate content length
    const validation = this.validateContent(content);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    try {
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          this.sendSingleMessage(content, recipient, config)
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

  private async sendSingleMessage(
    content: string,
    recipient: string,
    config: SmsConfig
  ): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: this.normalizePhoneNumber(recipient),
      Body: content,
    });

    if (config.messagingServiceSid) {
      body.append("MessagingServiceSid", config.messagingServiceSid);
    } else if (config.fromNumber) {
      body.append("From", config.fromNumber);
    }

    if (config.statusCallback) {
      body.append("StatusCallback", config.statusCallback);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = (await response.json()) as TwilioMessageResponse;

    if (!response.ok) {
      return {
        success: false,
        error: data.error_message || `Twilio API error: ${response.status}`,
      };
    }

    return {
      success: true,
      providerId: data.sid,
      response: data,
    };
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, "");

    // If it doesn't start with +, assume US number
    if (!normalized.startsWith("+")) {
      // Remove leading 1 if present and add +1
      if (normalized.startsWith("1") && normalized.length === 11) {
        normalized = "+" + normalized;
      } else if (normalized.length === 10) {
        normalized = "+1" + normalized;
      }
    }

    return normalized;
  }

  formatContent(content: string): string {
    // For SMS, we want to be concise
    let formatted = content.trim();

    // Add UTA branding if not present and there's room
    if (!formatted.toLowerCase().includes("uta") && formatted.length < 140) {
      formatted = `UTA Alert: ${formatted}`;
    }

    // Truncate if too long
    if (formatted.length > this.constraints.maxLength) {
      formatted = formatted.substring(0, this.constraints.maxLength - 3) + "...";
    }

    return formatted;
  }

  async healthCheck(config: SmsConfig): Promise<{ healthy: boolean; message?: string }> {
    if (!config.accountSid || !config.authToken) {
      return { healthy: false, message: "Twilio credentials not configured" };
    }

    try {
      // Check account status
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`,
        },
      });

      if (!response.ok) {
        return { healthy: false, message: "Invalid Twilio credentials" };
      }

      const data = (await response.json()) as { status: string };

      if (data.status !== "active") {
        return { healthy: false, message: `Account status: ${data.status}` };
      }

      return { healthy: true, message: "Twilio API connected" };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }
}

// Export singleton instance
export const smsAdapter = new SmsAdapter();
