/**
 * Channel Adapters Registry
 * Central registry for all notification channel adapters
 */

export * from "./types";
export * from "./email";
export * from "./sms";
export * from "./twitter";
export * from "./push";
export * from "./signage";

import type { ChannelAdapter } from "./types";
import { emailAdapter } from "./email";
import { smsAdapter } from "./sms";
import { twitterAdapter } from "./twitter";
import { pushAdapter } from "./push";
import { signageAdapter } from "./signage";

// Registry of all available channel adapters
const adapters: Record<string, ChannelAdapter> = {
  email: emailAdapter,
  sms: smsAdapter,
  twitter: twitterAdapter,
  push: pushAdapter,
  signage: signageAdapter,
};

/**
 * Get a channel adapter by type
 */
export function getAdapter(type: string): ChannelAdapter | undefined {
  return adapters[type];
}

/**
 * Get all available channel types
 */
export function getAvailableChannelTypes(): string[] {
  return Object.keys(adapters);
}

/**
 * Register a custom channel adapter
 */
export function registerAdapter(adapter: ChannelAdapter): void {
  adapters[adapter.type] = adapter;
}
