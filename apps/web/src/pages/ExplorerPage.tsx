import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  LayoutList,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  Square,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CollectionInfo } from "@milvuslens/shared";

export function ExplorerPage() {
  const {
    activeConnectionId,
    selectedDatabase,
    setSelectedDatabase,
    setCurrentPage,
    setSelectedCollection,
    setActiveConnection,
  } = useAppStore();

  // Database state
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [creatingDb, setCreatingDb] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collection state
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [colLoading, setColLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Create collection form
  const [form, setForm] = useState({
    name: "",
    fields: [
      { name: "id", dataType: "INT64", isPrimaryKey: true, dimension: undefined, maxLength: undefined },
      { name: "vector", dataType: "FLOAT_VECTOR", isPrimaryKey: false, dimension: 128, maxLength: undefined },
      { name: "text", dataType: "VARCHAR", isPrimaryKey: false, dimension: undefined, maxLength: 512 },
    ] as Array<{
      name: string;
      dataType: string;
      isPrimaryKey: boolean;
      dimension?: number;
      maxLength?: number;
    }>,
    indexType: "AUTO_INDEX",
    metricType: "COSINE",
  });
  const [creatingCol, setCreatingCol] = useState(false);

  // Load databases
  const loadDatabases = async () => {
    if (!activeConnectionId) return;
    setDbLoading(true);
    setError(null);
    const res = await api.listDatabases(activeConnectionId);
    setDbLoading(false);
    if (res.success) {
      const dbs = (res.data as string[]) || [];
      setDatabases(dbs);
      // Auto-select first database if none selected
      if (!selectedDatabase && dbs.length > 0) {
        handleSelectDb(dbs[0]);
      }
    } else {
      setError(translateError(res.error));
      if (res.error?.includes("not found")) {
        setActiveConnection(null);
      }
    }
  };

  // Load collections for selected database
  const loadCollections = async () => {
    if (!activeConnectionId || !selectedDatabase) {
      setCollections([]);
      return;
    }
    setColLoading(true);
    const res = await api.listCollections(activeConnectionId, selectedDatabase);
    setColLoading(false);
    if (res.success) {
      setCollections((res.data as CollectionInfo[]) || []);
    }
  };

  // Select a database
  const handleSelectDb = async (name: string) => {
    if (!activeConnectionId) return;
    setSelectedDatabase(name);
    await api.useDatabase(activeConnectionId, name);
    loadCollections();
  };

  useEffect(() => {
    loadDatabases();
  }, [activeConnectionId]);

  useEffect(() => {
    if (selectedDatabase) loadCollections();
  }, [activeConnectionId, selectedDatabase]);

  // Database actions
  const handleCreateDb = async () => {
    if (!newDbName.trim() || !activeConnectionId) return;
    setCreatingDb(true);
    await api.createDatabase(activeConnectionId, newDbName.trim());
    setCreatingDb(false);
    setNewDbName("");
    loadDatabases();
  };

  const handleDeleteDb = async (name: string) => {
    if (!activeConnectionId) return;
    if (!confirm(`确定删除数据库 "${name}" 吗？`)) return;
    await api.deleteDatabase(activeConnectionId, name);
    if (selectedDatabase === name) setSelectedDatabase(null);
    loadDatabases();
  };

  // Collection actions
  const handleCreateCol = async () => {
    if (!form.name.trim() || !activeConnectionId) return;
    setCreatingCol(true);
    const vectorFields = form.fields.filter(
      (f) => f.dataType === "FLOAT_VECTOR" || f.dataType === "BINARY_VECTOR"
    );
    const res = await api.createCollection({
      connectionId: activeConnectionId,
      collectionName: form.name.trim(),
      fields: form.fields,
      indexParams: vectorFields.map((f) => ({
        fieldName: f.name,
        indexType: form.indexType,
        metricType: form.metricType,
      })),
    });
    setCreatingCol(false);
    if (res.success) {
      setCreateOpen(false);
      setForm({ ...form, name: "" });
      loadCollections();
    }
  };

  const handleDeleteCol = async (name: string) => {
    if (!activeConnectionId) return;
    if (!confirm(`确定删除集合 "${name}" 吗？此操作不可恢复。`)) return;
    await api.deleteCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleLoadCol = async (name: string) => {
    if (!activeConnectionId) return;
    await api.loadCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleReleaseCol = async (name: string) => {
    if (!activeConnectionId) return;
    await api.releaseCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleViewData = (name: string) => {
    setSelectedCollection(name);
    setCurrentPage("data");
  };

  // Field form helpers
  const addField = () => {
    setForm({
      ...form,
      fields: [...form.fields, { name: "", dataType: "VARCHAR", isPrimaryKey: false, maxLength: 256 }],
    });
  };
  const removeField = (idx: number) => {
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) });
  };
  const updateField = (idx: number, updates: Partial<typeof form.fields[0]>) => {
    setForm({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...updates } : f)),
    });
  };

  // Not connected
  if (!activeConnectionId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Database className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">未连接</h2>
        <p className="text-muted-foreground mb-4">请先连接到 Milvus 服务器</p>
        <Button onClick={() => setCurrentPage("connect")}>前往连接</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel: Databases */}
      <div className="w-56 border-r flex flex-col bg-card/50">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">数据库</h3>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={loadDatabases}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Create database */}
        <div className="p-2 border-b flex gap-1">
          <Input
            placeholder="新建数据库"
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateDb()}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2" onClick={handleCreateDb} disabled={creatingDb}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Database list */}
        <div className="flex-1 overflow-auto p-1">
          {dbLoading ? (
            <p className="text-xs text-muted-foreground p-2">加载中...</p>
          ) : databases.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">暂无数据库</p>
          ) : (
            databases.map((db) => (
              <div
                key={db}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm group",
                  selectedDatabase === db
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
                onClick={() => handleSelectDb(db)}
              >
                <div className="flex items-center gap-2 truncate">
                  <Database className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{db}</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDb(db);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Collections */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">集合</h2>
            <p className="text-xs text-muted-foreground">
              数据库：{selectedDatabase || "未选择"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadCollections}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              刷新
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selectedDatabase}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  创建集合
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>创建集合</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>集合名称</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="my_collection"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>字段配置</Label>
                      <Button size="sm" variant="outline" onClick={addField}>
                        <Plus className="h-3 w-3 mr-1" />
                        添加字段
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {form.fields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                          <Input
                            placeholder="字段名"
                            value={field.name}
                            onChange={(e) => updateField(idx, { name: e.target.value })}
                            className="w-32"
                          />
                          <Select
                            value={field.dataType}
                            onValueChange={(v) => updateField(idx, { dataType: v })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INT64">INT64</SelectItem>
                              <SelectItem value="INT32">INT32</SelectItem>
                              <SelectItem value="FLOAT">FLOAT</SelectItem>
                              <SelectItem value="DOUBLE">DOUBLE</SelectItem>
                              <SelectItem value="VARCHAR">VARCHAR</SelectItem>
                              <SelectItem value="JSON">JSON</SelectItem>
                              <SelectItem value="BOOL">BOOL</SelectItem>
                              <SelectItem value="FLOAT_VECTOR">FLOAT_VECTOR</SelectItem>
                            </SelectContent>
                          </Select>
                          {field.dataType === "FLOAT_VECTOR" && (
                            <Input
                              type="number"
                              placeholder="维度"
                              value={field.dimension || ""}
                              onChange={(e) => updateField(idx, { dimension: Number(e.target.value) })}
                              className="w-20"
                            />
                          )}
                          {field.dataType === "VARCHAR" && (
                            <Input
                              type="number"
                              placeholder="最大长度"
                              value={field.maxLength || ""}
                              onChange={(e) => updateField(idx, { maxLength: Number(e.target.value) })}
                              className="w-24"
                            />
                          )}
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={field.isPrimaryKey}
                              onChange={(e) => updateField(idx, { isPrimaryKey: e.target.checked })}
                            />
                            主键
                          </label>
                          <Button size="sm" variant="ghost" onClick={() => removeField(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>索引类型</Label>
                      <Select value={form.indexType} onValueChange={(v) => setForm({ ...form, indexType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUTO_INDEX">AUTO_INDEX</SelectItem>
                          <SelectItem value="IVF_FLAT">IVF_FLAT</SelectItem>
                          <SelectItem value="HNSW">HNSW</SelectItem>
                          <SelectItem value="FLAT">FLAT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>度量类型</Label>
                      <Select value={form.metricType} onValueChange={(v) => setForm({ ...form, metricType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COSINE">COSINE</SelectItem>
                          <SelectItem value="L2">L2 (欧氏距离)</SelectItem>
                          <SelectItem value="IP">IP (内积)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateCol}
                    disabled={creatingCol || !form.name.trim()}
                    className="w-full"
                  >
                    {creatingCol ? "创建中..." : "创建集合"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            {error.includes("失效") && (
              <Button size="sm" variant="outline" onClick={() => setCurrentPage("connect")}>
                重新连接
              </Button>
            )}
          </div>
        )}

        {/* Collection list */}
        <div className="flex-1 overflow-auto p-3">
          {!selectedDatabase ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Database className="h-8 w-8 mb-2" />
              <p className="text-sm">请先在左侧选择一个数据库</p>
            </div>
          ) : colLoading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : collections.length === 0 ? (
            <p className="text-muted-foreground">暂无集合，点击「创建集合」开始</p>
          ) : (
            <div className="grid gap-2">
              {collections.map((col) => (
                <div
                  key={col.name}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <LayoutList className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{col.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {col.rowCount.toLocaleString()} 行 · {col.indexCount} 索引 · {col.state}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleViewData(col.name)}>
                      <Table2 className="h-4 w-4 mr-1" />
                      查看数据
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleLoadCol(col.name)} title="加载">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleReleaseCol(col.name)} title="释放">
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteCol(col.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
