/**
 * Channel Adapter Types
 * Common interfaces for all notification channel adapters
 */

export interface ChannelConfig {
  /** API key or authentication token */
  apiKey?: string;
  /** API endpoint override */
  endpoint?: string;
  /** Sender identity (email address, phone number, etc.) */
  sender?: string;
  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

export interface ChannelConstraints {
  /** Maximum message length in characters */
  maxLength: number;
  /** Whether the channel supports media attachments */
  supportsMedia: boolean;
  /** Whether the channel supports HTML formatting */
  supportsHtml: boolean;
  /** Rate limit (messages per minute) */
  rateLimit?: number;
  /** Required fields for this channel */
  requiredFields?: string[];
}

export interface SendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Provider-specific message ID */
  providerId?: string;
  /** Full provider response */
  response?: unknown;
  /** Error message if failed */
  error?: string;
  /** Number of recipients reached (for batch sends) */
  recipientCount?: number;
}

export interface ChannelAdapter {
  /** Channel type identifier */
  readonly type: string;

  /** Channel constraints */
  readonly constraints: ChannelConstraints;

  /**
   * Send a message through this channel
   * @param content The message content
   * @param recipients Array of recipient identifiers
   * @param config Channel configuration
   */
  send(
    content: string,
    recipients: string[],
    config: ChannelConfig
  ): Promise<SendResult>;

  /**
   * Validate that content meets channel constraints
   * @param content The message content to validate
   */
  validateContent(content: string): { valid: boolean; errors: string[] };

  /**
   * Format content for this channel (e.g., truncation, link shortening)
   * @param content The message content to format
   */
  formatContent(content: string): string;

  /**
   * Check if the channel is healthy and can send messages
   * @param config Channel configuration
   */
  healthCheck(config: ChannelConfig): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Base class for channel adapters with common functionality
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly type: string;
  abstract readonly constraints: ChannelConstraints;

  abstract send(
    content: string,
    recipients: string[],
    config: ChannelConfig
  ): Promise<SendResult>;

  validateContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Content cannot be empty");
    }

    if (content.length > this.constraints.maxLength) {
      errors.push(
        `Content exceeds maximum length of ${this.constraints.maxLength} characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  formatContent(content: string): string {
    // Truncate to max length if needed
    if (content.length > this.constraints.maxLength) {
      return content.substring(0, this.constraints.maxLength - 3) + "...";
    }
    return content;
  }

  async healthCheck(config: ChannelConfig): Promise<{ healthy: boolean; message?: string }> {
    // Default implementation - override in specific adapters
    return { healthy: true, message: "Health check not implemented" };
  }
}
