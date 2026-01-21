import { test, expect, describe } from "bun:test";
import { TwitterAdapter } from "../../src/channels/twitter";

describe("TwitterAdapter", () => {
  const adapter = new TwitterAdapter();

  describe("constraints", () => {
    test("has correct type", () => {
      expect(adapter.type).toBe("twitter");
    });

    test("has max length of 280", () => {
      expect(adapter.constraints.maxLength).toBe(280);
    });

    test("supports media", () => {
      expect(adapter.constraints.supportsMedia).toBe(true);
    });

    test("does not support HTML", () => {
      expect(adapter.constraints.supportsHtml).toBe(false);
    });
  });

  describe("countCharacters", () => {
    test("counts regular text correctly", () => {
      const count = adapter.countCharacters("Hello world");
      expect(count).toBe(11);
    });

    test("counts URLs as 23 characters", () => {
      const text = "Check this out: https://example.com/very/long/path/here";
      const count = adapter.countCharacters(text);
      // "Check this out: " = 16 chars + 23 for URL = 39
      expect(count).toBe(39);
    });

    test("counts multiple URLs correctly", () => {
      const text = "Visit https://a.com and https://b.com today";
      const count = adapter.countCharacters(text);
      // "Visit " = 6, URL = 23, " and " = 5, URL = 23, " today" = 6 = 63
      expect(count).toBe(63);
    });
  });

  describe("validateContent", () => {
    test("accepts valid tweet", () => {
      const result = adapter.validateContent("This is a valid tweet");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("accepts tweet at exactly 280 chars", () => {
      const result = adapter.validateContent("a".repeat(280));
      expect(result.valid).toBe(true);
    });

    test("rejects empty content", () => {
      const result = adapter.validateContent("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content cannot be empty");
    });

    test("rejects content over 280 chars", () => {
      const result = adapter.validateContent("a".repeat(281));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds 280 characters");
    });

    test("accounts for URL shortening in validation", () => {
      // 256 regular chars + space + URL (23) = 280 total
      const text = "a".repeat(256) + " https://very-long-url.example.com/path";
      const result = adapter.validateContent(text);
      expect(result.valid).toBe(true); // 256 + 1 (space) + 23 = 280
    });
  });

  describe("formatContent", () => {
    test("adds UTA hashtag if space available", () => {
      const result = adapter.formatContent("Service alert for Blue Line");
      expect(result).toContain("#UTA");
    });

    test("does not add hashtag if already present", () => {
      const result = adapter.formatContent("Service alert #UTA");
      expect(result.match(/#UTA/g)?.length).toBe(1);
    });

    test("truncates content over 280 chars", () => {
      const longContent = "a".repeat(300);
      const result = adapter.formatContent(longContent);
      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toEndWith("...");
    });
  });

  describe("splitIntoThread", () => {
    test("returns single tweet for short content", () => {
      const result = adapter.splitIntoThread("Short message");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Short message");
    });

    test("splits long content into multiple tweets", () => {
      const longContent = "This is a very long message. ".repeat(20);
      const result = adapter.splitIntoThread(longContent);
      expect(result.length).toBeGreaterThan(1);
    });

    test("adds thread indicators to split tweets", () => {
      const longContent = "This is a long message that needs splitting. ".repeat(15);
      const result = adapter.splitIntoThread(longContent);
      expect(result[0]).toContain("(1/");
      expect(result[result.length - 1]).toContain(`/${result.length})`);
    });

    test("respects max tweets limit", () => {
      const veryLongContent = "word ".repeat(1000);
      const result = adapter.splitIntoThread(veryLongContent, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe("send", () => {
    test("returns error when OAuth credentials missing", async () => {
      const result = await adapter.send("Test tweet", [], {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("OAuth credentials");
    });

    test("returns error when API keys missing", async () => {
      const result = await adapter.send("Test tweet", [], {
        accessToken: "token",
        accessTokenSecret: "secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("API keys");
    });
  });
});
