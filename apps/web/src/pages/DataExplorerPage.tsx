import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { toast } from "@/hooks/use-toast";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { FilterBuilder } from "@/components/FilterBuilder";
import { ColumnVisibility } from "@/components/ColumnVisibility";
import { ImportDialog } from "@/components/ImportDialog";
import { EvaluateDialog } from "@/components/EvaluateDialog";
import { SearchPanel } from "@/components/SearchPanel";
import { DataGrid } from "@/components/DataGrid";
import { RowDetailPanel } from "@/components/RowDetailPanel";
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
import { RefreshCw, Search, Plus, Trash2 } from "lucide-react";
import type {
  DescribeCollectionResult,
  MilvusFieldSchema,
} from "@milvuslens/shared";

export function DataExplorerPage() {
  const {
    activeConnectionId,
    selectedCollection,
    selectedDatabase,
    setSelectedCollection,
    setSelectedDatabase,
    setCurrentPage,
    embeddingConfig,
    searchHistory,
    clearSearchHistory,
  } = useAppStore();

  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [switcherLoading, setSwitcherLoading] = useState(false);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [schema, setSchema] = useState<DescribeCollectionResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [insertOpen, setInsertOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFilter, setDeleteFilter] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchField, setSearchField] = useState("");
  const [topK, setTopK] = useState(10);
  const [metricType, setMetricType] = useState<string>("IP");
  const [showSearchPanel, setShowSearchPanel] = useState(true);

  const search = useSemanticSearch({
    connectionId: activeConnectionId,
    collection: selectedCollection,
    database: selectedDatabase,
    vectorField: searchField,
    metricType,
    topK,
    onNeedEmbeddingConfig: () => setCurrentPage("settings"),
  });

  const loadDatabases = async () => {
    if (!activeConnectionId) return;
    setSwitcherLoading(true);
    const res = await api.listDatabases(activeConnectionId);
    setSwitcherLoading(false);
    if (res.success) {
      const dbs = (res.data as string[]) || [];
      setDatabases(dbs);
      if (!selectedDatabase && dbs.length > 0) setSelectedDatabase(dbs[0]);
    } else {
      toast({
        variant: "destructive",
        title: "加载数据库失败",
        description: translateError(res.error),
      });
    }
  };

  const loadCollectionNames = async (db: string | null | undefined) => {
    if (!activeConnectionId || !db) {
      setCollections([]);
      return;
    }
    setSwitcherLoading(true);
    const res = await api.listCollections(activeConnectionId, db, false);
    setSwitcherLoading(false);
    if (res.success) {
      const names = (res.data as Array<{ name: string }>)?.map((c) => c.name) || [];
      setCollections(names);
      if (!selectedCollection && names.length > 0) setSelectedCollection(names[0]);
    } else {
      toast({
        variant: "destructive",
        title: "加载集合列表失败",
        description: translateError(res.error),
      });
    }
  };

  const resetTableView = () => {
    setPage(0);
    setFilter("");
    setSelectedRow(null);
    search.clearResults();
    search.setSearchQuery("");
    setSearchField("");
    setVisibleColumns([]);
    setRows([]);
    setSchema(null);
    setTotal(null);
    setLoadError(null);
  };

  const handleDatabaseChange = async (db: string) => {
    if (db === selectedDatabase) return;
    setSelectedDatabase(db);
    setSelectedCollection(null);
    resetTableView();
    await loadCollectionNames(db);
  };

  const handleCollectionChange = (name: string) => {
    if (name === selectedCollection) return;
    setSelectedCollection(name);
    resetTableView();
  };

  const loadSchema = async () => {
    if (!activeConnectionId || !selectedCollection) return;
    const res = await api.getCollectionSchema(
      activeConnectionId,
      selectedCollection,
      selectedDatabase || undefined
    );
    if (res.success) {
      setSchema(res.data as DescribeCollectionResult);
      const fields = (res.data as DescribeCollectionResult)?.schema?.fields || [];
      const vectorField = fields.find(
        (f) => f.data_type === "FloatVector" || f.data_type === 101
      );
      if (vectorField && !searchField) setSearchField(vectorField.name);
      const indexes = (res.data as DescribeCollectionResult)?.index_descriptions || [];
      const matched =
        indexes.find((idx) => !vectorField || idx.field_name === vectorField.name) ||
        indexes[0];
      const metric = matched?.params?.metric_type;
      if (typeof metric === "string") setMetricType(metric);
    } else {
      setLoadError(translateError(res.error));
      toast({
        variant: "destructive",
        title: "加载集合结构失败",
        description: translateError(res.error),
      });
    }
  };

  const loadData = async () => {
    if (!activeConnectionId || !selectedCollection) return;
    setLoading(true);
    const listFields = (
      schema?.schema?.fields as Array<{ name: string; data_type: string | number }> | undefined
    )
      ?.filter(
        (f) =>
          f.data_type !== "FloatVector" &&
          f.data_type !== 101 &&
          f.data_type !== "BinaryVector" &&
          f.data_type !== 100
      )
      .map((f) => f.name);

    const res = await api.queryData(
      activeConnectionId,
      selectedCollection,
      {
        filter: filter || undefined,
        limit: pageSize,
        offset: page * pageSize,
        ...(listFields && listFields.length > 0 ? { outputFields: listFields } : {}),
      },
      selectedDatabase || undefined
    );
    setLoading(false);
    if (res.success) {
      setLoadError(null);
      const data = res.data as { data: Record<string, unknown>[]; total?: number };
      const newRows = data?.data || [];
      setRows(newRows);
      setTotal(typeof data?.total === "number" ? data.total : null);
      if (visibleColumns.length === 0 && newRows.length > 0) {
        setVisibleColumns(Object.keys(newRows[0]));
      }
    } else {
      setLoadError(translateError(res.error));
      toast({
        variant: "destructive",
        title: "加载数据失败",
        description: translateError(res.error),
      });
    }
  };

  useEffect(() => {
    void loadDatabases();
  }, [activeConnectionId]);

  useEffect(() => {
    void loadCollectionNames(selectedDatabase);
  }, [activeConnectionId, selectedDatabase]);

  useEffect(() => {
    void loadSchema();
  }, [activeConnectionId, selectedCollection, selectedDatabase]);

  useEffect(() => {
    if (schema) void loadData();
  }, [schema, activeConnectionId, selectedCollection, selectedDatabase, page, pageSize]);

  const schemaFields: Array<{ name: string; type: string; isVector: boolean }> =
    schema?.schema?.fields?.map((f: MilvusFieldSchema) => ({
      name: f.name,
      type: String(f.data_type),
      isVector: f.data_type === "FloatVector" || f.data_type === 101,
    })) || [];

  const handleInsert = async () => {
    if (!activeConnectionId || !selectedCollection) return;
    setInserting(true);
    const row: Record<string, unknown> = {};
    for (const field of schemaFields) {
      const raw = insertData[field.name];
      if (raw === undefined || raw === "") continue;
      if (field.isVector) {
        try {
          row[field.name] = JSON.parse(raw);
        } catch {
          toast({
            variant: "destructive",
            title: "格式错误",
            description: `字段 ${field.name} 的向量格式不正确，请输入 JSON 数组`,
          });
          setInserting(false);
          return;
        }
      } else if (field.type.includes("Int")) {
        row[field.name] = parseInt(raw, 10);
      } else if (field.type.includes("Float") || field.type.includes("Double")) {
        row[field.name] = parseFloat(raw);
      } else if (field.type.includes("Bool")) {
        row[field.name] = raw === "true";
      } else if (field.type.includes("JSON")) {
        try {
          row[field.name] = JSON.parse(raw);
        } catch {
          toast({
            variant: "destructive",
            title: "格式错误",
            description: `字段 ${field.name} 的 JSON 格式不正确`,
          });
          setInserting(false);
          return;
        }
      } else {
        row[field.name] = raw;
      }
    }

    const res = await api.insertData(
      activeConnectionId,
      selectedCollection,
      [row],
      selectedDatabase || undefined
    );
    setInserting(false);
    if (res.success) {
      setInsertOpen(false);
      setInsertData({});
      void loadData();
    } else {
      toast({
        variant: "destructive",
        title: "插入失败",
        description: translateError(res.error),
      });
    }
  };

  const handleDelete = async () => {
    if (!activeConnectionId || !selectedCollection || !deleteFilter.trim()) return;
    setDeleting(true);
    const res = await api.deleteData(
      activeConnectionId,
      selectedCollection,
      deleteFilter.trim(),
      selectedDatabase || undefined
    );
    setDeleting(false);
    if (res.success) {
      setDeleteOpen(false);
      setDeleteFilter("");
      setDeleteConfirmText("");
      void loadData();
    } else {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: translateError(res.error),
      });
    }
  };

  if (!activeConnectionId || !selectedCollection) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">未选择集合</h2>
        <p className="text-muted-foreground mb-4">请先连接并选择一个集合</p>
        <Button onClick={() => setCurrentPage("explorer")}>前往集合列表</Button>
      </div>
    );
  }

  const vectorFields =
    schema?.schema?.fields?.filter(
      (f) => f.data_type === "FloatVector" || f.data_type === 101
    ) || [];

  const scalarFields: Array<{ name: string; type: string }> =
    schema?.schema?.fields
      ?.filter((f) => f.data_type !== "FloatVector" && f.data_type !== 101)
      ?.map((f) => ({ name: f.name, type: String(f.data_type) })) || [];

  const allColumns: string[] =
    rows.length > 0
      ? Object.keys(rows[0])
      : (schema?.schema?.fields?.map((f: { name: string }) => f.name) as string[]) || [];

  const columns: string[] =
    visibleColumns.length > 0
      ? allColumns.filter((c) => visibleColumns.includes(c))
      : allColumns;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">数据库</Label>
          <Select
            value={selectedDatabase || ""}
            onValueChange={(v) => void handleDatabaseChange(v)}
            disabled={switcherLoading || databases.length === 0}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder={switcherLoading ? "加载中..." : "选择数据库"} />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db} value={db}>
                  {db}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-sm pb-2.5">/</span>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">集合</Label>
          <Select
            value={selectedCollection || ""}
            onValueChange={handleCollectionChange}
            disabled={switcherLoading || !selectedDatabase || collections.length === 0}
          >
            <SelectTrigger className="w-52 h-9">
              <SelectValue
                placeholder={
                  switcherLoading
                    ? "加载中..."
                    : !selectedDatabase
                      ? "请先选择数据库"
                      : "选择集合"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {collections.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={!selectedCollection}
          title="重新加载当前集合的数据"
        >
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
        <div className="flex-1 flex flex-col overflow-hidden">
          {showSearchPanel && (
            <SearchPanel
              searchQuery={search.searchQuery}
              onSearchQueryChange={search.setSearchQuery}
              searching={search.searching}
              searchResults={search.searchResults}
              batchResults={search.batchResults}
              searchHistory={searchHistory}
              onClearHistory={clearSearchHistory}
              onSearch={() => void search.handleSearch()}
              onExportCsv={search.exportCsv}
              onSelectRow={setSelectedRow}
              vectorFields={vectorFields.map((f) => ({ name: f.name }))}
              searchField={searchField}
              onSearchFieldChange={setSearchField}
              metricType={metricType}
              onMetricTypeChange={setMetricType}
              topK={topK}
              onTopKChange={setTopK}
              onOpenEvaluate={() => setEvalOpen(true)}
            />
          )}

          <div className="border-b px-4 py-2 flex items-center gap-3 bg-background flex-wrap">
            <FilterBuilder
              fields={scalarFields}
              filter={filter}
              onFilterChange={setFilter}
              onApply={() => {
                setPage(0);
                void loadData();
              }}
            />
            <ColumnVisibility
              columns={allColumns}
              visibleColumns={visibleColumns.length > 0 ? visibleColumns : allColumns}
              onVisibilityChange={setVisibleColumns}
            />
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              导入
            </Button>
            <ImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              connectionId={activeConnectionId}
              collectionName={selectedCollection}
              database={selectedDatabase}
              schemaFields={schema?.schema?.fields || []}
              embeddingConfig={embeddingConfig}
              onImported={() => void loadData()}
            />

            <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  新增
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>新增数据</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {schemaFields.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <Label className="text-xs">
                        {field.name}
                        <span className="text-muted-foreground ml-1">({field.type})</span>
                      </Label>
                      <Input
                        placeholder={field.isVector ? "[0.1, 0.2, ...]" : field.name}
                        value={insertData[field.name] || ""}
                        onChange={(e) =>
                          setInsertData({ ...insertData, [field.name]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                  <Button onClick={() => void handleInsert()} disabled={inserting} className="w-full">
                    {inserting ? "插入中..." : "插入数据"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeleteFilter("");
                  setDeleteConfirmText("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>删除数据</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    输入筛选表达式，删除所有匹配的数据。此操作不可恢复。
                  </p>
                  <Input
                    placeholder="如: id == 123"
                    value={deleteFilter}
                    onChange={(e) => setDeleteFilter(e.target.value)}
                  />
                  <Input
                    placeholder="输入 删除 以确认"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                  />
                  <Button
                    onClick={() => void handleDelete()}
                    disabled={
                      deleting || !deleteFilter.trim() || deleteConfirmText.trim() !== "删除"
                    }
                    variant="destructive"
                    className="w-full"
                  >
                    {deleting ? "删除中..." : "确认删除"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <span className="text-xs text-muted-foreground">
              {filter || "无筛选条件"}
            </span>
          </div>

          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            loadError={loadError}
            filter={filter}
            page={page}
            pageSize={pageSize}
            total={total}
            onSelectRow={setSelectedRow}
            onRetry={() => void loadData()}
            onClearFilter={() => {
              setFilter("");
              setPage(0);
              void loadData();
            }}
            onPageChange={setPage}
          />
        </div>

        {selectedRow && <RowDetailPanel row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </div>

      <EvaluateDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        connectionId={activeConnectionId}
        collectionName={selectedCollection}
        database={selectedDatabase}
        vectorField={searchField}
        metricType={metricType}
        embeddingConfig={embeddingConfig}
      />
    </div>
  );
}
