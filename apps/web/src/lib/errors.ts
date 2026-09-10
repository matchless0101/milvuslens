/**
 * Translate common Milvus / network / SDK errors to Chinese.
 * Known patterns get specific messages; unknown ones get a generic fallback.
 */
export function translateError(raw: string | undefined | null): string {
  if (!raw) return "未知错误";

  const msg = raw.toLowerCase();

  // Connection not found (server restarted)
  if (msg.includes("connection not found")) {
    return "连接已失效（服务可能已重启），请重新连接";
  }

  // Network / DNS
  if (msg.includes("name resolution failed") || msg.includes("dns")) {
    return "无法解析服务器地址，请检查 Host 是否正确";
  }
  if (msg.includes("econnrefused") || msg.includes("connection refused")) {
    return "连接被拒绝，请确认 Milvus 服务已启动且端口正确";
  }
  if (msg.includes("etimedout") || msg.includes("timeout") || msg.includes("deadline")) {
    return "连接超时，请检查网络或服务器地址";
  }
  if (msg.includes("econnreset") || msg.includes("connection reset")) {
    return "连接被重置，请检查网络稳定性";
  }
  if (msg.includes("unavailable")) {
    return "服务不可用，请确认 Milvus 地址和端口正确";
  }

  // Auth
  if (msg.includes("unauthenticated") || msg.includes("unauthorized")) {
    return "认证失败，请检查用户名/密码或 Token";
  }
  if (msg.includes("permission denied") || msg.includes("forbidden")) {
    return "权限不足，请检查用户权限配置";
  }
  if (msg.includes("token") && (msg.includes("invalid") || msg.includes("expired"))) {
    return "Token 无效或已过期，请重新配置";
  }

  // SSL / TLS
  if (msg.includes("ssl") || msg.includes("tls") || msg.includes("certificate")) {
    return "TLS/SSL 连接失败，请检查证书配置或关闭 TLS";
  }

  // Milvus specific
  if (msg.includes("collection not found")) {
    return "集合不存在，请检查集合名称";
  }
  if (msg.includes("database not found")) {
    return "数据库不存在，请检查数据库名称";
  }
  if (msg.includes("index not found") || msg.includes("index not exist")) {
    return "索引不存在，请先创建索引";
  }
  if (msg.includes("collection not loaded") || msg.includes("not loaded")) {
    return "集合未加载，请先加载集合";
  }
  if (msg.includes("dimension") && msg.includes("mismatch")) {
    return "向量维度不匹配，请检查查询向量的维度";
  }
  if (msg.includes("field") && msg.includes("not exist")) {
    return "字段不存在，请检查字段名称";
  }
  if (msg.includes("duplicate") || msg.includes("already exist")) {
    return "资源已存在，请更换名称";
  }

  // gRPC
  if (msg.includes("14 unavailable")) {
    return "无法连接到 Milvus 服务器，请检查地址和网络";
  }
  if (msg.includes("code: 14")) {
    return "无法连接到 Milvus 服务器，请检查地址和网络";
  }
  if (msg.includes("code: 16")) {
    return "认证失败，请检查凭证";
  }

  // Embedding API
  if (msg.includes("embedding api error")) {
    const detail = raw.replace(/embedding api error:\s*/i, "");
    return `Embedding 接口调用失败：${detail.slice(0, 100)}`;
  }
  if (msg.includes("api key") || msg.includes("apikey")) {
    return "API Key 无效，请检查 Embedding 配置";
  }
  if (msg.includes("fetch failed") || msg.includes("network")) {
    return "网络请求失败，请检查 Embedding API 地址";
  }

  // Frontend fetch errors
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "无法连接到后端服务，请确认服务已启动";
  }

  // Generic fallback — show first 80 chars if present, else generic
  const trimmed = raw.trim();
  if (trimmed.length > 0 && trimmed.length <= 80) {
    return `操作失败：${trimmed}`;
  }
  return "操作失败，原因不明";
}
