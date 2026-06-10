# 更新日志

## 第一轮修复 -- 2026-04-28

### 后端修复（evaluater_backend_0.1）

#### 1. confidence.py -- 常量化硬编码值

**文件**: `app/confidence.py`

- 新增常量 `MAX_CONSECUTIVE_WRONG = 5`
- 替换连续错误题停止检查中的硬编码 `n >= 5` 和 `[-5:]`
- **影响**: 提高可维护性

#### 2. profile.py -- 常量化 HSK 映射魔法数字

**文件**: `app/profile.py`

- 新增常量 `HSK_LEVEL_SPAN = 5`
- **影响**: 明确 HSK 等级跨度计算意图

---

### 前端修复（evaluater_frontend_0.1）

#### 3. UserProfileSidebar.vue -- setInterval 内存泄漏修复

**文件**: `src/components/UserProfileSidebar.vue`

- 在 `onUnmounted` 中清理定时器
- **影响**: 修复内存泄漏

#### 4. Vite proxy 配置

**文件**: `vite.config.ts`

- 添加 `/api` 代理到 `localhost:8000`
- **影响**: 开发时无需 CORS

#### 5. SSE 解析器异常处理增强

**文件**: `src/api/index.ts`

- 4 个 SSE 流函数的 `JSON.parse` 全部包裹 try/except
- **影响**: 提高 SSE 流鲁棒性

#### 6. SessionReport 数据利用率提升

**文件**: `src/views/ChatPage.vue`、`src/components/ChatView.vue`

- 从 `summary.memory_update` 提取评测总结到报告
- **影响**: 报告不再空白

---

## 第二轮更新 -- 2026-04-28

### 语法知识图谱系统集成

#### 7. 语法知识围栏服务（Grammar Fence Service）

**新增文件**: `services/grammar_fence.py`

共 **200 个语法点**，包含知识图谱链接（147 个后置知识引用）。

核心功能：等级筛选、前置知识可达性分析、维度推断、出题约束 prompt 生成。

#### 8. 语法点数据库模型

**新增文件**: `models/grammar.py`

`GrammarPoint` ORM 模型，`grammar_points` 表。

#### 9. 语法数据导入脚本

**新增文件**: `import_grammar.py`

从 `hsk_grammar_selected/` JSON 文件导入到 PostgreSQL。用法: `python import_grammar.py`

#### 10. 替换 LEGACY_GRAMMAR_SKILLS

**修改文件**: `app/profile.py`

用知识图谱动态推断技能维度，替代硬编码映射。

---

### 验证结果

- 后端测试: 25 passed
- 语法服务: 全部功能验证通过

---

## 第三轮清理 -- 2026-04-28

### 清除死代码，语法知识图谱完全数据库化

#### 11. 清理 LEGACY_GRAMMAR_SKILLS 死代码

**修改文件**: `app/profile.py`

- 完全删除 `_DIMENSION_FROM_GRAMMAR` 字典（6 条 legacy 映射，其中 4 条在知识图谱中不存在，2 条的映射优先级被知识图谱覆盖，永远不会触发）
- `_get_dimension_from_grammar()` 仅保留知识图谱查询 + 默认 `"grammar"` 回退
- 清理冗余注释和文档字符串

#### 12. grammar_fence.py 完全数据库化

**修改文件**: `services/grammar_fence.py`

- **移除** JSON 文件加载逻辑（原 `Path(__file__).parent.parent / "hsk_grammar_selected"` + `lru_cache` 读文件）
- **改为** 通过 SQLAlchemy 查询 `grammar_points` 表
- `lru_cache` 缓存数据库查询结果（按 level 缓存），新增 `invalidate_grammar_cache()` 函数支持手动刷新
- `_normalize()` 函数将 ORM 对象转换为带 `_dimension` 的字典

#### 13. 导入脚本

**新增文件**: `import_grammar.py`

- 从 JSON 文件批量导入到 `grammar_points` 表
- 自动检测是否已有数据，跳过重复导入

---

## 第四轮修复 -- 2026-04-28

### 阅读理解题结构修复 + 出题 Agent 自主权提升

