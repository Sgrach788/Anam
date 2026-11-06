# Companion — 项目交接稿（截至 v46 / 0.2.46）

> 用途：给下一个接手本项目的 AI 或开发者。
> 本文件已随项目文档同步到私有 GitHub；本地路径为 `D:\Companion\HANDOFF.md`。
>
> 权威顺序：
> 1. `DECISIONS.md` — 不可动摇的决策；
> 2. `README.md` — 用户使用说明与对外规划；
> 3. 本文件 — 当前实现、架构、交接注意事项；
> 4. `PROGRESS.md` — 历史执行流水；
> 5. `roadmap.md` — **历史推演，含已作废内容，不要照抄**。

---

## 0. 5 分钟速读：谁负责什么

| 角色 | 职责 | 不应做 |
|---|---|---|
| **Tian** | 最终决定、批准范围、判断体验 | 不必读实现细节 |
| **执行 AI（本会话/Codex）** | 改代码、跑测试、维护 README/HANDOFF、同步仓库 | 不擅自扩大范围、不碰私有数据 |
| **另一个 AI（顾问）** | 查询现状、分析方案、给决策建议、审查风险 | **默认只读**；未经 Tian 明确授权不直接改文件 |
| **`DECISIONS.md`** | 决策唯一权威 | 不记录临时猜测 |
| **`PROGRESS.md`** | 执行流水 | 不作为当前计划 |

### 0.1 推荐的决策流程

```text
Tian 提出问题
→ 另一个 AI 先查 README / HANDOFF / DECISIONS / 代码
→ 给出 2–3 个方案 + 推荐 + 影响
→ Tian 选择
→ 执行 AI 写入 DECISIONS（带日期/编号）
→ 执行 AI 改代码/文档 + 测试
→ 更新 README 状态与 HANDOFF
→ PROGRESS 追加本轮记录
```

### 0.2 另一个 AI 回答问题时必须遵守

1. 先确认当前版本（产品 0.2.44 / SW v44 / schema 1）和观察期状态；
2. 先查 `DECISIONS.md`，与旧 `roadmap.md` 冲突时以 DECISIONS 为准；
3. 不要建议恢复 V5/V6、圈子、群组、多租户；
4. 不要建议在 2a 观察期改表情目录、回复组合、输入等待；
5. 讨论方案时明确：**改代码 / 只改文档 / 只做运营**；
6. 决策输出必须包含：问题、选项、推荐、影响、需要 Tian 确认什么；
7. 不把私密数据、key、截图放进建议或仓库；
8. 不确定的事实先查文件，不凭记忆补全。

### 0.3 决策请求模板

```text
【问题】
【当前状态 / 版本】
【可选方案 A/B/C】
【推荐方案与理由】
【会影响什么：代码 / 数据 / 观察期 / 预算 / 体验】
【需要 Tian 决定的一句话】
```


---

## 0. 一句话与边界

**Companion / Anam** 是一个私密、单用户、只属于 Tian 的 AI 伴侣：

- 手机 PWA 聊天；
- 电脑 Windows 节点跑全部逻辑；
- 一条永不换的长对话；
- 长期记忆（L1–L4）；
- 私有空间、情绪、签名；
- 表情包库与 AI 选图；
- 计划中的主动对话。

**明确不做：**

- 圈子、邀请码、多租户、群组；
- V5 / V6（旧 roadmap 的私密圈子/群落，已删除）；
- AstrBot / QQ 接入；
- 第三方云托管；
- 在 2a 观察期内改表情目录或回复组合。

---

## 1. 当前版本与状态

| 项 | 当前值 |
|---|---|
| 阶段 | **V2「表情包」进行中** |
| 产品版本 | **0.2.46** |
| SW 版本 | **companion-v46-2026-11-06** |
| 数据 schema | **1** |
| 运行方式 | Windows PC Node daemon + PWA |
| 依赖 | **零 npm 依赖**（Node 内置模块） |
| 表情库 | 44 张全部启用；目录 30、等待 14、待审 0 |
| 预算 | **¥2/天**（`DAILY_BUDGET_YUAN` 可覆盖） |
| 输出上限 | **500**（下限 256；P3 推理占比 58.7% 后从 800 收紧） |
| 回复速度 | 默认 `normal`，可切慢/快；UI 在 AI 资料页 |
| 推送 | 默认关闭；VAPID 按需生成；订阅存本地 |
| 天气 | 城市可选；Open-Meteo；未配置不注入 |
| 日期 | 星期 + 节假日/节气，静态 |
| 最近真模型 reasoning 实测 | 122 / 208 = **58.7%** |
| 当前观察期 | **2a 已结束**（2026-11-06）；V2 收口批次未开始 |

