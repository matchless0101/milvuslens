import type { FastifyInstance } from "fastify";
import type { ApiResponse, CreateCollectionRequest } from "@milvuslens/shared";
import { getClient, DataType } from "../services/milvus.js";

export async function collectionRoutes(app: FastifyInstance) {
  // List collections
  // Default: names only (1 RPC). withDetails=1 adds per-collection stats with limited concurrency.
  app.get<{ Querystring: { connectionId: string; db?: string; withDetails?: string } }>(
    "/collections",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, db, withDetails } = req.query;
        if (!connectionId) {
          return reply
            .code(400)
            .send({ success: false, error: "connectionId is required" });
        }
        const client = getClient(connectionId);

        // Pass db_name directly to avoid global client.use() race conditions
        const listParams: Record<string, unknown> = {};
        if (db) listParams.db_name = db;

        const res = await client.listCollections(listParams as unknown as Parameters<typeof client.listCollections>[0]);
        const names = (res as unknown as { collection_names: string[] }).collection_names || [];

        if (withDetails !== "1" && withDetails !== "true") {
          return {
            success: true,
            data: names.map((name) => ({
              name,
              rowCount: -1,
              indexCount: -1,
              shardCount: -1,
              state: "",
              description: "",
            })),
          };
        }

        // Fetch stats with bounded concurrency to avoid flooding the Milvus server
        const CONCURRENCY = 8;
        const collections: Array<{
          name: string;
          rowCount: number;
          indexCount: number;
          shardCount: number;
          state: string;
          description: string;
        }> = [];

        for (let i = 0; i < names.length; i += CONCURRENCY) {
          const batch = names.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(async (name: string) => {
              try {
                const statsParams: Record<string, unknown> = { collection_name: name };
                if (db) statsParams.db_name = db;
                const stats = await client.getCollectionStats(statsParams as unknown as Parameters<typeof client.getCollectionStats>[0]);

                // describeCollection does NOT include indexes — use listIndexes
                const indexParams: Record<string, unknown> = { collection_name: name };
                if (db) indexParams.db_name = db;
                let indexCount = 0;
                try {
                  const idxRes = await client.listIndexes(indexParams as unknown as Parameters<typeof client.listIndexes>[0]);
                  indexCount = (idxRes as unknown as { indexes?: unknown[] }).indexes?.length || 0;
                } catch {
                  indexCount = 0;
                }

                // Real load state (Loaded / NotLoad / ...)
                let state = "Unknown";
                try {
                  const loadRes = await client.getLoadState(
                    indexParams as unknown as Parameters<typeof client.getLoadState>[0]
                  );
                  state = (loadRes as unknown as { state?: string }).state || "Unknown";
                } catch {
                  state = "Unknown";
                }

                const descParams: Record<string, unknown> = { collection_name: name };
                if (db) descParams.db_name = db;
                const desc = await client.describeCollection(descParams as unknown as Parameters<typeof client.describeCollection>[0]) as unknown as {
                  shards_num?: number;
                  schema?: { description?: string };
                };
                const statsArr = (stats as unknown as { stats?: Array<{ key: string; value: string | number }> }).stats || [];
                return {
                  name,
                  rowCount: Number(statsArr.find((s) => s.key === "row_count")?.value || 0),
                  indexCount,
                  shardCount: desc.shards_num || 0,
                  state,
                  description: desc.schema?.description || "",
                };
              } catch {
                return {
                  name,
                  rowCount: 0,
                  indexCount: 0,
                  shardCount: 0,
                  state: "Unknown",
                  description: "",
                };
              }
            })
          );
          collections.push(...batchResults);
        }

        return { success: true, data: collections };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to list collections";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Get collection schema (includes index_descriptions for metric auto-detect)
  app.get<{ Params: { name: string }; Querystring: { connectionId: string; db?: string } }>(
    "/collections/:name/schema",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId, db } = req.query;
        const client = getClient(connectionId);
        const params: Record<string, unknown> = { collection_name: name };
        if (db) params.db_name = db;
        const res = await client.describeCollection(params as unknown as Parameters<typeof client.describeCollection>[0]);
        let index_descriptions: unknown[] = [];
        try {
          const idx = await client.describeIndex(params as unknown as Parameters<typeof client.describeIndex>[0]);
          index_descriptions = (idx as unknown as { index_descriptions?: unknown[] }).index_descriptions || [];
        } catch {
          index_descriptions = [];
        }
        return { success: true, data: { ...(res as object), index_descriptions } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to describe collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Create collection
  app.post<{ Body: CreateCollectionRequest & { connectionId: string; db?: string } }>(
    "/collections",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, db, ...createReq } = req.body;
        const client = getClient(connectionId);

        // Map field schemas to Milvus format
        const fields = createReq.fields.map((f) => {
          const base: Record<string, unknown> = {
            name: f.name,
            data_type: mapDataType(f.dataType),
            is_primary_key: f.isPrimaryKey,
          };
          if (f.dimension) base.dim = f.dimension;
          if (f.maxLength) base.max_length = f.maxLength;
          if (f.description) base.description = f.description;
          return base;
        }) as unknown as Array<{ name: string; data_type: number; is_primary_key: boolean; dim?: number; max_length?: number; description?: string }>;

        const createParams: Record<string, unknown> = {
          collection_name: createReq.collectionName,
          fields: fields as never,
          shards_num: createReq.shardsNum || 1,
          consistency_level: createReq.consistencyLevel || "Bounded",
        };
        if (db) createParams.db_name = db;

        await client.createCollection(createParams as unknown as Parameters<typeof client.createCollection>[0]);

        // Create index for vector fields
        for (const idx of createReq.indexParams) {
          const indexParams: Record<string, unknown> = {
            collection_name: createReq.collectionName,
            field_name: idx.fieldName,
            index_name: `${idx.fieldName}_idx`,
            index_type: idx.indexType,
            metric_type: idx.metricType,
            params: idx.params || {},
          };
          if (db) indexParams.db_name = db;
          await client.createIndex(indexParams as unknown as Parameters<typeof client.createIndex>[0]);
        }

        return { success: true, data: { name: createReq.collectionName } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Create vector index on an existing collection (required before search)
  app.post<{
    Params: { name: string };
    Body: {
      connectionId: string;
      fieldName: string;
      indexType?: string;
      metricType?: string;
      db?: string;
    };
  }>("/collections/:name/index", async (req, reply): Promise<ApiResponse> => {
    try {
      const { name } = req.params;
      const {
        connectionId,
        fieldName,
        indexType = "AUTOINDEX",
        metricType = "COSINE",
        db,
      } = req.body;
      if (!connectionId || !fieldName) {
        return reply
          .code(400)
          .send({ success: false, error: "connectionId and fieldName are required" });
      }
      const client = getClient(connectionId);
      const indexParams: Record<string, unknown> = {
        collection_name: name,
        field_name: fieldName,
        index_name: `${fieldName}_idx`,
        index_type: indexType,
        metric_type: metricType,
        params: {},
      };
      if (db) indexParams.db_name = db;
      await client.createIndex(indexParams as unknown as Parameters<typeof client.createIndex>[0]);
      return {
        success: true,
        data: { collection: name, fieldName, indexType, metricType },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create index";
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Delete collection
  app.delete<{ Params: { name: string }; Querystring: { connectionId: string; db?: string } }>(
    "/collections/:name",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId, db } = req.query;
        const client = getClient(connectionId);
        const params: Record<string, unknown> = { collection_name: name };
        if (db) params.db_name = db;
        await client.dropCollection(params as unknown as Parameters<typeof client.dropCollection>[0]);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Load collection
  app.post<{ Params: { name: string }; Querystring: { connectionId: string; db?: string } }>(
    "/collections/:name/load",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId, db } = req.query;
        const client = getClient(connectionId);
        const params: Record<string, unknown> = { collection_name: name };
        if (db) params.db_name = db;
        await client.loadCollection(params as unknown as Parameters<typeof client.loadCollection>[0]);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Release collection
  app.post<{ Params: { name: string }; Querystring: { connectionId: string; db?: string } }>(
    "/collections/:name/release",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId, db } = req.query;
        const client = getClient(connectionId);
        const params: Record<string, unknown> = { collection_name: name };
        if (db) params.db_name = db;
        await client.releaseCollection(params as unknown as Parameters<typeof client.releaseCollection>[0]);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to release collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );
}

function mapDataType(type: string): number {
  const map: Record<string, number> = {
    INT8: DataType.Int8,
    INT16: DataType.Int16,
    INT32: DataType.Int32,
    INT64: DataType.Int64,
    FLOAT: DataType.Float,
    DOUBLE: DataType.Double,
    VARCHAR: DataType.VarChar,
    JSON: DataType.JSON,
    BOOL: DataType.Bool,
    FLOAT_VECTOR: DataType.FloatVector,
    BINARY_VECTOR: DataType.BinaryVector,
  };
  return map[type] ?? DataType.VarChar;
}
