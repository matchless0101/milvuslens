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
import { rememberConnection } from "@/lib/autoReconnect";
import { Switch } from "@/components/ui/switch";
import { Plug, Trash2, CheckCircle, XCircle } from "lucide-react";
import type { ConnectionConfig } from "@milvuslens/shared";

export function ConnectPage() {
  const {
    connections,
    addConnection,
    removeConnection,
    setActiveConnection,
    setCurrentPage,
  } = useAppStore();

  const [form, setForm] = useState({
    name: "",
    host: "localhost",
    port: 19530,
    username: "",
    password: "",
    tls: false,
  });
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [reconnectPassword, setReconnectPassword] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<
    { ok: boolean; msg: string } | null
  >(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testConnection({
      ...form,
      id: "",
    });
    setTesting(false);
    const testData = res.data as { connected?: boolean; error?: string } | undefined;
    if (res.success && testData?.connected) {
      setTestResult({ ok: true, msg: "连接成功" });
    } else {
      setTestResult({
        ok: false,
        msg: translateError(res.error || testData?.error),
      });
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    const config: ConnectionConfig = {
      id: crypto.randomUUID(),
      name: form.name || `${form.host}:${form.port}`,
      host: form.host,
      port: form.port,
      username: form.username || undefined,
      password: form.password || undefined,
      tls: form.tls,
    };

    const res = await api.connect(config);
    setConnecting(false);

    if (res.success && res.data) {
      // Use the server-assigned connectionId, not the client-generated one
      const serverId = (res.data as { connectionId: string }).connectionId;
      const savedConfig = { ...config, id: serverId };
      addConnection(savedConfig);
      setActiveConnection(serverId);
      rememberConnection(savedConfig);
      setCurrentPage("explorer");
    } else {
      setTestResult({ ok: false, msg: translateError(res.error) });
    }
  };

  // Reconnect using a saved connection config — calls backend to get a fresh connectionId
  const handleReconnect = async (conn: ConnectionConfig) => {
    // Password is not persisted by default; require it again when username auth is used
    const password = conn.password || reconnectPassword[conn.id] || undefined;
    if (conn.username && !password && !conn.token) {
      setTestResult({
        ok: false,
        msg: "该连接使用用户名认证，请先输入密码后再连接",
      });
      return;
    }

    setReconnectingId(conn.id);
    setTestResult(null);

    const payload: ConnectionConfig = {
      ...conn,
      password: password || undefined,
    };

    // Create the new server connection first; only drop the old one after success
    const res = await api.connect(payload);

    if (res.success && res.data) {
      const serverId = (res.data as { connectionId: string }).connectionId;
      if (conn.id && conn.id !== serverId) {
        void api.disconnect(conn.id);
      }
      removeConnection(conn.id);
      const next = { ...payload, id: serverId };
      addConnection(next);
      setActiveConnection(serverId);
      rememberConnection(next);
      setCurrentPage("explorer");
    } else {
      setTestResult({ ok: false, msg: translateError(res.error) });
    }
    setReconnectingId(null);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">连接 Milvus</h2>
        <p className="text-muted-foreground">
          填写服务器信息以建立连接
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新建连接</CardTitle>
          <CardDescription>支持 Milvus 2.4+ / 2.5+</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">连接名称</Label>
              <Input
                id="name"
                placeholder="My Milvus"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={form.port}
                onChange={(e) =>
                  setForm({ ...form, port: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tls">TLS</Label>
              <div className="flex items-center h-10">
                <Switch
                  checked={form.tls}
                  onCheckedChange={(v) => setForm({ ...form, tls: v })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">用户名（可选）</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码（可选）</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>
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
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "测试中..." : "测试连接"}
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              <Plug className="h-4 w-4 mr-2" />
              {connecting ? "连接中..." : "连接"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>已保存的连接</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {connections.map((conn) => {
              const needsPassword = Boolean(conn.username) && !conn.password && !conn.token;
              return (
                <div
                  key={conn.id}
                  className="p-3 border rounded-md space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{conn.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {conn.host}:{conn.port}
                        {conn.username ? ` · ${conn.username}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={reconnectingId === conn.id}
                        onClick={() => handleReconnect(conn)}
                      >
                        {reconnectingId === conn.id ? "连接中..." : "连接"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await api.disconnect(conn.id);
                          removeConnection(conn.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {needsPassword && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder="密码未保存，请输入后连接"
                        value={reconnectPassword[conn.id] || ""}
                        onChange={(e) =>
                          setReconnectPassword({
                            ...reconnectPassword,
                            [conn.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleReconnect(conn);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