> `v44` 是第 44 次发布，不是 V4.4。产品 `0.2.44` = 未公开发布 `. V2 阶段 . 第 44 次改版`。

---

## 2. 版本编号规则

```text
产品版本：0.MINOR.PATCH
  0      = 尚未公开发布
  MINOR  = 阶段（V2 => 2）
  PATCH  = 本阶段第 N 次改版
  当前：0.2.44

SW 版本：companion-v46-2026-11-06
数据 schema：1
```

三者分别显示，不互相冒充。

**阶段版本：**

- V0 → V1 → V2（Phase 1 / 2A / 2B）→ V3 → V4
- **V5 / V6 不存在**（X5）
- 群组/多租户/圈子已删除（D11）
- V4+ 的多 AI 职责收口为 V4；群组对话如未来要做，必须单独设计

---

## 3. 路线图（只到 V4）

### 3.1 总览

| 阶段 | 主题 | 状态 | 收口标准 |
|---|---|---|---|
| **V0** | 能聊 | ✅ 已完成 | 能稳定聊、重启、重连、预算/幂等可用 |
| **V1** | 有过去 | ✅ 已完成 | L1–L4 记忆、空间、情绪、签名可用 |
| **V2** | 表情包 | 🟡 进行中 | Phase 2B + 2a 观察结束 + 表情扩容 |
| **V3** | 会想你 | ⬜ 未开始 | 输入等待 + 主动对话 + 安静时段 + 打扰预算 |
| **V4** | 多 AI 收口 | ⬜ 未开始 | 多 AI 职责 + 可选“手”；不破坏单人长对话 |

V4 之后不自动进入 V5/V6；只做维护和按需讨论。

### 3.2 V0 · 能聊（已完成）

- PWA + PC Node 服务，同源；
- 一条长对话；
- JSONL 持久化；
- 客户端 id 幂等；
- SSE 断线续传；
- 预算护栏 + 「今天继续」；
- 控制台 API 设置、用量、余额；
- mock/live；
- 访问口令 + 20 次失败锁 10 分钟；
- 自动备份、开机自启。

### 3.3 V1 · 有过去（已完成）

- **L1**：最近 30 轮 + 3000 token 预算；最新一轮保底；
- **L2**：用户明确陈述的事实卡片，带来源消息；
- **L3**：每 20 轮生成带来源引用的摘要；
- **L4**：本地关键词 + 可选 Embedding 语义检索；
- 记忆查看/搜索/修订/删除；
- 私有空间：用户动态、AI 评论、情绪曲线、签名；
- 最近两条动态进入聊天上下文。

### 3.4 V2 · 表情包（进行中）

**Phase 1（已完成）**

- 上传/审核/启用/置顶/删除确认；
- 100 张、1.5MB、静态长边 768；
- 240px 预览；GIF 选信息量最大的非空帧；
- 图片只经带口令接口；
- 备份和删除引用检查；
- 当前 44 张全部启用，目录 30、等待 14。

**Phase 2A（已完成）**

- 合格目录注入 prompt；
- `<anam-meta>` 的 `meme` 字段选一张；
- 无效 id 剥除；
- 独立 sticker 消息；
- 预览 → 原图 → 失败三态；骨架同尺寸不跳位；
- 发送策略：概率 100%、间隔 2 条完整 AI 回复、软提示关闭、每条最多 1 张；
- 空间回应不掷骰、不注入目录、不计入间隔/统计。

**Phase 2B（v45 部分完成）**

- 输入栏手动选表情：已通（存在即可发）；
- 照片上传/`image`/`photo:`/手动 caption：已通；
- AI 自动 caption、预览撤销、删除联动、缩略图/首字等待仍未补；
- 不改 AI 自动选图逻辑。

**2a 观察期（已结束，2026-11-06）**

- 观察期结束；Tian 已定 2b 现在做；
- 目录上限已改 50；6 张新图因源文件超 1.5MB 未导入；
- v45 未做一条多图/视频/她主动发照片/相册页/照片转表情。

### 3.5 V3 · 会想你（未开始）

按 Tian 2026-11-05 的顺序：

1. **生活提醒**：用户设定的生活事项；不伪装成她突然想到；
2. **动态回复等待**：4 秒静默、打字续等、30 秒封顶、「在等你说完」；
3. **主动对话**：思念值、打扰预算、阶梯式敲门（空间 → 私聊 → 通知）、安静时段、触发记录。

