import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@milvuslens/shared";
import { getClient } from "../services/milvus.js";

export async function databaseRoutes(app: FastifyInstance) {
  // List databases
  app.get<{ Querystring: { connectionId: string } }>(
    "/databases",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId } = req.query;
        if (!connectionId) {
          return reply
            .code(400)
            .send({ success: false, error: "connectionId is required" });
        }
        const client = getClient(connectionId);
        const res = await client.listDatabases();
        return { success: true, data: (res as unknown as { db_names?: string[] }).db_names || [] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to list databases";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Create database
  app.post<{ Body: { connectionId: string; dbName: string } }>(
    "/databases",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, dbName } = req.body;
        const client = getClient(connectionId);
        await client.createDatabase({ db_name: dbName });
        return { success: true, data: { name: dbName } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create database";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Delete database
  app.delete<{ Params: { name: string }; Querystring: { connectionId: string } }>(
    "/databases/:name",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { name } = req.params;
        const { connectionId } = req.query;
        const client = getClient(connectionId);
        await client.dropDatabase({ db_name: name });
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete database";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Use/switch database
  app.post<{ Body: { connectionId: string; dbName: string } }>(
    "/databases/use",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const { connectionId, dbName } = req.body;
        const client = getClient(connectionId);
        await client.use({ db_name: dbName });
        return { success: true, data: { activeDb: dbName } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to switch database";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );
}
