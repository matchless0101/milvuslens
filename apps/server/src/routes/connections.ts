import type { FastifyInstance } from "fastify";
import type { ConnectionConfig, ApiResponse } from "@milvuslens/shared";
import {
  createConnection,
  disconnect,
  listConnections,
  testConnection,
} from "../services/milvus.js";

export async function connectionRoutes(app: FastifyInstance) {
  // Connect to Milvus
  app.post<{ Body: ConnectionConfig }>(
    "/connect",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const config = req.body;
        const connectionId = createConnection(config);
        return { success: true, data: { connectionId } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Connection failed";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Test connection without saving
  app.post<{ Body: ConnectionConfig }>(
    "/connect/test",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const ok = await testConnection(req.body);
        return {
          success: true,
          data: { connected: ok, error: ok ? undefined : "Health check failed" },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Test failed";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // Disconnect
  app.post<{ Params: { id: string } }>(
    "/disconnect/:id",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const ok = disconnect(req.params.id);
        return { success: ok, data: { disconnected: ok } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Disconnect failed";
        return reply.code(500).send({ success: false, error: message });
      }
    }
  );

  // List active connections
  app.get("/connections", async (): Promise<ApiResponse> => {
    return { success: true, data: listConnections() };
  });
}