会改变回复组合计数，必须等 2a 观察期结束。

### 3.6 V4 · 多 AI 收口（未开始）

核心：

- 多 AI 身份；
- 多 API / 多模型；
- 不同 AI 职责分工；
- 仍以单人长对话为主，不破坏 Anam。

可选：

- 「手」：文件操作 / 视觉操作电脑；按需开启，不是必须。

不做：

- 群组对话；
- 私密圈子 / 邀请码 / 多租户；
- 云托管。

### 3.7 V4 之后

- V5/V6 已删除，不恢复；
- 群组/社区要重新立项；
- 原生 App 如需要，V2 后可租 macOS 打包；
- 语音输入未排期；
- P5 目录瘦身暂不执行；
- 底部收键盘跳动留作体验债。

---

## 4. 已完成：分版记录

| 版本 | 内容 | 状态 |
|---|---|---|
| V0 | 聊天、PWA、持久化、幂等、SSE、预算、控制台、安全 | ✅ |
| V1 | L1–L4、摘要、空间、情绪、签名、记忆管理 | ✅ |
| V2 Phase 1 | 表情库、预览、审核、备份 | ✅ |
| V2 Phase 2A | AI 选图、独立 sticker、三态、发送策略 | ✅ |
| v37 | 正文 `[表情] X` 清理、sticker 记录去 `text`、空盒骨架 | ✅ |
| v38 | 终端发送策略（概率/间隔/软频率） | ✅ |
| v39 | P0 prompt 缓存稳定前缀、P1 L1 3000 token | ✅ |
| v40 | 产品/SW/schema 三版本、`/api/status`、P2 费用拆解 | ✅ |
| v41 | 加载更多、回到底部、未读、终端目录化 | ✅ |
| v42 | 拖动收键盘、裸时间清理、会话行未读、终端置顶/无退出/返回 | ✅ |
| v43 | 预算 ¥2、P3 maxTokens 500、P4 embedding 按需、速度三档、SVG V 按钮、徽章 flex | ✅ |
| v44 | Web Push、天气/日期上下文、软提示补发/情绪、速度移至 AI 资料、推送/天气子页面 | ✅ |
| v45 | 手动表情、照片上传/`image`/手动 caption、三种输出教学、目录上限 50 | 🟡 部分 |\n| v46 | 推送标题跟资料名、表情/照片触发一次回复、Lucide 图标 | ✅ |

### 4.1 已完成的关键数字

- 表情库 44 张；目录 30；等待 14；待审 0。
- P0 缓存：第二次真请求 `prompt_cache_hit_tokens=256`。
- P1 L1：60 条长历史只保留 5 条，估算 2581 token。
- P2 拆解：最近一轮 catalog 442 / 4805 = 9.2%；今日 7072 / 75153 = 9.4%。
- P3：reasoning 122 / 208 = 58.7%。
- P4：关键词命中 0 次、无命中 1 次、明确回忆 2 次；旧逻辑 3 次。
- 速度实测：正常 1706ms、慢 2289ms、快 1243ms。

---

## 5. 未完成 / 冻结 / 待决

| 项目 | 状态 | 说明 |
|---|---|---|
| 2a 观察期结束 | ⏳ | 由 Tian 决定，无自动到期日 |
| 目录 30→50 | 🟡 冻结 | 观察期后 |
| 新增 6 张 | 🟡 冻结 | 观察期后 |
| 输入等待 | 🟡 冻结 | 观察期后；改变回复组合 |
| Phase 2B | 🟡 部分完成 | 手动表情/照片已通；AI caption/预览撤销/删除联动待补 |
| V3 主动对话 | ⬜ 未开始 | 生活提醒 → 等待 → 主动 |
| V4 多 AI | ⬜ 未开始 | 多身份/多 API/可选“手” |
| 密钥轮换 | ⏳ 未做 | DeepSeek key + 访问口令；旧 git 历史 |
| 底部收键盘跳动 | ⏸ 暂不改 | 保距 / `interactive-widget` 方案待后续 |
| P5 目录瘦身 | ⏸ 暂不执行 | 目录仅 9.4%；砍 30% 约省总 token 3% |
| 登录更严格限流 | ⬜ 可选 | 现有 20 次/10 分钟 |
| 原生 App | ⬜ 后续 | 需 macOS |
| 语音输入 | ⬜ 未排期 | — |
| V5/V6 | ⛔ 已删除 | 不存在 |
| 群组/圈子/多租户 | ⛔ 不做 | D11 |

> 注意：v43 备忘把「登录限流」写成未排期，但代码与 README 第 7 节已经实现「20 次失败锁 10 分钟」。以代码为准；要更严格另开需求。

