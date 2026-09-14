/**
 * Local Milvus RAG smoke: create collection, insert chunks, search.
 * Usage: node scripts/local-rag-test.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.join(__dirname, "..", "apps", "server", "package.json")
);
const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");

const MILVUS = "127.0.0.1:19530";
const EMBED_URL = "http://127.0.0.1:11434/v1/embeddings";
const MODEL = "qwen3-embedding:0.6b";
const COLLECTION = "demo_chunks";
const DIM = 1024;

const chunks = [
  {
    id: "c1",
    text: "动疲劳试验：植入物以 10 Hz 正弦波加载，最大载荷 900 N，R=10，循环 1000 万次，环境为空气干燥，室温。",
  },
  {
    id: "c2",
    text: "骨水泥固定：使用聚甲基丙烯酸甲酯骨水泥将假体固定于骨床，需控制混合时间与加压灌注压力。",
  },
  {
    id: "c3",
    text: "ASTM F1800 标准规定了胫骨平台组件的动疲劳试验方法，包括载荷比、频率与失效判据。",
  },
  {
    id: "c4",
    text: "髋关节假体磨损试验通常在模拟体液中进行，考察超高分子量聚乙烯衬垫的磨损率。",
  },
  {
    id: "c5",
    text: "影像学评估：术后随访通过 X 线观察假体周围透亮线，判断是否出现无菌性松动。",
  },
];

async function embed(text) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  const j = await res.json();
  if (!j?.data?.[0]?.embedding) throw new Error("embed failed: " + JSON.stringify(j).slice(0, 200));
  return j.data[0].embedding;
}

function log(...args) {
  console.log(...args);
}

const client = new MilvusClient({ address: MILVUS });

// health
const health = await client.checkHealth();
log("health connected:", health?.isHealthy ?? health);

// drop if exists
try {
  await client.dropCollection({ collection_name: COLLECTION });
  log("dropped existing", COLLECTION);
} catch {
  /* not exists */
}

// create
await client.createCollection({
  collection_name: COLLECTION,
  fields: [
    { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 64 },
    { name: "text", data_type: DataType.VarChar, max_length: 4096 },
    { name: "embedding", data_type: DataType.FloatVector, dim: DIM },
  ],
  consistency_level: "Bounded",
});
log("created collection", COLLECTION);

// insert first, then index + load (more reliable on fresh standalone)
const embeddings = [];
for (const c of chunks) {
  embeddings.push(await embed(c.text));
}
const insertRes = await client.insert({
  collection_name: COLLECTION,
  data: chunks.map((c, i) => ({
    id: c.id,
    text: c.text,
    embedding: embeddings[i],
  })),
});
log("inserted", chunks.length, "chunks", insertRes?.insert_cnt ?? "");

const idxRes = await client.createIndex({
  collection_name: COLLECTION,
  field_name: "embedding",
  index_name: "embedding_idx",
  index_type: "FLAT",
  metric_type: "IP",
  params: {},
});
log("createIndex result", JSON.stringify(idxRes).slice(0, 200));

const listed = await client.listIndexes({ collection_name: COLLECTION });
log("listIndexes", JSON.stringify(listed).slice(0, 300));

await client.loadCollection({ collection_name: COLLECTION });
log("loaded collection");

// flush so search sees data
try {
  await client.flush({ collection_names: [COLLECTION] });
  log("flushed");
} catch (e) {
  log("flush skip", String(e).slice(0, 80));
}

const questions = [
  "疲劳试验的加载频率是多少？",
  "骨水泥怎么固定的？",
  "有没有关于髋关节磨损的说明？",
];

for (const q of questions) {
  const vec = await embed(q);
  const res = await client.search({
    collection_name: COLLECTION,
    vectors: [vec],
    vector_type: 101,
    anns_field: "embedding",
    limit: 3,
    metric_type: "IP",
    params: {},
    output_fields: ["id", "text"],
  });
  log("  raw keys", Object.keys(res || {}));
  log("  raw", JSON.stringify(res).slice(0, 500));
  const hits = res?.results || res?.search_results || res || [];
  log("\nQ:", q);
  if (!Array.isArray(hits) || !hits.length) log("  (no hits)");
  for (const [i, h] of (Array.isArray(hits) ? hits : []).entries()) {
    const text = String(h.text || h.data?.text || "").slice(0, 60);
    log(`  #${i + 1} score=${Number(h.score).toFixed(4)} id=${h.id ?? h.pk ?? ""} | ${text}`);
  }
}

log("\nDONE");
