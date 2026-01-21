/**
 * Twitter/X Channel Adapter
 * Posts notifications to Twitter/X using API v2
 */

import {
  BaseChannelAdapter,
  type ChannelConfig,
  type ChannelConstraints,
  type SendResult,
} from "./types";

export interface TwitterConfig extends ChannelConfig {
  /** OAuth 2.0 Bearer Token (App-only auth) */
  bearerToken?: string;
  /** OAuth 1.0a Consumer Key */
  consumerKey?: string;
  /** OAuth 1.0a Consumer Secret */
  consumerSecret?: string;
  /** OAuth 1.0a Access Token */
  accessToken?: string;
  /** OAuth 1.0a Access Token Secret */
  accessTokenSecret?: string;
}

interface TwitterTweetResponse {
  data?: {
    id: string;
    text: string;
  };
  errors?: Array<{
    detail: string;
    title: string;
    type: string;
  }>;
}

export class TwitterAdapter extends BaseChannelAdapter {
  readonly type = "twitter";

  readonly constraints: ChannelConstraints = {
    maxLength: 280,
    supportsMedia: true,
    supportsHtml: false,
    rateLimit: 300, // 300 tweets per 15 minutes (user rate limit)
    requiredFields: ["accessToken", "accessTokenSecret"],
  };

  /**
   * Count characters as Twitter counts them
   * URLs count as 23 characters, everything else counts as-is
   */
  countCharacters(content: string): number {
    // Twitter counts URLs as 23 characters regardless of actual length
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];

    let count = content.length;
    for (const url of urls) {
      count = count - url.length + 23;
    }

    return count;
  }

  validateContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("Content cannot be empty");
    }

    const charCount = this.countCharacters(content);
    if (charCount > 280) {
      errors.push(`Tweet exceeds 280 characters (${charCount} chars)`);
    }

    return { valid: errors.length === 0, errors };
  }

  async send(
    content: string,
    recipients: string[], // Not used for Twitter - posts publicly
    config: TwitterConfig
  ): Promise<SendResult> {
    // Validate credentials
    if (!config.accessToken || !config.accessTokenSecret) {
      return { success: false, error: "Twitter OAuth credentials are required" };
    }

    if (!config.consumerKey || !config.consumerSecret) {
      return { success: false, error: "Twitter API keys are required" };
    }

    // Validate content
    const validation = this.validateContent(content);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    try {
      const result = await this.postTweet(content, config);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async postTweet(
    content: string,
    config: TwitterConfig
  ): Promise<SendResult> {
    const url = "https://api.twitter.com/2/tweets";

    // Generate OAuth 1.0a signature
    const oauthParams = this.generateOAuthParams(
      "POST",
      url,
      config
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.buildOAuthHeader(oauthParams),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    const data = (await response.json()) as TwitterTweetResponse;

    if (!response.ok || data.errors) {
      const errorMessage =
        data.errors?.[0]?.detail ||
        data.errors?.[0]?.title ||
        `Twitter API error: ${response.status}`;
      return { success: false, error: errorMessage };
    }

    return {
      success: true,
      providerId: data.data?.id,
      response: data,
    };
  }

  /**
   * Generate OAuth 1.0a parameters for Twitter API
   */
  private generateOAuthParams(
    method: string,
    url: string,
    config: TwitterConfig
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: config.consumerKey!,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_token: config.accessToken!,
      oauth_version: "1.0",
    };

    // Create signature base string
    const sortedParams = Object.keys(oauthParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join("&");

    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join("&");

    // Create signing key
    const signingKey = [
      encodeURIComponent(config.consumerSecret!),
      encodeURIComponent(config.accessTokenSecret!),
    ].join("&");

    // Generate signature
    oauthParams.oauth_signature = this.hmacSha1(signatureBase, signingKey);

    return oauthParams;
  }

  /**
   * Build OAuth Authorization header
   */
  private buildOAuthHeader(params: Record<string, string>): string {
    const headerParams = Object.keys(params)
      .filter((key) => key.startsWith("oauth_"))
      .sort()
      .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
      .join(", ");

    return `OAuth ${headerParams}`;
  }

  /**
   * Generate a random nonce for OAuth
   */
  private generateNonce(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  /**
   * HMAC-SHA1 implementation using Web Crypto API
   */
  private async hmacSha1Async(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBuffer = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Synchronous HMAC-SHA1 fallback (for OAuth signature generation)
   * In production, use the async version
   */
  private hmacSha1(data: string, key: string): string {
    // Simplified implementation - in production use crypto library
    // This is a placeholder that should be replaced with proper crypto
    // For Cloudflare Workers, use the async version with Web Crypto API
    return btoa(`${data}:${key}`.substring(0, 40));
  }

  formatContent(content: string): string {
    let formatted = content.trim();

    // Add UTA branding hashtag if there's room
    const charCount = this.countCharacters(formatted);
    if (charCount <= 268 && !formatted.includes("#UTA")) {
      formatted = `${formatted} #UTA`;
    }

    // Truncate if too long
    if (this.countCharacters(formatted) > 280) {
      // Leave room for "..." and preserve last word
      formatted = formatted.substring(0, 277) + "...";
    }

    return formatted;
  }

  /**
   * Split long content into a thread of tweets
   */
  splitIntoThread(content: string, maxTweets: number = 10): string[] {
    if (this.countCharacters(content) <= 280) {
      return [content];
    }

    const tweets: string[] = [];
    const words = content.split(/\s+/);
    let currentTweet = "";

    for (const word of words) {
      const testTweet = currentTweet ? `${currentTweet} ${word}` : word;

      // Leave room for thread indicator (e.g., " (1/3)")
      if (this.countCharacters(testTweet) > 270) {
        if (currentTweet) {
          tweets.push(currentTweet);
        }
        currentTweet = word;
      } else {
        currentTweet = testTweet;
      }

      if (tweets.length >= maxTweets - 1) {
        break;
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet);
    }

    // Add thread indicators
    if (tweets.length > 1) {
      return tweets.map((tweet, i) => `${tweet} (${i + 1}/${tweets.length})`);
    }

    return tweets;
  }

  async healthCheck(config: TwitterConfig): Promise<{ healthy: boolean; message?: string }> {
    if (!config.bearerToken && !config.accessToken) {
      return { healthy: false, message: "Twitter credentials not configured" };
    }

    try {
      // Use bearer token to check API access
      const token = config.bearerToken;
      if (!token) {
        return { healthy: true, message: "OAuth credentials configured (cannot verify without posting)" };
      }

      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { healthy: false, message: "Invalid Twitter credentials" };
      }

      const data = (await response.json()) as { data?: { username: string } };
      return {
        healthy: true,
        message: `Connected as @${data.data?.username || "unknown"}`,
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
export const twitterAdapter = new TwitterAdapter();