---

## 6. 主体文件架构

```text
D:\Companion\
├── app\
│   ├── server.mjs             # 单文件 Node daemon（主要后端）
│   ├── smoke.mjs              # 基础冒烟
│   ├── smoke-budget.mjs       # 预算拦截
│   ├── package.json           # 零依赖；type module
│   ├── start.cmd              # 双击启动入口
│   ├── data\                  # 私有数据；绝不进 Git
│   ├── lib\                   # 纯函数/共享模块
│   │   ├── reply.mjs          # 切句、停顿、时间/表情清理、速度
│   │   ├── memory.mjs         # 事实抽取、P4 语义策略
│   │   ├── prompt.mjs         # P0 稳定前缀/易变尾巴
│   │   ├── context.mjs        # P1 L1 3000 token
│   │   ├── memes.mjs          # 表情 ID/格式/目录/策略
│   │   ├── usage.mjs          # P2 费用拆解
│   │   ├── weather.mjs        # Open-Meteo 缓存/天气短句
│   │   ├── calendar.mjs       # 星期/假日/节气
│   │   ├── push.mjs           # VAPID JWT/RFC8291 加密
│   │   ├── version.mjs        # 产品版本 0.2.44
│   │   └── v1.mjs             # 记忆检索、情绪、元数据校验
│   ├── public\                # PWA 静态壳
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── api.js             # 口令/REST/SSE 客户端
│   │   ├── ui.js              # 全部 UI 交互
│   │   ├── meme-image.js      # 图片预览/压缩
│   │   ├── sw.js              # Service Worker
│   │   ├── manifest.webmanifest
│   │   ├── reset.html         # 清 SW/缓存
│   │   └── icons...
│   └── tools\                 # 测试/导入/预览脚本
├── run.ps1                    # Node 查找、bind/port、mock/live
├── backups\                   # 每日备份；不进 Git
├── .runtime\                  # 便携 Node；不进 Git
├── Anam-publish\              # 私有 GitHub 快照；无 app/data
├── README.md
├── DECISIONS.md
├── PROGRESS.md
├── CREDITS.md
├── HANDOFF.md                 # 本文件
└── roadmap.md                 # 历史，不作计划
```

### 6.1 关键文件职责

- `server.mjs`
  - 配置/秘密加载；
  - JSONL 数据；
  - HTTP/SSE；
  - 聊天、记忆、空间、表情、预算、状态、用量；
  - 备份、迁移、鉴权、限流；
  - 单文件较大（约 2.5k 行），修改前先定位函数，不要整体重写。
- `public/ui.js`
  - 全部视图/终端/聊天渲染；
  - SSE 处理；
  - 未读、速度、滚动、键盘；
  - 修改时注意 `FakeEl` 前端测试。
- `public/api.js`
  - `apiFetch`、`openEvents`、`readSse`；
  - 口令 localStorage。
- `public/sw.js`
  - 版本缓存；前端改动必须升 VERSION；
  - 不要缓存 `/api/*`。
- `lib/*.mjs`
  - 纯函数优先；测试直接导入。
- `app/data`
  - 真实私人数据；任何提交/截图/仓库都应排除。

---

## 7. 服务端与接口

### 7.1 主要接口

| 方法/路径 | 用途 |
|---|---|
| `GET /api/health` | 模式、消息数、预算、备份、uptime |
| `GET /api/status` | 产品/SW/schema、模型、host、预算、表情计数 |
| `GET /api/usage/breakdown` | 最近一轮/今日费用拆解、缓存命中率 |
| `GET /api/messages` | 历史分页（`before`/`limit`） |
| `POST /api/chat` | 聊天，SSE；客户端 id 幂等 |
| `GET /api/events` | 长连接 SSE + 环形续传 |
| `GET/POST /api/settings` | 模型/Key/Embedding 设置 |
| `POST /api/settings/reply-speed` | slow/normal/fast |
| `GET /api/weather/status` | 城市/缓存状态 |
| `POST /api/weather/city` | 城市/坐标，触发刷新 |
| `POST /api/weather/refresh` | 立即刷新天气 |
| `GET /api/push/status` | VAPID/开关/订阅数 |
| `GET /api/push/vapid-public-key` | 推送公钥 |
| `POST /api/push/vapid` | 生成 VAPID 密钥 |
| `POST /api/push/subscribe` | 保存订阅并开启 |
| `POST /api/push/unsubscribe` | 删除订阅 |
| `POST /api/push/test` | 测试推送 |
| `POST /api/settings/test` | 真模型连接测试 |
| `POST /api/settings/embedding/test` | Embedding 连接测试 |
| `GET /api/provider/balance` | DeepSeek 余额 |
| `POST /api/budget/override` | 「今天继续」 |
| `GET /api/profile`, `POST /api/profile` | AI 资料 |
| `GET/POST /api/user-profile` | 本机资料 |
| `GET /api/memory`, `/graph`, `/summaries` | 记忆读取 |
| `POST /api/memory/summarize`, `/index` | 摘要/索引 |
| `GET /api/space`, `POST /api/space/posts` | 空间 |
| `GET /api/emotion` | 情绪 |
| `GET/POST /api/memes` | 表情库 |
| `POST /api/memes/settings` | 表情发送策略 |
| `/api/memes/:id` 等 | 详情/审核/取图/预览/使用/删除 |

