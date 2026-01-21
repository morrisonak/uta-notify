import { test, expect, describe, mock } from "bun:test";
import { SmsAdapter } from "../../src/channels/sms";

describe("SmsAdapter", () => {
  const adapter = new SmsAdapter();

  describe("constraints", () => {
    test("has correct type", () => {
      expect(adapter.type).toBe("sms");
    });

    test("has max length of 1600", () => {
      expect(adapter.constraints.maxLength).toBe(1600);
    });

    test("does not support media", () => {
      expect(adapter.constraints.supportsMedia).toBe(false);
    });

    test("does not support HTML", () => {
      expect(adapter.constraints.supportsHtml).toBe(false);
    });
  });

  describe("validateContent", () => {
    test("accepts valid short content", () => {
      const result = adapter.validateContent("Test alert message");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects empty content", () => {
      const result = adapter.validateContent("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content cannot be empty");
    });

    test("rejects content exceeding max length", () => {
      const longContent = "a".repeat(1700);
      const result = adapter.validateContent(longContent);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds maximum length");
    });
  });

  describe("formatContent", () => {
    test("adds UTA branding to short messages", () => {
      const result = adapter.formatContent("Service delayed");
      expect(result).toContain("UTA Alert:");
    });

    test("does not add branding if UTA already present", () => {
      const result = adapter.formatContent("UTA: Service delayed");
      expect(result).toBe("UTA: Service delayed");
    });

    test("truncates long messages", () => {
      const longContent = "a".repeat(1700);
      const result = adapter.formatContent(longContent);
      expect(result.length).toBeLessThanOrEqual(adapter.constraints.maxLength);
      expect(result).toEndWith("...");
    });
  });

  describe("getSegmentCount", () => {
    test("returns 1 for short GSM messages", () => {
      const count = adapter.getSegmentCount("Hello world");
      expect(count).toBe(1);
    });

    test("returns 1 for exactly 160 chars GSM", () => {
      const count = adapter.getSegmentCount("a".repeat(160));
      expect(count).toBe(1);
    });

    test("returns 2 for 161 chars GSM", () => {
      const count = adapter.getSegmentCount("a".repeat(161));
      expect(count).toBe(2);
    });

    test("handles unicode messages with lower limits", () => {
      // Emoji is unicode
      const count = adapter.getSegmentCount("Hello 👋");
      expect(count).toBe(1);

      const longUnicode = "👋".repeat(80);
      const longCount = adapter.getSegmentCount(longUnicode);
      expect(longCount).toBeGreaterThan(1);
    });
  });

  describe("send", () => {
    test("returns error when credentials missing", async () => {
      const result = await adapter.send("Test message", ["+18015551234"], {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("credentials");
    });

    test("returns error when no from number configured", async () => {
      const result = await adapter.send("Test message", ["+18015551234"], {
        accountSid: "AC123",
        authToken: "token123",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("From number");
    });

    test("returns error when no recipients", async () => {
      const result = await adapter.send("Test message", [], {
        accountSid: "AC123",
        authToken: "token123",
        fromNumber: "+18005551234",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("recipient");
    });
  });
});
