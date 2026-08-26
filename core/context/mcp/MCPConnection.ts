/**
 * MCPConnection stub for air-gapped Continue fork.
 * MCP external server support is disabled in network-restricted environments.
 */

import {
  IDE,
  InternalMcpOptions,
  MCPConnectionStatus,
  MCPPrompt,
  MCPResource,
  MCPResourceTemplate,
  MCPServerStatus,
  MCPTool,
} from "../..";

export type MCPExtras = {
  ide?: IDE;
};

export class MCPConnection {
  public client: any = {
    close: async () => {},
  };
  public abortController: AbortController = new AbortController();
  public status: MCPConnectionStatus = "disabled";
  public prompts: MCPPrompt[] = [];
  public tools: MCPTool[] = [];
  public resources: MCPResource[] = [];
  public resourceTemplates: MCPResourceTemplate[] = [];

  constructor(
    public options: InternalMcpOptions,
    public extras?: MCPExtras,
  ) {}

  getStatus(): MCPServerStatus {
    return {
      id: this.options.id,
      name: this.options.name,
      status: "disabled",
      errors: ["[SECURITY] MCP server connections are disabled in this air-gapped build."],
      tools: [],
      prompts: [],
      resources: [],
      resourceTemplates: [],
      transport: this.options.transport,
    };
  }

  async modifyConnection(options: InternalMcpOptions): Promise<void> {
    this.options = options;
  }

  async connect(): Promise<void> {}

  async disconnect(force?: boolean): Promise<void> {}

  async reconnect(): Promise<void> {}
}

export default MCPConnection;
