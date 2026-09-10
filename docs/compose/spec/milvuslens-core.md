---
feature: milvuslens-core
status: designed
updated: 2026-09-10
branch: feat/core-features
commits: 
---

# MilvusLens Core Features

## Report

## [S1] Problem

现有 Milvus 管理工具（Attu）已闭源，且在检索体验、界面交互、功能聚焦上存在不足。需要一个轻量开源的 Milvus 管理工具，专注三个核心场景：

1. **连接与浏览** — 连接 Milvus 服务器，查看/创建集合，浏览数据库
2. **数据查看** — 高性能表格 + 行详情面板，支持大数据量浏览
3. **语义检索调试** — 输入自然语言问题，通过可配置的 Embedding 接口向量化，在集合中执行相似度搜索，按分数排序展示结果

## [S2] Design

### 技术栈

| 层 | 选型 |
|---|------|
| 前端 | React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS |
| 后端 | Node.js + Fastify + @zilliz/milvus2-sdk-node |
| 桌面 | Electron（包装 Web 应用） |
| 状态管理 | Zustand（轻量） |
| 表格 | TanStack Table + TanStack Virtual |
| 包管理 | pnpm monorepo |

### 项目结构

```
milvuslens/
├── apps/
│   ├── web/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   ├── pages/          # 页面
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── hooks/          # 自定义 hooks
│   │   │   ├── lib/            # 工具函数
│   │   │   └── types/          # 类型定义
│   │   └── package.json
│   ├── server/                 # Fastify 后端
│   │   ├── src/
│   │   │   ├── routes/         # API 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   └── types/          # 类型定义
│   │   └── package.json
│   └── desktop/                # Electron 桌面壳
│       └── package.json
├── packages/
│   └── shared/                 # 共享类型和常量
├── docs/
│   └── compose/spec/
├── pnpm-workspace.yaml
└── package.json
```

### 核心功能模块

#### 2.1 连接管理

**页面：Connect**

- 表单字段：Host、Port、用户名（可选）、密码（可选）、TLS（开关）、连接名称
- 支持保存多个连接配置（localStorage 持久化）
- 连接测试按钮，显示连接状态
- 连接成功后跳转到数据库列表

**后端 API：**
```
POST /api/connect          # 建立连接，返回连接 ID
POST /api/disconnect       # 断开连接
GET  /api/connections      # 列出已保存的连接
```

#### 2.2 数据库与集合浏览

**页面：Databases / Collections**

- 左侧数据库列表（支持创建/删除数据库）
- 右侧集合列表，显示：名称、行数、索引数、分片数、状态
- 集合操作：加载/释放/删除
- 点击集合进入数据查看

**后端 API：**
```
GET    /api/databases                    # 列出数据库
POST   /api/databases                    # 创建数据库
DELETE /api/databases/:name              # 删除数据库
GET    /api/collections?db=:name         # 列出集合
POST   /api/collections                  # 创建集合
DELETE /api/collections/:name            # 删除集合
POST   /api/collections/:name/load       # 加载集合
POST   /api/collections/:name/release    # 释放集合
```

#### 2.3 创建集合

**弹窗：Create Collection**

- 字段配置：字段名、类型（INT64/VARCHAR/FLOAT_VECTOR/BINARY_VECTOR/JSON 等）、维度（向量字段）、最大长度（VARCHAR）
- 主键字段选择
- 索引配置：索引类型（AUTO_INDEX/IVF_FLAT/HNSW 等）、度量类型（L2/IP/COSINE）
- 高级选项：分片数、副本数、描述

#### 2.4 数据查看（重点设计）

**页面：Data Explorer**

布局：三栏结构
```
┌─────────────────────────────────────────────────────┐
│ 工具栏：搜索框 | 过滤表达式 | 刷新 | 导出            │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│   数据表格（虚拟滚动）    │   行详情面板             │
│   - 列头可排序           │   - 字段列表             │
│   - 行点击选中           │   - 向量字段预览         │
│   - 向量列截断显示       │   - JSON 视图            │
│   - 分页控件             │   - 复制功能             │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│ 语义搜索面板（可折叠）                              │
│ [输入问题] [选择向量字段] [TopK] [搜索]             │
│ 搜索结果：按相似度分数排序的卡片列表                 │
└─────────────────────────────────────────────────────┘
```

**高性能表格：**
- 使用 TanStack Virtual 实现虚拟滚动，支持 10 万+ 行流畅浏览
- 列宽自适应 + 手动调整
- 向量字段显示为 `[0.12, -0.34, ...]` 截断格式，点击展开完整值
- 支持标量字段排序（前端排序当前页 / 后端排序全量）
- 分页：默认 50 条/页，可选 20/50/100/200

**行详情面板：**
- 点击表格行，在右侧面板展示完整字段详情
- 向量字段显示：前 20 维数值 + 维度总数 + 「展开全部」按钮
- JSON 字段格式化展示
- 每个字段提供「复制值」按钮
- 底部提供「复制整行 JSON」按钮

