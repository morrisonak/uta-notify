import { BaseChannelAdapter, type ChannelConfig, type FormattedMessage } from "../adapter";
import {
  type ChannelType,
  type DeliveryResult,
  type ChannelConstraints,
} from "../../domain/messages/message.schema";
import type { Incident } from "../../domain/incidents/incident.schema";

// ============================================
// TEST SIGNAGE ADAPTER
// ============================================

/**
 * Test endpoint adapter for digital signage
 * Simulates sending to signage systems like Penta WavWriter,
 * Papercast, Daktronics, etc.
 *
 * In production, separate adapters would be created for each provider.
 */
export class TestSignageAdapter extends BaseChannelAdapter {
  readonly type: ChannelType = "signage";
  readonly name = "Digital Signage (Test)";
  readonly constraints: ChannelConstraints = {
    maxLength: 500, // Varies by device
    supportsMedia: false,
  };

  private provider: SignageProvider;

  constructor(provider: SignageProvider = "generic") {
    super();
    this.provider = provider;
  }

  /**
   * Format message for signage display
   * - Remove URLs (not useful on signage)
   * - Convert to uppercase for visibility (optional)
   * - Handle line breaks for display constraints
   */
  override formatMessage(content: string, incident: Incident): string {
    let formatted = content;

    // Remove URLs
    formatted = formatted.replace(/https?:\/\/[^\s]+/g, "");

    // Remove extra whitespace
    formatted = formatted.replace(/\s+/g, " ").trim();

    // Add route prefix if available
    if (incident.affectedRoutes && incident.affectedRoutes.length > 0) {
      const routes = incident.affectedRoutes.slice(0, 3).join(", ");
      const prefix = `[${routes}] `;
      if (formatted.length + prefix.length <= this.constraints.maxLength!) {
        formatted = prefix + formatted;
      }
    }

    // Truncate to max length
    if (formatted.length > this.constraints.maxLength!) {
      formatted = formatted.substring(0, this.constraints.maxLength! - 3) + "...";
    }

    return formatted;
  }

  /**
   * Simulate sending to signage system
   */
  async send(message: FormattedMessage, config: ChannelConfig): Promise<DeliveryResult> {
    const settings = config.settings as SignageSettings;

    // Simulate network delay (signage systems can be slow)
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 500));

    // Log the message details
    console.log(`[SIGNAGE TEST - ${this.provider.toUpperCase()}] Message:`, {
      provider: this.provider,
      targetLocations: settings.targetLocations || ["all"],
      messageId: message.id,
      content: message.content,
      priority: settings.priority || "normal",
      duration: settings.displayDurationSeconds || 30,
    });

    // Simulate the API call structure for each provider
    const providerResult = await this.simulateProviderCall(message, config);

    if (!providerResult.success) {
      return this.failureResult(providerResult.error!, providerResult.retryable);
    }

    return this.successResult(providerResult.messageId, {
      provider: this.provider,
      targetedDevices: providerResult.deviceCount,
      displayDuration: settings.displayDurationSeconds || 30,
    });
  }

  /**
   * Simulate provider-specific API calls
   */
  private async simulateProviderCall(
    message: FormattedMessage,
    config: ChannelConfig
  ): Promise<ProviderSimulationResult> {
    const settings = config.settings as SignageSettings;

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: "Simulated signage system timeout",
        retryable: true,
      };
    }

    switch (this.provider) {
      case "penta":
        return this.simulatePentaWavWriter(message, settings);
      case "papercast":
        return this.simulatePapercast(message, settings);
      case "daktronics":
        return this.simulateDaktronics(message, settings);
      default:
        return this.simulateGeneric(message, settings);
    }
  }

  private async simulatePentaWavWriter(
    message: FormattedMessage,
    settings: SignageSettings
  ): Promise<ProviderSimulationResult> {
    // Penta WavWriter uses SOAP/XML API
    console.log("[PENTA WAVWRITER] Simulating SOAP request to Sunrise SESA");
    return {
      success: true,
      messageId: `penta_${Date.now()}`,
      deviceCount: settings.targetLocations?.length || 10,
    };
  }

  private async simulatePapercast(
    message: FormattedMessage,
    settings: SignageSettings
  ): Promise<ProviderSimulationResult> {
    // Papercast uses REST API
    console.log("[PAPERCAST] Simulating REST API call to e-paper displays");
    return {
      success: true,
      messageId: `papercast_${Date.now()}`,
      deviceCount: settings.targetLocations?.length || 5,
    };
  }

  private async simulateDaktronics(
    message: FormattedMessage,
    settings: SignageSettings
  ): Promise<ProviderSimulationResult> {
    // Daktronics OVX system
    console.log("[DAKTRONICS] Simulating OVX API call");
    return {
      success: true,
      messageId: `daktronics_${Date.now()}`,
      deviceCount: settings.targetLocations?.length || 8,
    };
  }

  private async simulateGeneric(
    message: FormattedMessage,
    settings: SignageSettings
  ): Promise<ProviderSimulationResult> {
    console.log("[GENERIC SIGNAGE] Simulating generic signage API");
    return {
      success: true,
      messageId: `signage_${Date.now()}`,
      deviceCount: settings.targetLocations?.length || 3,
    };
  }

  /**
   * Test connection to signage system
   */
  async testConnection(config: ChannelConfig): Promise<{ ok: boolean; error?: string }> {
    // In a real implementation, this would ping the signage management system
    console.log(`[SIGNAGE TEST] Testing connection to ${this.provider} system`);

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { ok: true };
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

type SignageProvider = "penta" | "papercast" | "daktronics" | "generic";

interface SignageSettings {
  targetLocations?: string[]; // Stop/station IDs
  priority?: "low" | "normal" | "high" | "emergency";
  displayDurationSeconds?: number;
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  deviceTypes?: string[]; // Filter by device type
}

interface ProviderSimulationResult {
  success: boolean;
  messageId?: string;
  deviceCount?: number;
  error?: string;
  retryable?: boolean;
}

// ============================================
// FACTORIES
// ============================================

/**
 * Create a Penta WavWriter adapter
 */
export function createPentaAdapter(): TestSignageAdapter {
  return new TestSignageAdapter("penta");
}

/**
 * Create a Papercast adapter
 */
export function createPapercastAdapter(): TestSignageAdapter {
  return new TestSignageAdapter("papercast");
}

/**
 * Create a Daktronics adapter
 */
export function createDaktronicsAdapter(): TestSignageAdapter {
  return new TestSignageAdapter("daktronics");
}

/**
 * Create a generic signage adapter
 */
export function createGenericSignageAdapter(): TestSignageAdapter {
  return new TestSignageAdapter("generic");
}
