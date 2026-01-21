import { test, expect, describe } from "bun:test";
import { EmailAdapter } from "../../src/channels/email";

describe("EmailAdapter", () => {
  const adapter = new EmailAdapter();

  describe("constraints", () => {
    test("has correct type", () => {
      expect(adapter.type).toBe("email");
    });

    test("has max length of 100000", () => {
      expect(adapter.constraints.maxLength).toBe(100000);
    });

    test("supports media", () => {
      expect(adapter.constraints.supportsMedia).toBe(true);
    });

    test("supports HTML", () => {
      expect(adapter.constraints.supportsHtml).toBe(true);
    });
  });

  describe("validateContent", () => {
    test("accepts valid content", () => {
      const result = adapter.validateContent("Test email content");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects empty content", () => {
      const result = adapter.validateContent("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content cannot be empty");
    });

    test("accepts long content", () => {
      const longContent = "a".repeat(50000);
      const result = adapter.validateContent(longContent);
      expect(result.valid).toBe(true);
    });

    test("rejects content exceeding 100KB", () => {
      const tooLongContent = "a".repeat(100001);
      const result = adapter.validateContent(tooLongContent);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds maximum length");
    });
  });

  describe("formatContent", () => {
    test("preserves content under max length", () => {
      const content = "Test email content";
      const result = adapter.formatContent(content);
      expect(result).toBe(content);
    });

    test("truncates overly long content", () => {
      const longContent = "a".repeat(100010);
      const result = adapter.formatContent(longContent);
      expect(result.length).toBeLessThanOrEqual(adapter.constraints.maxLength);
      expect(result).toEndWith("...");
    });
  });

  describe("send", () => {
    test("returns error when API key missing", async () => {
      const result = await adapter.send("Test content", ["test@example.com"], {
        provider: "sendgrid",
        fromEmail: "sender@example.com",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("API key");
    });

    test("returns error when from email missing", async () => {
      const result = await adapter.send("Test content", ["test@example.com"], {
        provider: "sendgrid",
        apiKey: "test-key",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("From email");
    });

    test("returns error when no recipients", async () => {
      const result = await adapter.send("Test content", [], {
        provider: "sendgrid",
        apiKey: "test-key",
        fromEmail: "sender@example.com",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("recipient");
    });

    test("returns error for unknown provider", async () => {
      const result = await adapter.send("Test content", ["test@example.com"], {
        provider: "unknown" as any,
        apiKey: "test-key",
        fromEmail: "sender@example.com",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown provider");
    });
  });
});
