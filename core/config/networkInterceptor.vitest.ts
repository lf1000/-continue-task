/**
 * Tests for the network interceptor.
 * Confirms that the interceptor blocks calls to non-allowlisted hosts
 * and allows calls to internal hosts, and that events are logged correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  gatedFetch,
  testBlock,
  gateRequest,
  GatedHttpAgent,
  GatedHttpsAgent,
} from "../util/networkInterceptor";
import securityLogger from "../util/securityLogger";

describe("Network Interceptor", () => {
  it("gateRequest throws for external hosts", () => {
    expect(() => gateRequest("api.openai.com", "test")).toThrow("[SECURITY]");
  });

  it("gateRequest throws for example.com", () => {
    expect(() => gateRequest("example.com", "test")).toThrow(
      "blocked by network allowlist",
    );
  });

  it("gateRequest does not throw for localhost", () => {
    expect(() => gateRequest("localhost", "test")).not.toThrow();
  });

  it("gateRequest does not throw for 127.0.0.1", () => {
    expect(() => gateRequest("127.0.0.1", "test")).not.toThrow();
  });

  it("gateRequest does not throw for private IPs", () => {
    expect(() => gateRequest("10.0.0.1", "test")).not.toThrow();
    expect(() => gateRequest("192.168.1.1", "test")).not.toThrow();
    expect(() => gateRequest("172.16.0.1", "test")).not.toThrow();
  });

  it("gatedFetch rejects external domains", async () => {
    await expect(gatedFetch("https://api.openai.com/v1/models")).rejects.toThrow(
      "[SECURITY]",
    );
  });

  it("gatedFetch rejects example.com", async () => {
    await expect(gatedFetch("https://example.com")).rejects.toThrow(
      "blocked by network allowlist",
    );
  });

  it("logs connection_blocked events for blocked requests", () => {
    const beforeCount = securityLogger
      .getRecentEvents()
      .filter((e) => e.target === "test-blocked-host.example.org").length;

    try {
      gateRequest("test-blocked-host.example.org", "test");
    } catch {
      // Expected
    }

    const afterEvents = securityLogger
      .getRecentEvents()
      .filter((e) => e.target === "test-blocked-host.example.org");

    expect(afterEvents.length).toBeGreaterThan(beforeCount);
    expect(afterEvents[afterEvents.length - 1].eventType).toBe(
      "connection_blocked",
    );
    expect(afterEvents[afterEvents.length - 1].verdict).toBe("blocked");
  });

  it("logs connection_allowed events for allowed requests", () => {
    const beforeCount = securityLogger
      .getRecentEvents()
      .filter(
        (e) =>
          e.target === "127.0.0.1" && e.eventType === "connection_allowed",
      ).length;

    gateRequest("127.0.0.1", "test");

    const afterEvents = securityLogger
      .getRecentEvents()
      .filter(
        (e) =>
          e.target === "127.0.0.1" && e.eventType === "connection_allowed",
      );

    expect(afterEvents.length).toBeGreaterThan(beforeCount);
  });

  it("testBlock() function confirms blocking works", async () => {
    const result = await testBlock();
    expect(result).toContain("Block confirmed");
    expect(result).toContain("[SECURITY]");
  });

  it("GatedHttpAgent blocks connection creation to external hosts", () => {
    const agent = new GatedHttpAgent();
    let callbackErr: any = null;
    agent.createConnection({ hostname: "api.openai.com", port: 80 } as any, (err: any) => {
      callbackErr = err;
    });
    expect(callbackErr).toBeTruthy();
    expect(callbackErr.message).toContain("[SECURITY]");
  });

  it("GatedHttpsAgent blocks connection creation to external hosts", () => {
    const agent = new GatedHttpsAgent();
    let callbackErr: any = null;
    agent.createConnection({ hostname: "api.anthropic.com", port: 443 } as any, (err: any) => {
      callbackErr = err;
    });
    expect(callbackErr).toBeTruthy();
    expect(callbackErr.message).toContain("[SECURITY]");
  });
});
