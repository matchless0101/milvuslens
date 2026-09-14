import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/stores/app";
import type { EmbedResponse } from "@milvuslens/shared";

export type SearchHit = {
  id: string | number;
  score: number;
  data: Record<string, unknown>;
};

export type BatchSearchItem = {
  query: string;
  results: SearchHit[];
  error?: string;
};

export function pickPreviewText(data: Record<string, unknown>): string {
  const skip = new Set(["embedding", "vector", "$meta"]);
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k) || k.toLowerCase().includes("vector")) continue;
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

interface UseSemanticSearchArgs {
  connectionId: string | null;
  collection: string | null;
  database?: string | null;
  vectorField: string;
  metricType: string;
  topK: number;
  onNeedEmbeddingConfig?: () => void;
}

export function useSemanticSearch({
  connectionId,
  collection,
  database,
  vectorField,
  metricType,
  topK,
  onNeedEmbeddingConfig,
}: UseSemanticSearchArgs) {
  const { embeddingConfig, addSearchHistory } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [batchResults, setBatchResults] = useState<BatchSearchItem[]>([]);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setBatchResults([]);
  }, []);

  const runOneSearch = async (question: string): Promise<{ results: SearchHit[]; error?: string }> => {
    if (!connectionId || !collection) {
      return { results: [], error: "未选择连接或集合" };
    }
    const embedRes = await api.embed(question, embeddingConfig);
    if (!embedRes.success) {
      return { results: [], error: translateError(embedRes.error) };
    }
    const embedding = (embedRes.data as EmbedResponse).embedding;
    const searchRes = await api.searchData(
      connectionId,
      collection,
      { vector: embedding, vectorField, topK, metricType },
      database || undefined
    );
    if (!searchRes.success) {
      return { results: [], error: translateError(searchRes.error) };
    }
    return { results: (searchRes.data as SearchHit[]) || [] };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !connectionId || !collection) return;
    if (!embeddingConfig.baseUrl || !embeddingConfig.model) {
      toast({
        title: "未配置 Embedding",
        description: "请先在设置中填写 API Base URL 与模型名称",
      });
      onNeedEmbeddingConfig?.();
      return;
    }

    const questions = searchQuery
      .split(/\r?\n/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length === 0) return;

    setSearching(true);
    setSearchResults([]);
    setBatchResults([]);

    try {
      if (questions.length === 1) {
        const { results, error } = await runOneSearch(questions[0]);
        if (error) {
          toast({ variant: "destructive", title: "搜索失败", description: error });
        } else {
          setSearchResults(results);
          addSearchHistory(questions[0]);
        }
      } else {
        const batch: BatchSearchItem[] = [];
        for (const q of questions) {
          const { results, error } = await runOneSearch(q);
          batch.push({ query: q, results, error });
          addSearchHistory(q);
        }
        setBatchResults(batch);
        const failed = batch.filter((b) => b.error).length;
        toast({
          title: "批量搜索完成",
          description: `共 ${batch.length} 个问题${failed ? `，${failed} 个失败` : ""}`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "搜索出错",
        description: translateError((err as Error).message),
      });
    }
    setSearching(false);
  };

  const exportCsv = () => {
    const rowsOut: string[][] = [["question", "rank", "score", "id", "text"]];
    if (batchResults.length > 0) {
      for (const item of batchResults) {
        if (item.error) {
          rowsOut.push([item.query, "", "", "", `ERROR: ${item.error}`]);
          continue;
        }
        item.results.forEach((r, i) => {
          rowsOut.push([
            item.query,
            String(i + 1),
            String(r.score),
            String(r.id),
            pickPreviewText(r.data),
          ]);
        });
      }
    } else {
      searchResults.forEach((r, i) => {
        rowsOut.push([
          searchQuery.trim(),
          String(i + 1),
          String(r.score),
          String(r.id),
          pickPreviewText(r.data),
        ]);
      });
    }
    if (rowsOut.length <= 1) {
      toast({ title: "没有可导出的结果" });
      return;
    }
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = "﻿" + rowsOut.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milvuslens-search-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "已导出 CSV" });
  };

  return {
    searchQuery,
    setSearchQuery,
    searching,
    searchResults,
    batchResults,
    setSearchResults,
    clearResults,
    handleSearch,
    exportCsv,
  };
}
