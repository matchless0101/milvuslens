import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, History } from "lucide-react";
import type { BatchSearchItem, SearchHit } from "@/hooks/useSemanticSearch";
import { pickPreviewText } from "@/hooks/useSemanticSearch";

interface SearchPanelProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  searching: boolean;
  searchResults: SearchHit[];
  batchResults: BatchSearchItem[];
  searchHistory: string[];
  onClearHistory: () => void;
  onSearch: () => void;
  onExportCsv: () => void;
  onSelectRow: (row: Record<string, unknown>) => void;
  vectorFields: Array<{ name: string }>;
  searchField: string;
  onSearchFieldChange: (v: string) => void;
  metricType: string;
  onMetricTypeChange: (v: string) => void;
  topK: number;
  onTopKChange: (v: number) => void;
  onOpenEvaluate: () => void;
}

export function SearchPanel({
  searchQuery,
  onSearchQueryChange,
  searching,
  searchResults,
  batchResults,
  searchHistory,
  onClearHistory,
  onSearch,
  onExportCsv,
  onSelectRow,
  vectorFields,
  searchField,
  onSearchFieldChange,
  metricType,
  onMetricTypeChange,
  topK,
  onTopKChange,
  onOpenEvaluate,
}: SearchPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const isDistanceMetric = metricType.toUpperCase() === "L2";

  return (
    <div className="border-b p-4 bg-muted/30">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">输入问题（多行可批量搜索）</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-3 w-3 mr-1" />
                历史
              </Button>
              {searchHistory.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={onClearHistory}
                >
                  清空历史
                </Button>
              )}
            </div>
          </div>
          <Textarea
            placeholder={"例如：疲劳试验的参数是什么？\n也可每行一个问题，一次批量搜索"}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="min-h-[72px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSearch();
              }
            }}
          />
          {showHistory && searchHistory.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {searchHistory.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="text-xs px-2 py-0.5 rounded border bg-background hover:bg-accent max-w-[220px] truncate"
                  title={h}
                  onClick={() => onSearchQueryChange(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
        {vectorFields.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">向量字段</Label>
            <select
              className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm"
              value={searchField}
              onChange={(e) => onSearchFieldChange(e.target.value)}
            >
              {vectorFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Metric</Label>
          <select
            className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
            value={metricType}
            onChange={(e) => onMetricTypeChange(e.target.value)}
          >
            <option value="COSINE">COSINE</option>
            <option value="IP">IP</option>
            <option value="L2">L2</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">TopK</Label>
          <Input
            type="number"
            value={topK}
            onChange={(e) => onTopKChange(Number(e.target.value))}
            className="w-20"
            min={1}
            max={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button onClick={onSearch} disabled={searching}>
            {searching ? "搜索中..." : "搜索"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={searchResults.length === 0 && batchResults.length === 0}
            title="将当前搜索结果导出为 CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            导出CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenEvaluate} title="批量问题召回评测">
            评测
          </Button>
        </div>
      </div>

      {batchResults.length === 0 && searchResults.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-auto">
          <p className="text-xs text-muted-foreground">
            找到 {searchResults.length} 条结果 · metric: {metricType}
            {isDistanceMetric ? " · 距离越小越相似" : " · 分数越大越相似"}
          </p>
          {searchResults.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 border rounded bg-background cursor-pointer hover:bg-accent/50"
              onClick={() => onSelectRow(r.data)}
            >
              <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
              <span className="text-sm font-semibold text-primary w-20">
                {r.score.toFixed(4)}
              </span>
              <span className="text-xs text-muted-foreground w-16">
                ID: {String(r.id).slice(0, 10)}
              </span>
              <span className="text-sm truncate flex-1">{pickPreviewText(r.data)}</span>
            </div>
          ))}
        </div>
      )}

      {batchResults.length > 0 && (
        <div className="mt-3 space-y-3 max-h-64 overflow-auto">
          <p className="text-xs text-muted-foreground">
            批量结果 · {batchResults.length} 个问题 · 可导出 CSV
          </p>
          {batchResults.map((item, qi) => (
            <div key={qi} className="border rounded-md p-2 bg-background">
              <p className="text-xs font-medium mb-1 truncate" title={item.query}>
                Q{qi + 1}: {item.query}
              </p>
              {item.error ? (
                <p className="text-xs text-destructive">{item.error}</p>
              ) : (
                item.results.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-accent/50 rounded px-1"
                    onClick={() => onSelectRow(r.data)}
                  >
                    <span className="text-muted-foreground w-5">#{i + 1}</span>
                    <span className="font-semibold text-primary w-16">
                      {r.score.toFixed(4)}
                    </span>
                    <span className="truncate flex-1">{pickPreviewText(r.data)}</span>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
