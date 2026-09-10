import { useEffect } from "react";
import { useAppStore } from "./stores/app";
import { Sidebar } from "./components/Sidebar";
import { ConnectPage } from "./pages/ConnectPage";
import { DatabasesPage } from "./pages/DatabasesPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { DataExplorerPage } from "./pages/DataExplorerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CommandPalette } from "./components/CommandPalette";

export default function App() {
  const { theme, currentPage, commandPaletteOpen, setCommandPaletteOpen } =
    useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

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
      case "databases":
        return <DatabasesPage />;
      case "collections":
        return <CollectionsPage />;
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
    </div>
  );
}
