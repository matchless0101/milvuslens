import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import type { ClientConfig } from "@zilliz/milvus2-sdk-node";
import type { ConnectionConfig } from "@milvuslens/shared";
import { randomUUID } from "crypto";

// In-memory connection store: connectionId -> { client, config }
const connections = new Map<
  string,
  { client: MilvusClient; config: ConnectionConfig }
>();

function buildAddress(config: ConnectionConfig): string {
  // If host already contains a port (e.g. "39.97.251.27:19530"), use it as-is
  if (config.host.includes(":")) {
    return config.host;
  }
  return `${config.host}:${config.port}`;
}

function buildClientConfig(config: ConnectionConfig): ClientConfig {
  const clientConfig: Record<string, unknown> = {
    address: buildAddress(config),
  };

  if (config.token) {
    clientConfig.token = config.token;
  } else if (config.username && config.password) {
    clientConfig.username = config.username;
    clientConfig.password = config.password;
  }

  if (config.tls) {
    clientConfig.ssl = true;
  }

  return clientConfig as unknown as ClientConfig;
}

export function createConnection(config: ConnectionConfig): string {
  const connectionId = randomUUID();
  const client = new MilvusClient(buildClientConfig(config));
  connections.set(connectionId, { client, config });
  return connectionId;
}

export function getClient(connectionId: string): MilvusClient {
  const conn = connections.get(connectionId);
  if (!conn) {
    throw new Error(`Connection not found: ${connectionId}`);
  }
  return conn.client;
}

export function disconnect(connectionId: string): boolean {
  return connections.delete(connectionId);
}

export function listConnections(): Array<{
  connectionId: string;
  config: Omit<ConnectionConfig, "password">;
}> {
  return Array.from(connections.entries()).map(([id, { config }]) => ({
    connectionId: id,
    config: { ...config, password: undefined },
  }));
}

export async function testConnection(config: ConnectionConfig): Promise<boolean> {
  const client = new MilvusClient(buildClientConfig(config));
  try {
    await client.checkHealth();
    return true;
  } catch {
    return false;
  }
}

export { DataType };
