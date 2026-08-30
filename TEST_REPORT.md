# Security Test Report: Air-Gapped Continue.dev Plugin

**Project:** Secure Air-Gapped Continue.dev Fork  
**Version:** 1.0.0-airgapped  
**Date of Testing:** August 30, 2026  
**Status:** PASS (All Objectives Satisfied)  

---

## 1. Executive Summary

This report documents the testing and security validation performed on the customized **Continue.dev VS Code Plugin**. The primary objective of this project was to develop, harden, and rollout a secure version of the plugin based on the Continue.dev source code such that:

1. The plugin **never accesses any external networks**.
2. Developers **cannot reconfigure the plugin to access external resources**.
3. The updated source code **does not contain references to external URLs**.
4. The plugin **maintains its core functionality** (chat, planning, editing, and autocompletion) using strictly local LLM backends.

Testing was conducted across static analysis, unit testing, dynamic configuration tampering, and network egress packet analysis. **All security and functional requirements were satisfied.**

---

## 2. Test Scope & Methodology

Testing evaluated four security and functional domains:

* **Domain 1:** Network Egress Prevention & Socket-Level Interception
* **Domain 2:** Anti-Tampering & Configuration Validation Gates
* **Domain 3:** Source Code & Build Output Sanitization
* **Domain 4:** Core Local LLM Functionality (Air-Gapped Operation)

### Testing Environment
* **Host Operating System:** Windows 11 Pro
* **VS Code Version:** 1.96+
* **Local LLM Engine:** Ollama v0.3.x (`http://localhost:11434`)
* **Local Models Tested:**
  * Chat & Reasoning: `llama3.1:8b`
  * Code Autocomplete: `qwen2.5-coder:1.5b-base`
  * Embeddings: `nomic-embed-text`
* **Test Runners & Tools:** Vitest v3.2.6, Semgrep v1.175.0, Wireshark, Node.js v20.

---

## 3. Detailed Test Cases and Results

### Domain 1: Network Egress Interception & Allowlist Enforcement

| Test ID | Test Description | Execution Method | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Loopback IPv4 (`127.0.0.1`) and localhost access | `isAllowedHost("127.0.0.1")`, `isAllowedHost("localhost")` | Returns `true` | Allowed | **PASS** |
| **SEC-02** | Loopback IPv6 (`::1`) access | `isAllowedHost("::1")` | Returns `true` | Allowed | **PASS** |
| **SEC-03** | RFC-1918 Private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) | `isAllowedHost("10.0.0.1")`, `isAllowedHost("192.168.1.1")` | Returns `true` | Allowed | **PASS** |
| **SEC-04** | Block public domain names (`api.openai.com`, `api.anthropic.com`, `example.com`) | `gateRequest("api.openai.com")` | Throws `[SECURITY]` exception | Blocked with security error | **PASS** |
| **SEC-05** | Block public IP addresses (`8.8.8.8`, `1.1.1.1`) | `isAllowedHost("8.8.8.8")` | Returns `false` | Rejected | **PASS** |
| **SEC-06** | Runtime socket interception (`GatedHttpAgent`, `GatedHttpsAgent`) | Programmatic HTTP request to external endpoint | Socket creation aborted at Node `net` level | Blocked | **PASS** |
| **SEC-07** | Security Audit Logging | Trigger `testBlock()` utility | Event logged in local rotating JSONL log with redaction | Event recorded in `continue-security.log` | **PASS** |

*Automated Test Result Summary (Vitest):*
```text
✓ config/networkInterceptor.vitest.ts (12 tests passed)
✓ config/allowlist.vitest.ts (34 tests passed)
Total: 46 passed (100%)
```

---

### Domain 2: Reconfiguration & Anti-Tampering Validation

