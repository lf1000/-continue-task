/**
 * Tests for the LLM provider registry.
 * Confirms that no cloud provider entries exist after the air-gapped fork changes.
 */

import { describe, it, expect } from "vitest";
import { LLMClasses } from "../llm/llms/index";

// Known cloud provider names that MUST NOT appear in the registry
const CLOUD_PROVIDERS = [
  "openai",
  "anthropic",
  "mistral",
  "cohere",
  "voyage",
  "gemini",
  "bedrock",
  "bedrock-import",
  "vertexai",
  "azure",
  "openrouter",
  "claw-router",
  "together",
  "groq",
  "fireworks",
  "deepinfra",
  "replicate",
  "sagemaker",
  "cloudflare",
  "deepseek",
  "cerebras",
  "sambanova",
  "nvidia",
  "scaleway",
  "siliconflow",
  "nebius",
  "asksage",
  "watsonx",
  "huggingface-tgi",
  "huggingface-inference-api",
  "huggingface-tei",
  "kindo",
  "ovhcloud",
  "flowise",
  "function-network",
  "comet",
  "novita",
  "ncompass",
  "inception",
  "moonshot",
  "xai",
  "zai",
  "minimax",
  "mimo",
  "venice",
  "relace",
  "tensorix",
  "tars",
  "nous",
];

// Known local-only provider names that SHOULD be present
const LOCAL_PROVIDERS = [
  "ollama",
  "vllm",
  "llama.cpp",
  "llamafile",
  "llamastack",
  "lmstudio",
  "lemonade",
  "text-gen-webui",
  "msty",
  "docker",
  "mock",
  "test",
];

describe("LLM Provider Registry (air-gapped fork)", () => {
  it("contains zero cloud provider entries", () => {
    const providerNames = LLMClasses.map((cls) =>
      cls.providerName.toLowerCase(),
    );

    for (const cloud of CLOUD_PROVIDERS) {
      expect(
        providerNames,
        `Cloud provider "${cloud}" should NOT be in the registry`,
      ).not.toContain(cloud);
    }
  });

  it("contains only local-only providers", () => {
    const providerNames = LLMClasses.map((cls) =>
      cls.providerName.toLowerCase(),
    );

    for (const local of LOCAL_PROVIDERS) {
      expect(
        providerNames,
        `Local provider "${local}" should be in the registry`,
      ).toContain(local);
    }
  });

  it("has exactly 12 provider entries", () => {
    expect(LLMClasses).toHaveLength(12);
  });

  it("does not reference any external API base URLs", () => {
    for (const cls of LLMClasses) {
      const instance = new cls({
        model: "test-model",
      } as any);

      const apiBase = (instance as any).apiBase || "";
      if (apiBase) {
        // Verify it's a local URL
        expect(apiBase).not.toMatch(/api\.openai\.com/);
        expect(apiBase).not.toMatch(/api\.anthropic\.com/);
        expect(apiBase).not.toMatch(/api\.mistral\.ai/);
        expect(apiBase).not.toMatch(/api\.cohere\.ai/);
      }
    }
  });
});
