import { useEffect } from "react";
import { useAppStore } from "./stores/app";
import { tryAutoReconnect } from "./lib/autoReconnect";
import { Sidebar } from "./components/Sidebar";
import { ConnectPage } from "./pages/ConnectPage";
import { ExplorerPage } from "./pages/ExplorerPage";
import { DataExplorerPage } from "./pages/DataExplorerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CommandPalette } from "./components/CommandPalette";
import { Toaster } from "./components/Toaster";

export default function App() {
  const { theme, currentPage, commandPaletteOpen, setCommandPaletteOpen } =
    useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Restore last Milvus connection after page refresh
  useEffect(() => {
    const { activeConnectionId } = useAppStore.getState();
    if (!activeConnectionId) {
      void tryAutoReconnect();
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const renderPage = () => {
    switch (currentPage) {
      case "connect":
        return <ConnectPage />;
      case "explorer":
        return <ExplorerPage />;
      case "data":
        return <DataExplorerPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ConnectPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
