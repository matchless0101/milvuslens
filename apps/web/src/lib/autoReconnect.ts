import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import type { ConnectionConfig } from "@milvuslens/shared";

let inflight: Promise<boolean> | null = null;

/**
 * Try to re-establish the last used Milvus connection.
 * Safe to call repeatedly — concurrent calls share one attempt.
 */
export async function tryAutoReconnect(): Promise<boolean> {
  if (inflight) return inflight;

  inflight = (async () => {
    const store = useAppStore.getState();
    if (store.activeConnectionId) return true;

    const base = store.lastConnection;
    if (!base?.host) return false;
    // Username auth without stored password cannot reconnect silently
    if (base.username && !base.password && !base.token) return false;

    const config: ConnectionConfig = {
      ...base,
      id: base.id || crypto.randomUUID(),
    };

    const res = await api.connect(config);
    if (!res.success || !res.data) return false;

    const serverId = (res.data as { connectionId: string }).connectionId;
    const saved: ConnectionConfig = { ...config, id: serverId };
    store.addConnection(saved);
    store.setActiveConnection(serverId);
    store.setLastConnection(saved);
    return true;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Record a connection as the one to restore next time. */
export function rememberConnection(config: ConnectionConfig) {
  useAppStore.getState().setLastConnection(config);
}
