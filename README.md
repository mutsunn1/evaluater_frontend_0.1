# 中文水平评测前端

Vue 3 + TypeScript + Pinia + TailwindCSS 前端，用于中文水平评测系统的登录、冷启动、正式出题、作答、反馈、思考过程和评测报告展示。

## 快速启动

```bash
npm install
npm run dev
```

构建和测试：

```bash
npm run test
npm run build
```

## 后端 API 地址

默认使用同源 API 路径：

```text
/api/v1/...
```

也就是说生产环境推荐由公网域名反向代理 `/api` 到后端服务。例如前端页面为：

```text
https://eval.mutsum1.xyz
```

则浏览器请求：

```text
https://eval.mutsum1.xyz/api/v1/...
```

本地开发时，`vite.config.ts` 已配置 `/api` 代理到 `http://localhost:8000`。

如果必须显式指定 API 域名，可在 `.env` 中设置：

```env
VITE_API_URL=https://your-domain.example
```

通常生产部署不建议写成 `http://localhost:8000`，因为移动端浏览器中的 `localhost` 指向手机本机，不是部署后端的机器。

## 客户端 ID 生成

前端使用 `uuid` 依赖生成客户端 ID，统一入口为：

```text
src/utils/id.ts
```

不要在组件中直接调用 `crypto.randomUUID()`。部分移动端或旧浏览器环境没有这个函数，会导致运行时报错：

```text
crypto.randomUUID is not a function
```

当前客户端 ID 用于：

- 消息 `id`
- 正式出题 `question_request_id`
- 批量提交 `submission_id`

这些 ID 不需要跨页面刷新持久化，只需要在当前请求或当前重试链路内保持稳定。

## 多工作区同步注意事项

如果把源码同步到另一份工作区，例如从 `week3` 复制到 `week7`，必须同步以下内容：

- `package.json`
- `package-lock.json`
- `src/utils/id.ts`
- 所有引用 `createClientId()` 的组件

同步后在目标工作区重新执行：

```bash
npm install
```

如果 Vite 仍提示无法解析依赖，可清理本地缓存后重新启动：

```powershell
Remove-Item -Recurse -Force node_modules\.vite
npm run dev
```

## 主要界面模块

- `src/views/LoginView.vue`：登录与会话创建。
- `src/views/ChatPage.vue`：评测页面外壳、顶部操作栏、用户画像入口。
- `src/components/ChatView.vue`：冷启动、正式评测、SSE thinking、重试和答题主流程。
- `src/components/MessageBubble.vue`：题目、用户答案、反馈、冷启动消息的聊天气泡。
- `src/components/ThinkingProcess.vue`：消息下方的思考摘要预览。
- `src/components/ThinkingSidebar.vue`：完整思考过程抽屉。
- `src/components/UserProfileSidebar.vue`：用户画像与 HSK 能力维度展示。
- `src/components/ConfidenceBar.vue`：评测轮次、维度覆盖和置信度展示。