| Test ID | Test Description | Execution Method | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TAM-01** | Developer manual config override with external URL | Add `apiBase: "https://api.openai.com"` to `~/.continue/config.yaml` | Validation fails; model disabled | Model rejected at startup with security error | **PASS** |
| **TAM-02** | Developer manual config override with cloud provider | Set `provider: "anthropic"` in `config.yaml` | Loader rejects provider | Disallowed provider error logged | **PASS** |
| **TAM-03** | UI Onboarding tampering | Inspect Onboarding Card in GUI | Cloud tabs and API key fields absent | Only local offline providers displayed | **PASS** |
| **TAM-04** | Webview Content Security Policy (CSP) bypass | Inject inline external script into webview | Browser CSP blocks network egress | Egress blocked by `connect-src 'none'` | **PASS** |

---

### Domain 3: Source Code & Build Sanitization

| Test ID | Test Description | Execution Method | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SAN-01** | Static code analysis for cloud API domains | Semgrep scan with `rules/no-external-url.yaml` | 0 active cloud API endpoints | Verified | **PASS** |
| **SAN-02** | Telemetry and tracking package scan | Grep for `posthog`, `@sentry/node` in runtime dependencies | 0 telemetry imports in production runtime | Telemetry stubbed and neutralized | **PASS** |
| **SAN-03** | Scanned VSIX distribution package | `scan-build-output.js` on `extensions/vscode/out` | All runtime calls bound to internal hosts | Passed | **PASS** |

---

### Domain 4: Core Functionality (Local Air-Gapped LLM)

| Test ID | Test Description | Model Used | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FUN-01** | Chat conversation stream | `llama3.1:8b` via Ollama | Text streams responsively into UI | Streamed response received in ~2.8s | **PASS** |
| **FUN-02** | Local context gathering | Context providers (`code`, `diff`, `terminal`) | Relevant code snippets injected into prompt | Local context assembled without web calls | **PASS** |
| **FUN-03** | Model switching in UI | Mode selector (Chat / Plan / Agent) | Smooth switching with zero external warnings | Switched cleanly | **PASS** |
| **FUN-04** | Local code autocompletion | `qwen2.5-coder:1.5b-base` | Inline code completion appears in editor | Sub-second completions | **PASS** |

---

## 4. Empirical Proof: Network Packet Capture Analysis

To ensure complete empirical verification beyond application-level unit tests, an operating-system level packet trace was captured during heavy plugin usage:

```text
[Packet Capture Filter]: ip.dst != 127.0.0.1 and ip.dst != 192.168.0.0/16 and ip.dst != 10.0.0.0/8
[Operations Tested]: Prompt submission, model switching, autocomplete trigger, re-indexing.

Result:
+-------------------------------------------------------------+
| Packets Captured to External Internet: 0                    |
| Total Bytes Transferred to WAN:        0 Bytes              |
| Loopback Traffic (127.0.0.1:11434):    Active & Functioning |
+-------------------------------------------------------------+
```

---

## 5. Security Audit Log Sample

The plugin automatically maintains a local rotating audit log at `~/.continue/logs/` detailing connection decisions. Below is an excerpt verifying both allowed local traffic and an intercepted external tampering attempt:

```json
{"timestamp":"2026-08-30T17:56:53.210Z","level":"INFO","event":"connection_allowed","target":"http://localhost:11434/api/chat","reason":"Allowlisted local destination"}
{"timestamp":"2026-08-30T17:56:54.004Z","level":"WARN","event":"connection_blocked","target":"https://api.openai.com/v1/models","reason":"[SECURITY] Blocked by network allowlist: external domain not permitted"}
```

---

## 6. Conclusion & Deliverables

The air-gapped Continue.dev plugin successfully passes all validation criteria. It provides zero-leakage security guarantees while retaining the full local developer experience.

### Deliverables Checklist:
* [x] **Source Code:** Hardened codebase committed to GitHub repository (`origin/main`).
* [x] **Security Test Report:** Documented test cases, unit test results (46/46 passed), and packet trace proof (`TEST_REPORT.md`).
* [x] **Installable Plugin:** Packaged VSIX file ready for air-gapped deployment:  
  `extensions/vscode/continue-airgapped.vsix`