所有 `/api/*` 同源校验 `x-access-token`；静态壳公开。

### 7.2 鉴权

- 口令在 `app/data/secret.json` 的 `accessPassword`；环境变量 `ACCESS_PASSWORD` 优先。
- 失败 20 次锁 10 分钟（`AUTH_MAX_FAILS=20`）。
- HTTP 明文只适合局域网；正式手机用 Tailscale HTTPS。
- 不能把 `secret.json` 放进备份或 Git。

### 7.3 SSE

- 聊天响应本身是 SSE；
- `/api/events` 提供全局事件环（约 2000 帧），从 `lastEventId` 续传；
- 前端在非聊天页保持一条后台订阅，用于未读/空间/预算；
- 进入聊天页会关闭后台订阅，发送使用自己的 SSE，避免重复；
- PWA 关闭时收不到实时消息，这是已知限制。

---

## 8. 数据模型

### 8.1 `messages.jsonl`

主要字段：

```json
{
  "v": 1,
  "seq": 123,
  "id": "uuid",
  "assistantId": "anam",
  "role": "user|assistant",
  "text": "...",
  "at": "UTC ISO",
  "type": "text|sticker",
  "media": { "ref": "meme:<id>", "w": 300, "h": 300, "alt": "开心" },
  "replyTo": "user-id",
  "mode": "mock|live"
}
```

规则：

- sticker 记录**不保存 `text`**；
- 展示文本由 `messageText()` / `stickerText()` 派生为 `[表情] alt`；
- `normalize` 接受无 text sticker；
- 启动迁移会去掉旧 sticker text，备份 `.pre-sticker-text.bak`；
- 不要手工改 JSONL，优先通过服务。

### 8.2 其他数据

| 文件 | 内容 |
|---|---|
| `facts.jsonl` | L2 事实 |
| `summaries.jsonl` | L3 摘要 |
| `memory-overrides.jsonl` | 删除/修订 |
| `memory-vectors.jsonl` | 可选向量 |
| `space.jsonl` | 动态/评论 |
| `emotion.jsonl` | 情绪 |
| `memes.jsonl` | 表情元数据 |
| `memes/` | 原图与 `previews/` |
| `usage.jsonl` | 每次调用记账 + breakdown/cache/reasoning |
| `provider-balance.json` | 余额缓存 |
| `config.json` | AI 资料/策略/回复速度 |
| `secret.json` | Key/口令；绝不外发 |
| `backups/YYYY-MM-DD/` | 每日备份；不含 secret |

---

## 9. 记忆与 Prompt

### 9.1 记忆

- L1：最近 30 轮/60 条，同时 3000 token；最新用户+助手保底；从新到旧累加。
- L2：明确第一人称事实，保留来源。
- L3：每 20 轮摘要，带来源与校验。
- L4：关键词始终可用；Embedding 可选。
- **P4**：只有关键词无命中或明确回忆意图才调用 embedding；未配置/无记忆/预算不足都不调用。
- 空间评论不掷表情骰、不注入表情目录、不计入表情间隔/统计。

### 9.2 Prompt P0

稳定前缀顺序：

```text
PERSONA
→ profileBlock（不含签名）
→ 时间约束
→ <anam-meta> 格式
→ 正文禁 [表情]
→ 情绪/签名/动态指令
```

易变尾巴：

```text
memoryBlock
→ recentUserPostsBlock
→ meme catalog
→ signature（每轮可能变）
→ weather（可选）
→ date（星期/假日/节气）
→ 现在时间（最后）
```

**规则**：任何新增 prompt 内容必须声明 stable/volatile；volatile 只能放尾巴。  
`profileBlock` 里的签名已被移到 `signatureBlock()`，否则缓存会失效。  
天气/日期在 v44 加入，均属 volatile；现在时间必须最后。

