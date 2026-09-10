import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
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
  LayoutList,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  Square,
  Table2,
} from "lucide-react";
import type { CollectionInfo } from "@milvuslens/shared";

export function CollectionsPage() {
  const {
    activeConnectionId,
    selectedDatabase,
    setCurrentPage,
    setSelectedCollection,
  } = useAppStore();

  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
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
  const [creating, setCreating] = useState(false);

  const loadCollections = async () => {
    if (!activeConnectionId) return;
    setLoading(true);
    const res = await api.listCollections(activeConnectionId, selectedDatabase || undefined);
    setLoading(false);
    if (res.success) {
      setCollections((res.data as CollectionInfo[]) || []);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [activeConnectionId, selectedDatabase]);

  const handleCreate = async () => {
    if (!form.name.trim() || !activeConnectionId) return;
    setCreating(true);
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
    setCreating(false);
    if (res.success) {
      setCreateOpen(false);
      setForm({ ...form, name: "" });
      loadCollections();
    }
  };

  const handleDelete = async (name: string) => {
    if (!activeConnectionId) return;
    if (!confirm(`确定删除集合 "${name}" 吗？此操作不可恢复。`)) return;
    await api.deleteCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleLoad = async (name: string) => {
    if (!activeConnectionId) return;
    await api.loadCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleRelease = async (name: string) => {
    if (!activeConnectionId) return;
    await api.releaseCollection(activeConnectionId, name);
    loadCollections();
  };

  const handleViewData = (name: string) => {
    setSelectedCollection(name);
    setCurrentPage("data");
  };

  const addField = () => {
    setForm({
      ...form,
      fields: [
        ...form.fields,
        { name: "", dataType: "VARCHAR", isPrimaryKey: false, maxLength: 256 },
      ],
    });
  };

  const removeField = (idx: number) => {
    setForm({
      ...form,
      fields: form.fields.filter((_, i) => i !== idx),
    });
  };

  const updateField = (idx: number, updates: Partial<typeof form.fields[0]>) => {
    setForm({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...updates } : f)),
    });
  };

  if (!activeConnectionId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <LayoutList className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">未连接</h2>
        <Button onClick={() => setCurrentPage("connect")}>前往连接</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">集合</h2>
          <p className="text-muted-foreground">
            数据库：{selectedDatabase || "default"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadCollections}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 border rounded"
                      >
                        <Input
                          placeholder="字段名"
                          value={field.name}
                          onChange={(e) =>
                            updateField(idx, { name: e.target.value })
                          }
                          className="w-32"
                        />
                        <Select
                          value={field.dataType}
                          onValueChange={(v) =>
                            updateField(idx, { dataType: v })
                          }
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
                            <SelectItem value="FLOAT_VECTOR">
                              FLOAT_VECTOR
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {field.dataType === "FLOAT_VECTOR" && (
                          <Input
                            type="number"
                            placeholder="维度"
                            value={field.dimension || ""}
                            onChange={(e) =>
                              updateField(idx, {
                                dimension: Number(e.target.value),
                              })
                            }
                            className="w-20"
                          />
                        )}
                        {field.dataType === "VARCHAR" && (
                          <Input
                            type="number"
                            placeholder="最大长度"
                            value={field.maxLength || ""}
                            onChange={(e) =>
                              updateField(idx, {
                                maxLength: Number(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                        )}
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={field.isPrimaryKey}
                            onChange={(e) =>
                              updateField(idx, {
                                isPrimaryKey: e.target.checked,
                              })
                            }
                          />
                          主键
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeField(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>索引类型</Label>
                    <Select
                      value={form.indexType}
                      onValueChange={(v) => setForm({ ...form, indexType: v })}
                    >
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
                    <Select
                      value={form.metricType}
                      onValueChange={(v) => setForm({ ...form, metricType: v })}
                    >
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
                  onClick={handleCreate}
                  disabled={creating || !form.name.trim()}
                  className="w-full"
                >
                  {creating ? "创建中..." : "创建集合"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : collections.length === 0 ? (
          <p className="text-muted-foreground">暂无集合，点击「创建集合」开始</p>
        ) : (
          collections.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <LayoutList className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{col.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {col.rowCount.toLocaleString()} 行 · {col.indexCount} 索引
                    · {col.state}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewData(col.name)}
                >
                  <Table2 className="h-4 w-4 mr-1" />
                  查看数据
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleLoad(col.name)}
                  title="加载"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRelease(col.name)}
                  title="释放"
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(col.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