#### 14. 阅读理解 prompt 结构约束

**修改文件**: `app/routes/session_routes.py`

- 阅读维度出题时，在 prompt 中注入 `reading_instruction`：
  - `question_text` 必须以 `【阅读材料】` 开头，后接材料，空一行，再写具体问题
  - `options` 必须基于阅读材料内容，不能脱离材料
- **解决的问题**: 之前 LLM 只生成阅读材料，没有生成"需要判断什么"的具体问题，导致前端渲染为选择题后没有可供作答的题目

#### 15. 出题 Agent 自主权提升

**修改文件**: `agents/skill_generator_agents.py`、`app/routes/session_routes.py`

- 重写三个出题 Agent 的 `desc`，从固定题型约束改为"拥有完整自主权，根据考察目标自行选择最合适的题型"
- 阅读出题 Agent 明确要求生成"阅读材料 + 具体问题"的双段式结构
- **影响**: Agent 不再被 planner 分配的 question_type 硬性约束，可以自由选择最能考察该维度的题型

#### 16. 题型与话术一致性约束

**修改文件**: `app/routes/session_routes.py`

- 阅读指令中根据实际分配题型给出对应话术示例：选择题用"下列说法正确的是？"并提供 options，判断题结尾给明确说法而非选择式提问，填空题用 `______` 标记
- 判断题指令补充"结尾必须是可供判断真伪的明确说法，不能是选择式提问"
- **解决的问题**: 之前 LLM 将 `question_type` 设为判断题，但 `question_text` 结尾写了"下列说法正确的是？"（选择话术），且不提供 options，导致前端渲染为判断题但用户无选项可判断

---

## 第五轮修复 -- 2026-04-28

### 用户画像能力维度更新失败修复

#### 17. SQLAlchemy JSON 列原地修改不触发 dirty 检测

**修改文件**: `app/profile.py`

- `_update_user_profile_async` 中原代码：`profile.skill_levels.update(skills)`
- 改为：`profile.skill_levels = skills`（直接赋值新字典）
- **根因**: SQLAlchemy 对 JSON/JSONB 列的 `dict.update()` 是原地修改（in-place mutation），ORM 不会检测到这个变化，`commit()` 时不生成 UPDATE 语句，导致数据库中的 `skill_levels` 永远停留在冷启动写入的值（16.7%）
- **表现**: 用户答完题后前端侧边栏四个维度能力值全部停留在 16.7%，从未更新
- **影响**: 修复后每次答题都会正确更新用户画像到数据库

---

## 第六轮修复 -- 2026-04-29

### 题目元信息语法点显示修复

#### 18. 前端空 grammar_focus 不渲染

**修改文件**: `src/components/QuestionRenderer.vue`

- `<span>{{ itemData.grammar_focus }}</span>` → `<span v-if="itemData.grammar_focus">{{ itemData.grammar_focus }}</span>`
- **问题**: `grammar_focus` 为空字符串时前端渲染出一个空白占位，视觉上出现一个空位

#### 19. 后端 grammar_focus 保留 agent 输出值

**修改文件**: `app/routes/session_routes.py`

- 旧逻辑：grammar 维度强制覆盖 `grammar_focus = dim_grammar`（硬编码轮转列表），丢弃 agent 自己生成的值；vocabulary/reading 维度用 `setdefault` 设为空字符串
- 新逻辑：优先保留 agent 返回的 `grammar_focus`，仅在 agent 没返回时才使用后端默认值
- **影响**: agent 可以根据题目内容自主决定 `grammar_focus` 标签，前端展示更准确的语法点信息

---

## 第七轮更新 -- 2026-04-29

### 评测机制重构：按轮次计量替代按题数计量

#### 20. 置信度停止逻辑改为轮次驱动

**修改文件**: `app/confidence.py`

- **旧逻辑**: 按已答题数判断停止，`MAX_QUESTIONS = 12`（每轮 3 题 = 4 轮就停）
- **新逻辑**: 按已完成评测轮次判断：`MIN_ROUNDS = 8`、`MAX_ROUNDS = 18`、每轮固定 `QUESTIONS_PER_ROUND = 3`
- `compute_rounds()` 从 history 统计各维度题目数，计算总轮次和各维度覆盖度

