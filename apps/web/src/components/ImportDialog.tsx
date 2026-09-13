import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { toast } from "@/hooks/use-toast";
import type { MilvusFieldSchema } from "@milvuslens/shared";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  collectionName: string;
  database?: string | null;
  schemaFields: MilvusFieldSchema[];
  embeddingConfig: { baseUrl: string; apiKey: string; model: string };
  onImported: () => void;
}

type ParsedRow = Record<string, unknown>;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function parseJsonl(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        rows.push(obj as ParsedRow);
      }
    } catch {
      // skip bad lines
    }
  }
  return rows;
}

function parseJsonArray(text: string): ParsedRow[] {
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v)) {
      return v.filter(
        (x) => x && typeof x === "object" && !Array.isArray(x)
      ) as ParsedRow[];
    }
  } catch {
    /* fallthrough */
  }
  return [];
}

export function ImportDialog({
  open,
  onOpenChange,
  connectionId,
  collectionName,
  database,
  schemaFields,
  embeddingConfig,
  onImported,
}: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [useEmbed, setUseEmbed] = useState(false);
  const [textField, setTextField] = useState("");
  const [vectorField, setVectorField] = useState("");

  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    const keys = new Set<string>();
    rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [rows]);

  const vectorFields = schemaFields.filter(
    (f) => f.data_type === "FloatVector" || f.data_type === 101
  );
  const textLikeFields = schemaFields.filter(
    (f) =>
      f.data_type === "VarChar" ||
      f.data_type === "String" ||
      String(f.data_type).includes("VarChar") ||
      String(f.data_type).includes("String")
  );

  const handleFile = async (file: File) => {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let parsed: ParsedRow[] = [];
    if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
      parsed = parseJsonl(text);
    } else if (lower.endsWith(".json")) {
      parsed = parseJsonArray(text) ;
      if (parsed.length === 0) parsed = parseJsonl(text);
    } else {
      parsed = parseCsv(text);
      if (parsed.length === 0) parsed = parseJsonl(text);
    }
    if (parsed.length === 0) {
      toast({
        variant: "destructive",
        title: "解析失败",
        description: "请上传 CSV（含表头）或 JSONL/JSON 数组",
      });
      return;
    }
    setRows(parsed);
    setFileName(file.name);
    // default vector field
    if (vectorFields[0] && !vectorField) setVectorField(vectorFields[0].name);
    if (textLikeFields[0] && !textField) setTextField(textLikeFields[0].name);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let payloadRows = rows;
    if (useEmbed) {
      if (!textField || !vectorField) {
        toast({
          variant: "destructive",
          title: "请选择文本字段与向量字段",
        });
        setImporting(false);
        return;
      }
      if (!embeddingConfig.baseUrl || !embeddingConfig.model) {
        toast({
          variant: "destructive",
          title: "未配置 Embedding",
          description: "请先在设置中配置后再开启自动向量化",
        });
        setImporting(false);
        return;
      }
      // strip any existing vector column so server generates fresh ones
      payloadRows = rows.map((r) => {
        const { [vectorField]: _drop, ...rest } = r;
        return rest;
      });
    }

    const res = await api.importData(
      connectionId,
      collectionName,
      {
        rows: payloadRows,
        embed: useEmbed
          ? {
              textField,
              vectorField,
              config: embeddingConfig,
            }
          : undefined,
      },
      database || undefined
    );
    setImporting(false);

    if (res.success) {
      const data = res.data as { imported?: number; embedded?: boolean };
      toast({
        title: "导入成功",
        description: `已写入 ${data?.imported ?? payloadRows.length} 行${
          data?.embedded ? "（含自动向量化）" : ""
        }`,
      });
      setRows([]);
      setFileName("");
      onOpenChange(false);
      onImported();
    } else {
      toast({
        variant: "destructive",
        title: "导入失败",
        description: translateError(res.error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>批量导入数据</DialogTitle>
          <DialogDescription>
            支持 CSV（首行为表头）、JSONL、JSON 数组；可对文本字段自动向量化
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.jsonl,.ndjson,.json,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              className="flex-1"
            />
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRows([]);
                  setFileName("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                清除
              </Button>
            )}
          </div>

          {rows.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {fileName} · <span className="font-medium">{rows.length}</span> 行
                · 字段：{columns.join(", ")}
              </p>

              <div className="border rounded-md p-2 max-h-32 overflow-auto text-xs font-mono bg-muted/40">
                {rows.slice(0, 3).map((r, i) => (
                  <div key={i} className="truncate">
                    {JSON.stringify(r).slice(0, 160)}
                  </div>
                ))}
                {rows.length > 3 && (
                  <div className="text-muted-foreground">…</div>
                )}
              </div>

              <div className="flex items-center justify-between border rounded-md p-3">
                <div className="space-y-0.5">
                  <Label>自动向量化</Label>
                  <p className="text-xs text-muted-foreground">
                    对选中文本字段调用 Embedding，写入向量字段
                  </p>
                </div>
                <Switch checked={useEmbed} onCheckedChange={setUseEmbed} />
              </div>

              {useEmbed && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">文本字段（文件列）</Label>
                    <Select value={textField} onValueChange={setTextField}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择列" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">向量字段（集合）</Label>
                    <Select value={vectorField} onValueChange={setVectorField}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择向量字段" />
                      </SelectTrigger>
                      <SelectContent>
                        {vectorFields.map((f) => (
                          <SelectItem key={f.name} value={f.name}>
                            {f.name}
                            {f.dim ? ` (${f.dim}d)` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            取消
          </Button>
          <Button onClick={() => void handleImport()} disabled={rows.length === 0 || importing}>
            {importing ? "导入中..." : `导入 ${rows.length} 行`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
