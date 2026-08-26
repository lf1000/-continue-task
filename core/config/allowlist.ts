/**
 * Network allowlist validator for the air-gapped Continue fork.
 *
 * Validates that all apiBase URLs and hostnames resolve to internal/local
 * network addresses only. Used both at config-load time and at runtime
 * by the network interceptor.
 */

import { URL } from "url";
import * as net from "net";

// ── Internal network patterns ──────────────────────────────────────────
// These match RFC 1918, loopback, and link-local ranges.
const INTERNAL_CIDR_PATTERNS: Array<{ prefix: number[]; mask: number }> = [
  // 127.0.0.0/8  — loopback
  { prefix: [127], mask: 8 },
  // 10.0.0.0/8   — Class A private
  { prefix: [10], mask: 8 },
  // 172.16.0.0/12 — Class B private
  { prefix: [172, 16], mask: 12 },
  // 192.168.0.0/16 — Class C private
  { prefix: [192, 168], mask: 16 },
  // 169.254.0.0/16 — link-local
  { prefix: [169, 254], mask: 16 },
];

const ALLOWED_HOSTNAMES: Set<string> = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

// Optional: additional allowed hostnames from environment
const ENV_ALLOWED_HOSTS = process.env.CONTINUE_ALLOWED_HOSTS;
if (ENV_ALLOWED_HOSTS) {
  ENV_ALLOWED_HOSTS.split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0)
    .forEach((h) => ALLOWED_HOSTNAMES.add(h));
}

/**
 * Check if an IPv4 address string falls within any of the internal CIDR ranges.
 */
function isInternalIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) {
    return false;
  }
  const octets = ip.split(".").map(Number);

  for (const cidr of INTERNAL_CIDR_PATTERNS) {
    const prefixLen = cidr.mask;
    const fullOctets = Math.floor(prefixLen / 8);
    const remainingBits = prefixLen % 8;

    let match = true;
    for (let i = 0; i < fullOctets && i < 4; i++) {
      if (octets[i] !== cidr.prefix[i]) {
        match = false;
        break;
      }
    }

    if (match && remainingBits > 0 && fullOctets < 4) {
      const mask = 0xff << (8 - remainingBits);
      const expected = (cidr.prefix[fullOctets] ?? 0) & mask;
      if ((octets[fullOctets] & mask) !== expected) {
        match = false;
      }
    }

    if (match) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a hostname is in the allowlist.
 * Matches explicit hostnames and internal IP addresses.
 */
export function isAllowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Direct hostname match
  if (ALLOWED_HOSTNAMES.has(lower)) {
    return true;
  }

  // IPv4 range check
  if (net.isIPv4(lower) && isInternalIPv4(lower)) {
    return true;
  }

  // IPv6 loopback
  if (lower === "::1" || lower === "[::1]") {
    return true;
  }

  return false;
}

/**
 * Validate a full URL string. Returns true only if the hostname
 * portion resolves to an allowed internal address.
 */
export function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return isAllowedHost(parsed.hostname);
  } catch {
    // If the URL can't be parsed, reject it
    return false;
  }
}

/**
 * Validate an apiBase URL at config-load time.
 * Throws a descriptive error if the URL points to a non-internal host.
 *
 * @param apiBase - The apiBase URL to validate
 * @param roleName - The model role (chat, edit, autocomplete, etc.) for error messaging
 * @throws Error if the URL is not on the internal allowlist
 */
export function validateApiBase(apiBase: string, roleName: string): void {
  if (!apiBase) {
    return; // Empty apiBase will use provider defaults which are local
  }

  if (!isAllowedUrl(apiBase)) {
    let hostname: string;
    try {
      hostname = new URL(apiBase).hostname;
    } catch {
      hostname = apiBase;
    }

    throw new Error(
      `[SECURITY] Configuration rejected: apiBase "${apiBase}" for model role "${roleName}" ` +
        `points to non-internal host "${hostname}". ` +
        `Only internal network addresses (localhost, 127.0.0.1, 10.x.x.x, 172.16-31.x.x, 192.168.x.x) ` +
        `and hosts listed in CONTINUE_ALLOWED_HOSTS are permitted. ` +
        `Configure your local model server (Ollama, vLLM, LM Studio) and use its internal address.`,
    );
  }
}

/**
 * Validate a provider name against the list of allowed local-only providers.
 * Throws if the provider is a cloud-only service.
 */
const ALLOWED_PROVIDERS = new Set([
  "ollama",
  "vllm",
  "llama.cpp",
  "llamafile",
  "llama-stack",
  "lmstudio",
  "lemonade",
  "text-gen-webui",
  "msty",
  "docker",
  "mock",
  "test",
  "free-trial", // kept for local testing compatibility
]);

export function validateProvider(
  provider: string,
  roleName: string,
): void {
  if (!provider) {
    return;
  }
  const lower = provider.toLowerCase();
  if (!ALLOWED_PROVIDERS.has(lower)) {
    throw new Error(
      `[SECURITY] Configuration rejected: provider "${provider}" for model role "${roleName}" ` +
        `is not a permitted local provider. Allowed providers: ${Array.from(ALLOWED_PROVIDERS).join(", ")}. ` +
        `Use a local model server (Ollama, vLLM, LM Studio, etc.) instead.`,
    );
  }
}

/**
 * Validate a complete model configuration for a given role.
 */
export function validateModelConfig(
  config: { provider?: string; apiBase?: string },
  roleName: string,
): void {
  if (config.provider) {
    validateProvider(config.provider, roleName);
  }
  if (config.apiBase) {
    validateApiBase(config.apiBase, roleName);
  }
}

/**
 * Get a copy of the current allowed hostnames set (for testing/logging).
 */
export function getAllowedHostnames(): ReadonlySet<string> {
  return new Set(ALLOWED_HOSTNAMES);
}
