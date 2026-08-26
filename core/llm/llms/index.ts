import Handlebars from "handlebars";
import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  ILLMLogger,
  JSONModelDescription,
  LLMOptions,
} from "../..";
import { renderTemplatedString } from "../../util/handlebars/renderTemplatedString";
import { BaseLLM } from "../index";

// ── LOCAL-ONLY PROVIDERS ────────────────────────────────────────────────
// All cloud providers (OpenAI, Anthropic, Mistral, Cohere, Voyage, Gemini,
// Bedrock, VertexAI, etc.) have been removed from this air-gapped fork.
// Only providers that target local/internal model servers are retained.
import Docker from "./Docker";
import LlamaCpp from "./LlamaCpp";
import Llamafile from "./Llamafile";
import LlamaStack from "./LlamaStack";
import Lemonade from "./Lemonade";
import LMStudio from "./LMStudio";
import MockLLM from "./Mock";
import Msty from "./Msty";
import Ollama from "./Ollama";
import TestLLM from "./Test";
import TextGenWebUI from "./TextGenWebUI";
import Vllm from "./Vllm";

export const LLMClasses = [
  Ollama,
  Vllm,
  LlamaCpp,
  Llamafile,
  LlamaStack,
  Lemonade,
  LMStudio,
  TextGenWebUI,
  Msty,
  Docker,
  MockLLM,
  TestLLM,
];

export async function llmFromDescription(
  desc: JSONModelDescription,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
  uniqueId: string,
  ideSettings: IdeSettings,
  llmLogger: ILLMLogger,
  completionOptions?: BaseCompletionOptions,
): Promise<BaseLLM | undefined> {
  const cls = LLMClasses.find((llm) => llm.providerName === desc.provider);

  if (!cls) {
    return undefined;
  }

  const finalCompletionOptions = {
    ...completionOptions,
    ...desc.completionOptions,
  };

  let baseChatSystemMessage: string | undefined = undefined;
  if (desc.systemMessage !== undefined) {
    // baseChatSystemMessage = DEFAULT_CHAT_SYSTEM_MESSAGE;
    // baseChatSystemMessage += "\n\n";
    baseChatSystemMessage = await renderTemplatedString(
      Handlebars,
      desc.systemMessage,
      {},
      [],
      readFile,
      getUriFromPath,
    );
  }

  let options: LLMOptions = {
    ...desc,
    completionOptions: {
      ...finalCompletionOptions,
      model: (desc.model || cls.defaultOptions?.model) ?? "codellama-7b",
      maxTokens:
        finalCompletionOptions.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    baseChatSystemMessage,
    basePlanSystemMessage: baseChatSystemMessage,
    baseAgentSystemMessage: baseChatSystemMessage,
    logger: llmLogger,
    uniqueId,
  };

  return new cls(options);
}

export function llmFromProviderAndOptions(
  providerName: string,
  llmOptions: LLMOptions,
): ILLM {
  const cls = LLMClasses.find((llm) => llm.providerName === providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}
