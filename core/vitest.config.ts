import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@continuedev/fetch": path.resolve(__dirname, "./__mocks__/@continuedev/fetch/index.ts"),
      "@continuedev/llm-info": path.resolve(__dirname, "../packages/llm-info/src/index.ts"),
      "@continuedev/config-types": path.resolve(__dirname, "../packages/config-types/src/index.ts"),
      "@continuedev/config-yaml": path.resolve(__dirname, "./__mocks__/@continuedev/config-yaml/index.ts"),
      "@continuedev/openai-adapters": path.resolve(__dirname, "./__mocks__/@continuedev/openai-adapters/index.ts"),
      "@continuedev/terminal-security": path.resolve(__dirname, "../packages/terminal-security/src/index.ts"),
    },
  },
  test: {
    testTransformMode: {
      web: ["/.[jt]s?$/"],
      ssr: ["/.[jt]s?$/"],
    },
    globalSetup: "./test/vitest.global-setup.ts",
    setupFiles: "./test/vitest.setup.ts",
    fileParallelism: false,
    include: ["**/*.vitest.ts"],
  },
});