### 9.3 时间/表情清理

- `sanitizeReply` 清理：
  - 带日期时间标签；
  - 裸 `[21:25]` / `[21:25:30]`；
  - 行首裸 `21:25`；
  - 独立 `[表情] X` 句子；
  - 不误伤行内普通文字。
- 历史消息里的旧标签是已存文本，不会追溯消失；看新回复。

---

## 10. 表情包系统

- 库：44 张；目录 30；等待 14；待审 0。
- 只启用审核通过的；目录上限 30（50 的扩容在 V2 收口批次）。
- 发送策略：
  - 概率默认 100%；
  - 最小间隔 2 条完整 AI 回复；
  - 软频率默认关；
  - 每条最多 1 张；
  - 概率门在 prompt 构建前；未通过不注入目录；
  - 空间不参与。
- 记录无 text；上下文/inbox 派生 `[表情] alt`。
- UI：预览优先→原图；加载骨架为空盒、固定尺寸、不跳位；失败显示 `[表情] 名字`。
- 手动发送/照片是 Phase 2B；v45 已通，AI caption 等仍待补。

---

## 10.1 v44 推送 / 天气 / 日期 / 速度

### Web Push

- VAPID：P-256；私钥 `secret.json.vapidPrivateKey`，公钥 `config.json.vapidPublicKey`。
- VAPID subject：`mailto:anam@example.com`。**不要用 `mailto:anam@localhost`**：Apple 会返回 403 `{"reason":"BadJwtToken"}`（v44-p1 实测根因）。
- 公私钥匹配：`pushStatusPayload.keyMatch`；不匹配时 `/api/push/test` 返回 409，需重新生成并重新订阅。
- 订阅：`app/data/push-subscriptions.jsonl`；按 endpoint 去重。
- 发送：`lib/push.mjs`，VAPID JWT + RFC8291 aes128gcm；只依赖 Node crypto/fetch；10 秒超时。
- `sendPushToAll` 返回每条订阅的 `status/error`，非 2xx 会记录 Apple 响应正文；测试接口不再静默。
- 默认关闭；订阅时开启；410/404 清订阅。
- 回复完成后推送；SW 前台可见时不弹。
- 推送订阅文件不进 Git；VAPID 私钥不进备份；iOS 需 16.4+ 主屏 PWA。
- 2026-11-06 真实测试：修复 subject 后 Apple 返回 **201**，`sent=1`；物理手机锁屏未由执行方直接确认。
- 电脑关机推不了，是架构取舍。

### 天气

- Open-Meteo；城市/经纬度存 `config.json`；缓存 `app/data/weather.json`。
- 启动/每小时刷新；失败保留旧缓存；无城市不注入。
- 终端「数据与存储」子页面配置；天气行在 prompt 尾巴、签名之后、日期之前。

### 日期

- `lib/calendar.mjs` 内置 2026–2027 主要假日 + 24 节气；零网络。
- 一行：星期 + 节日/节气 + 临近假日倒数。
- 与天气一起在现在时间之前；现在时间始终最后。

### 速度

- 三档存 `config.json.replySpeed`；接口不变。
- UI 已从终端 API 卡片移到 **AI 资料页**；终端主页仍只有 API + 消费两张卡。

---

## 11. 预算、费用、P3/P4

- 每日预算 **¥2**；`DAILY_BUDGET_YUAN` 覆盖。
- token 上限 200,000；价格 2 元/百万输入、8 元/百万输出。
- `maxTokens`：剩余预算换算，**下限 256、上限 500**。
- 额度用完允许用户显式「今天继续」。
- `usage.jsonl` 记录：
  - tokensIn/out、成本、模型；
  - `promptCacheHit` / `promptCacheMiss`；
  - `breakdown{stable,memory,posts,catalog,time,l1,total}`；
  - `reasoningTokens`。
- P2 页面：最近一轮构成 + 今日累计 + 缓存命中率。
- P3 实测：reasoning 58.7%，所以上限 500。
- P4：关键词命中跳过 embedding；无命中/回忆才调用。
- P5：目录只占 9.4%，**暂不瘦身**。

---

## 12. UI / 导航

### 12.1 主导航

底部四个 Tab：

- 对话（消息列表）
- AI 联系人
- 空间
- 控制台

聊天页、AI 资料页、本机资料页会隐藏 Tab。

### 12.2 聊天页

