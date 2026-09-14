import type { FastifyInstance } from "fastify";
import type { ApiResponse, EmbeddingConfig, QueryRequest, SearchRequest } from "@milvuslens/shared";
import { getClient } from "../services/milvus.js";
import { embedTexts } from "../services/embed.js";

export async function dataRoutes(app: FastifyInstance) {
  // Query data
  app.post<{
    Params: { name: string };
    Querystring: { connectionId: string; db?: string };
    Body: QueryRequest;
  }>("/collections/:name/query", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const { connectionId, db } = req.query;
      const { filter, limit = 50, offset = 0, outputFields } = req.body;

      const client = getClient(connectionId);
      const queryParams: Record<string, unknown> = {
        collection_name: name,
        filter: filter || "",
        limit,
        offset,
        output_fields: outputFields || ["*"],
      };
      if (db) queryParams.db_name = db;

      const res = await client.query(queryParams as unknown as Parameters<typeof client.query>[0]);

      // Without a filter, collection stats give the real total row count.
      // With a filter Milvus has no cheap COUNT(*), so fall back to page length.
      let total = res.data?.length || 0;
      if (!filter) {
        try {
          const statsParams: Record<string, unknown> = { collection_name: name };
          if (db) statsParams.db_name = db;
          const stats = await client.getCollectionStats(statsParams as unknown as Parameters<typeof client.getCollectionStats>[0]);
          const statsArr = (stats as unknown as { stats?: Array<{ key: string; value: string | number }> }).stats || [];
          const rowCount = Number(statsArr.find((s) => s.key === "row_count")?.value);
          if (Number.isFinite(rowCount)) total = rowCount;
        } catch {
          // keep page length
        }
      }

      return {
        success: true,
        data: {
          data: res.data || [],
          total,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Query failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Vector search
  app.post<{
    Params: { name: string };
    Querystring: { connectionId: string; db?: string };
    Body: SearchRequest;
  }>("/collections/:name/search", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const { connectionId, db } = req.query;
      const { vector, vectorField, topK, metricType, filter, outputFields } = req.body;

      const client = getClient(connectionId);

      const searchParams: Record<string, unknown> = {
        collection_name: name,
        vectors: [vector],
        vector_type: 101, // FloatVector
        anns_field: vectorField,
        limit: topK,
        metric_type: metricType || "COSINE",
        params: { nprobe: 16 },
        output_fields: outputFields || ["*"],
        ...(filter ? { filter } : {}),
      };
      if (db) searchParams.db_name = db;

      const res = await client.search(searchParams as unknown as unknown as Parameters<typeof client.search>[0]);

      const results =
        res.results?.map(
          (r: { id?: string | number; score: number; [key: string]: unknown }) => {
            const { score, id, ...rest } = r;
            return {
              id: id ?? rest.pk ?? "",
              score: Number(score),
              data: rest as Record<string, unknown>,
            };
          }
        ) || [];

      return { success: true, data: results };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Batch import rows; optionally embed a text field into a vector field
  app.post<{
    Params: { name: string };
    Querystring: { connectionId: string; db?: string };
    Body: {
      rows: Record<string, unknown>[];
      embed?: {
        textField: string;
        vectorField: string;
        config: EmbeddingConfig;
      };
      batchSize?: number;
    };
  }>("/collections/:name/import", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const { connectionId, db } = req.query;
      const { rows, embed, batchSize = 32 } = req.body;

      if (!rows || rows.length === 0) {
        return reply.code(400).send({ success: false, error: "没有可导入的数据" });
      }
      if (rows.length > 5000) {
        return reply
          .code(400)
          .send({ success: false, error: "单次最多导入 5000 行，请拆分文件" });
      }

      const client = getClient(connectionId);
      let imported = 0;
      let failedBatches = 0;
      let lastError = "";

      // Embed in batches, then insert
      const prepared: Record<string, unknown>[] = [];
      const size = Math.max(1, Math.min(batchSize, 128));
      try {
        for (let i = 0; i < rows.length; i += size) {
          const chunk = rows.slice(i, i + size);
          if (embed?.textField && embed?.vectorField && embed?.config) {
            const texts = chunk.map((r) => String(r[embed.textField] ?? ""));
            const vectors = await embedTexts(texts, embed.config);
            chunk.forEach((row, j) => {
              prepared.push({
                ...row,
                [embed.vectorField]: vectors[j],
              });
            });
          } else {
            prepared.push(...chunk);
          }
        }
      } catch (e) {
        return reply.code(500).send({
          success: false,
          error: `向量化失败（已中止，未写入）：${e instanceof Error ? e.message : String(e)}`,
        });
      }

      // Insert in batches; report partial success explicitly
      const INSERT_BATCH = 100;
      for (let i = 0; i < prepared.length; i += INSERT_BATCH) {
        const batch = prepared.slice(i, i + INSERT_BATCH);
        const insertParams: Record<string, unknown> = {
          collection_name: name,
          data: batch,
        };
        if (db) insertParams.db_name = db;
        try {
          await client.insert(insertParams as unknown as Parameters<typeof client.insert>[0]);
          imported += batch.length;
        } catch (e) {
          failedBatches += 1;
          lastError = e instanceof Error ? e.message : String(e);
          // stop on first insert failure to avoid hammering a broken collection
          break;
        }
      }

      if (imported > 0 && failedBatches > 0) {
        return {
          success: true,
          data: {
            imported,
            totalRows: prepared.length,
            embedded: Boolean(embed?.textField && embed?.vectorField),
            partial: true,
            error: lastError,
          },
        };
      }
      if (imported === 0 && failedBatches > 0) {
        return reply.code(500).send({
          success: false,
          error: `导入失败：${lastError}`,
        });
      }

      return {
        success: true,
        data: {
          imported,
          totalRows: prepared.length,
          embedded: Boolean(embed?.textField && embed?.vectorField),
          partial: false,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Insert data
  app.post<{
    Params: { name: string };
    Querystring: { connectionId: string; db?: string };
    Body: { data: Record<string, unknown>[] };
  }>("/collections/:name/insert", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const { connectionId, db } = req.query;
      const { data } = req.body;

      if (!data || data.length === 0) {
        return reply.code(400).send({ success: false, error: "No data provided" });
      }

      const client = getClient(connectionId);
      const insertParams: Record<string, unknown> = {
        collection_name: name,
        data,
      };
      if (db) insertParams.db_name = db;

      await client.insert(insertParams as unknown as Parameters<typeof client.insert>[0]);

      return { success: true, data: { insertCount: data.length } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Insert failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Delete data by filter expression
  app.delete<{
    Params: { name: string };
    Querystring: { connectionId: string; filter: string; db?: string };
  }>("/collections/:name/delete", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const { connectionId, filter, db } = req.query;

      if (!filter) {
        return reply.code(400).send({ success: false, error: "Filter expression is required" });
      }

      const client = getClient(connectionId);
      const deleteParams: Record<string, unknown> = {
        collection_name: name,
        filter,
      };
      if (db) deleteParams.db_name = db;

      await client.delete(deleteParams as unknown as Parameters<typeof client.delete>[0]);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      return reply.code(500).send({ success: false, error: message });
    }
  });
}
