/**
 * Structured security/activity logger for the air-gapped Continue fork.
 *
 * Provides JSON-formatted logging with:
 * - Two rotating file transports (general 7-day, connection 30-day)
 * - Automatic redaction of sensitive fields (tokens, API keys, file content)
 * - In-memory ring buffer for fast in-app display (last 500 events)
 * - Shared event schema across all modules
 */

import { EventEmitter } from "events";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// ── Event Schema ────────────────────────────────────────────────────────

export interface SecurityEvent {
  timestamp: string;
  eventType:
    | "connection_allowed"
    | "connection_blocked"
    | "config_rejected"
    | "startup"
    | "config_loaded"
    | "interceptor_active";
  target: string;
  verdict: "allowed" | "blocked" | "error" | "info";
  sourceModule: string;
  callerStack: string;
  sessionId: string;
}

// ── Session ID ──────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
const SESSION_ID = randomUUID();

// ── Ring Buffer ─────────────────────────────────────────────────────────

class RingBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  get length(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

// ── Sensitive field redaction ────────────────────────────────────────────

const REDACT_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /password/i,
  /bearer/i,
];

function redactSensitiveFields(obj: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_PATTERNS.some((p) => p.test(key))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveFields(value);
    } else if (typeof value === "string" && value.length > 2000) {
      // Truncate very long strings (likely file content)
      redacted[key] = value.substring(0, 100) + "...[TRUNCATED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ── Log Directory ───────────────────────────────────────────────────────

function getLogDir(): string {
  const logDir = path.join(os.homedir(), ".continue", "security-logs");
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Directory may already exist
  }
  return logDir;
}

// ── Simple File Logger (no Winston dependency) ──────────────────────────
// Using a simple JSON-lines file logger to avoid adding heavy dependencies.
// Files are rotated by date suffix.

function getDateString(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function appendToLogFile(filename: string, entry: SecurityEvent): void {
  try {
    const logDir = getLogDir();
    const date = getDateString();
    const filepath = path.join(logDir, `${filename}-${date}.jsonl`);
    const line = JSON.stringify(redactSensitiveFields(entry as any)) + "\n";
    fs.appendFileSync(filepath, line, "utf-8");
  } catch {
    // Logging should never crash the application
  }
}

function cleanOldLogs(filenamePrefix: string, retentionDays: number): void {
  try {
    const logDir = getLogDir();
    const files = fs.readdirSync(logDir);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    for (const file of files) {
      if (!file.startsWith(filenamePrefix)) continue;
      // Extract date from filename pattern: prefix-YYYY-MM-DD.jsonl
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (dateMatch) {
        const fileDate = new Date(dateMatch[1]);
        if (fileDate < cutoff) {
          fs.unlinkSync(path.join(logDir, file));
        }
      }
    }
  } catch {
    // Cleanup is best-effort
  }
}

// ── Main Logger Class ───────────────────────────────────────────────────

class SecurityLogger {
  private ringBuffer: RingBuffer<SecurityEvent>;
  public events: EventEmitter;

  constructor() {
    this.ringBuffer = new RingBuffer<SecurityEvent>(500);
    this.events = new EventEmitter();
    this.events.setMaxListeners(50);

    // Clean old logs on startup (best-effort)
    cleanOldLogs("combined-activity", 7);
    cleanOldLogs("connection-activity", 30);
  }

  /**
   * Log a security event. Writes to both file transports and the ring buffer,
   * and emits the event for live subscribers (e.g., the dashboard panel).
   */
  log(
    eventType: SecurityEvent["eventType"],
    target: string,
    verdict: SecurityEvent["verdict"],
    sourceModule: string,
    callerStack?: string,
  ): SecurityEvent {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      target,
      verdict,
      sourceModule,
      callerStack: callerStack || new Error().stack?.split("\n").slice(2, 5).join(" | ") || "",
      sessionId: SESSION_ID,
    };

    // Write to ring buffer
    this.ringBuffer.push(event);

    // Write to file transports
    appendToLogFile("combined-activity", event);

    // Connection events also go to the 30-day log
    // Connection and security rejection events also go to the 30-day log
    if (
      eventType === "connection_allowed" ||
      eventType === "connection_blocked" ||
      eventType === "config_rejected"
    ) {
      appendToLogFile("connection-activity", event);
    }

    // Emit for live subscribers (dashboard panel, etc.)
    this.events.emit("security_event", event);

    return event;
  }

  /**
   * Get the last N events from the in-memory ring buffer.
   */
  getRecentEvents(count?: number): SecurityEvent[] {
    const all = this.ringBuffer.getAll();
    if (count !== undefined && count < all.length) {
      return all.slice(all.length - count);
    }
    return all;
  }

  /**
   * Read historical events from rotated log files on disk.
   */
  readHistoricalEvents(
    filenamePrefix: string = "connection-activity",
    maxEntries: number = 1000,
  ): SecurityEvent[] {
    const events: SecurityEvent[] = [];
    try {
      const logDir = getLogDir();
      const files = fs
        .readdirSync(logDir)
        .filter((f) => f.startsWith(filenamePrefix) && f.endsWith(".jsonl"))
        .sort();

      for (const file of files) {
        if (events.length >= maxEntries) break;
        const content = fs.readFileSync(path.join(logDir, file), "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          if (events.length >= maxEntries) break;
          try {
            events.push(JSON.parse(line));
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      // Best-effort
    }
    return events;
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string {
    return SESSION_ID;
  }
}

// ── Singleton Export ────────────────────────────────────────────────────

export const securityLogger = new SecurityLogger();

export default securityLogger;
