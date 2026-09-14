# MilvusLens

轻量级开源 **Milvus 管理 + 语义检索调试** 工具。

A lightweight open-source tool for managing Milvus and **debugging semantic search** (RAG retrieval).

**定位：** 本机开发/调试工具 —— 连上 Milvus、导入切片、用真实问题测召回，而不是多租户管理平台。

---

## 功能一览

| 模块 | 说明 |
|------|------|
| 连接管理 | Milvus 2.4+ / 2.5+，本地或云；上次连接自动恢复 |
| 库与集合 | 列表、创建、删除；建向量索引；加载 / 释放 |
| 数据查看 | 虚拟滚动表格、筛选构建器、列显隐、列宽拖拽、行详情 |
| 批量导入 | CSV / JSONL / JSON 数组；可对文本字段自动向量化 |
| 语义搜索 | 问题 → Embedding（Ollama / OpenAI 兼容）→ Milvus ANN |
| 检索辅助 | 搜索历史、多问题批量搜、结果 CSV 导出 |
| 召回评测 | `问题|期望id` 列表 → Hit@1 / Hit@3 / Hit@K，可导出 |
| 体验 | 暗色/亮色、命令面板 `Ctrl+K`、中文错误提示 |

## 快速开始

### 环境要求

- Node.js **≥ 20**
- [pnpm](https://pnpm.io/)
- 可选：Docker（本地 Milvus）、[Ollama](https://ollama.com)（本地 Embedding）

### 启动

```bash
pnpm install
pnpm dev
```

- 前端：http://localhost:5173 （请用 `localhost`，不要用 `127.0.0.1` 打开页面）
- 后端：http://127.0.0.1:3001

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke              # 需先启动 server
pnpm test:integration   # 需本地 Milvus
```

## 推荐使用流程

```text
1. 连接 Milvus（本地 127.0.0.1:19530 或云端）
2. 库与集合 → 选择库 → 如无索引点「建索引」→ 「加载」
3. 数据与搜索 → 导入 CSV/JSONL（可自动向量化）
4. 输入用户真实问题 → 搜索
5. 需要时用「评测」批量看 Hit@1/3/K
```

## 语义搜索配置

1. 打开 **设置 → Embedding**
2. 任选一种：

| 提供方 | Base URL | API Key | 模型示例 |
|--------|----------|---------|----------|
| OpenAI | `https://api.openai.com/v1` | 必填 | `text-embedding-3-small` |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | 可空 | `qwen3-embedding:0.6b`（1024 维） |

3. 集合必须有 **向量索引** 且 **已加载**；搜索 Metric 与索引一致（如 `FLAT` + `IP`）

### 本地 Milvus（Docker）

```bash
docker run -d --name milvus-standalone \
  -p 19530:19530 -p 9091:9091 \
  -e ETCD_USE_EMBED=true \
  -e COMMON_STORAGETYPE=local \
  milvusdb/milvus:v2.5.14 \
  milvus run standalone
```

### 本地 Ollama

```bash
ollama pull qwen3-embedding:0.6b
ollama serve
```

## 界面导航

| 侧边栏 | 用途 |
|--------|------|
| 连接 | 新建 / 重连 / 删除服务器连接 |
| 库与集合 | 数据库列表、集合列表、索引、加载 |
| 数据与搜索 | 表格、导入、筛选、语义搜索、评测 |
| 设置 | Embedding、是否记住密钥 |

## 架构

```text
milvuslens/
├── apps/
│   ├── web/          # React 18 + Vite + Tailwind + shadcn
│   └── server/       # Fastify + @zilliz/milvus2-sdk-node
│       └── src/
│           ├── routes/     # HTTP 入口
│           └── services/   # milvus / milvusOps / embed / urlGuard
├── packages/
│   └── shared/       # 共享 TypeScript 类型（产出 dist 供 Node）
├── scripts/          # smoke / integration / eval
└── .github/workflows/  # check · smoke · integration
```

```text
浏览器 → Vite :5173 → /api proxy → Fastify :3001
                                      ├─ gRPC → Milvus
                                      └─ HTTP → Embedding API
```

## 安全说明（Threat Model）

**本机调试工具，不是多租户服务。**

| 项 | 行为 |
|----|------|
| 监听地址 | 默认 `127.0.0.1:3001`，**勿对公网暴露** |
| CORS | 仅本地 `localhost` / `127.0.0.1` / `[::1]` |
| 密钥 | 密码与 API Key **默认不写** localStorage；仅在可信机器开启「记住密钥」 |
| 鉴权 | **无登录**；本机任意进程可调 API 并改 Milvus |
| 破坏操作 | 删库 / 删集合 / 删数据需输入确认文案 |
| Embedding 代理 | 拒绝非 http(s) 与云 metadata 地址 |

需要远程访问时，请自备反向代理鉴权或 SSH 隧道。

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3001` | 后端端口 |
| `HOST` | `127.0.0.1` | 后端监听地址 |

## 明确不做（当前定位）

- 多用户 / 云 SaaS 权限体系  
- Rerank、LLM 生成对照、混合检索  
- 手机端原生 App  

## 开发说明

```bash
# 先编译 shared，再起前后端（pnpm dev 已包含）
pnpm --filter @milvuslens/shared build

# 仅后端 / 仅前端
pnpm dev:server
pnpm dev:web
```

CI：push / PR 到 `main` 会跑 typecheck、lint、单测、API smoke、Milvus 集成测试。

## License

[MIT](./LICENSE)
