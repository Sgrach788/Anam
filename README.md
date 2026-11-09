# Companion — 使用说明与路线图

> 只属于你的私密 AI 伴侣。单用户、非商业、本机运行。
>
> 当前阶段：**V2「表情包」进行中**  
> 当前版本：**0.2.49** · SW **v49** · schema **1**  
> 2a 观察期：**已结束**（2026-11-06）；表情扩容/输入等待/Phase 2B 仍按下一批安排

本文是 GitHub 上的**用户说明 + 状态总览**。  
完整工程交接、接口、数据结构和另一个 AI 的协作规则见 **[HANDOFF.md](HANDOFF.md)**；不可动摇的决策见 **[DECISIONS.md](DECISIONS.md)**；历史流水见 **[PROGRESS.md](PROGRESS.md)**。  
`roadmap.md` 是历史推演，含已作废内容，**不要照着做**。

---

## 1. 它是什么

一个由你的 Windows 电脑托管的私密 AI 伴侣：

- 手机 PWA 聊天；
- 一条永不换的长对话；
- 长期记忆（L1–L4）；
- 私有空间、情绪曲线、个性签名；
- 表情包库与 AI 语境选图；
- 终端控制台：模型、费用、记忆、表情、运行状态；
- 计划中的主动对话。

**不是：**

- 不是社交产品；
- 不是多用户/圈子/群组；
- 不连接 AstrBot 或 QQ；
- 不依赖第三方云平台；
- 没有 V5 / V6（旧的私密圈子/群落已删除）。

---

## 2. 当前状态

| 项 | 值 |
|---|---|
| 阶段 | V2「表情包」 |
| 产品版本 | **0.2.49** |
| SW 版本 | **companion-v49-2026-11-09** |
| 数据 schema | **1** |
| 聊天 | 单长对话；文字 + AI 表情 |
| 记忆 | L1 近 30 轮/3000 token；L2 事实；L3 摘要；L4 关键词 + 可选语义 |
| 空间 | 动态、评论、情绪、签名 |
| 表情库 | 44 张全部启用；目录 30、等待 14、待审 0 |
| 预算 | **¥2/天**；`DAILY_BUDGET_YUAN` 可覆盖 |
| 输出上限 | **500**（下限 256） |
| 回复速度 | 慢 / 正常 / 快；默认正常 |
| 未读 | 非列表页 tab 红点；列表页会话行红点 |
| 终端 | 目录 + hash 子页面；不新增主页面 |

### 2.1 已完成

- **V0 能聊**：PWA、JSONL、幂等、SSE 续传、预算、控制台、口令。
- **V1 有过去**：L1–L4、摘要、记忆管理、空间、情绪、签名。
- **V2 Phase 1**：表情库、审核、预览、备份、删除引用。
- **V2 Phase 2A**：AI 选图、独立 sticker、三态 UI、发送策略。
- **v37–v43**：
  - 正文 `[表情] X` 清理；
  - sticker 记录去 `text`；
  - 终端发送策略；
  - Prompt 缓存稳定前缀；
  - L1 3000 token 预算；
  - 产品/SW/schema 三版本与 `/api/status`；
  - 费用拆解与缓存命中率；
  - 加载更多/回到底部/未读/终端目录；
  - 拖动收键盘、裸时间戳清理；
  - 预算 ¥2、reasoning 上限 500、embedding 按需；
  - 回复速度三档、SVG V 按钮、徽章居中。
- **v44**：
  - Web Push（VAPID、订阅、锁屏通知、前台去重）；
  - 天气上下文（Open-Meteo，城市可选）；
  - 日期/节假日/节气上下文；
  - 表情软提示补发/情绪两句；
  - 推送/天气进终端子页面，速度移到 AI 资料页。
- **v44-p1**：
  - 修复 Apple `BadJwtToken`：VAPID subject 从 `mailto:anam@localhost` 改为 Apple 接受的 `mailto:anam@example.com`；
  - 推送测试返回每条订阅的 status/error，服务端记录 Apple 状态码；
  - `sendPush` 加 10 秒超时；toast 3 秒。
