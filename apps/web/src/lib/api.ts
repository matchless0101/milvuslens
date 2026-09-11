import { useAppStore } from "@/stores/app";

const API_BASE = "/api";

function isConnectionLost(message: string | undefined): boolean {
  if (!message) return false;
  return message.toLowerCase().includes("connection not found");
}

function handleConnectionLost() {
  const store = useAppStore.getState();
  store.setActiveConnection(null);
  store.setCurrentPage("connect");
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const json = await res.json();
    if (
      json &&
      json.success === false &&
      isConnectionLost(json.error)
    ) {
      handleConnectionLost();
    }
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const api = {
  // Connections
  connect: (config: unknown) =>
    request("/connect", { method: "POST", body: JSON.stringify(config) }),
  testConnection: (config: unknown) =>
    request("/connect/test", { method: "POST", body: JSON.stringify(config) }),
  disconnect: (id: string) =>
    request(`/disconnect/${id}`, { method: "POST" }),
  listConnections: () => request("/connections"),

  // Databases
  listDatabases: (connectionId: string) =>
    request(`/databases?connectionId=${connectionId}`),
  createDatabase: (connectionId: string, dbName: string) =>
    request("/databases", {
      method: "POST",
      body: JSON.stringify({ connectionId, dbName }),
    }),
  deleteDatabase: (connectionId: string, name: string) =>
    request(`/databases/${name}?connectionId=${connectionId}`, {
      method: "DELETE",
    }),
  useDatabase: (connectionId: string, dbName: string) =>
    request("/databases/use", {
      method: "POST",
      body: JSON.stringify({ connectionId, dbName }),
    }),

  // Collections
  listCollections: (connectionId: string, db?: string, withDetails = false) =>
    request(
      `/collections${qs({
        connectionId,
        db,
        withDetails: withDetails ? "1" : undefined,
      })}`
    ),
  getCollectionSchema: (connectionId: string, name: string, db?: string) =>
    request(`/collections/${name}/schema${qs({ connectionId, db })}`),
  createCollection: (data: unknown) =>
    request("/collections", { method: "POST", body: JSON.stringify(data) }),
  deleteCollection: (connectionId: string, name: string, db?: string) =>
    request(`/collections/${name}${qs({ connectionId, db })}`, {
      method: "DELETE",
    }),
  loadCollection: (connectionId: string, name: string, db?: string) =>
    request(`/collections/${name}/load${qs({ connectionId, db })}`, {
      method: "POST",
    }),
  releaseCollection: (connectionId: string, name: string, db?: string) =>
    request(`/collections/${name}/release${qs({ connectionId, db })}`, {
      method: "POST",
    }),
  createIndex: (
    connectionId: string,
    name: string,
    fieldName: string,
    opts?: { indexType?: string; metricType?: string; db?: string }
  ) =>
    request(`/collections/${name}/index`, {
      method: "POST",
      body: JSON.stringify({
        connectionId,
        fieldName,
        indexType: opts?.indexType || "AUTOINDEX",
        metricType: opts?.metricType || "COSINE",
        db: opts?.db,
      }),
    }),

  // Data
  queryData: (connectionId: string, name: string, body: unknown, db?: string) =>
    request(`/collections/${name}/query${qs({ connectionId, db })}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  searchData: (connectionId: string, name: string, body: unknown, db?: string) =>
    request(`/collections/${name}/search${qs({ connectionId, db })}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  insertData: (
    connectionId: string,
    name: string,
    data: Record<string, unknown>[],
    db?: string
  ) =>
    request(`/collections/${name}/insert${qs({ connectionId, db })}`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  deleteData: (connectionId: string, name: string, filter: string, db?: string) =>
    request(
      `/collections/${name}/delete${qs({ connectionId, filter, db })}`,
      { method: "DELETE" }
    ),

  // Embedding
  embed: (text: string, config: unknown) =>
    request("/embed", {
      method: "POST",
      body: JSON.stringify({ text, config }),
    }),
  testEmbedding: (config: unknown) =>
    request("/embedding/test", {
      method: "POST",
      body: JSON.stringify({ config }),
    }),
};
