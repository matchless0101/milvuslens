import Fastify from "fastify";
import cors from "@fastify/cors";
import { connectionRoutes } from "./routes/connections.js";
import { databaseRoutes } from "./routes/databases.js";
import { collectionRoutes } from "./routes/collections.js";
import { dataRoutes } from "./routes/data.js";
import { embeddingRoutes } from "./routes/embedding.js";

// Prevent unhandled gRPC rejections from crashing the process
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (kept alive):", reason);
});

const server = Fastify({ logger: true });

// Allow local frontend origins (any localhost/127.0.0.1 port) and no-origin (proxy/CLI).
const isLocalOrigin = (origin: string): boolean => {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1"
    );
  } catch {
    return false;
  }
};

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin || isLocalOrigin(origin)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

await server.register(connectionRoutes, { prefix: "/api" });
await server.register(databaseRoutes, { prefix: "/api" });
await server.register(collectionRoutes, { prefix: "/api" });
await server.register(dataRoutes, { prefix: "/api" });
await server.register(embeddingRoutes, { prefix: "/api" });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || "127.0.0.1";
    await server.listen({ port, host });
    console.log(`MilvusLens server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