- **v45（2b 进行中）**：
  - 聊天输入栏手动选表情并发送；存在即可发，不看 AI 启用状态；
  - 照片上传（JPG/PNG/WebP，客户端 JPEG 长边 2048），`image` 消息、`photo:` 引用；照片不带 caption 行；
  - L1 图片占位 `[图片：caption]` / `[图片]`；照片进备份，终端显示张数/MB；
  - 表情软提示增加三种输出教学示例；
  - 目录上限 30→50。
- **v46**：
  - 推送标题跟 AI 资料名，空则回退 Anam；
  - 用户发表情/照片后触发一次生成，她对着 label/tags 或 caption 回一句；
  - 输入框两个图标换成 Lucide `sticker` / `image` 内联 SVG。
- **v47（收尾中）**：
  - 清理 `<p class="empty"></p>` 空占位：服务端清洗 + 前端不渲染空文本；历史唯一坏记录已移除；
  - 软频率改为“每约 2–3 条 1 张”，追赶句改为连续 2 条；
  - 6 张扩库已导入并审核，目录 50/50；
  - 照片发送前预览/取消；图片消息可删除并同步删除 `photos/` 文件；
  - deepseek-flash 视觉 caption 后台生成（`captionBy=ai`，只进 L1/终端，不显示在气泡）；弹框“附带消息”独立成文字消息；双 clientId 去重；回话请求带图片 base64；
  - 照片乐观气泡：点发送立刻显示照片/文字，服务端返回后升级为正式消息；失败可点气泡重试。
- **v48**：
  - 软提示增加连续 4 条强制配图；终端标签改为 2–3 条；
  - 照片 512 缩略图：新图客户端生成，旧图批量补齐/懒生成，鉴权取图；
  - AI 预标注草稿 `ai_label/ai_tags/ai_labeled_at`，单张 + 批量，仅草稿不自动过审。
- **v49**：
  - 稳定前缀禁止 HTML；服务端流式剥标签 + 前端纵深清洗；
  - 服务端按 replyTo 组计连续未配图轮数，streak≥2 注入提示，≥4 强制。

### 2.2 进行中 / 冻结

- **2a 观察期**：已结束（2026-11-06）。
- **Phase 2B**：手动表情/照片/触发回复已通；AI 自动 caption、发送前预览撤销、缩略图、首字等待、删除联动、终端 caption 编辑仍未完成。
- **目录 30→50**：上限 50；6 张新图已导入并审核，目录 50/50。
- **新增 6 张表情**：已导入并由 Tian 审核 6 张（含「催眠2」替代「花花」）；目录 **50/50**。
- **输入等待**：下一批。

### 2.3 明确不做

- V5 / V6；
- 圈子 / 邀请码 / 多租户；
- 群组对话；
- 云托管；
- AstrBot / QQ 接入。

---

## 3. 快速开始

**唯一入口：双击 `app\start.cmd`。**

- 有 `app\data\secret.json` 的 key：真模型；没有：自动 mock（不花钱）。
- 启动窗口会打印电脑和手机地址。
- 电脑：`http://127.0.0.1:8787`
- 手机：`http://<电脑局域网 IP>:8787`
- 强制 mock：`powershell -ExecutionPolicy Bypass -File D:\Companion\run.ps1 -Mock`
- 换端口 / 只绑本机：`run.ps1 -Port 9000`、`run.ps1 -Bind 127.0.0.1`
- 关闭窗口 = 停止服务；重启后历史还在。
- 第一次在每台设备打开要输访问口令；之后存浏览器 localStorage。
- 口令在 `app\data\secret.json` 的 `accessPassword`；修改后要重新输入或清站点数据。

### 3.1 手机 HTTPS（推荐）

- 手机主屏用 Tailscale HTTPS 地址：`https://<your-tailnet-host>`
- 电脑：`tailscale serve --bg 8787`
- 手机先连同一 Tailscale 账号。
- 地址只对同一 tailnet 可见；换机器名/账号后地址会变。
- 局域网 HTTP 也能用，但 Service Worker 不会注册。

