/**
 * Connection Activity Dashboard Panel
 *
 * Registers the `continue.showConnectionActivity` command and displays
 * a live dashboard showing all network connection events from the
 * runtime interceptor. Features:
 * - Scrolling event log table (blocked entries highlighted in red)
 * - Allowed/Blocked counters
 * - Chart.js line chart plotting blocked attempts over time
 * - "Test Block" demo button
 * - History toggle for viewing rotated log files
 */

import * as vscode from "vscode";
import { networkEvents } from "core/util/networkInterceptor";
import { testBlock } from "core/util/networkInterceptor";
import securityLogger, { SecurityEvent } from "core/util/securityLogger";
import { getNonce } from "./util/vscode";

let currentPanel: vscode.WebviewPanel | undefined;

export function registerConnectionActivityPanel(
  context: vscode.ExtensionContext,
): void {
  const disposable = vscode.commands.registerCommand(
    "continue.showConnectionActivity",
    () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
        return;
      }

      currentPanel = vscode.window.createWebviewPanel(
        "connectionActivity",
        "Connection Activity",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        },
      );

      currentPanel.webview.html = getWebviewContent(
        currentPanel.webview,
        context.extensionUri,
      );

      // Send initial batch from ring buffer
      const initialEvents = securityLogger.getRecentEvents();
      currentPanel.webview.postMessage({
        type: "initial_batch",
        payload: initialEvents,
      });

      // Subscribe to live events
      const eventHandler = (event: SecurityEvent) => {
        currentPanel?.webview.postMessage({
          type: "connection_event",
          payload: event,
        });
      };
      networkEvents.on("security_event", eventHandler);

      // Handle messages from the webview
      currentPanel.webview.onDidReceiveMessage(
        async (message: { type: string }) => {
          if (message.type === "test_block") {
            try {
              const result = await testBlock();
              currentPanel?.webview.postMessage({
                type: "test_result",
                payload: { success: true, message: result },
              });
            } catch (err: any) {
              currentPanel?.webview.postMessage({
                type: "test_result",
                payload: { success: false, message: err.message },
              });
            }
          } else if (message.type === "load_history") {
            const history = securityLogger.readHistoricalEvents(
              "connection-activity",
              500,
            );
            currentPanel?.webview.postMessage({
              type: "history_batch",
              payload: history,
            });
          }
        },
      );

      currentPanel.onDidDispose(() => {
        networkEvents.off("security_event", eventHandler);
        currentPanel = undefined;
      });
    },
  );

  context.subscriptions.push(disposable);
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = getNonce();
  const chartJsUri = webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "chart.min.js"))
    .toString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src 'unsafe-inline';">
  <title>Connection Activity</title>
  <script nonce="${nonce}" src="${chartJsUri}"></script>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d30;
      --text-primary: #cccccc;
      --text-secondary: #969696;
      --accent-green: #4ec9b0;
      --accent-red: #f44747;
      --accent-blue: #569cd6;
      --accent-yellow: #dcdcaa;
      --border-color: #3c3c3c;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 16px;
      font-size: 13px;
    }

    h1 {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h1 .icon { font-size: 20px; }

    .stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px 20px;
      flex: 1;
      text-align: center;
    }

    .stat-card .label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-secondary);
      letter-spacing: 0.5px;
    }

    .stat-card .value {
      font-size: 28px;
      font-weight: 600;
      margin-top: 4px;
    }

    .stat-card .value.allowed { color: var(--accent-green); }
    .stat-card .value.blocked { color: var(--accent-red); }
    .stat-card .value.total { color: var(--accent-blue); }

    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    button {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.15s;
    }

    button:hover { background: var(--accent-blue); color: white; }
    button.danger:hover { background: var(--accent-red); }

    .table-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      max-height: 400px;
      overflow-y: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      position: sticky;
      top: 0;
      background: var(--bg-tertiary);
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-secondary);
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-color);
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 12px;
    }

    tr.blocked { background: rgba(244, 71, 71, 0.08); }
    tr.blocked td.verdict { color: var(--accent-red); font-weight: 600; }
    tr.allowed td.verdict { color: var(--accent-green); }
    tr.info td.verdict, td.verdict.verdict-info { color: var(--accent-blue); font-weight: 600; }

    .top-hosts {
      margin-top: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
    }

    .top-hosts h3 {
      font-size: 13px;
      margin-bottom: 8px;
      color: var(--accent-yellow);
    }

    .host-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid var(--border-color);
      font-family: monospace;
      font-size: 12px;
    }

    .host-item:last-child { border-bottom: none; }
    .host-count { color: var(--accent-red); font-weight: 600; }

    .chart-container {
      margin-top: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      height: 200px;
    }

    .chart-container h3 {
      font-size: 13px;
      margin-bottom: 8px;
      color: var(--accent-yellow);
    }

    .chart-bar {
      display: flex;
      align-items: end;
      gap: 2px;
      height: 140px;
      padding-top: 8px;
    }

    .chart-bar .bar {
      flex: 1;
      min-width: 4px;
      background: var(--accent-red);
      border-radius: 2px 2px 0 0;
      transition: height 0.3s;
    }

    .status-badge {
      display: inline-block;
      background: var(--accent-green);
      color: #000;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>
    <span class="icon">🛡️</span>
    Connection Activity Monitor
    <span class="status-badge">INTERCEPTOR ACTIVE</span>
  </h1>

  <div class="stats-row">
    <div class="stat-card">
      <div class="label">Total Events</div>
      <div class="value total" id="totalCount">0</div>
    </div>
    <div class="stat-card">
      <div class="label">Allowed</div>
      <div class="value allowed" id="allowedCount">0</div>
    </div>
    <div class="stat-card">
      <div class="label">Blocked</div>
      <div class="value blocked" id="blockedCount">0</div>
    </div>
  </div>

  <div class="actions">
    <button class="danger" id="testBlockBtn">🧪 Test Block (fetch example.com)</button>
    <button id="historyBtn">📁 Load History</button>
    <button id="clearBtn">🗑️ Clear Display</button>
  </div>

  <div class="chart-container">
    <h3>Blocked Attempts Over Time</h3>
    <canvas id="trendChart" style="width:100%;height:140px;"></canvas>
  </div>

  <div class="top-hosts" id="topHostsSection">
    <h3>Top Attempted External Hosts</h3>
    <div id="topHostsList"></div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Target</th>
          <th>Verdict</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody id="eventTableBody"></tbody>
    </table>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let events = [];
    let allowed = 0;
    let blocked = 0;
    const blockedTimeline = new Array(60).fill(0);
    const blockedHosts = {};

    function addEvent(event) {
      events.unshift(event);
      if (events.length > 500) events.pop();

      if (event.verdict === 'allowed') allowed++;
      if (event.verdict === 'blocked') {
        blocked++;
        blockedTimeline[blockedTimeline.length - 1]++;
        blockedHosts[event.target] = (blockedHosts[event.target] || 0) + 1;
      }

      updateDisplay();
    }

    function updateDisplay() {
      document.getElementById('totalCount').textContent = allowed + blocked;
      document.getElementById('allowedCount').textContent = allowed;
      document.getElementById('blockedCount').textContent = blocked;

      // Update table
      const tbody = document.getElementById('eventTableBody');
      const maxRows = 200;
      const displayEvents = events.slice(0, maxRows);
      tbody.innerHTML = displayEvents.map(e => {
        const cls = e.verdict === 'blocked' ? 'blocked' : (e.verdict === 'allowed' ? 'allowed' : 'info');
        return '<tr class="' + cls + '">' +
          '<td>' + time + '</td>' +
          '<td>' + e.eventType + '</td>' +
          '<td>' + e.target + '</td>' +
          '<td class="verdict verdict-' + e.verdict + '">' + e.verdict.toUpperCase() + '</td>' +
          '<td>' + e.sourceModule + '</td>' +
          '</tr>';
      }).join('');

      // Update chart via Chart.js
      var canvas = document.getElementById('trendChart');
      if (canvas && window.Chart) {
        if (!window.chartInstance) {
          window.chartInstance = new window.Chart(canvas, {
            data: {
              labels: blockedTimeline.map(function(_, idx) { return idx; }),
              datasets: [{
                data: blockedTimeline,
                borderColor: '#f44747',
                backgroundColor: 'rgba(244, 71, 71, 0.25)'
              }]
            }
          });
        } else {
          window.chartInstance.data.datasets[0].data = blockedTimeline;
          window.chartInstance.update();
        }
      }

      // Update top hosts
      const hostsList = document.getElementById('topHostsList');
      const sorted = Object.entries(blockedHosts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      hostsList.innerHTML = sorted.map(([host, count]) =>
        '<div class="host-item"><span>' + host + '</span><span class="host-count">' + count + '</span></div>'
      ).join('') || '<div style="color:#969696">No blocked hosts yet</div>';
    }

    // Advance timeline every 10 seconds
    setInterval(() => {
      blockedTimeline.shift();
      blockedTimeline.push(0);
      updateDisplay();
    }, 10000);

    // Handle messages from extension host
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'initial_batch') {
        msg.payload.forEach(e => addEvent(e));
      } else if (msg.type === 'connection_event') {
        addEvent(msg.payload);
      } else if (msg.type === 'history_batch') {
        msg.payload.forEach(e => addEvent(e));
      } else if (msg.type === 'test_result') {
        const status = msg.payload.success ? '✓' : '✗';
        alert(status + ' ' + msg.payload.message);
      }
    });

    document.getElementById('testBlockBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'test_block' });
    });

    document.getElementById('historyBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'load_history' });
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
      events = [];
      allowed = 0;
      blocked = 0;
      blockedTimeline.fill(0);
      Object.keys(blockedHosts).forEach(k => delete blockedHosts[k]);
      updateDisplay();
    });

    updateDisplay();
  </script>
</body>
</html>`;
}
