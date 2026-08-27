/**
 * This is the entry point for the Continue extension.
 */

// ── SECURITY: Network interceptor MUST load before anything else ────────
import "core/util/networkInterceptor";

import { setupCa } from "core/util/ca";
import * as vscode from "vscode";

export { default as buildTimestamp } from "./.buildTimestamp";

// Global output channel for Continue diagnostic and activation logs
export const continueOutputChannel = vscode.window.createOutputChannel("Continue");

function log(message: string) {
  const timestamp = new Date().toISOString();
  continueOutputChannel.appendLine(`[${timestamp}] [Continue] ${message}`);
  console.log(`[Continue] ${message}`);
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  const errorDetails = error?.stack || error?.message || String(error || "");
  continueOutputChannel.appendLine(`[${timestamp}] [Continue ERROR] ${message}\n${errorDetails}`);
  console.error(`[Continue ERROR] ${message}`, error);
}

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  log("Starting air-gapped Continue extension activation...");

  // Register emergency log command early so View Logs always works
  context.subscriptions.push(
    vscode.commands.registerCommand("continue.viewLogs", () => {
      continueOutputChannel.show(true);
    }),
  );

  try {
    log("Step 1/3: Setting up system certificates (CA)...");
    await setupCa();
    log("Step 1/3 complete: CA setup finished.");
  } catch (caErr) {
    logError("Warning: Non-fatal error during CA setup", caErr);
  }

  log("Step 2/3: Dynamically loading activation bundle...");
  const { activateExtension } = await import("./activation/activate");
  log("Step 2/3 complete: Module loaded.");

  log("Step 3/3: Initializing extension components and services...");
  const result = await activateExtension(context);
  log("Step 3/3 complete: Continue extension activated successfully!");

  return result;
}

export function activate(context: vscode.ExtensionContext) {
  return dynamicImportAndActivate(context).catch((e: any) => {
    logError("CRITICAL: Error activating Continue extension", e);

    const errorMessage = e?.message || "Unknown error during extension startup.";

    vscode.window
      .showErrorMessage(
        `Continue failed to activate: ${errorMessage}`,
        "View Output Logs",
        "Show Connection Monitor",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Output Logs") {
          continueOutputChannel.show(true);
        } else if (selection === "Show Connection Monitor") {
          vscode.commands.executeCommand("continue.showConnectionActivity");
        } else if (selection === "Retry") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });

    // Automatically reveal the output channel on failure so user has instant visibility
    continueOutputChannel.show(true);
  });
}

export function deactivate() {
  log("Continue extension deactivated.");
}
