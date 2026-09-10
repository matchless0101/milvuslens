/**
 * Basic SSRF guards for the embedding proxy.
 * Blocks non-http(s) schemes and well-known cloud metadata endpoints.
 * Localhost / private IPs are allowed because local embedding servers
 * (Ollama, LocalAI, TEI, etc.) are a primary use case.
 */

const BLOCKED_HOSTS = new Set([
  "169.254.169.254", // AWS/GCP/Azure metadata
  "metadata.google.internal",
  "metadata.goog",
]);

export function validateEmbeddingUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Embedding API 地址不是合法 URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Embedding API 仅支持 http/https 协议" };
  }

  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: "禁止访问该地址" };
  }

  return { ok: true, url };
}