#### 21. 每轮固定 3 维度出题

**修改文件**: `app/routes/session_routes.py`

- planner 从"决定哪些维度 + 分配题型"改为"为 vocabulary/grammar/reading 3 个固定维度分配不同题型"
- 每轮信息量一致，不再出现一轮 2 题一轮 3 题的波动

#### 22. 前端置信度条改为轮次展示

**修改文件**: `src/types/index.ts`、`src/components/ConfidenceBar.vue`、`src/api/index.ts`、`src/components/ChatView.vue`

- 新增 `total_rounds`、`min_rounds`、`max_rounds`、`dimension_rounds` 字段
- 进度条展示"已答 X / 18 轮"，底部三个维度独立计数（词汇/语法/阅读各 N 轮）
- 加载提示语优化：判题阶段"正在评估作答..."，出题阶段"正在生成下一轮题目..."

#### 23. 数据流一致性

**修改文件**: `app/routes/session_routes.py`

- `should_stop()` 调用补充 `history` 参数用于轮次计算
- `get_confidence` 接口返回轮次数据

#### 设计理由

- 8 轮 = 每维度 8 题（24 题），Wilson 区间收敛的最低样本量
- 18 轮 = 每维度 18 题（54 题），边际收益递减
- 旧系统 12 题/3 维 = 每维 4 题，统计上不可靠

---

## 第八轮更新 -- 2026-04-29

### 行为观察智能体上下文增强

#### 24. 新增 `_build_observer_context()` 函数

**修改文件**: `app/utils.py`

- 为观察者提供结构化上下文：题型、难度、维度、语法点、题目内容、用户当前 HSK 等级、答题用时（秒）、近 5 题趋势
- `state["question_pushed_at"]` 在题目推送时记录毫秒时间戳，答案提交时计算用时

#### 25. 所有 4 处 observer prompt 重写

**修改文件**: `app/routes/session_routes.py`

- 客观题 prompt：答题用时合理性 + 作答质量反映的认知水平 + 犹豫/猜测迹象
- 主观题 prompt：答题用时 + 句式/词汇/语法 + 犹豫/猜测 + 整体认知水平
- **与评分 agent 区分**：观察者关注行为模式和时间异常，评分者关注语言质量

#### 26. session_state 新增时间追踪字段

**修改文件**: `app/state.py`

- `question_pushed_at`: 题目推送时间戳
- `last_response_time`: 答题用时（毫秒）

---

## 第九轮更新 -- 2026-06-05

### 前端移动端兼容与部署说明

#### 27. API 默认地址改为同源路径

**修改文件**: `src/api/index.ts`、`.env`、`.env.example`

- `VITE_API_URL` 默认不再指向 `http://localhost:8000`
- 前端默认请求 `/api/v1/...`
- **原因**: 移动端浏览器中的 `localhost` 指向手机本机，不是后端所在机器
- **影响**: 生产环境可统一通过公网域名反向代理 `/api` 到后端，避免 PC 正常但移动端 `Failed to fetch`

#### 28. 客户端 ID 生成改用 `uuid`

**新增文件**: `src/utils/id.ts`

- 新增 `createClientId()` 作为前端客户端 ID 的统一生成入口
- 引入生产依赖 `uuid`
- 替换组件中的 `crypto.randomUUID()`
- **原因**: 部分移动端或旧浏览器环境没有 `crypto.randomUUID`，会报 `crypto.randomUUID is not a function`
- **影响**: 消息 `id`、正式出题 `question_request_id`、批量提交 `submission_id` 在移动端环境中稳定生成

#### 29. 前端运行文档

**新增文件**: `README.md`

- 记录本地启动、测试、构建命令
- 说明同源 API 路径与反向代理约定
- 说明 `uuid` 依赖和 `createClientId()` 使用边界
- 补充多工作区同步注意事项：复制到新工作区后需要同步 `package.json` / `package-lock.json` 并重新执行 `npm install`
