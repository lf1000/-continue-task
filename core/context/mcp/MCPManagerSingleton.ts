/**
 * MCPManagerSingleton stub for air-gapped Continue fork.
 * MCP server management is disabled in network-restricted environments.
 */

import { InternalMcpOptions, MCPServerStatus } from "../..";
import MCPConnection, { MCPExtras } from "./MCPConnection";

export class MCPManagerSingleton {
  private static instance: MCPManagerSingleton;
  public onConnectionsRefreshed?: () => void;
  public connections: Map<string, MCPConnection> = new Map();

  private constructor() {}

  public static getInstance(): MCPManagerSingleton {
    if (!MCPManagerSingleton.instance) {
      MCPManagerSingleton.instance = new MCPManagerSingleton();
    }
    return MCPManagerSingleton.instance;
  }

  setConnections(
    servers: InternalMcpOptions[],
    forceDisconnect: boolean = false,
    extras?: MCPExtras,
  ): void {
    this.connections.clear();
    if (Array.isArray(servers)) {
      for (const server of servers) {
        if (server && server.id) {
          this.connections.set(server.id, new MCPConnection(server, extras));
        }
      }
    }
  }

  async setEnabled(serverId: string, enabled: boolean): Promise<void> {}

  createConnection(id: string, options: InternalMcpOptions, extras?: MCPExtras): MCPConnection {
    const connection = new MCPConnection(options, extras);
    this.connections.set(id, connection);
    return connection;
  }

  getConnection(id: string): MCPConnection | undefined {
    return this.connections.get(id);
  }

  async shutdown(): Promise<void> {
    this.connections.clear();
  }

  getStatuses(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = [];
    for (const conn of this.connections.values()) {
      statuses.push(conn.getStatus());
    }
    return statuses;
  }

  async refreshConnection(id: string): Promise<void> {}

  async refreshAllConnections(): Promise<void> {}

  async deleteConnection(id: string): Promise<void> {
    this.connections.delete(id);
  }

  async modifyConnection(id: string, options: InternalMcpOptions): Promise<void> {}

  async getPrompt(serverId: string, promptName: string, args: Record<string, string>): Promise<any> {
    return undefined;
  }

  setStatus(id: string, status: any): void {}
}

export default MCPManagerSingleton;
