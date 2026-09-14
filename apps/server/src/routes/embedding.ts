import type { FastifyInstance } from "fastify";
import type { ApiResponse, EmbeddingConfig } from "@milvuslens/shared";
import { validateEmbeddingUrl } from "../services/urlGuard.js";

interface EmbedBody {
  text: string;
  config: EmbeddingConfig;
}

function buildEmbeddingHeaders(config: EmbeddingConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Local providers (Ollama etc.) often ignore auth; only send a token when provided
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return {
    ...headers,
    ...config.headers,
  };
}

function isEmbeddingConfigReady(config: EmbeddingConfig | undefined): boolean {
  return Boolean(config?.baseUrl && config?.model);
}

export async function embeddingRoutes(app: FastifyInstance) {
  // Embed text
  app.post<{ Body: EmbedBody }>("/embed", async (req, reply): Promise<ApiResponse> => {
    try {
      const { text, config } = req.body;

      if (!isEmbeddingConfigReady(config)) {
        return reply
          .code(400)
          .send({ success: false, error: "Embedding config is incomplete" });
      }

      const guard = validateEmbeddingUrl(config.baseUrl);
      if (!guard.ok) {
        return reply.code(400).send({ success: false, error: guard.error });
      }

      const response = await fetch(`${guard.url.toString().replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: buildEmbeddingHeaders(config),
        body: JSON.stringify({
          model: config.model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return reply.code(response.status).send({
          success: false,
          error: `Embedding API error: ${errBody}`,
        });
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };

      const embedding = data.data?.[0]?.embedding;
      if (!embedding) {
        return reply
          .code(500)
          .send({ success: false, error: "No embedding returned" });
      }

      return {
        success: true,
        data: {
          embedding,
          dimensions: embedding.length,
          model: config.model,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Embedding failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Test embedding config
  app.post<{ Body: { config: EmbeddingConfig } }>(
    "/embedding/test",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { config } = req.body;

        if (!isEmbeddingConfigReady(config)) {
          return reply
            .code(400)
            .send({ success: false, error: "Embedding config is incomplete" });
        }

        const guard = validateEmbeddingUrl(config.baseUrl);
        if (!guard.ok) {
          return reply.code(400).send({ success: false, error: guard.error });
        }

        const response = await fetch(`${guard.url.toString().replace(/\/$/, "")}/embeddings`, {
          method: "POST",
          headers: buildEmbeddingHeaders(config),
          body: JSON.stringify({
            model: config.model,
            input: "test",
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          return reply.code(response.status).send({
            success: false,
            error: `Test failed: ${errBody}`,
          });
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>;
        };

        const embedding = data.data?.[0]?.embedding;

        return {
          success: true,
          data: {
            dimensions: embedding?.length || 0,
            preview: embedding?.slice(0, 5) || [],
            model: config.model,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Test failed";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );
}
