import type { FastifyInstance } from "fastify";
import type { ConnectionConfig, ApiResponse } from "@milvuslens/shared";
import {
  createConnection,
  disconnect,
  listConnections,
  testConnection,
} from "../services/milvus.js";

export async function connectionRoutes(app: FastifyInstance) {
  // Connect to Milvus — verify connectivity before saving
  app.post<{ Body: ConnectionConfig }>(
    "/connect",
    async (req, reply): Promise<ApiResponse> => {
      try {
        const config = req.body;

        // Test connectivity first — don't save if unreachable
        const testResult = await testConnection(config);
        if (!testResult.ok) {
          return reply.code(502).send({
            success: false,
            error: testResult.error || "无法连接到 Milvus 服务器",
          });
        }

        // Only create the connection after verification passes
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
        const result = await testConnection(req.body);
        return {
          success: true,
          data: { connected: result.ok, error: result.error },
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
