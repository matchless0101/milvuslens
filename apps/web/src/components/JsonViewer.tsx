import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface JsonViewerProps {
  data: unknown;
  name?: string;
  level?: number;
  defaultExpanded?: boolean;
}

function getValueColor(value: unknown): string {
  if (value === null) return "text-muted-foreground italic";
  if (value === undefined) return "text-muted-foreground italic";
  if (typeof value === "boolean") return "text-purple-500";
  if (typeof value === "number") return "text-blue-500";
  if (typeof value === "string") return "text-green-600 dark:text-green-400";
  return "";
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > 100 ? `"${value.slice(0, 100)}..."` : `"${value}"`;
  }
  return String(value);
}

function getTypeLabel(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value === null) return "null";
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return `{${keys.length}}`;
  }
  return typeof value;
}

export function JsonViewer({
  data,
  name,
  level = 0,
  defaultExpanded = level < 2,
}: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isExpandable =
    data !== null && typeof data === "object" && Object.keys(data as object).length > 0;

  const indent = level * 16;

  if (!isExpandable) {
    return (
      <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: indent }}>
        {name !== undefined && (
          <>
            <span className="text-muted-foreground">{name}:</span>
          </>
        )}
        <span className={getValueColor(data)}>{formatValue(data)}</span>
      </div>
    );
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-accent/50 rounded"
        style={{ paddingLeft: indent }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {name !== undefined && (
          <span className="text-muted-foreground">{name}:</span>
        )}
        <span className="text-xs text-muted-foreground">
          {expanded ? "" : getTypeLabel(data)}
        </span>
        {!expanded && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {Array.isArray(data)
              ? `[…]`
              : `{…}`}
          </span>
        )}
      </div>
      {expanded && (
        <div className="border-l ml-2" style={{ marginLeft: indent + 6 }}>
          {entries.map(([key, val]) => (
            <JsonViewer
              key={key}
              data={val}
              name={key}
              level={level + 1}
              defaultExpanded={level + 1 < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
