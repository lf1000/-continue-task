import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export const continueOutputChannel = vscode.window.createOutputChannel("Continue");

const logDirPath = path.join(os.homedir(), ".continue", "logs");
const logFilePath = path.join(logDirPath, "continue-debug.log");

function ensureLogDir() {
  try {
    if (!fs.existsSync(logDirPath)) {
      fs.mkdirSync(logDirPath, { recursive: true });
    }
  } catch (e) {
    // Ignore directory creation failure
  }
}

function writeToFile(line: string) {
  try {
    ensureLogDir();
    fs.appendFileSync(logFilePath, line + "\n", "utf8");
  } catch (e) {
    // Best-effort file write
  }
}

export function getDebugLogFilePath(): string {
  return logFilePath;
}

export function logInfo(tag: string, message: string, details?: any) {
  const ts = new Date().toISOString();
  const detailStr = details !== undefined ? (typeof details === "string" ? ` - ${details}` : ` - ${JSON.stringify(details)}`) : "";
  const line = `[${ts}] [INFO] [${tag}] ${message}${detailStr}`;
  continueOutputChannel.appendLine(line);
  console.log(line);
  writeToFile(line);
}

export function logDebug(tag: string, message: string, details?: any) {
  const ts = new Date().toISOString();
  const detailStr = details !== undefined ? (typeof details === "string" ? ` - ${details}` : ` - ${JSON.stringify(details)}`) : "";
  const line = `[${ts}] [DEBUG] [${tag}] ${message}${detailStr}`;
  continueOutputChannel.appendLine(line);
  console.log(line);
  writeToFile(line);
}

export function logWarn(tag: string, message: string, details?: any) {
  const ts = new Date().toISOString();
  const detailStr = details !== undefined ? (typeof details === "string" ? ` - ${details}` : ` - ${JSON.stringify(details)}`) : "";
  const line = `[${ts}] [WARN] [${tag}] ${message}${detailStr}`;
  continueOutputChannel.appendLine(line);
  console.warn(line);
  writeToFile(line);
}

export function logError(tag: string, message: string, error?: any) {
  const ts = new Date().toISOString();
  const errStack = error?.stack || error?.message || String(error || "");
  const line = `[${ts}] [ERROR] [${tag}] ${message}\n${errStack}`;
  continueOutputChannel.appendLine(line);
  console.error(line);
  writeToFile(line);
}

export function showLogs(preserveFocus = true) {
  continueOutputChannel.show(preserveFocus);
}
