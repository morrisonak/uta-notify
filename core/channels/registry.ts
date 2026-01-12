import type { ChannelAdapter, ChannelConfig } from "./adapter";
import { TestChannelAdapter } from "./adapter";
import {
  type ChannelType,
  type DeliveryResult,
  DefaultChannelConstraints,
} from "../domain/messages/message.schema";
import type { Incident } from "../domain/incidents/incident.schema";
import type { FormattedMessage, MessageValidation } from "./adapter";

// ============================================
// CHANNEL REGISTRY
// ============================================

/**
 * Registry for all channel adapters
 * Provides a central place to register and retrieve adapters
 */
export class ChannelRegistry {
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();
  private testAdapters: Map<ChannelType, ChannelAdapter> = new Map();

  constructor() {
    // Initialize test adapters for all channel types
    this.initializeTestAdapters();
  }

  /**
   * Create test adapters for all channel types
   */
  private initializeTestAdapters(): void {
    const channelTypes: ChannelType[] = [
      "twitter",
      "email",
      "sms",
      "push",
      "signage",
      "gtfs",
      "website",
    ];

    for (const type of channelTypes) {
      const constraints = DefaultChannelConstraints[type];
      this.testAdapters.set(
        type,
        new TestChannelAdapter(type, `Test ${type}`, constraints)
      );
    }
  }

  /**
   * Register a production adapter
   */
  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  /**
   * Unregister an adapter
   */
  unregister(type: ChannelType): void {
    this.adapters.delete(type);
  }

  /**
   * Get an adapter by type
   * Returns test adapter if in test mode or no production adapter exists
   */
  get(type: ChannelType, testMode: boolean = false): ChannelAdapter | undefined {
    if (testMode) {
      return this.testAdapters.get(type);
    }
    return this.adapters.get(type) ?? this.testAdapters.get(type);
  }

  /**
   * Get all registered adapter types
   */
  getRegisteredTypes(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all available types (including test adapters)
   */
  getAllTypes(): ChannelType[] {
    const types = new Set([...this.adapters.keys(), ...this.testAdapters.keys()]);
    return Array.from(types);
  }

  /**
   * Check if an adapter is registered
   */
  has(type: ChannelType, testMode: boolean = false): boolean {
    if (testMode) {
      return this.testAdapters.has(type);
    }
    return this.adapters.has(type) || this.testAdapters.has(type);
  }

  /**
   * Format a message for a specific channel
   */
  formatMessage(type: ChannelType, content: string, incident: Incident, testMode: boolean = false): string {
    const adapter = this.get(type, testMode);
    if (!adapter) {
      throw new Error(`No adapter registered for channel type: ${type}`);
    }
    return adapter.formatMessage(content, incident);
  }

  /**
   * Validate a message for a specific channel
   */
  validateMessage(type: ChannelType, content: string, testMode: boolean = false): MessageValidation {
    const adapter = this.get(type, testMode);
    if (!adapter) {
      throw new Error(`No adapter registered for channel type: ${type}`);
    }
    return adapter.validateMessage(content);
  }

  /**
   * Send a message through a channel
   */
  async send(
    type: ChannelType,
    message: FormattedMessage,
    config: ChannelConfig
  ): Promise<DeliveryResult> {
    const adapter = this.get(type, config.testMode);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter registered for channel type: ${type}`,
        retryable: false,
      };
    }
    return adapter.send(message, config);
  }

  /**
   * Test connection for a channel
   */
  async testConnection(
    type: ChannelType,
    config: ChannelConfig
  ): Promise<{ ok: boolean; error?: string }> {
    const adapter = this.get(type, config.testMode);
    if (!adapter) {
      return { ok: false, error: `No adapter registered for channel type: ${type}` };
    }
    if (!adapter.testConnection) {
      return { ok: true }; // Assume OK if no test method
    }
    return adapter.testConnection(config);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/**
 * Global channel registry instance
 */
export const channelRegistry = new ChannelRegistry();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get constraints for a channel type
 */
export function getChannelConstraints(type: ChannelType) {
  return DefaultChannelConstraints[type];
}

/**
 * Check if a channel supports media
 */
export function channelSupportsMedia(type: ChannelType): boolean {
  return DefaultChannelConstraints[type].supportsMedia;
}

/**
 * Get max message length for a channel
 */
export function getMaxMessageLength(type: ChannelType): number | undefined {
  return DefaultChannelConstraints[type].maxLength;
}
