# MilvusLens

A lightweight, open-source Milvus management tool focused on **semantic search debugging**.

## Features

- **Connection Management** — Connect to Milvus 2.4+ / 2.5+, save multiple connections
- **Database & Collection Browsing** — List, create, delete databases and collections
- **Data Explorer** — High-performance table with pagination, filter expressions
- **Row Detail Panel** — Inspect full field values, vector preview, copy JSON
- **Semantic Search** — Input a natural language question, embed via OpenAI-compatible API, find similar chunks ranked by similarity score
- **Dark/Light Theme** — Follows system preference, manual toggle
- **Command Palette** — `Ctrl+K` for quick navigation

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (server + web)
pnpm dev

# Or start individually
pnpm dev:server   # Backend on :3001
pnpm dev:web      # Frontend on :5173
```

Open http://localhost:5173

## Architecture

```
milvuslens/
├── apps/
│   ├── web/          # React 18 + shadcn/ui + Tailwind
│   ├── server/       # Fastify + @zilliz/milvus2-sdk-node
│   └── desktop/      # Electron (planned)
├── packages/
│   └── shared/       # Shared TypeScript types
```

## Semantic Search Setup

1. Go to **Settings** page
2. Configure your embedding provider:
   - **API Base URL**: e.g. `https://api.openai.com/v1`
   - **API Key**: Your API key
   - **Model**: e.g. `text-embedding-3-small`
3. Click **Test** to verify
4. Go to **Data Explorer**, enter a question, and click **Search**

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `127.0.0.1` | Server host |

## License

MIT
