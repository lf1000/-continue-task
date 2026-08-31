# PR: Air-Gapped Network Hardening — Continue.dev Fork

**Branch:** `main`  
**Status:** Complete — all external URL access removed/blocked across 5 independent defense layers  

---

## Executive Summary

This fork hardens Continue.dev into a strictly air-gapped VS Code plugin suitable for classified or air-gapped environments. External network access is:
1. **Removed** from source code (cloud providers, telemetry, external URLs eliminated)
2. **Blocked** at runtime via fail-closed socket and fetch interceptors
3. **Rejected** at configuration load time via strict allowlists
4. **Audited** with dual rotating file logs and a live VS Code dashboard
5. **Guarded** by static analysis Semgrep rules in CI

Each layer operates independently so that even if one layer is bypassed or misconfigured, subsequent layers prevent data exfiltration.

---

## Layer 1: Runtime Network Interceptor (Fail-Closed Gate)

> Every outbound socket connection and `fetch()` call is intercepted and checked against an internal-only allowlist. Non-matching hosts are **blocked immediately with a fatal security exception**.

### [NEW] [`core/util/networkInterceptor.ts`](core/util/networkInterceptor.ts)
*Commits: `29553f6` (base interceptor) + `580c49d` (streamChat & customFetch routing)*

- **`gateRequest(hostname, sourceModule)`**: Core gate function. Checks the destination host against RFC 1918 / loopback allowlists. Throws `[SECURITY] Outbound connection to "<host>" blocked by network allowlist` on failure.
- **`GatedHttpAgent` & `GatedHttpsAgent`**: Subclasses of Node's `http.Agent` and `https.Agent` overriding `createConnection()`. Instantly destroys any socket targeting a non-allowlisted host. Patched into `http.globalAgent` and `https.globalAgent`.
- **`gatedFetch()`** wrapper + monkey-patched `globalThis.fetch`: Transparently gates standard HTTP requests.
- **`testBlock()`**: Built-in self-test attempting a request to `https://example.com/test-block` to verify the interceptor is actively enforcing.
- **`networkEvents`**: Shared `EventEmitter` forwarding audit records to the UI dashboard.

### [MODIFY] [`core/llm/index.ts`](core/llm/index.ts#L450-L455)
*Commit: `580c49d`*

```diff
+ import { gateRequest, extractHostname } from "../util/networkInterceptor.js";
  ...
  fetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const customFetch = async (input: URL | RequestInfo, init: any) => {
      try {
+       const hostname = extractHostname(input as any);
+       gateRequest(hostname, "BaseLLM.fetch");
        const resp = await fetchwithRequestOptions(
          new URL(input as any),
          { ...init },
          { ...this.requestOptions },
        );
```
Every `BaseLLM.fetch()` call — the primary transport for all model interactions — is explicitly gated before dispatching requests.

### [MODIFY] [`core/llm/streamChat.ts`](core/llm/streamChat.ts#L2)
*Commit: `580c49d`*

```diff
+ import { gateRequest, extractHostname } from "../util/networkInterceptor";
  ...
  fetch: (url, init) => {
+   gateRequest(extractHostname(url as any), "llm.streamChat");
    return fetchwithRequestOptions(
      url,
      { ...init, signal: abortController.signal },
      model.requestOptions,
    );
  }
```
Ensures slash-command runtime tools and subroutines are strictly confined to internal endpoints.

### [NEW] [`core/config/networkInterceptor.vitest.ts`](core/config/networkInterceptor.vitest.ts)
*Commit: `29553f6`*

12 automated unit tests validating:
- Rejection of external domains (`api.openai.com`, `example.com`)
- Acceptance of loopback (`127.0.0.1`, `localhost`) and private IPs (`10.x`, `172.16.x`, `192.168.x`)
- Proper emission of `connection_blocked` and `connection_allowed` log events
- Socket termination by `GatedHttpAgent` and `GatedHttpsAgent`

