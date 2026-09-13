const base = "http://127.0.0.1:3001";
const cid = process.argv[2];
if (!cid) {
  console.error("need connectionId");
  process.exit(1);
}

const q = await fetch(
  `${base}/api/collections/demo_chunks/query?connectionId=${cid}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: 'id in ["imp1","imp2","imp3"]',
      limit: 10,
      outputFields: ["id", "text"],
    }),
  }
).then((r) => r.json());
console.log("query imported:", JSON.stringify(q).slice(0, 600));

const emb = await fetch(`${base}/api/embed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "羟基磷灰石涂层促进骨长入",
    config: {
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "qwen3-embedding:0.6b",
    },
  }),
}).then((r) => r.json());

const s = await fetch(
  `${base}/api/collections/demo_chunks/search?connectionId=${cid}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vector: emb.data.embedding,
      vectorField: "embedding",
      topK: 3,
      metricType: "IP",
      outputFields: ["id", "text"],
    }),
  }
).then((r) => r.json());
(s.data || []).forEach((h, i) =>
  console.log(
    i + 1,
    h.id,
    h.score,
    String(h.data?.text || h.text || "").slice(0, 50)
  )
);
