import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Database, Plus, Trash2, RefreshCw } from "lucide-react";

export function DatabasesPage() {
  const {
    activeConnectionId,
    setCurrentPage,
    setSelectedDatabase,
    setActiveConnection,
  } = useAppStore();
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDatabases = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    setError(null);
    const res = await api.listDatabases(activeConnectionId);
    setLoading(false);
    if (res.success) {
      setDatabases((res.data as string[]) || []);
    } else {
      const msg = res.error || "加载失败";
      setError(msg);
      // If connection not found, clear stale activeConnectionId
      if (msg.includes("Connection not found") || msg.includes("not found")) {
        setActiveConnection(null);
      }
    }
  };

  useEffect(() => {
    loadDatabases();
  }, [activeConnectionId]);

  const handleCreate = async () => {
    if (!newDbName.trim() || !activeConnectionId) return;
    setCreating(true);
    await api.createDatabase(activeConnectionId, newDbName.trim());
    setCreating(false);
    setNewDbName("");
    loadDatabases();
  };

  const handleDelete = async (name: string) => {
    if (!activeConnectionId) return;
    if (!confirm(`确定删除数据库 "${name}" 吗？`)) return;
    await api.deleteDatabase(activeConnectionId, name);
    loadDatabases();
  };

  const handleSelect = async (name: string) => {
    if (!activeConnectionId) return;
    await api.useDatabase(activeConnectionId, name);
    setSelectedDatabase(name);
    setCurrentPage("collections");
  };

  if (!activeConnectionId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Database className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">未连接</h2>
        <p className="text-muted-foreground mb-4">
          请先连接到 Milvus 服务器
        </p>
        <Button onClick={() => setCurrentPage("connect")}>前往连接</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">数据库</h2>
          <p className="text-muted-foreground">浏览和管理数据库</p>
        </div>
        <Button variant="outline" onClick={loadDatabases}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
          {error.includes("not found") && (
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => setCurrentPage("connect")}
            >
              重新连接
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">创建数据库</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="数据库名称"
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              创建
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : databases.length === 0 ? (
          <p className="text-muted-foreground">暂无数据库</p>
        ) : (
          databases.map((db) => (
            <div
              key={db}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
              onClick={() => handleSelect(db)}
            >
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-medium">{db}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(db);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
