#!/usr/bin/env node
/**
 * Build output scanner for the air-gapped Continue fork.
 * Scans compiled build output directories for any leaked external URLs.
 */

const fs = require("fs");
const path = require("path");

const ALLOWED_PATTERNS = [
  /https?:\/\/localhost/i,
  /https?:\/\/127\.0\.0\.1/i,
  /https?:\/\/0\.0\.0\.0/i,
  /https?:\/\/10\.\d+\.\d+\.\d+/i,
  /https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/i,
  /https?:\/\/192\.168\.\d+\.\d+/i,
];

const SCAN_DIRS = [
  path.join(__dirname, "../extensions/vscode/out"),
  path.join(__dirname, "../extensions/vscode/dist"),
  path.join(__dirname, "../gui/dist"),
  path.join(__dirname, "../binary/out"),
  path.join(__dirname, "../core/dist"),
];

const URL_REGEX = /https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+/g;

let totalFilesScanned = 0;
let violationsFound = 0;

function scanFile(filePath) {
  if (filePath.endsWith(".map") || filePath.includes("node_modules")) {
    return;
  }
  totalFilesScanned++;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(URL_REGEX) || [];

  for (const url of matches) {
    const isAllowed = ALLOWED_PATTERNS.some((p) => p.test(url));
    if (!isAllowed) {
      console.error(`[SECURITY VIOLATION] External URL found in build artifact:`);
      console.error(`  File: ${filePath}`);
      console.error(`  URL:  ${url}\n`);
      violationsFound++;
    }
  }
}

function scanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

console.log("Starting build output security scan...");
for (const dir of SCAN_DIRS) {
  scanDir(dir);
}

console.log(`Scan completed: ${totalFilesScanned} files scanned.`);
if (violationsFound > 0) {
  console.error(`FAILED: ${violationsFound} external URL violations found in build output.`);
  process.exit(1);
} else {
  console.log("SUCCESS: 0 external URLs found in scanned build outputs.");
  process.exit(0);
}
