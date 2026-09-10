import { useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import { translateError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings, CheckCircle, XCircle } from "lucide-react";

export function SettingsPage() {
  const { embeddingConfig, setEmbeddingConfig } = useAppStore();
  const [form, setForm] = useState(embeddingConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const handleSave = () => {
    setEmbeddingConfig(form);
    setTestResult({ ok: true, msg: "配置已保存" });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testEmbedding(form);
    setTesting(false);
    if (res.success) {
      const data = res.data as any;
      setTestResult({
        ok: true,
        msg: `连接成功 · ${data.dimensions} 维 · 模型: ${data.model}`,
      });
    } else {
      setTestResult({ ok: false, msg: translateError(res.error) });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-muted-foreground">配置 Embedding 服务和其他选项</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Embedding 配置
          </CardTitle>
          <CardDescription>
            用于语义搜索的文本向量化服务，支持 OpenAI 兼容接口
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">API Base URL</Label>
            <Input
              id="baseUrl"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
            <p className="text-xs text-muted-foreground">
              支持 OpenAI、智谱、通义等 OpenAI 兼容接口
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">模型名称</Label>
            <Input
              id="model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="text-embedding-3-small"
            />
            <p className="text-xs text-muted-foreground">
              常用: text-embedding-3-small, text-embedding-3-large,
              embedding-3
            </p>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}
            >
              {testResult.ok ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult.msg}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "测试中..." : "测试配置"}
            </Button>
            <Button onClick={handleSave}>保存配置</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            MilvusLens v0.1.0 — 轻量开源 Milvus 管理工具
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            支持 Milvus 2.4+ / 2.5+ · 暗色模式 · 命令面板 (Ctrl+K)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
