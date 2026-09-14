# MilvusLens 维护手册

> 文档目的：方便后期接手、排障与二次开发。  
> 对应仓库：https://github.com/matchless0101/milvuslens  
> 文档版本：与 `main` @ `5898a3a0` 对齐（功能合并后 + README 改版）

---

## 1. 项目是什么

**MilvusLens** = 本机使用的 **Milvus 管理 + RAG 语义检索调试** 工具。

| 做 | 不做 |
|----|------|
| 连本地/云 Milvus | 多用户 SaaS、云托管 |
| 浏览库集合、建索引、Load/Release | 复杂权限体系 |
| 导入切片（可自动向量化） | 分块 pipeline / ETL 编排 |
| 问题 → Embedding → ANN 检索 | Rerank、LLM 生成对照 |
| 批量问题、Hit@k 评测、CSV 导出 | 手机原生 App |

**产品一句话：** 用真实用户问题，验证「库里向量能不能被搜到」。

---

## 2. 仓库与分支

| 项 | 状态 |
|----|------|
| 主分支 | `main` |
| 开发流 | 功能分支 → PR/merge → `main` |
| CI | GitHub Actions：`check` / `smoke` / `integration` |
| License | MIT（根目录 `LICENSE`） |
| 历史分支 | `feat/core-features` 已合入并删除 |

克隆后日常：

```bash
git checkout main
git pull
```

---

## 3. 技术架构

### 3.1 包结构（pnpm workspace）

```text
milvuslens/
├── apps/web          # 前端：React 18 + Vite + Tailwind + shadcn
├── apps/server       # 后端：Fastify + @zilliz/milvus2-sdk-node
├── packages/shared   # 共享类型（tsc 产出 dist，供 Node 解析）
├── scripts/          # smoke / integration / eval 脚本
└── .github/workflows/ci.yml
```

### 3.2 运行时链路

```text
浏览器 http://localhost:5173
    │  Vite proxy /api
    ▼
Fastify http://127.0.0.1:3001
    ├─ gRPC → Milvus（19530）
    └─ HTTP → Embedding（Ollama 11434 或 OpenAI 兼容）
```

**注意：** 浏览器请用 `localhost:5173`，不要用 `127.0.0.1:5173`（Vite 监听习惯）。

### 3.3 前端模块地图

| 路径 | 职责 |
|------|------|
| `pages/ConnectPage.tsx` | 连接、测试、重连、已保存连接 |
| `pages/ExplorerPage.tsx` | 库/集合列表、索引、加载、删除 |
| `pages/DataExplorerPage.tsx` | 数据页编排（约 580 行） |
| `pages/SettingsPage.tsx` | Embedding、记住密钥 |
| `components/SearchPanel.tsx` | 语义搜索 UI + 历史 |
| `components/DataGrid.tsx` | 虚拟表格、列宽、分页 |
| `components/RowDetailPanel.tsx` | 行详情抽屉 |
| `components/ImportDialog.tsx` | CSV/JSONL 导入 + 自动向量化 |
| `components/EvaluateDialog.tsx` | 召回评测（并发 4） |
| `hooks/useSemanticSearch.ts` | 单条/批量搜索、CSV 导出逻辑 |
| `lib/api.ts` | fetch 封装 + 连接失效处理 |
| `lib/autoReconnect.ts` | lastConnection 自动重连 |
| `lib/errors.ts` | 错误中文化 |
| `stores/app.ts` | zustand + persist |

### 3.4 后端模块地图

| 路径 | 职责 |
|------|------|
| `routes/connections.ts` | connect / test / disconnect |
| `routes/databases.ts` | 列库、建库、删库（`/use` 已 deprecated） |
| `routes/collections.ts` | 列表（listIndexes/getLoadState）、schema、建删、索引、load/release |
| `routes/data.ts` | query / search / import / insert / delete |
| `routes/embedding.ts` | `/embed`、`/embedding/test` |
| `services/milvus.ts` | 连接池 Map、create/get/disconnect |
| `services/milvusOps.ts` | SDK 调用薄封装（统一类型与 db_name） |
| `services/embed.ts` | 批量 embed |
| `services/urlGuard.ts` | Embedding URL 校验（http/https、禁 metadata） |

### 3.5 数据与状态

| 数据 | 位置 | 持久化 |
|------|------|--------|
| 连接配置、主题、搜索历史、Embedding | zustand | localStorage（密码/API Key 默认不写） |
| lastConnection | zustand | 是（用于刷新后重连） |
| MilvusClient 实例 | server 内存 Map | 否，进程重启即失 |
| 表格/搜索结果 | 页面 state | 否 |

---

## 4. 本地开发

### 4.1 依赖

- Node.js ≥ 20  
- pnpm  
- 可选：Docker Desktop、Ollama  

### 4.2 启动

```bash
pnpm install
pnpm dev                 # 先 build shared，再 server + web
pnpm dev:server
pnpm dev:web
```

| 服务 | 地址 |
|------|------|
| Web | http://localhost:5173 |
| API | http://127.0.0.1:3001 |
| Milvus（若本地） | 127.0.0.1:19530 |
| Ollama | http://127.0.0.1:11434 |

### 4.3 质量命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke               # 需 server 已启动
pnpm smoke:rag           # 本地 Milvus + Ollama
pnpm test:integration    # 本地 Milvus 自命中
```

### 4.4 本地 Milvus / Ollama

```bash
docker run -d --name milvus-standalone \
  -p 19530:19530 -p 9091:9091 \
  -e ETCD_USE_EMBED=true -e COMMON_STORAGETYPE=local \
  milvusdb/milvus:v2.5.14 milvus run standalone

