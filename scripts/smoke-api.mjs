/**
 * Live API smoke test. Requires server on PORT (default 3001).
 * Usage: node scripts/smoke-api.mjs
 */
const base = process.env.API_BASE || "http://127.0.0.1:3001";

async function call(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const originHeaders = { Origin: "http://localhost:5173" };

// 1. list connections
{
  const r = await call("/api/connections");
  assert(r.status === 200 && r.body?.success === true, "GET /api/connections");
}

// 2. connect/test unreachable host should return 200 with connected:false
{
  const r = await call("/api/connect/test", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({
      host: "127.0.0.1",
      port: 19530,
      id: "",
      name: "smoke",
      tls: false,
    }),
  });
  assert(
    r.status === 200 && r.body?.success === true && r.body?.data?.connected === false,
    "POST /api/connect/test (unreachable → connected:false)"
  );
}

// 3. connect unreachable host should be 502 with error body
{
  const r = await call("/api/connect", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({
      host: "127.0.0.1",
      port: 19530,
      id: "",
      name: "smoke",
      tls: false,
    }),
  });
  assert(
    r.status === 502 && r.body?.success === false && !!r.body?.error,
    "POST /api/connect (unreachable → 502 + error)"
  );
}

// 4. CORS preflight
{
  const res = await fetch(`${base}/api/connect`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const acao = res.headers.get("access-control-allow-origin");
  assert(res.status === 204 && acao === "http://127.0.0.1:5173", "OPTIONS CORS preflight");
}

// 5. databases without connectionId → 400
{
  const r = await call("/api/databases");
  assert(r.status === 400 && r.body?.success === false, "GET /api/databases without id → 400");
}

// 6. query with unknown connection → 500 connection not found
{
  const r = await call("/api/collections/foo/query?connectionId=nope", {
    method: "POST",
    body: JSON.stringify({ limit: 1 }),
  });
  assert(
    r.status === 500 && String(r.body?.error || "").includes("Connection not found"),
    "query unknown connection → connection not found"
  );
}

console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE PASSED");