### 3.2 Node

`run.ps1` 按顺序找：

1. 系统 PATH 的 `node`；
2. 项目 `.runtime/node-*/node.exe`；
3. DSH 自带 Node。

不装 Node 也能跑。

---

## 4. 功能说明

### 4.1 聊天

- 一条长对话；分条回复；断线续传。
- 发送失败可点重试；同一个 id 不会重复。
- 时间轴按今天/昨天/日期分隔。
- 长按复制。
- 粘贴/输入时不抢滚动。
- 顶部状态：「在线」「正在输入…」「API 已配置」等。

### 4.2 加载更多与回到底部

- 「加载更早」只在列表顶部出现。
- 点开更早消息保持当前阅读位置。
- 离开底部超过一屏出现 V 按钮；点击平滑回到底部。
- V 按钮在输入框右上，不重叠。

### 4.3 未读

- 只计 AI 的 assistant 消息。
- 不在消息列表时有红点；99+。
- 消息列表里由会话行显示同一数字。
- 打开会话写已读并清空。
- 未读只存本机，不同步服务端。
- PWA 关闭期间没有实时 SSE；重开后按已读标记重算。

### 4.4 记忆

- L1：最近 30 轮、3000 token；最新一轮保底。
- L2：用户明确陈述的事实，带来源。
- L3：每 20 轮摘要，带来源校验。
- L4：本地关键词始终可用；Embedding 可选。
- **P4**：只有关键词无命中或明确回忆时才调用 Embedding；日常不每轮付费。
- 控制台可查看/搜索/修订/删除记忆。

### 4.5 空间

- 你发动态，她可评论（每帖最多一条，受预算）。
- 最近两条动态进入聊天上下文。
- AI 情绪曲线和签名。
- 空间回应不参与表情掷骰、不注入表情目录、不计入表情间隔/统计。

### 4.6 表情包

- 当前 44 张，全部启用；目录 30、等待 14。
- 终端可上传、审核、启用、置顶、删除确认。
- 发送策略（终端）：
  - 概率 0–100%，默认 100%；
  - 两次表情至少隔 0–5 条完整 AI 回复，默认 2；
  - 软频率提示，默认关；
  - 每条最多 1 张。
- 总开关只在 AI 资料页；终端只读显示。
- 图片只经带口令的接口读取。
- 加载：预览 → 原图；失败显示 `[表情] 名字`；骨架空盒同尺寸，不跳位。

### 4.7 终端

- 首页：API + 本地用量。
- 目录：表情包、记忆、备份、数据、运行状态、高级维护。
- 子页面用 hash，如 `#/terminal/memes`；左上角返回。
- 首页无退出按钮，切换用底部 tab。
- 重内容只在子页面加载。

### 4.8 费用

- 每日预算 **¥2**；环境变量可覆盖。
- 费用卡：今日花费、token、调用数、上限、“今天继续”。
- 最近一轮费用拆解：稳定前缀 / 记忆 / 动态 / 表情目录 / 时间/签名 / L1。
- 今日缓存命中率。
- 余额是 API 提供方账户余额，不等同于本地用量。

### 4.9 回复速度

回复速度在 **AI 资料页**（不再放在终端 API 卡片）：

- 慢 1.5×；
- 正常 1×（默认）；
- 快 0.6×。

只改变句间停顿，不改内容、切句或“正在输入”提示。

### 4.10 推送通知

- 默认关闭；需在终端「运行状态」子页面生成 VAPID 密钥，再点「开启推送」。
- iOS 需 16.4+，并从 Safari“添加到主屏幕”安装；必须由你点按授权。
- 她回复完成时推送；前台可见时 SW 不重复弹。
- 点通知会聚焦/打开聊天页。
- 测试推送会返回每条订阅的真实 HTTP 状态；失败原因直接显示。
- Apple 曾因 VAPID subject 为 `mailto:anam@localhost` 返回 `BadJwtToken`；v44-p1 已改用可接受的 `mailto:anam@example.com`。
- 电脑关机推不了——这是架构取舍，不是 bug。