ollama pull qwen3-embedding:0.6b
ollama serve
```

Embedding 配置示例（设置页）：

- Base URL：`http://127.0.0.1:11434/v1`  
- Key：可空  
- Model：`qwen3-embedding:0.6b`（1024 维）  

**重要：** 集合向量维度必须与模型一致；索引 metric 与搜索 metric 一致（如 FLAT+IP）。

---

## 5. CI 说明

`.github/workflows/ci.yml`

| Job | 内容 |
|-----|------|
| `check` | install → typecheck → lint → unit test |
| `smoke` | 起 API → `pnpm smoke` |
| `integration` | Docker Milvus → `pnpm test:integration`（合成向量自命中） |

触发：push / PR（`main`、`feat/core-features` 等）。

集成测试**不依赖** Ollama，使用固定维度合成向量。

---

## 6. 安全模型（维护时勿破坏）

1. API 默认只听 `127.0.0.1`  
2. CORS 仅本地 origin  
3. 无登录鉴权——本机信任模型  
4. 密钥默认不落盘；「记住密钥」需用户显式打开  
5. 删库/删集合/删数据需输入确认文案  
6. Embedding 代理拒绝非 http(s)、云 metadata IP  

改动破坏性 API 或暴露端口时，**必须同步改 README 威胁模型**。

---

## 7. 关键设计决策（ADR 摘要）

| 决策 | 原因 |
|------|------|
| 不用 `client.use()` 切库 | 全局 client 竞态；改为各接口 `db_name` |
| 列表用 `listIndexes`/`getLoadState` | `describeCollection` 不返回索引/加载态 |
| 密钥默认不 persist | 降低 localStorage 泄露风险 |
| 搜索默认 metric IP | 常见 FLAT(IP) 索引 |
| shared 发 dist + types 指 src | Node 可跑生产构建，前端类型仍来自源码 |
| Vite alias shared→src | 浏览器直接打包 TS 类型包源码 |
| 评测限并发 4 | 平衡速度与 Embedding 服务压力 |
| 导入部分失败可感知 | 分批 insert 无事务，必须报 `partial` |

---

## 8. 常见排障

| 现象 | 排查 |
|------|------|
| 连接 502 | 目标 Milvus 不可达/认证失败；看页面错误或 `server.log` 中 `milvus connect failed` |
| 搜索结果为空 | 集合是否 **已加载**；是否有 **向量索引**；metric 是否与索引一致 |
| 提示未配置 Embedding | 设置里 Base URL + 模型名；Ollama 可不填 Key |
| 刷新后要重新连接 | 正常：连接在 server 内存；前端会用 lastConnection 尽量自动重连 |
| 用户名认证重连失败 | 默认不存密码，需在连接卡片输入密码 |
| 维度不匹配 | Embedding 模型 dim ≠ 集合向量字段 dim |
| 列表显示 0 索引 | 是否走 withDetails；旧缓存可点刷新 |
| 前端 127.0.0.1:5173 打不开 | 改用 `http://localhost:5173` |

服务端日志（开发时）：

```powershell
Get-Content .\server.log -Tail 50
Select-String -Path .\server.log -Pattern "milvus connect"
```

---

## 9. 测试资产

| 脚本 | 用途 |
|------|------|
| `scripts/smoke-api.mjs` | 真实 HTTP：连接/CORS/query 等 |
| `scripts/integration-rag.mjs` | Milvus 建集合→插入→索引→自命中 |
| `scripts/local-rag-test.mjs` | Ollama+Milvus 完整中文检索 demo |
| `scripts/eval-demo.mjs` | demo 集合 Hit@1 演示 |
| `scripts/verify-import.mjs` | 校验导入行可 query/search |

单测：`errors.ts`、`urlGuard`、`collectionState`、CSV 解析。

---

## 10. 已完成里程碑（简表）

1. P0/P1 安全与正确性（CORS、密钥、删除确认、重连泄漏、相似度、db_name…）  
2. 数据体验（虚拟表、列宽、库集合切换、失败/空态）  
3. RAG 调试（Ollama、建索引、导入、历史/批量/CSV、评测）  
4. 工程化（shared 产物、CI 三 job、拆页、milvusOps、文档）  
5. 合入 `main` 并清理 feature 分支  

---

## 11. 可选后续（未做）

| 项 | 优先级建议 |
|----|------------|
| 用已有向量搜索 | 用户明确暂不做 |
| 结果高亮 / 复制全部 | 低 |
| react-router 深链 | 需要分享链接时 |
| Electron 壳 | 仅当要安装包/托盘/自动更新 |
| 根目录清理空 `server/` `web/` 残留 | 顺手可做 |

---

## 12. 修改代码时的检查清单

- [ ] `pnpm typecheck`  
- [ ] `pnpm lint`  
- [ ] `pnpm test`  
- [ ] 若改 API：起 server 后 `pnpm smoke`  
- [ ] 若改检索/导入：本地 Milvus 跑 `pnpm test:integration` 或 `smoke:rag`  
- [ ] 若改安全相关：更新 README 威胁模型  
- [ ] 不要提交真实密码 / API Key / 内网地址  

---

## 13. 相关文档

| 文件 | 内容 |
|------|------|
| [README.md](../README.md) | 用户向介绍与快速开始 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献与 PR 约定 |
| [LICENSE](../LICENSE) | MIT |

---

**维护原则：** 保持「本机检索调试」定位清晰；优先修连接/索引/召回链路，避免无边界扩功能。
