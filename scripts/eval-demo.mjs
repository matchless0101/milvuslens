/** Quick recall eval against local demo_chunks via MilvusLens API */
const base = "http://127.0.0.1:3001";

const cases = [
  ["疲劳试验的加载频率是多少？", "c1"],
  ["骨水泥怎么固定的？", "c2"],
  ["有没有关于髋关节磨损的说明？", "c4"],
  ["羟基磷灰石涂层做什么用？", "imp2"],
];

const conn = await fetch(`${base}/api/connect`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "",
    name: "local",
    host: "127.0.0.1",
    port: 19530,
    tls: false,
  }),
}).then((r) => r.json());
const cid = conn.data?.connectionId;
if (!cid) {
  console.error("connect failed", conn);
  process.exit(1);
}

const embedCfg = {
  baseUrl: "http://127.0.0.1:11434/v1",
  apiKey: "",
  model: "qwen3-embedding:0.6b",
};

let hit1 = 0;
let hit3 = 0;
for (const [q, expected] of cases) {
  const emb = await fetch(`${base}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: q, config: embedCfg }),
  }).then((r) => r.json());
  const s = await fetch(
    `${base}/api/collections/demo_chunks/search?connectionId=${cid}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: emb.data.embedding,
        vectorField: "embedding",
        topK: 5,
        metricType: "IP",
        outputFields: ["id", "text"],
      }),
    }
  ).then((r) => r.json());
  const hits = s.data || [];
  const rank = hits.findIndex((h) => String(h.id) === expected) + 1;
  if (rank === 1) hit1++;
  if (rank > 0 && rank <= 3) hit3++;
  console.log(
    q,
    "expect",
    expected,
    "rank",
    rank || "miss",
    "top1",
    hits[0]?.id,
    hits[0]?.score?.toFixed?.(4)
  );
}
console.log(
  `Hit@1 ${hit1}/${cases.length} (${((hit1 / cases.length) * 100).toFixed(0)}%) Hit@3 ${hit3}/${cases.length}`
);
