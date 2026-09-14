# 贡献指南

感谢关注 MilvusLens。

## 开发环境

- Node.js ≥ 20
- pnpm
- 可选：Docker（本地 Milvus）、Ollama（本地 embedding）

```bash
pnpm install
pnpm dev
```

浏览器打开 http://localhost:5173

## 提交前请跑

```bash
pnpm typecheck
pnpm lint
pnpm test
```

若改动涉及后端 API，建议再：

```bash
# 另开终端启动 server 后
pnpm smoke
```

## 分支与 PR

1. 从最新 `main` 拉分支：`git checkout -b feat/your-topic`
2. 保持提交信息简洁（英文或中文均可，说明「为什么」）
3. PR 描述写清：改动点、如何验证、是否影响连接/检索路径

## 安全注意

- 不要提交真实 Milvus 密码、API Key、内网地址到仓库  
- 新增对外 HTTP 能力时，保持默认绑定 `127.0.0.1`，并在 README 威胁模型中更新说明  

## 定位边界

优先修复与「本机检索调试」相关的问题。Rerank、LLM 生成、多租户鉴权等不在当前范围。
