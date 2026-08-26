import { HTMLInputTypeAttribute } from "react";
import { ModelProviderTags } from "../../../components/modelSelection/utils";
import { completionParamsInputs } from "./completionParamsInputs";
import type { ModelPackage } from "./models";
import { models } from "./models";

export interface InputDescriptor {
  inputType: HTMLInputTypeAttribute;
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  required?: boolean;
  description?: string;
  [key: string]: any;
}

export interface ProviderInfo {
  title: string;
  icon?: string;
  provider: string;
  description: string;
  longDescription?: string;
  tags?: ModelProviderTags[];
  packages: ModelPackage[];
  popularPackages?: ModelPackage[];
  params?: any;
  collectInputFor?: InputDescriptor[];
  refPage?: string;
  apiKeyUrl?: string;
  downloadUrl?: string;
}

const completionParamsInputsConfigs = Object.values(completionParamsInputs);

const openSourceModels = Object.values(models).filter(
  ({ isOpenSource }) => isOpenSource,
);

export const ollamaStaticModels = Object.values(models).filter(
  ({ providerOptions }) => providerOptions?.includes("ollama"),
);

export const apiBaseInput: InputDescriptor = {
  inputType: "text",
  key: "apiBase",
  label: "API Base",
  placeholder: "e.g. http://localhost:8080",
  required: false,
};

// ── AIR-GAPPED LOCAL PROVIDERS ONLY ─────────────────────────────────────
// All external cloud provider entries and URLs have been removed.
export const providers: Partial<Record<string, ProviderInfo>> = {
  ollama: {
    title: "Ollama",
    provider: "ollama",
    description: "Run models locally on your machine with Ollama",
    longDescription:
      "Ollama allows you to run open-source large language models locally on your machine.",
    icon: "ollama.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
      ...openSourceModels.slice(0, 15),
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:11434",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  lmstudio: {
    title: "LM Studio",
    provider: "lmstudio",
    description: "Run models locally on your machine with LM Studio",
    longDescription:
      "LM Studio lets you run local LLMs and provides a local OpenAI-compatible server.",
    icon: "lmstudio.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
      ...openSourceModels.slice(0, 10),
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:1234/v1/",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  vllm: {
    title: "vLLM",
    provider: "vllm",
    description: "High-throughput and memory-efficient local LLM inference engine",
    longDescription: "Connect to a locally hosted vLLM model inference server.",
    icon: "vllm.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
      ...openSourceModels.slice(0, 10),
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:8000/v1/",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  llamacpp: {
    title: "Llama.cpp",
    provider: "llama.cpp",
    description: "Port of Facebook's LLaMA model in C/C++",
    longDescription: "Connect to a local llama.cpp server instance.",
    icon: "llamacpp.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
      ...openSourceModels.slice(0, 5),
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:8080",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  llamafile: {
    title: "Llamafile",
    provider: "llamafile",
    description: "Distribute and run LLMs with a single executable",
    longDescription: "Connect to a local llamafile server.",
    icon: "llamafile.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:8080",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  llamastack: {
    title: "Llama Stack",
    provider: "llamastack",
    description: "Meta Llama Stack local distribution",
    longDescription: "Connect to a local Llama Stack server instance.",
    icon: "llamastack.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:8321/v1/openai/v1/",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  docker: {
    title: "Docker Model Runner",
    provider: "docker",
    description: "Run local models directly within Docker Desktop",
    longDescription: "Integrates with Docker Desktop local model runner.",
    icon: "docker.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:12434/engines/v1/",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  textGenWebUI: {
    title: "Text Generation WebUI",
    provider: "text-gen-webui",
    description: "A Gradio web UI for Large Language Models",
    longDescription: "Connect to a local Text Generation WebUI instance.",
    icon: "textGenWebUI.png",
    tags: [ModelProviderTags.Local],
    packages: [
      models.AUTODETECT,
    ],
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:5000/v1",
      },
      ...completionParamsInputsConfigs,
    ],
  },
};