---

## Layer 2: Config-Time Validation (Allowlist & Provider Gates)

> Model definitions in both JSON (`config.json`) and YAML (`config.yaml`) are validated before activation. Any configuration pointing to external hosts or unauthorized cloud providers is **rejected at startup**.

### [NEW] [`core/config/allowlist.ts`](core/config/allowlist.ts)
*Commits: `29553f6` + `0b53430`*

- **Internal CIDR Matching**: Validates IPv4 addresses against loopback (`127.0.0.0/8`), Class A private (`10.0.0.0/8`), Class B private (`172.16.0.0/12`), Class C private (`192.168.0.0/16`), and link-local (`169.254.0.0/16`).
- **`isAllowedHost(hostname)` / `isAllowedUrl(url)`**: Rejects public IPs and fully qualified domain names not explicitly listed in `ALLOWED_HOSTNAMES` or the `CONTINUE_ALLOWED_HOSTS` environment variable.
- **`validateApiBase(apiBase, roleName)`**: Throws descriptive `[SECURITY] Configuration rejected` errors if an `apiBase` points to an external server.
- **`validateProvider(provider, roleName)`**: Enforces strict allowlist of approved local inference backends: `ollama`, `vllm`, `llama.cpp`, `llamafile`, `llama-stack`, `lmstudio`, `lemonade`, `text-gen-webui`, `msty`, `docker`, `mock`, `test`.
- **`validateModelConfig(config, roleName)`**: Combined entry point used across configuration parsers.

### [MODIFY] [`core/config/validation.ts`](core/config/validation.ts)
*Commits: `29553f6` + `4837f67`*

```diff
+ import { validateModelConfig } from "./allowlist.js";
```

Integrates `validateModelConfig()` across every model role during configuration loading:
- **Chat Models (`models[]`)**: Lines 37–47
- **Autocomplete Models (`tabAutocompleteModel`)**: Lines 90–97 & Lines 101–111
- **Embeddings Provider (`embeddingsProvider`)**: Lines 170–176
- **Reranker (`reranker`)**: Lines 190–198

### [MODIFY] [`core/config/yaml/loadYaml.ts`](core/config/yaml/loadYaml.ts#L41)
*Commit: `0b53430`*

```diff
+ import { validateModelConfig } from "../allowlist";
  ...
  for (const model of config.models ?? []) {
+   validateModelConfig(
+     { provider: model.provider, apiBase: (model as any).apiBase },
+     model.name || model.model || "model",
+   );
```
Binds the YAML configuration pipeline to the security validator, guaranteeing parity regardless of which configuration format is used.

### [NEW] [`core/config/allowlist.vitest.ts`](core/config/allowlist.vitest.ts)
*Commit: `29553f6`*

22 unit tests validating allowlist boundary conditions, RFC 1918 subnets, provider gating, and end-to-end `validateConfig()` rejection of cloud configurations.

---

## Layer 3: Source Code Sanitization (GUI & Onboarding)

> All cloud provider presets, API key configuration options, and external documentation/marketing links have been purged from the UI.

### [MODIFY] [`gui/src/pages/AddNewModel/configs/providers.ts`](gui/src/pages/AddNewModel/configs/providers.ts)
*Commits: `29553f6` + `f8d6e67`*

- **Removed ~20+ cloud provider definitions**: OpenAI, Anthropic, Mistral, Gemini, Cohere, Groq, Together, Fireworks, DeepInfra, Replicate, Bedrock, Azure, OpenRouter, Voyage, WatsonX, VertexAI, etc.
- **Retained strictly local inference options (8 total)**: Ollama, LM Studio, vLLM, Llama.cpp, Llamafile, Llama Stack, Docker Model Runner, and Text Generation WebUI.
- Sanitized default `apiBase` configurations to point to `localhost` ports (`11434`, `1234`, `8000`, `8080`, `8321`, `12434`, `5000`).