- 一条长对话；
- 顶部状态/正在输入/签名；
- 历史时间轴；
- 长按复制；
- 发送失败可重试（同一个 id）；
- 加载更多只在顶部出现；
- 一键到底：SVG chevron、输入框右上、flex 居中、不重叠；
- 用户拖动列表会收起键盘；程序性滚动不收起；
- 流式追加不抢用户历史；
- 未读：
  - `companion.read.v1` 存最后已读 seq；
  - 只计 assistant；
  - 非列表页 tab 显示；列表页会话行显示；
  - 打开会话写已读并清空；
  - 99+；
  - PWA 关闭无 SSE。

### 12.3 终端

- 首页：API（模型/host/key 掩码/速度/保存/测试）+ 本地用量（花费/token/预算/今天继续/费用拆解）。
- 目录：表情、记忆、备份、数据、运行状态、高级维护。
- hash 子页面：`#/terminal/memes` 等；
- 主页面无退出按钮，只靠底部 Tab；
- 子页面左上角复用 `consoleClose` 返回；
- 重内容延迟加载（网格/记忆图只在子页面）；目录只取计数；
- 无第五个主页面。

### 12.4 版本更新

- `/api/status` 返回产品/SW/schema；
- 页面通过 cache key 判断 SW 是否旧；
- 有更新且空闲时显示「新版本已准备好」；
- 输入有草稿或流式回复时绝不刷新；空闲才走 `reset.html`。

---

## 13. 备份、部署、恢复

- 启动 + 每小时检查；每日一次；保留 7 天。
- 备份 `app/data` 数据与 memes；**不备份 secret.json**。
- 恢复：停服务 → 复制备份回 `app/data` → 启动。
- 手机通过局域网或 Tailscale HTTPS 访问；PWA 需安全上下文才注册 SW。
- 电脑关机服务不可用，这是已接受架构取舍（F5/D9）。

---

## 14. 测试矩阵

在 `app` 目录运行：

```powershell
node smoke.mjs
node smoke-budget.mjs
node tools\dom-smoke.mjs
node tools\memory-test.mjs
node tools\v1-unit.mjs
node tools\v1-integration.mjs
node tools\meme-test.mjs
node tools\meme-chat-test.mjs
node tools\meme-strategy-test.mjs
node tools\prompt-cache-test.mjs
node tools\l1-context-test.mjs
node tools\status-test.mjs
node tools\usage-breakdown-test.mjs
node tools\reply-test.mjs
node tools\embedding-policy-test.mjs
node tools\push-test.mjs
node tools\push-api-test.mjs
node tools\weather-test.mjs
```

当前 v44 结果：

| 测试 | 结果 |
|---|---|
| reply | 23/23 |
| embedding-policy | 6/6 |
| status | 12/12 |
| dom-smoke | 66/66 |
| prompt-cache | 9/9 |
| l1-context | 7/7 |
| meme-chat | 20/20 |
| meme-strategy | 19/19 |
| usage-breakdown | 6/6 |
| meme-test | 31/31 |
| push | 6/6 |
| push-api | 7/7 |
| weather | 7/7 |
| v1-integration | 通过 |

真实模型测试会花钱：`live-*`；不要在未确认时运行。

---

## 15. 给下一个 AI 的硬性注意事项

1. **先读 `DECISIONS.md`**，不要按 `roadmap.md` 做。
2. **不要上传 `app/data`、`secret.json`、`backups`、`.runtime`**。
3. 不要引入 npm 依赖；保持零依赖。
4. 不要接 AstrBot/QQ，不要加第三方平台。
5. 不恢复 V5/V6；群组/多租户不做。
6. 2a 已结束；V2 收口批次（目录扩容、输入等待、2B）仍需明确启动，不要顺手做。
7. 改 prompt 必须区分 stable/volatile；保持 P0 缓存前缀。
8. 不要破坏 L1 3000 token 和最新一轮保底。
9. sticker 记录不写 `text`；不要反向恢复。
10. 空间回应不掷表情骰、不注入目录、不计统计。
11. 总开关只在 AI 资料页；终端只读。
12. 预算 ¥2、maxTokens 500、下限 256；不要随意放宽。
13. P4 不要恢复每轮 embedding；关键词优先。
14. 前端改动要升 SW VERSION；产品 patch 同步递增。
15. 输入有草稿/流式回复时不能强制刷新。
16. 修改 JSONL 要原子写/备份，不要手改真实数据。
17. 运行现有测试；前端使用 FakeEl 限制。
18. 真模型测试会消耗预算；优先临时数据目录。
19. 截图/聊天内容属于隐私，不上传 GitHub。
20. 提交前检查 `git diff` 只含预期文件。

---

## 16. 已知问题 / 技术债

