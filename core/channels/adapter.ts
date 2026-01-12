import type { z } from "zod";
import type { Incident } from "../domain/incidents/incident.schema";
import {
  type ChannelType,
  type DeliveryResult,
  DeliveryResultSchema,
  type ChannelConstraints,
} from "../domain/messages/message.schema";

// ============================================
// FORMATTED MESSAGE TYPE
// ============================================

/**
 * Message prepared for delivery to a channel
 */
export interface FormattedMessage {
  id: string;
  content: string;
  incidentId: string;
  incidentVersion: number;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Delivery status from a channel
 */
export interface DeliveryStatusInfo {
  status: "pending" | "sent" | "delivered" | "failed";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// CHANNEL ADAPTER INTERFACE
// ============================================

/**
 * Base interface for all channel adapters
 *
 * Each adapter handles communication with a specific external service
 * (Twitter, SMS provider, email provider, etc.)
 */
export interface ChannelAdapter {
  /** Channel type identifier */
  readonly type: ChannelType;

  /** Human-readable name */
  readonly name: string;

  /** Channel constraints (max length, media support, etc.) */
  readonly constraints: ChannelConstraints;

  /**
   * Format a message for this channel
   * Applies channel-specific formatting rules
   */
  formatMessage(content: string, incident: Incident): string;

  /**
   * Validate a message before sending
   * Returns validation result with any errors/warnings
   */
  validateMessage(content: string): MessageValidation;

  /**
   * Send a message through this channel
   * Returns the delivery result
   */
  send(message: FormattedMessage, config: ChannelConfig): Promise<DeliveryResult>;

  /**
   * Get the delivery status of a previously sent message
   * Optional - not all channels support status tracking
   */
  getStatus?(externalId: string, config: ChannelConfig): Promise<DeliveryStatusInfo>;

  /**
   * Test the channel connection/configuration
   * Returns true if the channel is properly configured
   */
  testConnection?(config: ChannelConfig): Promise<{ ok: boolean; error?: string }>;
}

/**
 * Message validation result
 */
export interface MessageValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  characterCount: number;
  truncated?: string; // Truncated version if too long
}

/**
 * Channel configuration (decrypted from database)
 */
export interface ChannelConfig {
  id: string;
  type: ChannelType;
  provider?: string;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  testMode: boolean;
}

// ============================================
// ABSTRACT BASE ADAPTER
// ============================================

/**
 * Base class for channel adapters with common functionality
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly type: ChannelType;
  abstract readonly name: string;
  abstract readonly constraints: ChannelConstraints;

  /**
   * Default message formatting - can be overridden
   */
  formatMessage(content: string, _incident: Incident): string {
    // Apply max length if specified
    if (this.constraints.maxLength && content.length > this.constraints.maxLength) {
      return content.substring(0, this.constraints.maxLength - 3) + "...";
    }
    return content;
  }

  /**
   * Default message validation
   */
  validateMessage(content: string): MessageValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let truncated: string | undefined;

    const maxLength = this.constraints.maxLength;

    if (!content || content.trim().length === 0) {
      errors.push("Message content is required");
    }

    if (maxLength && content.length > maxLength) {
      warnings.push(
        `Message exceeds maximum length (${content.length}/${maxLength}). It will be truncated.`
      );
      truncated = content.substring(0, maxLength - 3) + "...";
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      characterCount: content.length,
      truncated,
    };
  }

  /**
   * Abstract send method - must be implemented by each adapter
   */
  abstract send(message: FormattedMessage, config: ChannelConfig): Promise<DeliveryResult>;

  /**
   * Helper to create a successful delivery result
   */
  protected successResult(messageId?: string, metadata?: Record<string, unknown>): DeliveryResult {
    return DeliveryResultSchema.parse({
      success: true,
      messageId,
      metadata,
    });
  }

  /**
   * Helper to create a failed delivery result
   */
  protected failureResult(error: string, retryable: boolean = true): DeliveryResult {
    return DeliveryResultSchema.parse({
      success: false,
      error,
      retryable,
    });
  }
}

// ============================================
// TEST/MOCK ADAPTER
// ============================================

/**
 * Test adapter for development and testing
 * Logs messages instead of sending them
 */
export class TestChannelAdapter extends BaseChannelAdapter {
  readonly type: ChannelType;
  readonly name: string;
  readonly constraints: ChannelConstraints;

  constructor(type: ChannelType, name: string, constraints: ChannelConstraints) {
    super();
    this.type = type;
    this.name = name;
    this.constraints = constraints;
  }

  async send(message: FormattedMessage, config: ChannelConfig): Promise<DeliveryResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    // Log the message
    console.log(`[TEST ${this.type.toUpperCase()}] Sending message:`, {
      channel: this.type,
      messageId: message.id,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? "..." : ""),
      incidentId: message.incidentId,
      testMode: config.testMode,
    });

    // Simulate occasional failures for testing retry logic
    if (Math.random() < 0.1) {
      return this.failureResult("Simulated random failure", true);
    }

    return this.successResult(`test_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  }

  async testConnection(_config: ChannelConfig): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }

  async getStatus(externalId: string, _config: ChannelConfig): Promise<DeliveryStatusInfo> {
    return {
      status: "delivered",
      timestamp: new Date().toISOString(),
      metadata: { externalId },
    };
  }
}
