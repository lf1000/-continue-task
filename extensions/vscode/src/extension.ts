/**
 * This is the entry point for the Continue extension.
 */

// ── SECURITY: Network interceptor MUST load before anything else ────────
import "core/util/networkInterceptor";

import { setupCa } from "core/util/ca";
import * as vscode from "vscode";
import { continueOutputChannel, getDebugLogFilePath, logError, logInfo, showLogs } from "./util/debugLogger";

export { default as buildTimestamp } from "./.buildTimestamp";
export { continueOutputChannel } from "./util/debugLogger";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  logInfo("Startup", `Starting air-gapped Continue extension activation...`);
  logInfo("Startup", `Log file location: ${getDebugLogFilePath()}`);

  try {
    logInfo("Startup", "Step 1/3: Setting up system certificates (CA)...");
    await setupCa();
    logInfo("Startup", "Step 1/3 complete: CA setup finished.");
  } catch (caErr) {
    logError("Startup", "Warning: Non-fatal error during CA setup", caErr);
  }

  logInfo("Startup", "Step 2/3: Dynamically loading activation bundle...");
  const { activateExtension } = await import("./activation/activate");
  logInfo("Startup", "Step 2/3 complete: Activation module loaded.");

  logInfo("Startup", "Step 3/3: Initializing extension components, commands, and webviews...");
  const result = await activateExtension(context);
  logInfo("Startup", "Step 3/3 complete: Continue extension activated successfully!");

  return result;
}

export function activate(context: vscode.ExtensionContext) {
  // Reveal the output channel on activation so logs are immediately visible
  showLogs(true);

  return dynamicImportAndActivate(context).catch((e: any) => {
    logError("Startup", "CRITICAL: Error activating Continue extension", e);

    const errorMessage = e?.message || "Unknown error during extension startup.";

    vscode.window
      .showErrorMessage(
        `Continue failed to activate: ${errorMessage}`,
        "View Output Logs",
        "Open Log File",
        "Show Connection Monitor",
        "Retry",
      )
      .then(async (selection) => {
        if (selection === "View Output Logs") {
          showLogs(false);
        } else if (selection === "Open Log File") {
          const doc = await vscode.workspace.openTextDocument(getDebugLogFilePath());
          await vscode.window.showTextDocument(doc);
        } else if (selection === "Show Connection Monitor") {
          vscode.commands.executeCommand("continue.showConnectionActivity");
        } else if (selection === "Retry") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });

    showLogs(false);
  });
}

export function deactivate() {
  logInfo("Lifecycle", "Continue extension deactivated.");
}
