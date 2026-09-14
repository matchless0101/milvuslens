# MilvusLens

A lightweight, open-source Milvus management tool focused on **semantic search debugging**.

## Features

- **Connection Management** — Connect to Milvus 2.4+ / 2.5+ (local or cloud), auto-reconnect last session
- **Database & Collection Browsing** — List/create/delete databases and collections; create vector index; load/release
- **Data Explorer** — Virtualized table, filter builder, column visibility, resizable columns, row detail
- **Batch Import** — CSV / JSONL / JSON array; optional auto-embedding into a vector field
- **Semantic Search** — Question → OpenAI-compatible embedding (Ollama supported) → Milvus ANN search
- **Search History / Batch Q&A / CSV export**
- **Recall Evaluation** — Paste questions with optional `question|expected_id`, get Hit@1 / Hit@3 / Hit@K
- **Dark/Light Theme**, **Command Palette** (`Ctrl+K`)

## Quick Start

```bash
pnpm install
pnpm dev          # builds shared, then server :3001 + web :5173
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`, for the browser).

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke        # API smoke against running server
```

## Semantic Search Setup

1. **Settings** → Embedding
   - OpenAI: `https://api.openai.com/v1` + API key + model
   - Local Ollama: `http://127.0.0.1:11434/v1`, key optional, model e.g. `qwen3-embedding:0.6b`
2. Ensure the collection has a **vector index** and is **loaded**
3. **数据与搜索** → enter question(s) → Search

Vector index type/metric must match search metric (e.g. `FLAT` + `IP`).

## Security / Threat Model

**This app is a local debugging tool, not a multi-tenant service.**

| Topic | Behavior |
|-------|----------|
| Bind address | API defaults to `127.0.0.1:3001` — do **not** expose the port publicly |
| CORS | Only local browser origins (`localhost` / `127.0.0.1` / `[::1]`) |
| Secrets | Milvus password & embedding API key are **not** written to localStorage by default; enable “记住密钥” only on a trusted machine |
| Auth | **No user login.** Any local process can call the API and mutate Milvus |
| Destructive ops | Delete collection/database/data require typed confirmation |
| Embedding proxy | Rejects non-http(s) and cloud metadata hosts; still only for local use |

If you need remote access, put the API behind a reverse proxy with auth, or tunnel via SSH.

## Local development extras

```bash
# Local Milvus (Docker)
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 \
  -e ETCD_USE_EMBED=true -e COMMON_STORAGETYPE=local \
  milvusdb/milvus:v2.5.14 milvus run standalone

# Scripts
pnpm smoke:rag           # insert sample chunks + search (needs local Milvus + Ollama)
pnpm test:integration    # CI-style insert/search self-hit (needs local Milvus)
```

## Architecture

```
milvuslens/
├── apps/
│   ├── web/       # React + Vite + Tailwind + shadcn
│   └── server/    # Fastify + @zilliz/milvus2-sdk-node
├── packages/
│   └── shared/    # Shared TypeScript types (built to dist for Node)
└── scripts/       # smoke / integration / eval helpers
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `127.0.0.1` | Server host |

## License

MIT