### 4.11 天气与日期

- 天气：终端「数据与存储」子页面填写城市；只到城市级，Open-Meteo 免费无 Key。
- 留空不注入；取失败保留旧缓存，仍不阻塞聊天。
- 日期：星期 + 节假日/节气 + 临近假日倒数。
- 两行都在 prompt 易变尾巴，天气/日期在签名之后、现在时间之前；现在时间始终最后。
- 约 40 token/轮。

### 4.12 版本更新

- 运行状态显示产品/SW/schema。
- 页面 SW 与服务端不一致时显示“新版本已准备好”。
- 输入框有草稿或流式回复时，点更新也不会刷新；空闲时才走 `reset.html`。

---

## 5. 数据、隐私与安全

### 5.1 数据在哪

| 路径 | 内容 |
|---|---|
| `app\data\messages.jsonl` | 消息 |
| `app\data\usage.jsonl` | 调用/费用/缓存/拆解 |
| `app\data\facts.jsonl` | L2 事实 |
| `app\data\summaries.jsonl` | L3 摘要 |
| `app\data\memory-*.jsonl` | 记忆覆盖/向量 |
| `app\data\space.jsonl` | 动态/评论 |
| `app\data\emotion.jsonl` | 情绪 |
| `app\data\memes.jsonl` + `memes\` | 表情元数据/原图/预览 |
| `app\data\config.json` | AI 资料、策略、速度 |
| `app\data\secret.json` | API key + 访问口令（**绝不外发**） |
| `backups\YYYY-MM-DD\` | 每日备份（不含 secret） |

全部 UTF-8、无 BOM、可读文本。

### 5.2 安全

- 页面/图标公开；所有 `/api/*` 校验口令。
- 连续失败 20 次锁 10 分钟。
- 局域网 HTTP 明文只防误连/蹭网，不是加密；正式使用走 Tailscale HTTPS。
- `secret.json` 不备份、不提交、不进截图。
- 手机和电脑要在同一 WiFi/Tailscale。

### 5.3 不上传 GitHub

- `app/data/`；
- `secret.json`；
- 聊天截图/录屏；
- `backups/`；
- `.runtime/`；
- 真实 Tailscale 主机名或 IP。

---

## 6. 备份与恢复

- 服务启动 + 每小时检查；每天一次；保留 7 天。
- 备份消息、费用、事实、摘要、记忆覆盖、向量、空间、情绪、表情 JSONL 和 `memes\`。
- **不备份 secret.json。**
- 恢复：
  1. 关服务；
  2. 把备份 JSONL 与 `memes\` 复制回 `app\data\`；
  3. 启动。
- 换机器：复制整个 `D:\Companion`（可不带 `.runtime`/`backups`），单独拷 `secret.json`。

---

## 7. 常见问题

| 现象 | 处理 |
|---|---|
| 手机打不开 | 服务窗口是否开着；同一 WiFi/Tailscale；IP 是否变了 |
| 能开但发不出 | 刷新；看红字错误 |
| 回复是模拟 | 当前 mock；控制台保存 key |
| 401 / 口令错 | 重新输；或清站点数据 |
| 额度用完 | 「今天继续」；或控制台恢复今日限额 |
| 端口占用 | 关旧窗口 |
| 电脑睡眠 | 唤醒后恢复 |
| 手机界面旧 | 关 PWA 两次，或 `reset.html` |
| 备份空 | 当天还没到备份点，或数据目录非默认 |

---

## 8. 路线图（只到 V4）

### 8.1 总览

| 阶段 | 主题 | 状态 |
|---|---|---|
| **V0** | 能聊 | ✅ 已完成 |
| **V1** | 有过去 | ✅ 已完成 |
| **V2** | 表情包 | 🟡 进行中 |
| **V3** | 会想你 | ⬜ 未开始 |
| **V4** | 多 AI 收口 | ⬜ 未开始 |

V4 之后不自动进入 V5/V6；只做维护和按需讨论。

### 8.2 V2 收口

- Phase 2B：手动表情/照片 + caption，待批准；
- 2a 观察期已结束；V2 收口批次另行安排；
- 目录 30→50 + 6 张表情；
- 输入等待（4 秒静默、30 秒封顶）。

### 8.3 V3 会想你

1. 生活提醒；
2. 动态回复等待；
3. 主动对话：思念值、打扰预算、空间→私聊→通知、安静时段、触发记录。

### 8.4 V4 多 AI

- 多 AI 身份；
- 多 API / 多模型；
- 职责分工；
- 可选“手”：文件/视觉操作电脑；
- 不做群组/圈子/多租户；
- 不破坏单人长对话。

### 8.5 暂不做 / 未排期

- 密钥轮换（运营项，V3 前建议做）；
- 底部收键盘跳动（技术债）；
- P5 目录瘦身（目录仅约 9.4%，暂不执行）；
- 更严格登录限流（现有 20 次/10 分钟）；
- 原生 App（需要 macOS，V2 后按需）；
- 语音输入（未排期）；
- V5 / V6（已删除）。

---

## 9. 版本规则

```text
产品版本：0.MINOR.PATCH
  0 = 未公开发布
  MINOR = 阶段（V2 => 2）
  PATCH = 本阶段第 N 次改版
当前：0.2.49

SW 版本：companion-v49-2026-11-09
数据 schema：1
```

- `v49` = 第 49 次发布，**不是 V4.9**。
- 改前端要升 SW；每版升 patch。
- 三者分开显示，不互相冒充。
- 只改文档时不升 SW、不改版本号。

---

## 10. 测试

在 `D:\Companion\app` 下：

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

真实模型测试会花钱：`tools\live-*.mjs`，运行前确认。

当前 v49 结果：

| 测试 | 结果 |
|---|---|
| reply | 30/30 |
| embedding-policy | 6/6 |
| status | 12/12 |
| dom-smoke | 66/66 |
| prompt-cache | 10/10 |
| l1-context | 7/7 |
| meme-chat | 20/20 |
| meme-strategy | 27/27 |
| usage-breakdown | 6/6 |
| meme-test | 31/31 |
| push | 6/6 |
| push-api | 7/7 |
| weather | 7/7 |
| v1-integration | 通过 |

---

## 11. 给另一个 AI / 开发者

- 完整工程交接：**[HANDOFF.md](HANDOFF.md)**
- 决策权威：**[DECISIONS.md](DECISIONS.md)**
- 历史流水：**[PROGRESS.md](PROGRESS.md)**
- 协作方式：
  - 另一个 AI 负责查询、分析、给决策建议；
  - 执行 AI 负责代码/文档修改；
  - Tian 做最终决定；
  - 任何决策先写入 `DECISIONS.md`，再改代码/README。
- 不要直接改 `app/data/`，不要上传 secret/截图。

---

## 12. Credit / 许可

### 代码

- **MIT License**
- Copyright (c) 2026 **Ethan Tian**

### 表情包

- 作者：**可以叫我云大人**
- B 站：<https://space.bilibili.com/103739>
- 发布：kiriyuki.com
- 元数据：<https://kiriyuki.com/meme/kit/nekowhale.json>（2026-10-23）
- 许可：**CC BY-NC 4.0**
- 仅个人非商业使用；只导入「大肥鱼」单人包部分；双人包排除。
- 导入 36 张，库共 44 张；图片只在本机，不对外分发。
- 详见 **[CREDITS.md](CREDITS.md)**。

### 参考

- `anka-afk/astrbot_plugin_meme_manager`（MIT）作为表情发送策略的设计参考；
- 不打包插件代码，不连接 AstrBot/QQ。

### 模型与数据源

- DeepSeek API；Key 只保存在本机服务端，不进仓库。
- 天气/地理编码：Open-Meteo（免费、无 Key）；只发送城市/坐标，不发送聊天内容。



















