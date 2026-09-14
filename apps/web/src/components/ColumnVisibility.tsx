import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Columns3, Eye, EyeOff } from "lucide-react";

interface ColumnVisibilityProps {
  columns: string[];
  visibleColumns: string[];
  onVisibilityChange: (cols: string[]) => void;
}

export function ColumnVisibility({
  columns,
  visibleColumns,
  onVisibilityChange,
}: ColumnVisibilityProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      panelRef.current &&
      !panelRef.current.contains(e.target as Node) &&
      btnRef.current &&
      !btnRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const toggleColumn = (col: string) => {
    if (visibleColumns.includes(col)) {
      onVisibilityChange(visibleColumns.filter((c) => c !== col));
    } else {
      onVisibilityChange([...visibleColumns, col]);
    }
  };

  const showAll = () => onVisibilityChange([...columns]);
  const hideAll = () => onVisibilityChange([]);

  const filtered = columns.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <>
      <Button
        ref={btnRef}
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Columns3 className="h-4 w-4 mr-1" />
        字段
        {hiddenCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({visibleColumns.length}/{columns.length})
          </span>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[100] w-[280px] bg-card border rounded-lg shadow-xl p-3 space-y-2"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">显示字段</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={showAll}>
                全选
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={hideAll}>
                全不选
              </Button>
            </div>
          </div>

          <Input
            placeholder="搜索字段..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />

          <div className="max-h-[240px] overflow-auto space-y-0.5">
            {filtered.map((col) => {
              const isVisible = visibleColumns.includes(col);
              return (
                <button
                  key={col}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                  onClick={() => toggleColumn(col)}
                >
                  {isVisible ? (
                    <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={isVisible ? "" : "text-muted-foreground"}>
                    {col}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                无匹配字段
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
