/**
 * Email Channel Adapter
 * Sends notifications via email using various providers
 */

import {
  BaseChannelAdapter,
  type ChannelConfig,
  type ChannelConstraints,
  type SendResult,
} from "./types";

export interface EmailConfig extends ChannelConfig {
  /** Email provider: 'resend', 'sendgrid', 'mailgun', 'smtp' */
  provider?: "resend" | "sendgrid" | "mailgun" | "smtp";
  /** API key for the email provider */
  apiKey?: string;
  /** From email address */
  fromEmail?: string;
  /** From name */
  fromName?: string;
  /** Reply-to email address */
  replyTo?: string;
  /** SMTP configuration (if provider is 'smtp') */
  smtp?: {
    host: string;
    port: number;
    username: string;
    password: string;
    secure?: boolean;
  };
}

export class EmailAdapter extends BaseChannelAdapter {
  readonly type = "email";

  readonly constraints: ChannelConstraints = {
    maxLength: 100000, // 100KB text limit
    supportsMedia: true,
    supportsHtml: true,
    rateLimit: 100, // 100 emails per minute
    requiredFields: ["fromEmail"],
  };

  async send(
    content: string,
    recipients: string[],
    config: EmailConfig
  ): Promise<SendResult> {
    const provider = config.provider || "resend";

    // Validate config
    if (!config.apiKey && provider !== "smtp") {
      return { success: false, error: "API key is required" };
    }

    if (!config.fromEmail) {
      return { success: false, error: "From email address is required" };
    }

    if (recipients.length === 0) {
      return { success: false, error: "At least one recipient is required" };
    }

    try {
      switch (provider) {
        case "resend":
          return await this.sendViaResend(content, recipients, config);
        case "sendgrid":
          return await this.sendViaSendGrid(content, recipients, config);
        case "mailgun":
          return await this.sendViaMailgun(content, recipients, config);
        default:
          return { success: false, error: `Unknown provider: ${provider}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendViaResend(
    content: string,
    recipients: string[],
    config: EmailConfig
  ): Promise<SendResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromName
          ? `${config.fromName} <${config.fromEmail}>`
          : config.fromEmail,
        to: recipients,
        subject: this.extractSubject(content),
        html: this.formatAsHtml(content),
        text: content,
        reply_to: config.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Resend API error: ${error}` };
    }

    const data = (await response.json()) as { id: string };
    return {
      success: true,
      providerId: data.id,
      response: data,
      recipientCount: recipients.length,
    };
  }

  private async sendViaSendGrid(
    content: string,
    recipients: string[],
    config: EmailConfig
  ): Promise<SendResult> {
    const personalizations = recipients.map((email) => ({
      to: [{ email }],
    }));

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations,
        from: {
          email: config.fromEmail,
          name: config.fromName,
        },
        reply_to: config.replyTo ? { email: config.replyTo } : undefined,
        subject: this.extractSubject(content),
        content: [
          { type: "text/plain", value: content },
          { type: "text/html", value: this.formatAsHtml(content) },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `SendGrid API error: ${error}` };
    }

    // SendGrid returns 202 Accepted with no body
    const messageId = response.headers.get("X-Message-Id");
    return {
      success: true,
      providerId: messageId || undefined,
      recipientCount: recipients.length,
    };
  }

  private async sendViaMailgun(
    content: string,
    recipients: string[],
    config: EmailConfig
  ): Promise<SendResult> {
    // Mailgun requires domain in the API endpoint
    const domain = config.fromEmail?.split("@")[1] || "example.com";

    const formData = new FormData();
    formData.append(
      "from",
      config.fromName
        ? `${config.fromName} <${config.fromEmail}>`
        : config.fromEmail || ""
    );
    formData.append("to", recipients.join(","));
    formData.append("subject", this.extractSubject(content));
    formData.append("text", content);
    formData.append("html", this.formatAsHtml(content));

    if (config.replyTo) {
      formData.append("h:Reply-To", config.replyTo);
    }

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${config.apiKey}`)}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Mailgun API error: ${error}` };
    }

    const data = (await response.json()) as { id: string };
    return {
      success: true,
      providerId: data.id,
      response: data,
      recipientCount: recipients.length,
    };
  }

  /**
   * Extract subject line from content (first line or default)
   */
  private extractSubject(content: string): string {
    const lines = content.split("\n");
    const firstLine = lines[0]?.trim() || "";

    // If first line looks like a subject (short, no period at end)
    if (firstLine.length <= 100 && !firstLine.endsWith(".")) {
      return firstLine || "UTA Transit Alert";
    }

    // Default subject
    return "UTA Transit Alert";
  }

  /**
   * Format plain text content as HTML
   */
  private formatAsHtml(content: string): string {
    // Simple conversion - escape HTML and convert newlines to <br>
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
    .footer { margin-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <strong>UTA Transit Alert</strong>
  </div>
  <div class="content">
    ${escaped}
  </div>
  <div class="footer">
    <p>Utah Transit Authority</p>
    <p><a href="https://rideuta.com">rideuta.com</a></p>
  </div>
</body>
</html>
    `.trim();
  }

  async healthCheck(config: EmailConfig): Promise<{ healthy: boolean; message?: string }> {
    if (!config.apiKey) {
      return { healthy: false, message: "API key not configured" };
    }

    const provider = config.provider || "resend";

    try {
      switch (provider) {
        case "resend": {
          // Check Resend API key by listing domains
          const response = await fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          });
          return {
            healthy: response.ok,
            message: response.ok ? "Resend API connected" : "Invalid API key",
          };
        }
        case "sendgrid": {
          // Check SendGrid by verifying API key
          const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          });
          return {
            healthy: response.ok,
            message: response.ok ? "SendGrid API connected" : "Invalid API key",
          };
        }
        default:
          return { healthy: true, message: `Provider ${provider} health check not implemented` };
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }
}

// Export singleton instance
export const emailAdapter = new EmailAdapter();
