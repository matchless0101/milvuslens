<div align="center">

# MilvusLens

**轻量级开源 Milvus 可视化与语义检索调试工具**

连接 Milvus · 管理库与集合 · 导入切片 · 用真实问题测召回

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-blue.svg)](https://pnpm.io/)
[![CI](https://github.com/matchless0101/milvuslens/actions/workflows/ci.yml/badge.svg)](https://github.com/matchless0101/milvuslens/actions)

[快速开始](#快速开始) · [功能](#功能特性) · [架构](#系统架构) · [安全](#安全说明) · [贡献](./CONTRIBUTING.md)

</div>

---

## 简介

MilvusLens 是一款面向 **RAG / 向量检索调试** 的本地开源工具。  
你可以用它连接 Milvus（本地 Docker 或云端），浏览库与集合，批量导入文档切片，配置 Embedding，并用**用户真实会问的问题**做语义搜索与召回评测。

> **定位：** 本机开发调试工具，不是多租户 SaaS 管理平台。

## 功能特性

| 模块 | 说明 |
|------|------|
| **连接管理** | 支持 Milvus 2.4+ / 2.5+，本地或云；上次连接自动恢复 |
| **库与集合** | 列表、创建、删除；一键建向量索引；加载 / 释放 |
| **数据浏览器** | 虚拟滚动表格、筛选构建器、列显隐、列宽拖拽、行详情 |
| **批量导入** | CSV / JSONL / JSON 数组；可对文本字段自动向量化 |
| **语义搜索** | 问题 → Embedding（Ollama / OpenAI 兼容）→ Milvus ANN |
| **检索辅助** | 搜索历史、多问题批量搜索、结果 CSV 导出 |
| **召回评测** | `问题|期望id` → Hit@1 / Hit@3 / Hit@K，可导出报告 |
| **体验** | 暗色/亮色主题、命令面板 `Ctrl+K`、中文错误提示 |

## 界面预览

| 页面 | 说明 |
|------|------|
| 连接 | 新建 / 重连 / 管理服务器连接 |
| 库与集合 | 数据库、集合、索引状态、加载 |
| 数据与搜索 | 表格、导入、筛选、语义搜索、评测 |
| 设置 | Embedding 服务、是否记住密钥 |

> 可将本地运行截图放到 `docs/screenshots/` 并在此引用。

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 20 | 必需 |
| pnpm | 最新稳定版 | 必需 |
| Docker | 可选 | 本地 Milvus |
| Ollama | 可选 | 本地 Embedding |

### 安装与启动

```bash
git clone https://github.com/matchless0101/milvuslens.git
cd milvuslens
pnpm install
pnpm dev
```

打开浏览器访问：**http://localhost:5173**  
（请使用 `localhost`，不要用 `127.0.0.1` 打开页面）

### 常用命令

```bash
pnpm typecheck          # 类型检查
pnpm lint               # ESLint
pnpm test               # 单元测试
pnpm smoke              # API 冒烟（需先启动 server）
pnpm test:integration   # 集成测试（需本地 Milvus）
pnpm build              # 生产构建
```

## 推荐工作流

```text
连接 Milvus
    → 库与集合（建索引 / 加载）
    → 数据与搜索（导入切片）
    → 输入真实用户问题
    → 搜索 / 批量评测 Hit@k
```

1. **连接**：本地 `127.0.0.1:19530` 或云端地址  
2. **索引**：若集合无向量索引，点「建索引」  
3. **加载**：集合需 Load 后才能 search  
4. **导入**：CSV/JSONL，可勾选「自动向量化」  
5. **检索**：设置 Embedding 后输入问题；Metric 与索引一致（如 `FLAT` + `IP`）  
6. **评测**：粘贴 `问题|期望doc_id` 列表，查看 Hit@1/3/K  

## Embedding 配置

在 **设置 → Embedding** 中配置：

| 提供方 | API Base URL | API Key | 模型示例 |
|--------|--------------|---------|----------|
| OpenAI | `https://api.openai.com/v1` | 必填 | `text-embedding-3-small` |
| 本地 Ollama | `http://127.0.0.1:11434/v1` | 可空 | `qwen3-embedding:0.6b` |

本地 Ollama 示例：

```bash
ollama pull qwen3-embedding:0.6b
ollama serve
```

## 本地 Milvus（Docker）

```bash
docker run -d --name milvus-standalone \
  -p 19530:19530 -p 9091:9091 \
  -e ETCD_USE_EMBED=true \
  -e COMMON_STORAGETYPE=local \
  milvusdb/milvus:v2.5.14 \
  milvus run standalone
```

## 系统架构

```text
milvuslens/
├── apps/
│   ├── web/              # React + Vite + Tailwind + shadcn
│   └── server/           # Fastify + Milvus SDK
│       └── src/
│           ├── routes/   # HTTP API
│           └── services/ # milvus / milvusOps / embed / urlGuard
├── packages/
│   └── shared/           # 前后端共享类型
├── scripts/              # smoke / integration / eval
└── .github/workflows/    # CI：check · smoke · integration
```

```text
浏览器 (Vite :5173)
        │  /api proxy
        ▼
Fastify (127.0.0.1:3001)
        ├─ gRPC ──► Milvus（本地 / 云）
        └─ HTTP ──► Embedding（Ollama / OpenAI 兼容）
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 · Vite · Tailwind · shadcn/ui · zustand · TanStack Virtual |
| 后端 | Fastify · @zilliz/milvus2-sdk-node |
| 工程 | pnpm workspace · TypeScript · ESLint · Vitest · GitHub Actions |

## 安全说明

**本机调试工具，请勿对公网暴露 API 端口。**

| 项 | 说明 |
|----|------|
| 监听 | 默认 `127.0.0.1:3001` |
| CORS | 仅本地 `localhost` / `127.0.0.1` / `[::1]` |
| 密钥 | 密码与 API Key 默认不写入 localStorage |
| 鉴权 | 无用户登录；本机进程可调用 API |
| 破坏操作 | 删库 / 删集合 / 删数据需输入确认文案 |
| Embedding 代理 | 拒绝非 http(s) 与云 metadata 地址 |

详见 [README 安全段落](#安全说明) 与源码中的 `urlGuard`。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端端口 |
| `HOST` | `127.0.0.1` | 后端监听地址 |

## 路线图（当前不做）

- 多用户 / 云 SaaS 权限体系  
- Rerank、LLM 生成对照、混合检索  
- 手机端原生 App  

## 文档与贡献

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)  
- **维护手册**（架构、排障、检查清单）：[docs/MAINTENANCE.md](./docs/MAINTENANCE.md)  
- 发现问题请提 [Issue](https://github.com/matchless0101/milvuslens/issues)  
- 欢迎 PR：从 `main` 拉分支，提交前请跑 `pnpm typecheck && pnpm lint && pnpm test`

## 社区与支持

- 仓库：[github.com/matchless0101/milvuslens](https://github.com/matchless0101/milvuslens)  
- 若本工具对你有帮助，欢迎 **Star** 支持项目发展  

## License

本项目采用 [MIT](./LICENSE) 协议开源。

---

<div align="center">

如果 MilvusLens 帮到了你，请点一下 **Star**，谢谢

</div>
