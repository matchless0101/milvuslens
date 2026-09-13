import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { toast } from "@/hooks/use-toast";
import type { EmbedResponse } from "@milvuslens/shared";

interface EvaluateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  collectionName: string;
  database?: string | null;
  vectorField: string;
  metricType: string;
  embeddingConfig: { baseUrl: string; apiKey: string; model: string };
}

type EvalRow = {
  question: string;
  expectedId: string;
  hit1: boolean;
  hit3: boolean;
  hitK: boolean;
  topId: string;
  topScore: number;
  rank: number | null;
  error?: string;
};

/**
 * Input format (one per line):
 *   问题
 *   问题|期望id
 */
function parseCases(text: string): Array<{ q: string; expected: string }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf("|");
      if (idx > 0) {
        return {
          q: line.slice(0, idx).trim(),
          expected: line.slice(idx + 1).trim(),
        };
      }
      return { q: line, expected: "" };
    });
}

export function EvaluateDialog({
  open,
  onOpenChange,
  connectionId,
  collectionName,
  database,
  vectorField,
  metricType,
  embeddingConfig,
}: EvaluateDialogProps) {
  const [casesText, setCasesText] = useState("");
  const [topK, setTopK] = useState(5);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [summary, setSummary] = useState<string>("");

  const runEval = async () => {
    if (!connectionId || !collectionName) return;
    if (!embeddingConfig.baseUrl || !embeddingConfig.model) {
      toast({
        variant: "destructive",
        title: "未配置 Embedding",
        description: "请先在设置中配置后再评测",
      });
      return;
    }
    const cases = parseCases(casesText);
    if (cases.length === 0) {
      toast({ variant: "destructive", title: "请先粘贴问题列表" });
      return;
    }

    setRunning(true);
    setRows([]);
    setSummary("");

    const out: EvalRow[] = [];
    for (const c of cases) {
      try {
        const embedRes = await api.embed(c.q, embeddingConfig);
        if (!embedRes.success) {
          out.push({
            question: c.q,
            expectedId: c.expected,
            hit1: false,
            hit3: false,
            hitK: false,
            topId: "",
            topScore: 0,
            rank: null,
            error: translateError(embedRes.error),
          });
          continue;
        }
        const embedding = (embedRes.data as EmbedResponse).embedding;
        const searchRes = await api.searchData(
          connectionId,
          collectionName,
          {
            vector: embedding,
            vectorField,
            topK,
            metricType,
            outputFields: ["id"],
          },
          database || undefined
        );
        if (!searchRes.success) {
          out.push({
            question: c.q,
            expectedId: c.expected,
            hit1: false,
            hit3: false,
            hitK: false,
            topId: "",
            topScore: 0,
            rank: null,
            error: translateError(searchRes.error),
          });
          continue;
        }
        const hits =
          (searchRes.data as Array<{
            id: string | number;
            score: number;
          }>) || [];
        const top = hits[0];
        let rank: number | null = null;
        if (c.expected) {
          const i = hits.findIndex((h) => String(h.id) === c.expected);
          rank = i >= 0 ? i + 1 : null;
        }
        out.push({
          question: c.q,
          expectedId: c.expected,
          hit1: c.expected ? rank === 1 : hits.length > 0,
          hit3: c.expected ? rank !== null && rank <= 3 : hits.length > 0,
          hitK: c.expected ? rank !== null : hits.length > 0,
          topId: top ? String(top.id) : "",
          topScore: top ? Number(top.score) : 0,
          rank,
        });
      } catch (e) {
        out.push({
          question: c.q,
          expectedId: c.expected,
          hit1: false,
          hit3: false,
          hitK: false,
          topId: "",
          topScore: 0,
          rank: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const withExpected = out.filter((r) => r.expectedId);
    const n = withExpected.length;
    if (n > 0) {
      const h1 = withExpected.filter((r) => r.hit1).length;
      const h3 = withExpected.filter((r) => r.hit3).length;
      const hk = withExpected.filter((r) => r.hitK).length;
      setSummary(
        `带期望 ID 的 ${n} 条：Hit@1 ${(h1 / n * 100).toFixed(0)}% · Hit@3 ${(
          (h3 / n) *
          100
        ).toFixed(0)}% · Hit@${topK} ${((hk / n) * 100).toFixed(0)}%`
      );
    } else {
      setSummary(`共 ${out.length} 条问题（未提供期望 ID，仅统计是否返回结果）`);
    }
    setRows(out);
    setRunning(false);
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = [
      "question",
      "expected_id",
      "hit1",
      "hit3",
      `hit@${topK}`,
      "top_id",
      "top_score",
      "rank",
      "error",
    ];
    const body = rows.map((r) =>
      [
        r.question,
        r.expectedId,
        r.hit1 ? "1" : "0",
        r.hit3 ? "1" : "0",
        r.hitK ? "1" : "0",
        r.topId,
        String(r.topScore),
        r.rank === null ? "" : String(r.rank),
        r.error || "",
      ]
        .map((s) => `"${String(s).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "﻿" + [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milvuslens-eval-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>召回评测</DialogTitle>
          <DialogDescription>
            每行一个问题；可写成「问题|期望id」。有期望 ID 时统计 Hit@1 / Hit@3 / Hit@K
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">问题列表</Label>
            <Textarea
              placeholder={
                "疲劳试验的加载频率是多少？|c1\n骨水泥怎么固定的？|c2\n有没有关于髋关节磨损的说明？|c4"
              }
              value={casesText}
              onChange={(e) => setCasesText(e.target.value)}
              className="min-h-[140px] font-mono text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">TopK</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 5)}
                className="w-24"
              />
            </div>
            <Button onClick={() => void runEval()} disabled={running}>
              {running ? "评测中..." : "开始评测"}
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              导出CSV
            </Button>
          </div>

          {summary && (
            <p className="text-sm font-medium">{summary}</p>
          )}

          {rows.length > 0 && (
            <div className="border rounded-md overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">问题</th>
                    <th className="text-left px-2 py-1.5">期望</th>
                    <th className="text-left px-2 py-1.5">Top1</th>
                    <th className="text-left px-2 py-1.5">分数</th>
                    <th className="text-left px-2 py-1.5">排名</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 max-w-[220px] truncate" title={r.question}>
                        {r.error ? `${r.question} ⚠` : r.question}
                      </td>
                      <td className="px-2 py-1.5">{r.expectedId || "—"}</td>
                      <td className="px-2 py-1.5">{r.topId || "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.topScore ? r.topScore.toFixed(4) : "—"}
                      </td>
                      <td
                        className={`px-2 py-1.5 ${
                          r.expectedId
                            ? r.rank === 1
                              ? "text-green-600 font-medium"
                              : r.rank
                                ? "text-amber-600"
                                : "text-destructive"
                            : ""
                        }`}
                      >
                        {r.expectedId
                          ? r.rank
                            ? `#${r.rank}`
                            : "未命中"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
