/**
 * Integration test against a real Milvus (no embedding provider required).
 * Inserts synthetic unit vectors, then searches with one of them (self-hit).
 *
 * Env:
 *   MILVUS_ADDRESS  default 127.0.0.1:19530
 *   COLLECTION      default ci_it_chunks
 *
 * Usage: node scripts/integration-rag.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.join(__dirname, "..", "apps", "server", "package.json")
);
const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");

const ADDRESS = process.env.MILVUS_ADDRESS || "127.0.0.1:19530";
const COLLECTION = process.env.COLLECTION || "ci_it_chunks";
const DIM = 8;

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function unitVec(seed) {
  const v = [];
  let s = seed;
  for (let i = 0; i < DIM; i++) {
    s = (s * 16807) % 2147483647;
    v.push((s / 2147483647) * 2 - 1);
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const client = new MilvusClient({ address: ADDRESS });
const health = await client.checkHealth();
if (!health?.isHealthy) fail("Milvus not healthy at " + ADDRESS);
console.log("OK milvus healthy", ADDRESS);

try {
  await client.dropCollection({ collection_name: COLLECTION });
} catch {
  /* not exists */
}

await client.createCollection({
  collection_name: COLLECTION,
  fields: [
    { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 32 },
    { name: "text", data_type: DataType.VarChar, max_length: 512 },
    { name: "embedding", data_type: DataType.FloatVector, dim: DIM },
  ],
});
console.log("OK created", COLLECTION);

const rows = [
  { id: "a", text: "alpha chunk", embedding: unitVec(1) },
  { id: "b", text: "beta chunk", embedding: unitVec(2) },
  { id: "c", text: "gamma chunk", embedding: unitVec(3) },
];
await client.insert({ collection_name: COLLECTION, data: rows });
console.log("OK inserted", rows.length);

const idx = await client.createIndex({
  collection_name: COLLECTION,
  field_name: "embedding",
  index_name: "embedding_idx",
  index_type: "FLAT",
  metric_type: "IP",
  params: {},
});
if (idx?.error_code && idx.error_code !== "Success") {
  fail("createIndex: " + JSON.stringify(idx));
}
await client.loadCollection({ collection_name: COLLECTION });
console.log("OK indexed+loaded");

const search = await client.search({
  collection_name: COLLECTION,
  vectors: [unitVec(2)],
  vector_type: 101,
  anns_field: "embedding",
  limit: 3,
  metric_type: "IP",
  params: {},
  output_fields: ["id", "text"],
});
const hits = search?.results || [];
const topId = hits[0]?.id ?? hits[0]?.pk;
if (topId !== "b") {
  fail("expected self-hit b, got " + topId + " hits=" + JSON.stringify(hits).slice(0, 200));
}
console.log("OK self-hit", topId, "score", Number(hits[0].score).toFixed(4));

try {
  await client.dropCollection({ collection_name: COLLECTION });
  console.log("OK cleaned up");
} catch {
  /* ignore */
}

console.log("INTEGRATION PASSED");
