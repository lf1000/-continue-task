<h1 align="center">Continue</h1>

<p align="center">Pioneering open-source coding agent</p>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" /></a>
<a href="https://docs.continue.dev"><img src="https://img.shields.io/badge/Docs-docs.continue.dev-blue" /></a>
<a href="https://github.com/continuedev/continue/releases"><img src="https://img.shields.io/badge/Changelog-GitHub_Releases-blue" /></a>

</div>

<p align="center">
  <img src="media/github-readme.png" alt="Banner" />
</p>

## 🔒 Air-Gapped Secure Fork (Installable Plugin)

> **Deliverable:** Download the installable plugin from the [Releases page](https://github.com/lf1000/-continue-task/releases) (`continue-airgapped.vsix`).

### Quick Start & Installation

1. **Download:** Get [`continue-airgapped.vsix`](https://github.com/lf1000/-continue-task/releases/download/v0.1-poc/continue-airgapped.vsix) from the [latest release (v0.1-poc)](https://github.com/lf1000/-continue-task/releases/tag/v0.1-poc).
2. **Install in VS Code:**
   - In VS Code, open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Click the `...` menu in the top-right corner of the Extensions pane
   - Select **Install from VSIX...** and select `continue-airgapped.vsix`
   - *Or run via terminal:*
     ```bash
     code --install-extension continue-airgapped.vsix
     ```
3. **Local LLM Backend:** Ensure a local inference server is running (e.g. Ollama on `http://localhost:11434`, LM Studio on `http://localhost:1234`, or vLLM on `http://localhost:8000`).
4. **Connection Monitor:** Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run `Continue: Show Connection Activity` to view the live network audit dashboard.

### Security Documentation & Hardening Overview

- **[PR-Style Diff Summary](PR_DIFF_SUMMARY.md)**: Comprehensive breakdown of all 5 defense layers (Runtime Interceptor, Config Validation, Source Sanitization, Security Logging, Semgrep CI) with direct file links and commit references.
- **[Security Test Report](TEST_REPORT.md)**: Formal verification report covering network egress prevention, configuration anti-tampering, and local LLM performance.
- **[Deployment Network Config](docs/DEPLOYMENT-NETWORK-CONFIG.md)**: OS firewall rules (iptables, nftables, Windows Firewall) and VS Code sandbox policies.

---

## What is Continue?

## Final 2.0.0 Release

We polished Continue and did a final 2.0.0 release of the VS Code extension, CLI, and JetBrains plugin.

This included removing anonymous telemetry, pulling out authentication, squashing bugs, and more.

### VS Code

[![VS Code Marketplace](https://img.shields.io/badge/VS_Code_Marketplace-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=Continue.continue) [![OpenVSX Registry](https://img.shields.io/badge/OpenVSX_Registry-C160EF?logo=eclipseide&logoColor=white)](https://open-vsx.org/extension/Continue/continue) [![View source](https://img.shields.io/badge/View_source-181717?logo=github&logoColor=white)](extensions/vscode)

### CLI

[![npm](https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/@continuedev/cli) [![View source](https://img.shields.io/badge/View_source-181717?logo=github&logoColor=white)](extensions/cli)

### JetBrains

> _Note: We recommend using the Continue CLI instead of the JetBrains plugin._

[![GitHub Releases](https://img.shields.io/badge/GitHub_Releases-181717?logo=github&logoColor=white)](https://github.com/continuedev/continue/releases) [![View source](https://img.shields.io/badge/View_source-181717?logo=github&logoColor=white)](extensions/intellij)

## Contributors

Thank you to the entire Continue community for helping us create a pioneering coding agent.

What we built together pushed the boundaries of what AI developer tooling could be.

We hope this codebase continues to serve as a foundation for others.

## Code friends

<a href="https://github.com/continuedev/continue/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=continuedev/continue&max=500" />
</a>

## License

Apache 2.0 © 2023-2026 Continue Dev, Inc.
