import type { FastifyInstance } from "fastify";
import type { ApiResponse, EmbeddingConfig } from "@milvuslens/shared";

interface EmbedBody {
  text: string;
  config: EmbeddingConfig;
}

export async function embeddingRoutes(app: FastifyInstance) {
  // Embed text
  app.post<{ Body: EmbedBody }>("/embed", async (req, reply): Promise<ApiResponse> => {
    try {
      const { text, config } = req.body;

      if (!config?.baseUrl || !config?.apiKey || !config?.model) {
        return reply
          .code(400)
          .send({ success: false, error: "Embedding config is incomplete" });
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...config.headers,
      };

      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers,
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

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          ...config.headers,
        };

        const response = await fetch(`${config.baseUrl}/embeddings`, {
          method: "POST",
          headers,
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