### [MODIFY] [`gui/src/components/OnboardingCard/OnboardingCard.tsx`](gui/src/components/OnboardingCard/OnboardingCard.tsx)
*Commit: `eb265fa`*

- Removed the external "API Key" tab from the initial user onboarding flow.
- Configured onboarding to default directly to the local model setup.

### [MODIFY] [`gui/src/components/OnboardingCard/components/OnboardingProvidersTab.tsx`](gui/src/components/OnboardingCard/components/OnboardingProvidersTab.tsx)
*Commit: `f8d6e67`*

- Restricted selectable onboarding providers to `ollama`, `lmstudio`, and `vllm`.

---

## Layer 4: Security Audit Logging & Live Dashboard

> Detailed audit logs capture every connection attempt, allow/block verdict, source module, and caller stack.

### [NEW] [`core/util/securityLogger.ts`](core/util/securityLogger.ts)
*Commit: `29553f6`*

- **`SecurityEvent` schema**: `timestamp`, `eventType` (`connection_allowed`, `connection_blocked`, `config_rejected`, `startup`, `config_loaded`, `interceptor_active`), `target`, `verdict`, `sourceModule`, `callerStack`, `sessionId`.
- **Dual Rotating File Transports**:
  - `combined-activity-YYYY-MM-DD.jsonl` (7-day retention)
  - `connection-activity-YYYY-MM-DD.jsonl` (30-day retention for compliance)
- **Ring Buffer (500 events)**: In-memory circular buffer for instant webview hydration.
- **Automatic Redaction**: Scrubbing regex patterns for tokens, keys, authorization headers, and large payload dumps.

### [NEW] [`extensions/vscode/src/connectionActivityPanel.ts`](extensions/vscode/src/connectionActivityPanel.ts)
*Commits: `71b69e1`, `dd247d1`, `646afc1`, `7dacc1c`, `3142769`*

VS Code webview monitoring panel providing:
- Real-time tabular log of all socket/fetch events (color-coded verdicts)
- Live metric cards (Allowed vs. Blocked counters)
- Interactive Chart.js timeline tracking connection attempts
- Top-hosts distribution table
- Interactive "Test Block" diagnostic button

### [MODIFY] [`extensions/vscode/src/activation/activate.ts`](extensions/vscode/src/activation/activate.ts#L37)
*Commit: `71b69e1`*

Registers `registerConnectionActivityPanel(context)` during extension startup.

### [MODIFY] [`extensions/vscode/package.json`](extensions/vscode/package.json#L155)
*Commit: `dd247d1`*

Contributes the `continue.showConnectionActivity` command to the VS Code Command Palette.

---

## Layer 5: Static Analysis Rules & CI Gate

### [NEW] [`rules/no-external-url.yaml`](rules/no-external-url.yaml)
*Commit: `29553f6`*

Automated Semgrep rules preventing regressions during development:
- **`no-external-urls`**: Flags any raw `http://` or `https://` literals in production source code (`core/`, `extensions/`, `gui/`, `packages/`).
- **`no-cloud-provider-domains`**: Scans for known cloud API endpoints (`api.openai.com`, `api.anthropic.com`, `posthog.com`, `sentry.io`, etc.).
- **`no-telemetry-imports`**: Detects references or imports to PostHog, Sentry, or telemetry utilities.

---

## Supporting Changes & Cleanups

- **[`core/__mocks__/@continuedev/openai-adapters/index.ts`](core/__mocks__/@continuedev/openai-adapters/index.ts)** (`29553f6`): Test stub preventing unit tests from importing cloud adapter dependencies.
- **[`core/context/mcp/MCPManagerSingleton.ts`](core/context/mcp/MCPManagerSingleton.ts)** (`3a3d7d1`): Safe stub implementation preventing unexpected outbound Model Context Protocol network activity.
- **[`docs/DEPLOYMENT-NETWORK-CONFIG.md`](docs/DEPLOYMENT-NETWORK-CONFIG.md)** (`29553f6`): Enterprise deployment guide covering OS-level network backstops (iptables, nftables, Windows Defender Firewall, and VS Code network isolation settings).
- **[`TEST_REPORT.md`](TEST_REPORT.md)** (`adf4358`): Full verification report detailing test procedures, validation commands, and test results.

