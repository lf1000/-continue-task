/**
 * Tests for the network allowlist validator.
 * Confirms that external hostnames are rejected and internal ones are allowed.
 */

import { describe, it, expect } from "vitest";
import {
  isAllowedHost,
  isAllowedUrl,
  validateApiBase,
  validateProvider,
  validateModelConfig,
} from "./allowlist";

describe("allowlist", () => {
  describe("isAllowedHost", () => {
    it("allows localhost", () => {
      expect(isAllowedHost("localhost")).toBe(true);
    });

    it("allows 127.0.0.1", () => {
      expect(isAllowedHost("127.0.0.1")).toBe(true);
    });

    it("allows 0.0.0.0", () => {
      expect(isAllowedHost("0.0.0.0")).toBe(true);
    });

    it("allows IPv6 loopback", () => {
      expect(isAllowedHost("::1")).toBe(true);
    });

    it("allows 10.x.x.x private range", () => {
      expect(isAllowedHost("10.0.0.1")).toBe(true);
      expect(isAllowedHost("10.255.255.255")).toBe(true);
    });

    it("allows 172.16-31.x.x private range", () => {
      expect(isAllowedHost("172.16.0.1")).toBe(true);
      expect(isAllowedHost("172.31.255.255")).toBe(true);
    });

    it("allows 192.168.x.x private range", () => {
      expect(isAllowedHost("192.168.0.1")).toBe(true);
      expect(isAllowedHost("192.168.255.255")).toBe(true);
    });

    it("rejects api.openai.com", () => {
      expect(isAllowedHost("api.openai.com")).toBe(false);
    });

    it("rejects api.anthropic.com", () => {
      expect(isAllowedHost("api.anthropic.com")).toBe(false);
    });

    it("rejects 8.8.8.8 (public IP)", () => {
      expect(isAllowedHost("8.8.8.8")).toBe(false);
    });

    it("rejects example.com", () => {
      expect(isAllowedHost("example.com")).toBe(false);
    });

    it("rejects 172.32.0.1 (outside private range)", () => {
      expect(isAllowedHost("172.32.0.1")).toBe(false);
    });
  });

  describe("isAllowedUrl", () => {
    it("allows http://localhost:11434", () => {
      expect(isAllowedUrl("http://localhost:11434")).toBe(true);
    });

    it("allows http://127.0.0.1:8080/v1", () => {
      expect(isAllowedUrl("http://127.0.0.1:8080/v1")).toBe(true);
    });

    it("allows http://10.0.1.50:5000/api", () => {
      expect(isAllowedUrl("http://10.0.1.50:5000/api")).toBe(true);
    });

    it("rejects https://api.openai.com/v1/", () => {
      expect(isAllowedUrl("https://api.openai.com/v1/")).toBe(false);
    });

    it("rejects https://api.anthropic.com/v1/", () => {
      expect(isAllowedUrl("https://api.anthropic.com/v1/")).toBe(false);
    });

    it("rejects invalid URLs", () => {
      expect(isAllowedUrl("not-a-url")).toBe(false);
    });
  });

  describe("validateApiBase", () => {
    it("does not throw for empty apiBase", () => {
      expect(() => validateApiBase("", "chat")).not.toThrow();
    });

    it("does not throw for localhost URLs", () => {
      expect(() =>
        validateApiBase("http://localhost:11434", "chat"),
      ).not.toThrow();
    });

    it("throws for external apiBase", () => {
      expect(() =>
        validateApiBase("https://api.openai.com/v1/", "chat"),
      ).toThrow("[SECURITY] Configuration rejected");
    });

    it("throws for external apiBase with descriptive error", () => {
      expect(() =>
        validateApiBase("https://api.anthropic.com/v1/", "autocomplete"),
      ).toThrow('model role "autocomplete"');
    });
  });

  describe("validateProvider", () => {
    it("allows ollama", () => {
      expect(() => validateProvider("ollama", "chat")).not.toThrow();
    });

    it("allows vllm", () => {
      expect(() => validateProvider("vllm", "chat")).not.toThrow();
    });

    it("allows lmstudio", () => {
      expect(() => validateProvider("lmstudio", "embed")).not.toThrow();
    });

    it("rejects openai", () => {
      expect(() => validateProvider("openai", "chat")).toThrow(
        "[SECURITY] Configuration rejected",
      );
    });

    it("rejects anthropic", () => {
      expect(() => validateProvider("anthropic", "chat")).toThrow(
        "[SECURITY] Configuration rejected",
      );
    });

    it("rejects mistral", () => {
      expect(() => validateProvider("mistral", "chat")).toThrow(
        "[SECURITY] Configuration rejected",
      );
    });
  });

  describe("validateModelConfig", () => {
    it("accepts a fully local config", () => {
      expect(() =>
        validateModelConfig(
          { provider: "ollama", apiBase: "http://localhost:11434" },
          "chat",
        ),
      ).not.toThrow();
    });

    it("rejects a cloud provider with cloud apiBase", () => {
      expect(() =>
        validateModelConfig(
          { provider: "openai", apiBase: "https://api.openai.com/v1/" },
          "chat",
        ),
      ).toThrow("[SECURITY]");
    });
  });

  describe("validateConfig integration", () => {
    it("accepts valid local-only SerializedContinueConfig", async () => {
      const { validateConfig } = await import("./validation.js");
      const config: any = {
        models: [
          { title: "Local Chat", provider: "ollama", model: "llama3", apiBase: "http://localhost:11434" },
        ],
        tabAutocompleteModel: {
          title: "Local Autocomplete",
          provider: "ollama",
          model: "qwen2.5-coder",
          apiBase: "http://localhost:11434",
        },
        embeddingsProvider: {
          provider: "ollama",
          apiBase: "http://localhost:11434",
        },
      };
      const errors = validateConfig(config);
      expect(errors).toBeUndefined();
    });

    it("rejects SerializedContinueConfig with external chat model apiBase", async () => {
      const { validateConfig } = await import("./validation.js");
      const config: any = {
        models: [
          { title: "Cloud Chat", provider: "openai", model: "gpt-4", apiBase: "https://api.openai.com/v1/" },
        ],
      };
      const errors = validateConfig(config);
      expect(errors).toBeDefined();
      expect(errors!.some(e => e.message.includes("[SECURITY]"))).toBe(true);
    });

    it("rejects SerializedContinueConfig with external autocomplete apiBase", async () => {
      const { validateConfig } = await import("./validation.js");
      const config: any = {
        models: [{ title: "Local Chat", provider: "ollama", model: "llama3" }],
        tabAutocompleteModel: {
          title: "Cloud Autocomplete",
          provider: "anthropic",
          model: "claude-3-5-sonnet",
          apiBase: "https://api.anthropic.com/v1/",
        },
      };
      const errors = validateConfig(config);
      expect(errors).toBeDefined();
      expect(errors!.some(e => e.message.includes("[SECURITY]"))).toBe(true);
    });

    it("rejects SerializedContinueConfig with external embeddings provider", async () => {
      const { validateConfig } = await import("./validation.js");
      const config: any = {
        models: [{ title: "Local Chat", provider: "ollama", model: "llama3" }],
        embeddingsProvider: {
          provider: "voyage",
          apiBase: "https://api.voyageai.com/v1/",
        },
      };
      const errors = validateConfig(config);
      expect(errors).toBeDefined();
      expect(errors!.some(e => e.message.includes("[SECURITY]"))).toBe(true);
    });
  });
});
