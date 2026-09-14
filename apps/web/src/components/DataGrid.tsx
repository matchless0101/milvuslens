import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROW_HEIGHT = 36;
const DEFAULT_COL_WIDTH = 140;
const MIN_COL_WIDTH = 72;
const MAX_COL_WIDTH = 720;

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) {
    if (val.length > 8) {
      return `[${val.slice(0, 8).map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join(", ")}...]`;
    }
    return `[${val.map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join(", ")}]`;
  }
  if (typeof val === "object") return JSON.stringify(val).slice(0, 50);
  return String(val);
}

export interface DataGridProps {
  rows: Record<string, unknown>[];
  columns: string[];
  loading: boolean;
  loadError: string | null;
  filter: string;
  page: number;
  pageSize: number;
  total: number | null;
  onSelectRow: (row: Record<string, unknown>) => void;
  onRetry: () => void;
  onClearFilter: () => void;
  onPageChange: (page: number) => void;
  onResetWidths?: () => void;
}

export function DataGrid({
  rows,
  columns,
  loading,
  loadError,
  filter,
  page,
  pageSize,
  total,
  onSelectRow,
  onRetry,
  onClearFilter,
  onPageChange,
}: DataGridProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const gridTemplate = columns
    .map((col) => `${columnWidths[col] ?? DEFAULT_COL_WIDTH}px`)
    .join(" ");

  const startColumnResize = (col: string, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[col] ?? DEFAULT_COL_WIDTH;

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(
        Math.max(startWidth + (ev.clientX - startX), MIN_COL_WIDTH),
        MAX_COL_WIDTH
      );
      setColumnWidths((prev) => ({ ...prev, [col]: next }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <div ref={tableRef} className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-sm font-medium text-destructive">数据加载失败</p>
            <p className="text-sm text-muted-foreground max-w-md">{loadError}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              重试
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-sm text-muted-foreground">
              {filter ? "当前筛选条件下没有匹配数据" : "集合中暂无数据"}
            </p>
            {filter && (
              <Button size="sm" variant="outline" onClick={onClearFilter}>
                清除筛选
              </Button>
            )}
          </div>
        ) : (
          <div className="min-w-max">
            <div
              className="sticky top-0 z-10 grid bg-background border-b"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((col) => (
                <div
                  key={col}
                  className="relative px-3 py-2 text-left font-medium text-muted-foreground truncate select-none"
                  title={col}
                >
                  {col}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary"
                    onMouseDown={(e) => startColumnResize(col, e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full grid border-b hover:bg-accent/50 cursor-pointer"
                    style={{
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: gridTemplate,
                    }}
                    onClick={() => onSelectRow(row)}
                  >
                    {columns.map((col) => (
                      <div
                        key={col}
                        className="px-3 py-2 truncate text-sm"
                        title={formatValue(row[col])}
                      >
                        {formatValue(row[col])}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            第 {page + 1} 页 · {rows.length} 条
            {total !== null && !filter ? ` · 共 ${total.toLocaleString()} 条` : ""}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              total !== null && !filter
                ? (page + 1) * pageSize >= total
                : rows.length < pageSize
            }
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export { formatValue };
