import { useAppStore } from "@/stores/app";
import {
  FolderTree,
  HardDrive,
  Settings,
  Table2,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "connect" as const, label: "连接", icon: Zap },
  { id: "explorer" as const, label: "数据浏览", icon: FolderTree },
  { id: "data" as const, label: "数据查看", icon: Table2 },
  { id: "settings" as const, label: "设置", icon: Settings },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, theme, toggleTheme, activeConnection } =
    useAppStore();

  return (
    <aside className="w-56 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          MilvusLens
        </h1>
        {activeConnection && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {activeConnection.name}
          </p>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              currentPage === item.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === "dark" ? "亮色模式" : "暗色模式"}
        </button>
        <p className="text-xs text-muted-foreground px-3 py-2">
          Ctrl+K 命令面板
        </p>
      </div>
    </aside>
  );
}
