import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionConfig } from "@milvuslens/shared";

interface AppState {
  // Theme
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;

  // Connection
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  activeConnection: ConnectionConfig | null;
  addConnection: (config: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;

  // Navigation
  currentPage: "connect" | "explorer" | "data" | "settings";
  setCurrentPage: (page: AppState["currentPage"]) => void;

  // Selected collection
  selectedCollection: string | null;
  setSelectedCollection: (name: string | null) => void;

  // Selected database
  selectedDatabase: string | null;
  setSelectedDatabase: (name: string | null) => void;

  // Embedding config
  embeddingConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  setEmbeddingConfig: (config: AppState["embeddingConfig"]) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),

      // Connection
      connections: [],
      activeConnectionId: null,
      activeConnection: null,
      addConnection: (config) =>
        set((s) => ({ connections: [...s.connections, config] })),
      removeConnection: (id) =>
        set((s) => ({
          connections: s.connections.filter((c) => c.id !== id),
          activeConnectionId:
            s.activeConnectionId === id ? null : s.activeConnectionId,
        })),
      setActiveConnection: (id) =>
        set((s) => ({
          activeConnectionId: id,
          activeConnection: s.connections.find((c) => c.id === id) || null,
        })),

      // Navigation
      currentPage: "connect",
      setCurrentPage: (page) => set({ currentPage: page }),

      // Selected collection
      selectedCollection: null,
      setSelectedCollection: (name) => set({ selectedCollection: name }),

      // Selected database
      selectedDatabase: null,
      setSelectedDatabase: (name) => set({ selectedDatabase: name }),

      // Embedding config
      embeddingConfig: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "text-embedding-3-small",
      },
      setEmbeddingConfig: (config) => set({ embeddingConfig: config }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: "milvuslens-storage",
      partialize: (s) => ({
        theme: s.theme,
        connections: s.connections,
        embeddingConfig: s.embeddingConfig,
      }),
    }
  )
);
