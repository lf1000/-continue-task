# Deployment Configuration Notes — Network Backstops

This document covers OS-level and VS Code-level configuration to enforce
network restrictions beyond the source-level changes in the fork.

## VS Code Built-in Sandbox Settings

```json
// settings.json (machine-level or policy)
{
  // Sandbox AI agent network access
  "chat.agent.sandbox.enabled": true,
  "chat.agent.allowedNetworkDomains": [],

  // Disable all external extension marketplace access
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "update.mode": "none",

  // Network filter (if available in your VS Code version)
  "chat.agent.networkFilter": "block-all"
}
```

## iptables / nftables Egress Rules

Scope network access to the extension host process to only the internal
model server IP:

### iptables (Linux)

```bash
# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow traffic to internal model server (e.g., Ollama on 10.0.1.50:11434)
iptables -A OUTPUT -d 10.0.1.50 -p tcp --dport 11434 -m owner --uid-owner $VSCODE_UID -j ACCEPT

# Block all other egress from the VS Code process
iptables -A OUTPUT -m owner --uid-owner $VSCODE_UID -j DROP
```

### nftables (Linux)

```bash
table inet vscode_filter {
  chain output {
    type filter hook output priority 0; policy accept;

    # Allow loopback
    oifname "lo" accept

    # Allow internal model server
    meta skuid $VSCODE_UID ip daddr 10.0.1.50 tcp dport 11434 accept

    # Block all other VS Code egress
    meta skuid $VSCODE_UID drop
  }
}
```

### Windows Firewall (PowerShell)

```powershell
# Allow loopback and internal model server
New-NetFirewallRule -DisplayName "Continue Extension - Allow Ollama" `
  -Direction Outbound `
  -Program "C:\path\to\code.exe" `
  -RemoteAddress 10.0.1.50 `
  -RemotePort 11434 `
  -Protocol TCP `
  -Action Allow

# Block all other outbound from VS Code
New-NetFirewallRule -DisplayName "Continue Extension - Block Egress" `
  -Direction Outbound `
  -Program "C:\path\to\code.exe" `
  -Action Block
```

## Internal DNS Sinkhole

Configure the internal DNS resolver to only resolve the model server hostname:

```
# /etc/dnsmasq.conf or equivalent
# Only resolve the internal model server
address=/ollama.internal.corp/10.0.1.50

# Return NXDOMAIN for everything else
server=/api.openai.com/
server=/api.anthropic.com/
server=/api.mistral.ai/
```

Or use a dedicated DNS zone that only contains:

```
ollama.internal.corp.  IN  A  10.0.1.50
```

All other queries return NXDOMAIN, providing a network-level backstop
that complements the source-level allowlist.

## Network Architecture Summary

```
┌─────────────────────────────────────────┐
│          Air-Gapped Workstation         │
│                                         │
│  ┌──────────┐    ┌───────────────────┐  │
│  │ VS Code  │───>│ Continue Fork     │  │
│  │          │    │ (allowlist active) │  │
│  └──────────┘    └──────┬────────────┘  │
│                         │               │
│        iptables/nftables (egress gate)  │
│                         │               │
│                  ┌──────▼──────┐        │
│                  │  Ollama /   │        │
│                  │  vLLM       │        │
│                  │  (127.0.0.1 │        │
│                  │  or 10.x)   │        │
│                  └─────────────┘        │
│                                         │
│  ───── No route to public internet ──── │
└─────────────────────────────────────────┘
```