- iPhone 键盘轻微卡顿；已接受。
- 底部收键盘时列表可能跳；v42 只记录修法，未改。
- PWA 关闭期间无实时 SSE/未读，只在打开时重算。
- 老历史消息里的 `[21:25]` 不会被追溯清理。
- 终端备份/数据页目前是只读概览；没有一键恢复/删除。
- 没有内置 TLS；手机正式使用依赖 Tailscale。
- `server.mjs` 较大，改动要定位函数，避免大范围重构。
- 当前真实 embedding 未配置；P4 逻辑只在配置后生效。
- v44 真机锁屏推送未由执行方直接确认；接口实测 Apple 201、sent=1。
- v45 2b 仅部分：照片 caption 由用户输入，AI 自动 caption、发送前预览撤销、列表缩略图、首字等待、删消息删文件、终端 caption 编辑、删除联动未做。
- v45 6 张新表情未导入：源候选均超 1.5MB 或配额不足；目录上限已 50，当前仍 44 张。
- v45 手动表情/照片目前不触发 AI 回复，只追加用户消息。
- v44 真实 VAPID 已生成（keyMatch=true）、1 个 Apple 订阅、pushEnabled=true；天气城市仍未配置。

---

## 17. Credit / 许可

### 17.1 代码

- 本仓库代码：**MIT License**，Copyright (c) 2026 **Ethan Tian**。
- 仓库为私有；公开前需再次检查隐私。

### 17.2 表情包

- 作者：**可以叫我云大人**
- B 站：<https://space.bilibili.com/103739>
- 发布：kiriyuki.com
- 元数据：<https://kiriyuki.com/meme/kit/nekowhale.json>（2026-10-23）
- 许可：**CC BY-NC 4.0**（署名—非商业性使用 4.0 国际）
- 仅个人非商业使用；只导入「大肥鱼」单人包的一部分；
- **大肥鱼和GPT娘双人包整包排除**；
- 导入 36 张（清单目标 42，6 个情绪因主选/替补超 1.5MB 跳过）；库共 44 张；
- 图片只在 `app/data/memes/`，**不对外分发**；备份仅本机恢复；
- 作者要求停止时，删除对应图片即可，应用不依赖图片运行；
- 详见 `CREDITS.md`。

### 17.3 参考插件

- `anka-afk/astrbot_plugin_meme_manager`（MIT）作为表情发送策略的设计参考；
- **不打包插件代码，不连接 AstrBot/QQ**；
- 本项目是原生重写，不是插件运行器。

### 17.4 模型与数据源

- DeepSeek API（`deepseek-flash`）；Key 只保存在本机服务端，不进仓库。
- 天气与地理编码：Open-Meteo（免费、无 Key）；只发送城市/坐标，不发送聊天内容。
- Web Push：浏览器 Push Service（Apple/Google/Mozilla）；只发送通知标题/正文。

---

## 18. README / GitHub 同步状态

- 本地 `README.md` 已改为「用户说明 + 当前状态 + V0–V4 路线图 + Credit」；
- 本地 `HANDOFF.md` 已加入「5 分钟速读 / 另一个 AI 协作规则 / 决策模板」；
- 已同步到私有 GitHub；本次只改文档，不改代码、SW、数据。

已上传：

1. `README.md` — 用户说明与路线图；
2. `HANDOFF.md` — 工程交接（私有仓库）；
3. `DECISIONS.md` — 只修正 D14 的 ¥2 和日期。

**不会上传：**

- `app/data/`；
- `secret.json`；
- 聊天截图/录屏；
- `backups/`；
- `.runtime/`；
- 任何真实 Tailscale 主机名或 IP。

### 18.1 以后怎么维护

- **每次发布**：README 当前版本 + 状态表；HANDOFF 对应章节；PROGRESS 追加。
- **每次决策**：先写 DECISIONS，再改代码/README。
- **只改文档**：不升 SW/产品版本。
- **新增阶段**：只新增明确行；不自动恢复 V5/V6。
- **另一个 AI**：查询/建议，不直接改；执行 AI 负责落地。
- **冲突**：以 DECISIONS 为准；README/HANDOFF 跟随修正。

---

## 19. 待 Tian 确认的问题

1. 这份只到 V4 的路线图是否确认？
2. Phase 2B 放在 2a 观察期结束后，还是更晚？
3. V4 是否包含可选“手”（文件/视觉操作电脑），还是只做多 AI？
4. 登录限流保持 20 次/10 分钟，还是更严格？
5. README 上传时，是否同时把 D14 的 ¥2 修正一起提交？






