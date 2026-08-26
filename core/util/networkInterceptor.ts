/**
 * Runtime network interceptor for the air-gapped Continue fork.
 *
 * Provides:
 * 1. GatedHttpAgent & GatedHttpsAgent — intercepts socket creation via createConnection()
 * 2. gatedFetch — wrapped fetch checking all outbound destinations against the internal allowlist
 * 3. Patches http.globalAgent and https.globalAgent
 * 4. Shared EventEmitter for connection audit logs
 */

import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as tls from "tls";
import { EventEmitter } from "events";
import { isAllowedHost } from "../config/allowlist";
import securityLogger, { SecurityEvent } from "./securityLogger";

// ── Shared event bus ────────────────────────────────────────────────────
export const networkEvents = new EventEmitter();
networkEvents.setMaxListeners(100);

// Forward logger events to the shared bus
securityLogger.events.on("security_event", (event: SecurityEvent) => {
  networkEvents.emit("security_event", event);
});

// ── Helpers ─────────────────────────────────────────────────────────────

function getCallerStack(): string {
  const stack = new Error().stack || "";
  return stack.split("\n").slice(3, 6).join(" | ");
}

/**
 * Gate function — checks a hostname against the allowlist.
 * Throws immediately if the host is not allowed (fail-closed).
 */
export function gateRequest(hostname: string, sourceModule: string): void {
  if (isAllowedHost(hostname)) {
    securityLogger.log(
      "connection_allowed",
      hostname,
      "allowed",
      sourceModule,
      getCallerStack(),
    );
  } else {
    securityLogger.log(
      "connection_blocked",
      hostname,
      "blocked",
      sourceModule,
      getCallerStack(),
    );
    throw new Error(
      `[SECURITY] Outbound connection to "${hostname}" blocked by network allowlist. ` +
        `Only internal/local addresses are permitted in this air-gapped environment.`,
    );
  }
}

/**
 * Extract hostname from a URL string, URL object, or Request object.
 */
export function extractHostname(input: string | URL | Request): string {
  if (typeof input === "string") {
    try {
      return new URL(input).hostname;
    } catch {
      return input;
    }
  }
  if (input instanceof URL) {
    return input.hostname;
  }
  if (typeof input === "object" && "url" in input) {
    try {
      return new URL(input.url).hostname;
    } catch {
      return String(input.url);
    }
  }
  return "unknown";
}

// ── Custom Gated HTTP/HTTPS Agents ──────────────────────────────────────

export class GatedHttpAgent extends http.Agent {
  override createConnection(
    options: http.ClientRequestArgs,
    callback?: (err: Error | null, stream: net.Socket) => void,
  ): net.Socket {
    const host = options.hostname || options.host || "localhost";
    try {
      gateRequest(host, "http.Agent");
    } catch (err: any) {
      if (callback) {
        callback(err, null as any);
      }
      const socket = new net.Socket();
      socket.on("error", () => {});
      process.nextTick(() => socket.destroy(err));
      return socket;
    }
    return super.createConnection(options, callback);
  }
}

export class GatedHttpsAgent extends https.Agent {
  override createConnection(
    options: https.RequestOptions,
    callback?: (err: Error | null, stream: tls.TLSSocket) => void,
  ): tls.TLSSocket {
    const host = options.hostname || options.host || "localhost";
    try {
      gateRequest(host, "https.Agent");
    } catch (err: any) {
      if (callback) {
        callback(err, null as any);
      }
      const rawSocket = new net.Socket();
      rawSocket.on("error", () => {});
      const socket = new tls.TLSSocket(rawSocket);
      socket.on("error", () => {});
      process.nextTick(() => socket.destroy(err));
      return socket;
    }
    return super.createConnection(options, callback as any);
  }
}

// Set global agents
try {
  Object.defineProperty(http, "globalAgent", {
    value: new GatedHttpAgent(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(https, "globalAgent", {
    value: new GatedHttpsAgent(),
    writable: true,
    configurable: true,
  });
} catch (e) {
  // Ignore in restricted environments
}

/**
 * A gated fetch wrapper. Use this instead of global fetch to ensure
 * all outbound requests are checked against the allowlist.
 */
export async function gatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const hostname = extractHostname(input as any);
  gateRequest(hostname, "fetch");
  return globalThis.fetch(input, init);
}

// ── Attempt to patch global fetch ───────────────────────────────────────
const _originalFetch = globalThis.fetch;

if (typeof _originalFetch === "function") {
  try {
    const patchedFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const hostname = extractHostname(input as any);
      gateRequest(hostname, "fetch");
      return _originalFetch.call(globalThis, input, init);
    };

    globalThis.fetch = patchedFetch as typeof fetch;
  } catch {
    try {
      Object.defineProperty(globalThis, "fetch", {
        value: async (input: RequestInfo | URL, init?: RequestInit) => {
          const hostname = extractHostname(input as any);
          gateRequest(hostname, "fetch");
          return _originalFetch.call(globalThis, input, init);
        },
        writable: true,
        configurable: true,
      });
    } catch {
      console.warn(
        "[NetworkInterceptor] Could not patch globalThis.fetch — " +
          "use gatedFetch() wrapper at call sites instead.",
      );
    }
  }
}

// ── Test utility ────────────────────────────────────────────────────────

/**
 * Deliberately attempts a gated fetch against an external URL to demonstrate
 * the network interceptor blocking it. Returns the block confirmation message
 * if the block worked correctly.
 */
export async function testBlock(): Promise<string> {
  try {
    await gatedFetch("https://example.com/test-block");
    throw new Error(
      "CRITICAL: External request was NOT blocked! Interceptor may not be active.",
    );
  } catch (err: any) {
    if (err.message.includes("[SECURITY]")) {
      return `✓ Block confirmed: ${err.message}`;
    }
    throw err;
  }
}

// ── Log interceptor activation ──────────────────────────────────────────

securityLogger.log(
  "interceptor_active",
  "all-transports",
  "info",
  "networkInterceptor",
  "Module loaded at extension startup with GatedHttpAgent & GatedHttpsAgent",
);

export { networkEvents as default };
