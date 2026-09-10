import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  X,
} from "lucide-react";

export function DataExplorerPage() {
  const {
    activeConnectionId,
    selectedCollection,
    setCurrentPage,
    embeddingConfig,
  } = useAppStore();

  // Data state
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState("");
  const [schema, setSchema] = useState<any>(null);

  // Selected row for detail panel
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(
    null
  );

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("");
  const [topK, setTopK] = useState(10);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string | number; score: number; data: Record<string, unknown> }>
  >([]);
  const [showSearchPanel, setShowSearchPanel] = useState(true);

  const tableRef = useRef<HTMLDivElement>(null);

  // Load schema to get field list
  const loadSchema = async () => {
    if (!activeConnectionId || !selectedCollection) return;
    const res = await api.getCollectionSchema(
      activeConnectionId,
      selectedCollection
    );
    if (res.success) {
      setSchema(res.data);
      // Auto-select first vector field for search
      const fields = (res.data as any)?.schema?.fields || [];
      const vectorField = fields.find(
        (f: any) =>
          f.data_type === "FloatVector" || f.data_type === 101
      );
      if (vectorField && !searchField) {
        setSearchField(vectorField.name);
      }
    }
  };

  // Load data
  const loadData = async () => {
    if (!activeConnectionId || !selectedCollection) return;
    setLoading(true);
    const res = await api.queryData(activeConnectionId, selectedCollection, {
      filter: filter || undefined,
      limit: pageSize,
      offset: page * pageSize,
    });
    setLoading(false);
    if (res.success) {
      const data = res.data as { data: Record<string, unknown>[] };
      setRows(data?.data || []);
    }
  };

  useEffect(() => {
    loadSchema();
  }, [activeConnectionId, selectedCollection]);

  useEffect(() => {
    loadData();
  }, [activeConnectionId, selectedCollection, page, pageSize]);

  // Semantic search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeConnectionId || !selectedCollection)
      return;
    if (!embeddingConfig.apiKey) {
      alert("请先在设置中配置 Embedding API");
      setCurrentPage("settings");
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      // Step 1: Embed the query
      const embedRes = await api.embed(searchQuery, embeddingConfig);
      if (!embedRes.success) {
        alert("Embedding 失败: " + embedRes.error);
        setSearching(false);
        return;
      }

      const embedding = (embedRes.data as any).embedding;

      // Step 2: Vector search
      const searchRes = await api.searchData(
        activeConnectionId,
        selectedCollection,
        {
          vector: embedding,
          vectorField: searchField,
          topK,
          metricType: "COSINE",
        }
      );

      if (searchRes.success) {
        setSearchResults(
          (searchRes.data as typeof searchResults) || []
        );
      } else {
        alert("搜索失败: " + searchRes.error);
      }
    } catch (err) {
      alert("搜索出错: " + (err as Error).message);
    }
    setSearching(false);
  };

  // Get columns from first row or schema
  const columns: string[] =
    rows.length > 0
      ? Object.keys(rows[0])
      : (schema?.schema?.fields?.map((f: { name: string }) => f.name) as string[]) || [];

  // Format cell value
  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (Array.isArray(val)) {
      if (val.length > 8) {
        return `[${val.slice(0, 8).map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join(", ")}...]`;
      }
      return `[${val.map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join(", ")}]`;
    }
    if (typeof val === "object") return JSON.stringify(val).slice(0, 50);
    return String(val);
  };

  if (!activeConnectionId || !selectedCollection) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">未选择集合</h2>
        <p className="text-muted-foreground mb-4">
          请先连接并选择一个集合
        </p>
        <Button onClick={() => setCurrentPage("collections")}>
          前往集合列表
        </Button>
      </div>
    );
  }

  const vectorFields =
    schema?.schema?.fields?.filter(
      (f: any) => f.data_type === "FloatVector" || f.data_type === 101
    ) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b p-4 flex items-center gap-3">
        <h2 className="font-semibold text-lg">{selectedCollection}</h2>
        <div className="flex-1" />
        <Input
          placeholder="过滤表达式 (如: id > 100)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadData()}
          className="w-64"
        />
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant={showSearchPanel ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSearchPanel(!showSearchPanel)}
        >
          <Search className="h-4 w-4 mr-1" />
          语义搜索
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content: table + search */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Semantic search panel */}
          {showSearchPanel && (
            <div className="border-b p-4 bg-muted/30">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">输入问题</Label>
                  <Input
                    placeholder="例如: What is the capital of France?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                {vectorFields.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">向量字段</Label>
                    <Select value={searchField} onValueChange={setSearchField}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vectorFields.map((f: any) => (
                          <SelectItem key={f.name} value={f.name}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">TopK</Label>
                  <Input
                    type="number"
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="w-20"
                    min={1}
                    max={100}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? "搜索中..." : "搜索"}
                </Button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                  <p className="text-xs text-muted-foreground">
                    找到 {searchResults.length} 条结果（按相似度排序）
                  </p>
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 border rounded bg-background cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelectedRow(r.data)}
                    >
                      <span className="text-xs font-mono text-muted-foreground w-6">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-primary w-20">
                        {(1 - r.score).toFixed(4)}
                      </span>
                      <span className="text-xs text-muted-foreground w-16">
                        ID: {String(r.id).slice(0, 10)}
                      </span>
                      <span className="text-sm truncate flex-1">
                        {formatValue(
                          Object.entries(r.data).find(
                            ([k]) =>
                              !k.includes("vector") && k !== "id"
                          )?.[1]
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data table */}
          <div ref={tableRef} className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">暂无数据</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 font-medium text-muted-foreground"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b hover:bg-accent/50 cursor-pointer"
                      onClick={() => setSelectedRow(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 max-w-[200px] truncate"
                        >
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="border-t p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs">每页</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                第 {page + 1} 页 · {rows.length} 条
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rows.length < pageSize}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedRow && (
          <div className="w-96 border-l overflow-auto">
            <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
              <h3 className="font-semibold">行详情</h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(selectedRow, null, 2)
                    );
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRow(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {Object.entries(selectedRow).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      {key}
                    </Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-sm font-mono bg-muted p-2 rounded overflow-auto max-h-40">
                    {Array.isArray(value)
                      ? value.length > 20
                        ? `[${value.length} 维向量] 前20维: [${value
                            .slice(0, 20)
                            .map((v: number) => v.toFixed(4))
                            .join(", ")}...]`
                        : `[${value
                            .map((v: number) =>
                              typeof v === "number" ? v.toFixed(4) : v
                            )
                            .join(", ")}]`
                      : typeof value === "object" && value !== null
                        ? JSON.stringify(value, null, 2)
                        : String(value ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