**语义搜索面板：**
- 输入框：自然语言问题（如 "What is the capital of France?"）
- 向量字段选择器：列出集合中所有 FLOAT_VECTOR 字段
- TopK 滑块：1-100，默认 10
- 搜索按钮触发流程：
  1. 调用后端 `/api/embed` 将问题向量化
  2. 调用后端 `/api/collections/:name/search` 执行向量搜索
  3. 结果按相似度分数降序排列
- 结果展示：卡片列表，每张卡片显示：
  - 相似度分数（醒目显示）
  - 主键值
  - 主要标量字段摘要
  - 点击展开完整字段（复用行详情面板）
- 搜索历史：保留最近 20 条搜索记录，可快速重跑

#### 2.5 Embedding 配置

**页面：Settings > Embedding**

- 提供商类型：OpenAI 兼容接口（默认）
- 配置项：
  - API Base URL（默认 `https://api.openai.com/v1`）
  - API Key
  - 模型名（默认 `text-embedding-3-small`）
  - 自定义 Header（可选，用于私有部署）
- 测试按钮：发送测试文本，显示返回的向量维度和前几维数值
- 配置持久化到 localStorage（Key 加密存储）

**后端 API：**
```
POST /api/embed              # 文本向量化
POST /api/embedding/test     # 测试 embedding 配置
```

#### 2.6 全局交互

- **暗色/亮色模式**：跟随系统 + 手动切换
- **命令面板**：`Ctrl/Cmd + K` 打开，支持快速跳转页面、切换连接、搜索集合
- **快捷键**：
  - `Ctrl/Cmd + K`：命令面板
  - `Ctrl/Cmd + /`：快捷键帮助
  - `Ctrl/Cmd + R`：刷新当前视图
  - `Esc`：关闭弹窗/面板
- **Toast 通知**：操作成功/失败提示

### 数据流

```
用户输入问题
    ↓
前端 POST /api/embed { text, provider config }
    ↓
后端调用 OpenAI 兼容 API 获取 embedding
    ↓
前端 POST /api/collections/:name/search { vector, field, topK, metricType }
    ↓
后端调用 milvus-sdk-node 执行 search
    ↓
前端按分数排序展示结果卡片
```

### 错误处理

- 连接失败：显示具体错误信息（网络超时、认证失败、地址错误）
- Embedding 失败：显示 API 返回的错误详情
- 搜索失败：显示 Milvus 错误（字段不存在、索引未加载等）
- 所有 API 错误统一返回 `{ error: string, code: string }` 格式

### 测试边界

- 后端：路由层单元测试（mock Milvus SDK）
- 前端：关键组件渲染测试 + 语义搜索交互测试
- E2E：连接 → 浏览集合 → 查看数据 → 语义搜索 完整流程

## [S3] Out of Scope

- AI Agent / 自然语言管理（Attu v3 的功能）
- 备份/恢复
- 集群监控 / Prometheus 指标
- RBAC 用户权限管理
- 多语言 i18n（首版仅中文）
- 数据导入/导出
- 索引管理（查看已有索引，但不提供创建/修改索引的 UI）
- 分区管理

## Tasks

- [ ] T1: 初始化 pnpm monorepo 项目结构 — acceptance: `pnpm install` 成功，`pnpm build` 可构建空应用 (covers: S2)
- [ ] T2: 实现后端连接管理 API — acceptance: 可通过 API 连接 Milvus 并返回状态 (covers: S2.1)
- [ ] T3: 实现数据库/集合浏览 API — acceptance: 可列出、创建、删除数据库和集合 (covers: S2.2)
- [ ] T4: 实现创建集合 API — acceptance: 可通过 API 创建带索引的集合 (covers: S2.3)
- [ ] T5: 实现数据查询 API — acceptance: 可分页查询集合数据 (covers: S2.4)
- [ ] T6: 实现 Embedding API — acceptance: 可调用 OpenAI 兼容接口获取向量 (covers: S2.5)
- [ ] T7: 实现向量搜索 API — acceptance: 可执行向量相似度搜索并返回分数 (covers: S2.4)
- [ ] T8: 前端项目搭建 + 主题系统 — acceptance: 可切换暗色/亮色模式 (covers: S2.6)
- [ ] T9: 连接页面 — acceptance: 可填写表单连接 Milvus (covers: S2.1)
- [ ] T10: 数据库/集合浏览页面 — acceptance: 可查看数据库和集合列表 (covers: S2.2)
- [ ] T11: 创建集合弹窗 — acceptance: 可通过 UI 创建集合 (covers: S2.3)
- [ ] T12: 高性能数据表格组件 — acceptance: 10 万行数据流畅滚动 (covers: S2.4)
- [ ] T13: 行详情面板 — acceptance: 点击行可查看完整字段详情 (covers: S2.4)
- [ ] T14: 语义搜索面板 — acceptance: 输入问题可执行相似度搜索并展示结果 (covers: S2.4)
- [ ] T15: Embedding 设置页面 — acceptance: 可配置并测试 OpenAI 兼容接口 (covers: S2.5)
- [ ] T16: 命令面板 + 快捷键 — acceptance: Ctrl+K 可打开命令面板 (covers: S2.6)
- [ ] T17: Electron 桌面壳 — acceptance: 可打包为桌面应用运行 (covers: S2)
- [ ] T18: 集成测试 + 构建验证 — acceptance: 全流程 E2E 测试通过 (covers: S2)
