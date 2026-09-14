import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { JsonViewer } from "@/components/JsonViewer";
import { Copy, X } from "lucide-react";

interface RowDetailPanelProps {
  row: Record<string, unknown>;
  onClose: () => void;
}

export function RowDetailPanel({ row, onClose }: RowDetailPanelProps) {
  const [detailWidth, setDetailWidth] = useState(384);
  const isDragging = useRef(false);

  const startDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = detailWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 240), 800);
      setDetailWidth(newWidth);
    };
    const onUp = () => {
      isDragging.current = false;
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
      <div
        className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors shrink-0"
        onMouseDown={startDrag}
      />
      <div className="border-l overflow-auto shrink-0" style={{ width: detailWidth }}>
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold">行详情</h3>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(row, null, 2));
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(row).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{key}</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      typeof value === "object" ? JSON.stringify(value) : String(value)
                    )
                  }
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-sm bg-muted rounded overflow-auto max-h-60">
                {Array.isArray(value) && value.length > 0 && typeof value[0] === "number" ? (
                  <div className="font-mono p-2">
                    {value.length > 20
                      ? `[${value.length} 维向量] 前20维: [${value
                          .slice(0, 20)
                          .map((v: number) => v.toFixed(4))
                          .join(", ")}...]`
                      : `[${value
                          .map((v: number) => (typeof v === "number" ? v.toFixed(4) : v))
                          .join(", ")}]`}
                  </div>
                ) : typeof value === "object" && value !== null ? (
                  <div className="p-2">
                    <JsonViewer data={value} defaultExpanded={true} />
                  </div>
                ) : (
                  <div className="font-mono p-2">{String(value ?? "—")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