---

## Commit Reference Table

| Commit | Description | Primary Layer |
|:---|:---|:---|
| `29553f6` | Base hardened air-gapped fork implementation | Layers 1, 2, 3, 4, 5 |
| `580c49d` | Route `BaseLLM.fetch` and `streamChat` through `gateRequest` | Layer 1 (Runtime Interceptor) |
| `0b53430` | Connect YAML config loader to `validateModelConfig` | Layer 2 (Config Validation) |
| `4837f67` | Emit `config_rejected` security events to Connection Monitor | Layer 2 & 4 (Validation & Audit) |
| `f8d6e67` | Fix AddModelForm and OnboardingCard for local providers | Layer 3 (Source Sanitization) |
| `eb265fa` | Remove API Key tab from onboarding flow | Layer 3 (Source Sanitization) |
| `3a3d7d1` | Stub MCP manager singleton to prevent remote connections | Layer 1 (Runtime Protection) |
| `71b69e1` | Register Connection Activity dashboard in extension activation | Layer 4 (Audit Dashboard) |
| `dd247d1` | Register `continue.showConnectionActivity` command | Layer 4 (Audit Dashboard) |
| `646afc1` | Style INFO verdicts in Connection Activity Monitor | Layer 4 (Audit Dashboard) |
| `7dacc1c` | Style ERROR verdicts in Connection Activity Monitor | Layer 4 (Audit Dashboard) |
| `3142769` | Fix real-time rendering of chart and event tables | Layer 4 (Audit Dashboard) |

---

## File Summary

```
 NEW   core/config/allowlist.ts                              250 lines  ← Allowlist validator
 NEW   core/config/allowlist.vitest.ts                        236 lines  ← Allowlist unit tests
 NEW   core/config/networkInterceptor.vitest.ts               122 lines  ← Interceptor unit tests
 NEW   core/util/networkInterceptor.ts                        229 lines  ← Runtime socket & fetch gate
 NEW   core/util/securityLogger.ts                            268 lines  ← Audit logger & ring buffer
 NEW   core/__mocks__/@continuedev/openai-adapters/index.ts    23 lines  ← Air-gapped test stub
 NEW   extensions/vscode/src/connectionActivityPanel.ts       504 lines  ← Webview audit dashboard
 NEW   rules/no-external-url.yaml                              73 lines  ← Semgrep CI rules
 NEW   docs/DEPLOYMENT-NETWORK-CONFIG.md                      128 lines  ← OS firewall deployment guide
 NEW   TEST_REPORT.md                                         137 lines  ← Formal security test report
 NEW   PR_DIFF_SUMMARY.md                                                ← This document
 MOD   core/config/validation.ts                                         ← Integrated allowlist checks
 MOD   core/config/yaml/loadYaml.ts                                      ← YAML allowlist checks
 MOD   core/llm/index.ts                                                 ← BaseLLM.fetch gating
 MOD   core/llm/streamChat.ts                                            ← streamChat gating
 MOD   core/context/mcp/MCPManagerSingleton.ts                           ← Outbound connection stub
 MOD   gui/src/pages/AddNewModel/configs/providers.ts                    ← Cloud providers removed
 MOD   gui/src/components/OnboardingCard/OnboardingCard.tsx              ← API Key tab removed
 MOD   gui/src/components/OnboardingCard/.../OnboardingProvidersTab.tsx   ← Local-only providers
 MOD   extensions/vscode/src/activation/activate.ts                      ← Panel registration
 MOD   extensions/vscode/package.json                                    ← Command contribution
```
