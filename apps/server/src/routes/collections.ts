import type { FastifyInstance } from "fastify";
import type { ApiResponse, CreateCollectionRequest } from "@milvuslens/shared";
import { getClient, DataType } from "../services/milvus.js";

export async function collectionRoutes(app: FastifyInstance) {
  // List collections
  app.get<{ Querystring: { connectionId: string; db?: string } }>(
    "/collections",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, db } = req.query;
        if (!connectionId) {
          return reply
            .code(400)
            .send({ success: false, error: "connectionId is required" });
        }
        const client = getClient(connectionId);

        // Pass db_name directly to avoid global client.use() race conditions
        const listParams: Record<string, unknown> = {};
        if (db) listParams.db_name = db;

        const res = await client.listCollections(listParams as Parameters<typeof client.listCollections>[0]);
        const names = (res as unknown as { collection_names: string[] }).collection_names || [];
        const collections = await Promise.all(
          names.map(async (name: string) => {
            try {
              const statsParams: Record<string, unknown> = { collection_name: name };
              if (db) statsParams.db_name = db;
              const stats = await client.getCollectionStats(statsParams as unknown as Parameters<typeof client.getCollectionStats>[0]);

              const descParams: Record<string, unknown> = { collection_name: name };
              if (db) descParams.db_name = db;
              const desc = await client.describeCollection(descParams as unknown as Parameters<typeof client.describeCollection>[0]) as unknown as {
                index_descriptions?: unknown[];
                state?: string;
                shards_num?: number;
                schema?: { description?: string };
              };
              const statsArr = (stats as unknown as { stats?: Array<{ key: string; value: string | number }> }).stats || [];
              return {
                name,
                rowCount: Number(statsArr.find((s) => s.key === "row_count")?.value || 0),
                indexCount: desc.index_descriptions?.length || 0,
                shardCount: desc.shards_num || 0,
                state: desc.state || "Unknown",
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

        return { success: true, data: collections };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to list collections";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Get collection schema
  app.get<{ Params: { name: string }; Querystring: { connectionId: string } }>(
    "/collections/:name/schema",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId } = req.query;
        const client = getClient(connectionId);
        const res = await client.describeCollection({ collection_name: name });
        return { success: true, data: res };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to describe collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Create collection
  app.post<{ Body: CreateCollectionRequest & { connectionId: string } }>(
    "/collections",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, ...createReq } = req.body;
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

        await client.createCollection({
          collection_name: createReq.collectionName,
          fields: fields as never,
          shards_num: createReq.shardsNum || 1,
          consistency_level: createReq.consistencyLevel || "Bounded",
        } as Parameters<typeof client.createCollection>[0]);

        // Create index for vector fields
        for (const idx of createReq.indexParams) {
          await client.createIndex({
            collection_name: createReq.collectionName,
            field_name: idx.fieldName,
            index_name: `${idx.fieldName}_idx`,
            index_type: idx.indexType,
            metric_type: idx.metricType,
            params: JSON.stringify(idx.params || {}),
          } as Parameters<typeof client.createIndex>[0]);
        }

        return { success: true, data: { name: createReq.collectionName } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Delete collection
  app.delete<{ Params: { name: string }; Querystring: { connectionId: string } }>(
    "/collections/:name",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId } = req.query;
        const client = getClient(connectionId);
        await client.dropCollection({ collection_name: name });
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Load collection
  app.post<{ Params: { name: string }; Querystring: { connectionId: string } }>(
    "/collections/:name/load",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId } = req.query;
        const client = getClient(connectionId);
        await client.loadCollection({ collection_name: name });
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load collection";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Release collection
  app.post<{ Params: { name: string }; Querystring: { connectionId: string } }>(
    "/collections/:name/release",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId } = req.query;
        const client = getClient(connectionId);
        await client.releaseCollection({ collection_name: name });
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
