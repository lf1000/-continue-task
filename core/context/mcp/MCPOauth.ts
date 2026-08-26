/**
 * MCPOauth stub for air-gapped Continue fork.
 * External OAuth flows are disabled in network-restricted environments.
 */

import { IDE } from "../..";

export async function getOauthToken(
  serverId: string,
  ide: IDE,
): Promise<string | undefined> {
  return undefined;
}

export async function clearOAuthData(
  serverId: string,
  ide: IDE,
): Promise<void> {}

export async function handleMCPOauthCode(
  code: string,
  state?: string,
): Promise<void> {}

export async function performAuth(
  serverId: string,
  serverUrl: string,
  ide: IDE,
): Promise<string | undefined> {
  return undefined;
}

export async function removeMCPAuth(
  serverId: string,
  ide: IDE,
): Promise<void> {}
