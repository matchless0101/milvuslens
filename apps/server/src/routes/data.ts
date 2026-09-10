import type { FastifyInstance } from "fastify";
import type { ApiResponse, QueryRequest, SearchRequest } from "@milvuslens/shared";
import { getClient } from "../services/milvus.js";

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

      return {
        success: true,
        data: {
          data: res.data || [],
          total: res.data?.length || 0,
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
        params: JSON.stringify({ nprobe: 16 }),
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
