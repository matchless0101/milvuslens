import type { EmbeddingConfig } from "@milvuslens/shared";
import { validateEmbeddingUrl } from "./urlGuard.js";

export function isEmbeddingConfigReady(config: EmbeddingConfig | undefined): boolean {
  return Boolean(config?.baseUrl && config?.model);
}

export function buildEmbeddingHeaders(config: EmbeddingConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return {
    ...headers,
    ...config.headers,
  };
}

export async function embedTexts(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  if (!isEmbeddingConfigReady(config)) {
    throw new Error("Embedding config is incomplete");
  }
  const guard = validateEmbeddingUrl(config.baseUrl);
  if (!guard.ok) {
    throw new Error(guard.error);
  }
  const url = `${guard.url.toString().replace(/\/$/, "")}/embeddings`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildEmbeddingHeaders(config),
    body: JSON.stringify({
      model: config.model,
      input: texts,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Embedding API error: ${errBody.slice(0, 300)}`);
  }
  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  const embeddings = data.data?.map((d) => d.embedding);
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error("Embedding API returned unexpected number of vectors");
  }
  return embeddings;
}
