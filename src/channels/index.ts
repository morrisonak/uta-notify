/**
 * Channel Adapters Registry
 * Central registry for all notification channel adapters
 */

export * from "./types";
export * from "./email";

import type { ChannelAdapter } from "./types";
import { emailAdapter } from "./email";

// Registry of all available channel adapters
const adapters: Record<string, ChannelAdapter> = {
  email: emailAdapter,
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
