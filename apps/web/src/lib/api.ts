const API_BASE = "/api";

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
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
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
  listCollections: (connectionId: string, db?: string) =>
    request(
      `/collections?connectionId=${connectionId}${db ? `&db=${db}` : ""}`
    ),
  getCollectionSchema: (connectionId: string, name: string) =>
    request(`/collections/${name}/schema?connectionId=${connectionId}`),
  createCollection: (data: unknown) =>
    request("/collections", { method: "POST", body: JSON.stringify(data) }),
  deleteCollection: (connectionId: string, name: string) =>
    request(`/collections/${name}?connectionId=${connectionId}`, {
      method: "DELETE",
    }),
  loadCollection: (connectionId: string, name: string) =>
    request(`/collections/${name}/load?connectionId=${connectionId}`, {
      method: "POST",
    }),
  releaseCollection: (connectionId: string, name: string) =>
    request(`/collections/${name}/release?connectionId=${connectionId}`, {
      method: "POST",
    }),

  // Data
  queryData: (connectionId: string, name: string, body: unknown) =>
    request(`/collections/${name}/query?connectionId=${connectionId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  searchData: (connectionId: string, name: string, body: unknown) =>
    request(`/collections/${name}/search?connectionId=${connectionId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  insertData: (connectionId: string, name: string, data: Record<string, unknown>[]) =>
    request(`/collections/${name}/insert?connectionId=${connectionId}`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  deleteData: (connectionId: string, name: string, filter: string) =>
    request(
      `/collections/${name}/delete?connectionId=${connectionId}&filter=${encodeURIComponent(filter)}`,
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
