import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FolderTree,
  Settings,
  Table2,
  Zap,
  Search,
} from "lucide-react";

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setCurrentPage,
  } = useAppStore();

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (commandPaletteOpen) setQuery("");
  }, [commandPaletteOpen]);

  const commands = [
    { id: "connect", label: "前往 连接管理", icon: Zap, action: () => setCurrentPage("connect") },
    { id: "explorer", label: "前往 数据浏览", icon: FolderTree, action: () => setCurrentPage("explorer") },
    { id: "data", label: "前往 数据查看", icon: Table2, action: () => setCurrentPage("data") },
    { id: "settings", label: "前往 设置", icon: Settings, action: () => setCurrentPage("settings") },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (action: () => void) => {
    action();
    setCommandPaletteOpen(false);
  };

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>命令面板</DialogTitle>
        </DialogHeader>
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="输入命令..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-auto p-2">
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd.action)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent text-left"
            >
              <cmd.icon className="h-4 w-4 text-muted-foreground" />
              {cmd.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">
              无匹配命令
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
