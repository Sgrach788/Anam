# PROGRESS

> 每天的问题汇总与执行记录。每轮追加一条，格式：做了什么 / 改了哪些文件 / 怎么验证的。

## 第一轮 — 2026-10-30：修"看不见昨天" + 日期被动可用

### 做了什么

- **先诊断**：加 `DEBUG_PROMPT=1` 打印实际发给模型的 `messages`，用 3 轮真模型对话观察。
  - 结果：历史**一直在**（count 2 → 4 → 6 递增），不是"只有 system + 当前 user"。
  - 真正原因：历史消息**没有时间**、system prompt **没有日期**，模型无法判断"昨天"。
- **修复 1（第 1 条）**：
  - 历史每条前面加相对时间标签：`[今天 22:13]` / `[昨天 22:13]` / `[10月27日 22:13]` / `[2025年12月31日 22:13]`。
  - system prompt 给出"现在是 2026年10月30日 星期五 12:50（本地时间）"。
- **修复 2（第 2 条）**：system prompt 明确"时间只在被问或需要判断昨天/上次/多久以前时使用，不要主动提日期、不要报时"；并说明历史里的时间标签只用于理解跨度、不要照抄。

### 改了哪些文件

- `app\server.mjs`
  - 新增 `WEEKDAYS`、`pad2`、`formatNowLabel()`、`relativeTimeLabel()`、`buildSystemPrompt()`
  - `buildContextMessages()` 给每条消息加 `[时间]` 前缀
  - `streamModel()` 改用 `buildSystemPrompt()` + `buildContextMessages(nowDate)`
  - 新增 `DEBUG_PROMPT` 环境变量（默认关闭，仅排障）

### 怎么验证的

真模型 `deepseek-flash` + 种子数据（昨天 22:13 拔智齿、今天 10:00 说好多了）：

| 问 | 答 | 结果 |
|---|---|---|
| 我昨天说过什么？ | 你昨天说你去了诊所拔智齿，麻药过了之后有点疼 | ✅ 命中 |
| 今天几号？星期几？ | 今天是10月30号，星期五 | ✅ 准确 |
| 陪我聊两句吧 | （聊拔牙后饮食）未出现日期/星期/年份 | ✅ 没有主动提 |

- prompt dump 确认 system 含日期、history 带 `[昨天 22:13]` 标签。
- mock 回归 `smoke.mjs`：**39/39 通过**（未回归）。
- 临时数据目录已删除，未污染 `app\data`。

---

## 第二轮 — 2026-10-30：结构整理 + 去 AI 感

### 做了什么

- **前端拆分（第 3 条）**：`index.html` 只留结构，拆出 `style.css`、`api.js`（口令/REST/SSE）、`ui.js`（渲染/交互），ES modules，无框架。为 V1 预留底部 Tab（对话 / 空间·V1 禁用）和 `#sidebar` 容器。
- **按句分条（第 4 条）**：服务端在流式接收时切句——句末标点（`。！？!?…` 和换行，含紧跟的引号/括号）为一条；单条超 60 字按逗号类标点切；每条**单独落盘**，`replyTo` 指向同一条用户消息，`seq` 递增；SSE 事件改为 `user / start / message×N / done`；重放与幂等支持一次请求 N 条；条间延迟 300–900ms（按上一条字数）。
- **去思考态（第 5 条）**：删除逐字光标和三点跳动动画；点击发送 500ms 后顶栏显示「正在输入…」，消息区等待期间无任何占位元素。
- **界面六条（第 6 条）**：visualViewport 键盘适配；rAF 合并滚动、接近底部才自动滚；今天/昨天/更早分隔线；长按复制（HTTP 下用 `execCommand` 兜底）；发送失败可点击重试（同一个 id）；浅色模式跟随系统。排版 17px/1.6、触控目标 ≥44px、气泡最大 78%。

### 改了哪些文件

- `app\server.mjs`：新增 `findSentenceCut` / `findCommaCut` / `partDelay`；`streamReply` 重写为分片落盘 + `message` 帧；`findReplies` / `replayReply` 支持 N 条；`done` 改为 `{ ids, count }`
- `app\public\index.html`：只留结构 + 四个文件引用 + V1 Tab/侧边栏
- `app\public\style.css`（新）：主题变量、浅色模式、排版
- `app\public\api.js`（新）：口令、REST、SSE 解析
- `app\public\ui.js`（新）：渲染、日期分隔、长按、重试、键盘、rAF、状态行
- `app\smoke.mjs`：改为按 `message` 帧断言，覆盖 N 条幂等/续传
- `app\tools\dom-smoke.mjs`（新）：最小 DOM 垫片，在 Node 里加载真实前端模块

### 怎么验证的

| 项 | 结果 |
|---|---|
| 服务端回归 `smoke.mjs` | **43/43 通过** |
| 前端 DOM 冒烟 `dom-smoke.mjs` | **16/16 通过**（历史渲染、日期分隔、发送收到 2 条、断网→重试→成功、500ms 状态） |
| 真模型首句 | **816ms** 到达且为整句（3 条：14–16 字） |
| 条间延迟 | 568ms / 455ms，均在 300–900ms |
| 静态资源 | `style.css` / `api.js` / `ui.js` / manifest MIME 正确 |
| 浏览器 | Edge/Chrome 无头在沙箱里起不来（`OpenProcess: 拒绝访问`），改用 DOM 垫片做等价验证；真机 UI 待你刷新确认 |
| 数据 | 全部用临时目录，`app\data` 未被污染 |

---

## 第二轮返工 — 2026-10-30：键盘（A）+ 时间轴（B）+ 五条手感（C3）

### 做了什么

- **A 键盘**：按"页面固定、只改高度"重写布局——
  - `html, body { position: fixed; inset: 0; overflow: hidden }`；`#app { position: fixed; top: 0; height: var(--app-h) }`
  - 只用 `visualViewport.height` 更新 `--app-h`，**完全不读 `offsetTop`**
  - 删除所有 `translateY`、`scrollIntoView`、`window.scrollTo`（toast 动画也去掉了位移）
  - 键盘收起靠 `vv.resize` 自动恢复，没有手写复位
- **B1**：气泡不再渲染任何时间（本来就没有，这次确认并加断言）。
- **B2**：居中时间轴分隔符——
  - 跨天 → 「今天」/「昨天」/「10月28日」
  - 同一天、距上一条 > 5 分钟 → 「14:32」
  - 同一天、≤ 5 分钟 → 不显示
  - 12px、灰色、居中，不占气泡宽度
- **C3**：rAF 合并滚动（近底部才滚）、长按复制、失败重试（同 id）、浅色跟随系统、17px/1.6/44px/78% —— 本轮全部重新验证。

### 改了哪些文件

- `app\public\style.css`：固定布局、`#app` 固定、`.sep` 样式、toast 去位移
- `app\public\ui.js`：`maybeSeparator()`（跨天/5 分钟规则）、`lastAt` 轨迹、`fitViewport` 只用 `vv.height`
- `app\tools\dom-smoke.mjs`：改为**自己起 mock 服务 + 造时间夹具**，新增分隔符/长按复制断言

### 怎么验证的

| 项 | 结果 |
|---|---|
| 前端回归 `dom-smoke.mjs` | **17/17**：跨天「昨天/今天」、1 分钟内不显示、9 分钟显示「10:09」、气泡无时间、长按复制提示、发送分条、失败重试 |
| 服务端回归 `smoke.mjs` | **43/43** |
| A 的硬性约束 | 全文无 `translateY`/`scrollIntoView`/`window.scrollTo`/`offsetTop`；`html,body` 与 `#app` 均为 fixed |
| 真机键盘 | 沙箱里没有 iOS 设备，**需要你在手机上连开五次键盘确认**（贴边、无空隙、收起回底、不漂移） |

### 备注

- 真机验证点：输入框下沿是否贴键盘上沿；收起后列表是否落回底部；连开五次是否漂移。若仍有问题，把机型 + iOS 版本告诉我。

---

## 第二轮返工 2 — 2026-10-30：键盘顶到上方 / 时间戳泄漏 / 复制失败 / 启动合并

### 做了什么

- **键盘（A1 重做）**：真机反馈"输入框被顶到屏幕上方"。原因是 iOS 弹键盘时 `visualViewport.offsetTop` 变正、视觉视口下移，而固定在布局视口里的 `#app` 没跟着走。改为：
  - `#app { top: var(--app-top, 0) }`，`--app-top` 直接取 `vv.offsetTop`；
  - 页面本身已 `fixed` 且不可滚，所以这里加 top 不会造成"双重位移"（上次忽略 offsetTop 的指令是错的）；
  - `resize`/`scroll` 事件用 rAF 合并，键盘动画期间不再跳好几次；
  - 删掉 `focus` 后 200ms 的二次滚动。
- **时间戳泄漏（B）**：模型会把历史开头的 `[今天 19:12]` 抄进正文。
  - system prompt 增加硬性禁止；
  - 服务端 `sanitizeReply()` 过滤 `[今天 19:12]` / `今天 19:12：` 这类标签，并把切句/停顿/清洗抽到 `app\lib\reply.mjs` 便于单测。
- **复制（C3b 重做）**：iOS 在 HTTP 下没有 `navigator.clipboard`，且 `execCommand` 必须发生在手势里，原来"长按 500ms 后复制"必然失败。改为：长按 → 气泡高亮 + 浮出「复制」按钮 → 点按钮时同步复制。
- **启动合并**：只保留 `app\start.cmd`；`run.ps1` 自动判断（有 key 走真模型，无 key 自动 mock），绑定 `0.0.0.0`，同时打印电脑/手机地址。删除 `start-live.cmd`、`start-phone.cmd`、`start-phone-live.cmd`；开机自启快捷方式行为不变。

### 改了哪些文件

- `app\public\style.css`：`#app` 的 `top: var(--app-top)`、复制按钮样式
- `app\public\ui.js`：`applyViewport()` 用 `vv.height + vv.offsetTop`、rAF 合并、删除 focus 二次滚动；长按改为浮出复制按钮、`copyTextSync`
- `app\public\index.html`：新增 `#copybar` / `#copyBtn`
- `app\server.mjs`：改用 `lib/reply.mjs`；system prompt 增加"禁止时间标签"
- `app\lib\reply.mjs`（新）：切句、停顿、时间标签清洗
- `app\tools\reply-test.mjs`（新）：纯函数测试
- `app\tools\dom-smoke.mjs`：复制流程改为"长按 → 点按钮"
- `run.ps1`：自动模式（key → live / 无 key → mock）
- `app\start.cmd`：唯一入口，调用 run.ps1
- `README.md`：启动方式改为单入口

### 怎么验证的

| 项 | 结果 |
|---|---|
| 纯函数测试 `reply-test.mjs` | **13/13**（标签清洗、句号/引号/感叹号/换行切分、60 字逗号切、停顿区间） |
| 前端回归 `dom-smoke.mjs` | **20/20**（含长按浮出按钮、点击复制、分隔符、重试） |
| 服务端回归 `smoke.mjs` | **43/43** |
| 启动器 | `start.cmd` → `mode=LIVE`；`run.ps1 -Mock` → `mode=MOCK`，均绑 0.0.0.0 |
| 静态检查 | 使用 `vv.offsetTop`、设置 `--app-top`、rAF 合并、无 focus 二次滚动、只剩一个 `start.cmd` |
| 真机键盘 | 仍需你在手机上确认（沙箱没有 iOS） |

### 备注

- 你现在那个黑窗口跑的是旧代码：**先关掉它，再双击 `app\start.cmd`**，否则端口会被占用、时间戳过滤也不会生效。

---

## 第二轮返工 3 — 2026-10-31：切换栏不随键盘上升 + 胶囊造型

### 做了什么

- **切换栏不随键盘上升**：把 `#tabs` 从 `#app` 里移出去，固定在布局视口底部；`#app` 用 `padding-bottom: calc(env(safe-area-inset-bottom) + 74px)` 给胶囊留位置，键盘弹起时 `body.kb` 把这块留白清零。这样键盘只压缩对话区，切换栏留在原位被键盘盖住，没有隐藏动画、没有延迟。
- **造型**：底部切换栏改为"黑色大胶囊 + 淡灰小胶囊"——外层 `#0f1115`、1px `#2a2f38` 边、999px 圆角、`width: max-content` 收紧居中；当前选中项（对话）是 `#e6e8eb` 的淡灰小胶囊 + 深色文字；未选中/禁用的"空间 V1"是深灰字。没有毛玻璃、半透明或折射，只改形状。
- 夜间模式为主，颜色只用黑/淡灰，不新增色板。

### 改了哪些文件

- `app\public\index.html`：`#tabs` 移出 `#app`（在 `#app` 闭合之后）
- `app\public\style.css`：`#app` 底部留白 + `body.kb` 清零 + `body.kb form` 收掉安全区；`#tabs` 改为固定居中胶囊；`.tab` / `.tab.active` 胶囊样式
- `app\public\ui.js`：`applyViewport()` 增加键盘判定，切换 `body.kb`

### 怎么验证的

| 项 | 结果 |
|---|---|
| 前端回归 `dom-smoke.mjs` | **20/20** |
| 纯函数 `reply-test.mjs` | **13/13** |
| 服务端回归 `smoke.mjs` | **43/43** |
| 静态检查 | `#tabs` 在 `#app` 之外且 `position: fixed`；外层黑/内层淡灰；`body.kb` 清零留白；无隐藏动画 |
| 真机 | 需你确认：键盘弹起时切换栏被盖住不上升、输入框贴键盘上沿、收起后胶囊回到原位 |

### 真机返工（截图反馈）

真机截图显示：键盘弹起时胶囊被顶到键盘上方、压在输入框上；键盘收起时输入框与胶囊之间空隙过大。

- **原因**：iOS 26 里 `position: fixed` 元素会跟随**视觉视口**，`bottom: 10px` 的胶囊因此停在了键盘上沿，而不是布局视口底部。"留在底部被键盘盖住"在 fixed 上做不到。
- **修法**：键盘弹起时直接 `display: none` 隐藏胶囊（无动画、无延迟，视觉上等同被盖住）；键盘判定同时看 `visualViewport.height` 和布局视口高度，兼容两种系统行为。
- **空隙**：输入框原来叠了两次安全区 padding（`form` 自己有 `safe+10`，`#app` 又留 `safe+74`）。改成 `form` 只用 10px、`#app` 留 `safe+70px`，输入框到胶囊的间距从约 54px 降到约 16px。

**改了**：`style.css`（form padding、#app 70px、`body.kb #tabs { display:none }`）、`ui.js`（键盘判定基准 `layoutBase`）。

**验证**：前端回归 **20/20**；`ui.js` 语法检查通过。真机待确认。

---

## 第三轮 — 2026-10-31：D1 schema 留口 + D2 人格面板

### 做了什么

**D1（先做结构）**

- message 增加 `type`（text/image/sticker/system）与 `media`（`{ref,w,h,alt}` 或 `null`）；V0 只产生 `text`。
- 一次性迁移：旧数据自动补 `type="text"`、`media=null`，原文件备份为 `messages.jsonl.pre-type.bak`，原子写回。
- 修了一个潜伏 bug：`normalize()` 以前会丢掉 `replyTo` / `mode`，导致重启后幂等回放失效；现在保留。
- `app\data\config.json` 增加 `profile` 段：`{ name, avatar, tone, initiative, boundaries, persona }`（`persona` 对应"整体人设"，D1 没列但 D2 要求）。
- schema 版本仍是 `v:1`（纯新增字段，旧读取器可忽略）。

**D2（再填内容）**

- 头部加设置按钮，打开侧边栏"人格"面板：称呼 / 语气 / 主动性 / 边界 / 整体人设，五个纯文本字段。
- 保存写入 `config.json`，下一次请求即注入 system prompt（不用重启）。
- "试说三句"：用当前草稿调用 `POST /api/profile/preview`，返回 3 条示例，**不保存**；mock 模式返回占位三句。
- 没有扩成完整设置页。

### 改了哪些文件

- `app\server.mjs`：type/media 字段、迁移、`config.json` 读写、`profileBlock()` 注入、`/api/profile`（GET/POST）、`/api/profile/preview`
- `app\public\index.html`：头部设置按钮；侧边栏人格表单
- `app\public\style.css`：抽屉、字段、按钮、预览列表
- `app\public\ui.js`：打开/关闭侧边栏、读取/保存/试说三句
- `app\tools\profile-test.mjs`（新）：迁移 + profile + 预览 + 重启保留 replyTo
- `app\tools\dom-smoke.mjs`：新增侧边栏流程断言

### 怎么验证的

| 项 | 结果 |
|---|---|
| `profile-test.mjs` | **15/15**（旧数据迁移、type/media 默认值、replyTo/mode 保留、config 写入、预览 3 条、重启后 replyTo 仍在） |
| 真实数据副本迁移 | 202 条全部补字段，**replyTo 110 条全部保留**，seq 连续，备份生成 |
| 前端 `dom-smoke.mjs` | **26/26**（含打开侧边栏、保存语气、config 落盘、试说三句 3 条） |
| 服务端 `smoke.mjs` | **43/43** |
| 真模型人格验收 | 基线 38 字 → 设定"极简、≤12 字、不反问"后 **8 字**、无问号；试说三句返回 3 条短句 |

### 备注

- 真实 `app\data` 尚未迁移（测试都用副本）；**下次启动服务时会自动迁移**，并生成 `messages.jsonl.pre-type.bak`。
- 人格面板在手机上是抽屉式；称呼字段按"它怎么称呼你"实现，若你想改的是"它自己的名字"，告诉我调整。

### 第三轮补充 — 2026-10-31：头像 / 名称 / 对我的称呼

- `profile` 增加 `callUser`；`name` 语义改为**它自己的名字**（头部显示、写进 prompt："你的名字是…"）。
- `avatar` 存 data URL：客户端选图后缩到 128×128 JPEG（约 10–20KB），服务端只接受 `data:image/` 且 ≤400KB，否则丢弃。
- 头部显示自定义头像与名称；侧边栏新增"头像（选图/清除）""名称""对我的称呼"三项。
- 头像只存本地 `config.json`，**不注入 prompt**，也不进备份（备份本来就不含 config）。

**验证**

| 项 | 结果 |
|---|---|
| `profile-test.mjs` | **18/18**（name/callUser 持久化、合法头像保存、非法头像丢弃且不影响其他字段） |
| 前端 `dom-smoke.mjs` | **28/28**（保存后头部名称即时更新、称呼落盘） |
| 服务端 `smoke.mjs` | **43/43** |
| 真模型 | 设定"名字=小夜、称呼=阿哲"后，回复为"我叫小夜呀，阿哲……"，两项都生效 |

### 真机修复 — 2026-10-31：点齿轮只变暗、表单不可编辑

- **原因**：`#sidebar` 当时在 `#app` 内部，`#sideMask` 在 `#app` 外部。`#app` 是 `position: fixed`，会形成自己的层叠上下文；侧边栏的 `z-index: 40` 只在这个上下文里生效，而遮罩的 `z-index: 35` 位于根上下文，结果遮罩盖住了整个 `#app`（包括侧边栏）——所以只看到变暗、点不到表单。
- **修法**：把 `<aside id="sidebar">` 移出 `#app`，与 `#sideMask` 同级；现在 40 > 35，侧边栏在遮罩之上。
- **改了**：`app\public\index.html`（仅结构位置）。
- **验证**：DOM 顺序检查（sidebar 在 `#app` 之后、mask 之前）、中文内容完好；前端回归 **28/28**。

### 真机修复 — 2026-10-31：对话卡顿 + 不自动滚到底

- **卡顿**：头部 `backdrop-filter: blur(12px)` 在键盘动画时会触发整页重复模糊，这是最贵的一笔；已移除（头部本来就是不透明底色）。同时：
  - `applyViewport()` 只在数值真的变化时才写 CSS 变量 / 切 `body.kb`，不再每帧重复；
  - 键盘动画期间不再每帧读 `scrollHeight` 强制布局，改为键盘稳定 120ms 后滚一次。
- **不自动到底**：原来的判断是"追加后再看离底多远"，消息一长就超过阈值被判成"用户在读历史"，于是不滚。改成记住状态：
  - `stickToBottom` 只由用户自己的滚动改变（离底 <120px 视为贴底）；
  - 追加消息、键盘收起、发送，都按这个状态决定是否滚；
  - 滚动用连续两帧校正，覆盖输入框高度变化/键盘收缩晚一帧的情况。
- **改了**：`app\public\ui.js`（滚动状态机、viewport 去抖）、`app\public\style.css`（去掉 blur）。
- **验证**：`ui.js` 语法通过；前端回归 **28/28**；真机滚动/流畅度待确认。

### 真机修复 — 2026-10-31：键盘仍不够顺滑（继续减负）

- 原来每帧在 `:root` 上写 `--app-h` / `--app-top`：自定义属性会继承到整棵树，等于每次都让整份文档重算样式。改为**只给 `#app` 写内联 height/top**，样式失效范围收窄到对话区。
- 去掉 header 的 `position: sticky`（它在固定高度的 flex 列里没有滚动容器，纯属多余的计算）。
- 数值没变化时不写样式（保留原有的变化检测）。
- **改了**：`app\public\ui.js`、`app\public\style.css`。
- **验证**：语法通过、前端回归 **28/28**；真机待确认。
- 若仍卡：下一步会把输入框改成 `position: fixed; bottom: 0`，让 iOS 自己把它随键盘抬升（系统合成，不走 JS 逐帧改高度），代价是列表底部要一次性补 padding，属于较大改动。

### 真机体验 — 2026-10-31：人设长文本改为弹窗编辑

- 侧边栏里"语气 / 主动性 / 边界 / 整体人设"四个长文本字段改为只读，**点一下弹出中等大小的编辑框**：
  - 弹层靠上（避开键盘），宽度 `min(92vw, 440px)`，输入区高度 `min(30vh, 200px)`；
  - 「完成」写回字段，「取消 / ✕ / 点遮罩」不改；
  - 写回后仍需点「保存」才生效（避免误改）。
- 短字段（名称、对我的称呼）保持单行输入。
- **改了**：`app\public\index.html`、`style.css`、`ui.js`。
- **验证**：前端回归 **31/31**（新增"点语气弹框 → 完成写回 → 取消不改"三条断言）。刷新页面即可，无需重启。

### 真机体验 — 2026-10-31：人设改为"一个入口 + 分板块面板"

真机反馈"每个字段一个小框、长文本难改"，按要求重做：

- **侧边栏精简**：只留 头像 / 名称 / 对我的称呼 + 一个「个性 · 修改」入口；四个长文本字段从侧边栏移除。
- **点击进入"个性修改"面板**（不是一长条表单）：
  - 整体人设：整行，140px 高（优先级最高）
  - 语气 / 主动性：各占半行，110px 高
  - 边界：整行，96px 高
  - 面板宽 `min(94vw, 560px)`、最大高 88vh，可滚动；靠上摆放避开键盘。
- 面板内「保存」直接落库并关闭；「取消 / ✕ / 点遮罩」不改。侧边栏的「保存」仍负责头像/名称/称呼。
- **改了**：`index.html`（结构）、`style.css`（面板栅格）、`ui.js`（personaValues 状态 + 面板读写）。
- **验证**：`dom-smoke.mjs` **31/31**（打开面板 → 改语气/人设 → 面板保存落库；名称/称呼仍由侧边栏保存）。刷新页面即可。

### 真机体验 — 2026-10-31：面板再放大 + 按钮归位 + 深色滚动条

按新的真机反馈调整：

- **侧边栏只留一个入口**：头像 / 名称 / 对我的称呼 + 「修改个性 ›」，不再显示"语气 · 主动性 · 边界 · 人设"这类解释。
- **面板放大**：宽 `min(96vw, 620px)`、最大高 92vh；人设 180px、语气/主动性 130px、边界 110px。
- **试说三句 / 取消 / 保存 全部移进面板**；侧边栏不再有保存按钮。
  - 名称、对我的称呼：失焦（change）自动保存；头像选完/清除也自动保存。
  - 面板「保存」一次性落库并关闭；「取消 / ✕ / 点遮罩」丢弃面板内改动。
- **滚动条改黑灰**：`scrollbar-color` + `::-webkit-scrollbar*`，去掉白色轨道和上下箭头按钮。
- **改了**：`index.html`、`style.css`、`ui.js`。
- **验证**：`dom-smoke.mjs` **30/30**（面板保存、名称/称呼自动保存、面板内试说三句）。刷新页面即可。

### 真机体验 — 2026-10-31：面板改为"约 1/3 屏宽、居中"

- `#personaPanel` 从顶部对齐改为**水平垂直居中**；`.panel-box` 宽度 `clamp(360px, 33vw, 620px)`（桌面约 1/3 屏宽，窄屏保底 360px ≈ 92vw），最大高 80vh。
- 其余不变（板块布局、面板内试说/保存、滚动条黑灰）。
- **改**：`style.css`。
- **验证**：前端回归 **30/30**；真机待确认。若你指的是"高度占 1/3"，告诉我，我再改。

---

## 第四轮 E1 — 2026-10-31：Tailscale HTTPS

- **装机**：电脑 `astaria` + 手机 `iphone182`，登录同一 Tailscale 账号，两端在线（<your-tailscale-ip> / 100.123.9.77）。
- **开通 Serve**：Tailscale 默认关闭 Serve，用户在 `login.tailscale.com/f/serve?node=...` 点启用后生效。
- **配置**：`tailscale serve --bg 8787` → `https://<your-tailnet-host>` 代理到 `http://127.0.0.1:8787`，配置持久化。
- **验证**（提权执行，因为沙箱访问不到 tailnet 和 Tailscale 命名管道）：
  - 页面 `200`，`ssl_verify=0`（证书链校验通过）；
  - 无口令 `/api/health` → `401`；带口令 → `200`（mode=live，messages=311）；
  - `manifest.webmanifest` → `200 application/manifest+json`；
  - 期间发现 8787 未运行导致 502，已用 `start.cmd` 起服务（当前由本次会话的后台任务托管）。
- **待用户**：手机连 Tailscale → 打开 https 地址 → 删除旧 HTTP 图标 → 重新"添加到主屏幕"；确认无"不安全"提示。
- **注意**：沙箱内 Node 连不到 tailnet 地址（超时），验证一律用提权 curl；日常浏览器不受此限制。

## 第四轮 E2 — 2026-10-31：Service Worker + 缓存头 + 骨架屏

- **服务端**：
  - 静态文件加 `ETag`（sha1）与 `Cache-Control`：`index.html`/`sw.js` 用 `no-cache`，其它静态资源 `public, max-age=3600, must-revalidate`；命中 `If-None-Match` 返回 `304`。
  - 所有 `/api/*` 响应 `Cache-Control: no-store`。
- **Service Worker**（`app/public/sw.js`）：
  - 预缓存外壳（`/`、index、css、两个 js、manifest、图标）；
  - 同源静态走 cache-first + 后台更新；API 请求直接放行**不缓存**；断网时导航回退到缓存壳。
  - 版本常量 `VERSION`，前端改动需加一。
- **骨架屏**：`index.html` 的 `#list` 里先渲染 3 条灰条，历史消息回来后被替换。
- **注册与计时**：`ui.js` 在 load 后注册 SW，并把 `data-sw` / `data-rendered-at` 写到 `<html>`，便于无头浏览器校验。

### 验证

| 项 | 结果 |
|---|---|
| ETag / 304 | `GET /` 返回 ETag；带 `If-None-Match` 得到 `304` |
| Cache-Control | index/sw `no-cache`；css `public, max-age=3600, must-revalidate`；API `no-store` |
| SW 注册 | CDP 查询：`active: true`、`controller: controlled`、缓存 `companion-v2-2026-10-31` |
| 冷启动（Chrome headless，localhost） | 首次 **94ms**；SW 接管后 **39ms**（验收 <1.5s） |
| 离线 | 源站停掉后外壳仍由 SW 打开（`controller=controlled`）；API 连不上时显示"未连接"，符合预期 |
| 真实 HTTPS | `page=200`、`sw.js=200 text/javascript`、带口令 API `200` |

- **注意**：SW 只在 https/localhost 注册；HTTP 局域网地址不受影响。
- **改了**：`app/server.mjs`（ETag/缓存头/no-store）、`app/public/sw.js`（新）、`app/public/index.html`（骨架）、`style.css`（骨架样式）、`ui.js`（注册 + 计时）；README 增补缓存说明。

### 第四轮 E3 — 2026-10-31：拟人化打字节奏

真机反馈"回复太快、不像在打字"。调整服务端节奏（只影响发出时机，不影响落盘内容）：

- **首句**：从收到消息起至少等 `TYPING_FIRST_MS`（默认 **1800ms**）再发第一句；模型本身更慢就不再额外等。
- **句间**：`partDelay(len) = clamp(600 + 上一条字数 × 40, 600, 1800)` ms。
- **可调**：环境变量 `TYPING_FIRST_MS`；句间公式在 `app/lib/reply.mjs`。
- **真模型实测**（deepseek-flash，一句话回复拆 3 条）：
  - 首句 `+1843ms`，第二句 `+1133ms`（上一条 13 字），第三句 `+1494ms`（上一条 22 字），总计 `4.47s`。
- **改了**：`app/server.mjs`（首句最小等待）、`app/lib/reply.mjs`（partDelay）、`app/tools/reply-test.mjs`（期望值）、`app/tools/dom-smoke.mjs`（等待 4.2s）。
- **验证**：`reply-test` **13/13**、`dom-smoke` **30/30**；真实 HTTPS 服务已重启，`page/sw/health` 均 200。
- **教训**：用 PowerShell 按 ANSI 读写改 `dom-smoke.mjs` 把中文写坏了一次，已按当前逻辑整份重建并全量回归通过；以后改文本一律用编辑工具，不用 Shell 重写。

## V0 键盘布局返工 — 2026-11-02

- **问题**：iPhone 17 Pro Max / iOS 27.2 上弹出键盘后，输入栏跳到屏幕上方，下面留下大块空白。真机截图确认页面容器高度随 `visualViewport.height` 被错误压缩。
- **调整**：不再逐帧把整页高度设成视觉视口高度；输入栏改为固定定位，由 iOS 键盘视觉视口抬升，键盘态只切换 tabs 与底部间距。正常状态输入栏仍在底部胶囊上方，键盘态贴键盘上沿。
- **缓存**：Service Worker 版本升至 `companion-v6-2026-11-02`，让手机拉取新前端。
- **验证**：`ui.js` / `sw.js` 语法检查通过，`dom-smoke.mjs` **30/30**。当前环境没有 iPhone 真机，键盘贴边和收起复位仍需设备复测。

### 第二次调整

- **反馈**：v6 在 iPhone 17 Pro Max / iOS 27.2 上仍无可见变化。
- **调整**：将 `#composer` 从固定高度的 `#app` 内移到 body 顶层，避免输入栏继承聊天容器的布局定位；列表增加底部滚动余量；Service Worker 升至 v7。
- **验证**：`ui.js` / `sw.js` 语法检查通过，`dom-smoke.mjs` **30/30**，`reply-test.mjs` **13/13**。设备端键盘行为待复测。
- **回退结构**：真机反馈 v7 输入栏不可见。已将 composer 放回 `#app` 的 flex 布局并撤销顶层 fixed 定位；Service Worker 升至 v8。语法检查与 `dom-smoke.mjs` **30/30** 通过，真机可见性待确认。
- **恢复原始键盘方案**：按用户要求恢复修改前的键盘适配（`visualViewport.height + offsetTop` 更新 `#app`，输入栏保留在 flex 布局）；Service Worker 升至 v9。语法检查与 `dom-smoke.mjs` **30/30** 通过。
- **整轮回退**：用户澄清要恢复本轮开始前的版本。已恢复原始 `index.html` 输入栏结构、`style.css` flex 布局和 `ui.js` 视口高度/offsetTop 行为；Service Worker 升至 v10 以分发回退内容。语法检查及 `dom-smoke.mjs` **30/30** 通过。

### 第三次调整（v11）：不再用 vv.height 定布局，改用 inset:0

- **真机结论**（iPhone 17 Pro Max / iOS 27.2，独立 PWA）：`visualViewport.height` 会把页面容器压得比实际可见区域小，导致输入栏贴到屏幕上方、下面留一大块空白。
- **改法**：
  - `#app` 改为 `position: fixed; inset: 0`，让浏览器按**布局视口**自己算高度（键盘弹起时布局视口会正确变矮），不再用 JS 逐帧写 `height/top`；
  - `ui.js` 的 `applyViewport()` 只保留键盘状态判定（切 `body.kb`、隐藏胶囊、收键盘后回底），删除 `height/top/offsetTop` 写入；
  - Service Worker 升到 `companion-v11-2026-11-02`，并把**页面导航改为网络优先**（本地/尾网延迟很小），断网才回退缓存，避免以后改前端被旧缓存挡住。
- **新增 `public/reset.html`**：一键注销旧 SW、清空 CacheStorage 再跳回 `/`，用于真机上强制换到新前端（旧 SW 是缓存优先，靠普通刷新可能一直拿到旧壳）。
- **验证**：`ui.js`/`sw.js` 语法通过，`dom-smoke.mjs` **30/30**；本地 `reset.html` 200、`style.css` 已含 `inset: 0`、`sw.js` 已是 v11。
- **待真机**：手机打开 `/reset.html` → 重开 PWA（两次）→ 点输入框，确认输入栏贴在键盘上沿、无大块空白。

## V0 收尾 — API 控制台与 L2 基础事实记忆（2026-11-02）

### 做了什么

- 设置侧栏新增控制台：录入/替换/清除 DeepSeek Key，显示模型与 mock/live 状态；Key 仅由服务端保存，GET 响应和界面均不回显。
- 新增短模型连接测试，受每日预算拦截且写入 `usage.jsonl`；Key 由环境变量管理时，界面明确显示只读状态。
- 新增 DeepSeek 账户余额查询 `/user/balance`。最近一次成功余额写入独立缓存；查询失败保留旧数值并显示不可用状态与更新时间。
- 控制台区分提供方余额与 APP 本地用量，显示今日花费、token、调用次数、预算进度；记忆/空间、表情包、主动对话、多 AI 预览均禁用。
- 增加 L2 `facts.jsonl`：仅从用户明确陈述提取少量事实，保存原话、来源消息 id/序号；启动时回填旧历史，新消息即时索引，最新同类陈述覆盖旧值；仅用户消息可成为事实来源。
- L2 事实随 system prompt 注入并带“无依据就承认不确定”的约束；facts 文件纳入日备份。服务新增 Key 后可动态切换 mock/live；`run.ps1 -Mock` 仍会强制 mock。
- 新增 `.gitignore` 排除本地数据、密钥与备份；更新 README、决策总表及测试说明。

### 改了哪些文件

- `app/server.mjs`、`app/lib/memory.mjs`、`app/public/index.html`、`app/public/ui.js`、`app/public/style.css`、`app/public/sw.js`、`run.ps1`
- `app/tools/dom-smoke.mjs`、`app/tools/profile-test.mjs`、`app/tools/memory-test.mjs`、`app/tools/live-memory-test.mjs`、`app/smoke-budget.mjs`
- `README.md`、`DECISIONS.md`、`.gitignore`

### 怎么验证的

- Node 语法检查：通过。
- `dom-smoke.mjs`：**40/40**；设置保存/清除、Key 不回传、控制台与禁用预览均通过。
- `memory-test.mjs`：**5 项通过**；旧事实回填和 prompt 注入、来源序号、重复启动不重复写入、余额缓存失败回退、模型连接测试记账通过。
- `profile-test.mjs`：**18/18**；`reply-test.mjs`：**13/13**。
- 原服务端 `smoke.mjs`：临时 mock 服务 **43/43**；`smoke-budget.mjs`：临时低预算服务 **9/9**。
- `live-memory-test.mjs --confirm-cost`：真模型从 L1 窗口之外召回旧事实；Provider usage 约 **¥0.002932**。费用已补记到本机 `usage.jsonl`；原测试临时账本已清理，准确 token 数未保留，因此该笔标记为估算/未知。
- DeepSeek 官方余额接口实测：HTTP **200**，返回结构有效；没有在日志或回复中显示账户余额值。
- 所有服务端测试使用隔离端口和临时数据；未启动 8787 日常实例。键盘问题仍按用户选择暂不纳入本轮验收。

## 手机端控制台与个性页（2026-11-02）

### 做了什么

- 手机宽度下，控制台和个性设置改为当前 PWA 内的全屏子视图；返回先回设置抽屉，再由抽屉返回聊天，不新增站点路由或整页加载。
- 控制台标题栏固定、内容独立滚动；余额刷新、API Key 保存/清除、模型测试及禁用预览继续使用原接口与行为。
- 手机个性页汇总头像、AI 名称、对用户称呼、人设、语气、主动性和边界；编辑内容作为草稿，统一点“保存”提交。返回时对未保存更改进行放弃确认。
- 回到设置抽屉时将基础资料控件移回原位置，聊天视图与输入区未改。桌面端保留弹层和抽屉结构。
- Service Worker 升至 v13，确保客户端更新应用壳。

### 改了哪些文件

- `app/public/index.html`、`app/public/ui.js`、`app/public/style.css`、`app/public/sw.js`
- `app/tools/dom-smoke.mjs`

### 怎么验证的

- `ui.js`、`sw.js`、`dom-smoke.mjs` 语法检查通过。
- `dom-smoke.mjs`：**50/50**，包含手机子页面切换、返回、未保存确认、放弃不写入、统一保存和资料控件归位。
- `profile-test.mjs`：**18/18**；`reply-test.mjs`：**13/13**；`memory-test.mjs`：全部通过。
- `smoke.mjs`：**41/41**；`smoke-budget.mjs`：**9/9**。两者用临时数据目录与隔离端口运行，测试服务已停止；没有调用真模型，也未启动日常 8787 实例。
- 当前没有 iPhone 真机视觉验收；手机安全区、长内容滚动和桌面视觉仍需设备上确认。

### 手机排版复核（2026-11-02）

- 去掉标题栏中叠放的返回/关闭双图标，改为每个平台状态仅显示一个图标；手机标题显示“个性设置”。
- 手机上隐藏底部重复的“取消返回”，保留标题栏返回、试说三句和保存；桌面仍保留取消按钮。
- 为手机子页面增加显式 `mobile-page` 样式，强制全屏不透明背景、个性字段单列、独立滚动与安全区留白，避免 PWA 视口样式未命中时回退成桌面弹层。
- Service Worker 升至 v14；DOM 回归新增单一返回图标与手机页状态检查。

### 手机未保存提醒复核（2026-11-02）

- 手机个性页隐藏“取消返回”，只保留标题栏返回键；桌面仍保留取消按钮。
- 不再依赖浏览器原生 `confirm()`。手机返回且草稿有变化时显示 APP 内确认框，提供“继续编辑”和“放弃修改”；前者保留草稿，后者丢弃本地草稿并返回设置。
- DOM 回归覆盖未保存提醒出现、继续编辑、确认放弃、放弃不写入服务端等路径。
- Service Worker 升至 v15。

## 跳过事项清单

后续用户明确说“跳过”某个环节时，将该事项追加到此表，记录跳过内容、原因或现状、后续待优化点；阶段工作结束时与用户一起复盘此表。

| 跳过事项 | 当前情况 | 后续一起优化 |
|---|---|---|
| iPhone 键盘弹出/收起真机验证 | 本轮不纳入 V1 验收；桌面/DOM 测试不能代替 iPhone PWA | 在 iPhone 17 Pro Max / iOS 27.2 上检查输入框贴键盘、页面不跳位、收起后回底，连续开合 5 次 |
| 手机个性页未保存提醒真机验证 | 用户反馈目前仍未测出提醒；本轮先跳过，不继续调试 | 之后在 iPhone PWA 上验证修改字段后点标题栏返回，是否出现 APP 内“继续编辑 / 放弃修改”提示；同时确认客户端已加载 SW v16 |

## V1「有过去」实施轮 — 2026-11-02

### 做了什么

- 增加每 20 个用户回合整理一次的 L3 摘要，保留来源消息 ID/序号；每条摘要主张都必须带原文证据和消息 ID，不匹配的主张不入库；预算不足时延后整理。
- L2/L3 使用本地关键词、来源、时间、重要度排序；可选 OpenAI 兼容 Embedding 配置，未配置、失败或 mock 模式回退本地检索；不同 Embedding 模型的向量不会混用。
- 控制台加入记忆搜索、来源、关系图、召回记录编辑/删除和 Embedding 管理。Key 不返回浏览器；Embedding 花费计入本地预算。
- 空间在当前 PWA 内显示，支持用户/AI 动态和评论。AI 动态只从聊天同轮隐藏元数据产生，带来源消息，并经过提及用户、复制用户主题与已有事实的拦截，每日最多 5 条。
- AI 愉悦度/活跃度做惯性平滑并回归基线；个性签名在聊天头部和空间显示。元数据从聊天正文剥离，不另起状态模型请求。
- 记忆、空间与情绪 JSONL 纳入每日备份；V2 表情包、V3 主动对话、V4+ 多 AI 保持禁用预览，不接 AstrBot/QQ。

### 改了哪些文件

- `app/server.mjs`、`app/lib/v1.mjs`：记忆生命周期、Embedding、空间/情绪 API 与隐藏元数据处理。
- `app/public/index.html`、`app/public/ui.js`、`app/public/style.css`、`app/public/sw.js`：记忆控制台、空间页、签名及缓存版本 v16。
- `app/tools/v1-unit.mjs`、`app/tools/v1-integration.mjs`、`app/tools/dom-smoke.mjs`：V1 单元、隔离服务端与 DOM 回归。
- `README.md`、`DECISIONS.md`：更新 V1 现状、数据文件和路线。

### 怎么验证的

- `v1-unit.mjs`：检索排序、情绪平滑、AI 动态隐私拦截、隐藏元数据剥离、来源关系验证通过。
- `v1-integration.mjs`：mock 隔离实例验证 Embedding Key 隐藏与回退、20 轮摘要来源、事实编辑/删除重启持久、空间评论、AI 动态每日 5 条、情绪/签名与数据重启持久通过。
- `dom-smoke.mjs`：**61/61 通过**，覆盖控制台、个性页、聊天重试、空间切换、状态曲线、签名、动态和评论。
- `smoke.mjs`：**43/43 通过**（独立 mock 实例，端口 8911）；`profile-test.mjs` 18/18、`reply-test.mjs` 13/13、`memory-test.mjs`（含 live provider 模拟）通过。
- `smoke-budget.mjs`：**9/9 通过**（独立 mock 实例、临时 0.0002 元额度，超限消息未落盘）。
- `v1-unit.mjs` 与 `v1-integration.mjs` 通过；真模型完成一次旧事实召回，准确召回“豆豆”，实际费用 ¥0.003226，已记入 `app/data/usage.jsonl`。live provider 模拟另验证了摘要和隐藏元数据处理。
- 所有自动测试使用临时数据目录；只有上述已授权真模型调用的用量写回 `app/data/usage.jsonl`。默认端口 8787 未启动。

### 跳过事项更新

| 跳过事项 | 当前情况 | 后续一起优化 |
|---|---|---|
| iPhone 键盘弹出/收起真机验证 | 本轮不纳入 V1 验收；目前仅通过 DOM 回归 | iPhone 17 Pro Max / iOS 27.2 验证贴键盘、收起回底和连续开合 5 次 |
| 手机个性页未保存提醒真机验证 | 用户反馈目前仍未测出提醒；尚未做本轮真机验证 | iPhone PWA 确认返回提醒能否稳定弹出；当前 SW v19 |

## APP 内导航重构 — 2026-11-02

### 做了什么

- 将打开即聊天改为 QQ 概念的 APP 内首页：本机私密资料、搜索、Anam 最新消息摘要；底部导航为“对话 / AI 联系人 / 空间 / 控制台”。新增 AI 提示只提示后续开放。
- 聊天保留原有单一长对话，新增返回列表和右上角三横线 AI 资料入口；聊天隐藏底部导航。AI 联系人入口与聊天菜单进入同一份资料页，签名显示在聊天标题、联系人和资料页。
- 新增本机昵称/头像的独立读取保存接口。AI 资料页显示个性字段，个性编辑页集中保存头像、名称、称呼和人格设置；控制台改为底部 Tab 页面。
- 消息记录增加固定 `assistantId: "anam"`，旧消息备份后补齐；AI 空间动态、评论和情绪记录也携带该 ID。没有启用多 AI 或新会话。
- 更新 Service Worker 到 v17，并更新 README / 决策状态。

### 改了哪些文件

- `app/public/index.html`、`app/public/ui.js`、`app/public/style.css`、`app/public/sw.js`
- `app/server.mjs`、`app/tools/dom-smoke.mjs`、`app/tools/profile-test.mjs`
- `README.md`、`DECISIONS.md`

### 怎么验证的

- `dom-smoke.mjs`：47/47，通过 APP 导航、AI 联系人/资料入口、本机资料隔离、编辑保存、草稿与滚动保留、控制台、空间、签名和聊天重试。
- `profile-test.mjs`：24/24，通过旧消息迁移、ID/seq/replyTo 保留、本机资料与 AI 资料分离、重启持久化。
- `v1-unit.mjs`、`v1-integration.mjs`、`reply-test.mjs`、`memory-test.mjs` 均通过；JS 语法检查通过。
- `smoke.mjs` 与 `smoke-budget.mjs` 依赖已启动的 8787/8788 服务，本轮没有启动实例，分别因目标端口未监听而未能运行；没有调用真实模型。
- 默认服务 8787 保持停止。

### 跳过事项

| 跳过事项 | 当前情况 | 后续一起优化 |
|---|---|---|
| iPhone 键盘弹出/收起真机验证 | 本轮只做页面导航，未在 iPhone 实测 | iPhone 17 Pro Max / iOS 27.2 验证键盘与输入框位置 |
| 手机个性页未保存提醒真机验证 | DOM 仍覆盖提醒逻辑，未做真机验证 | iPhone PWA 确认返回提醒能否稳定弹出 |

## 导航点击与对话列表修整 — 2026-11-02

- 对话首页增加“消息”分组标题、统一行高、头像尺寸、摘要截断和右侧时间对齐，形成清晰的一行一会话结构。
- 更新 Service Worker 到 v18，促使已安装 PWA 替换先前缓存的页面资源。8787 仍保持停止。
- `dom-smoke.mjs`：47/47 通过；手机实际点击需在更新后的 PWA 上复验。

## PWA 版本错配根因修复 — 2026-11-02

- 截图确认手机用了新版 HTML，但旧样式仍把导航渲染成胶囊，点击脚本也疑似来自旧缓存；检查到旧 Service Worker 采用 HTML 网络优先、CSS/JS 缓存优先，更新仅在页面 load 后注册且没有 controllerchange 重载。服务器还给 CSS/JS 1 小时 HTTP 缓存，SW 新缓存安装时可能复用旧资源。
- 将 SW 升为 v19：安装时对壳资源使用 `cache: reload` 取新文件；页面 head 提前检查并注册更新，controller 改变时自动刷新当前页。服务器对 HTML、SW、CSS、JS 使用 `no-cache` + ETag，其他静态图标保持短缓存。
- 首页补成 QQ 风格清晰消息行，底部四 Tab 添加线框图标与标签。
- `profile-test.mjs`：28/28，通过旧消息迁移、独立资料、静态资源 no-cache 与新导航样式断言。
- `dom-smoke.mjs`：47/47，通过导航入口、个性页、聊天保留、控制台和空间操作；`v1-unit.mjs`、`v1-integration.mjs` 通过；服务端、前端与 SW 语法检查通过。
- iPhone PWA 更新接管尚未真机验证；8787 默认保持停止，没有调用真实模型。

## 聊天页底栏与输入框修复 — 2026-11-03（v21）

- **现象**：手机聊天页输入框消失；底栏在聊天页不隐藏、回首页也不见变化。
- **根因**：
  - `#tabs { display: grid; }` 是 ID 选择器，压过了浏览器对 `hidden` 的 `[hidden]{display:none}`，所以 `switchMainView` 里 `tabs.hidden = true` 从未真正隐藏底栏；
  - 聊天页 `#app.chat-mode { padding-bottom: 0 }` 去掉了底栏留白，而底栏（fixed, z-index 20）仍在，正好盖住 z-index 1 的 `#composer`，看起来就是输入框消失；
  - 键盘态 `body.kb #tabs { display:none }` 优先级更高，所以只有弹键盘时输入框才露出来，收起又消失。
- **修法**（只动 CSS，JS 视图逻辑未改）：
  - 新增 `#tabs[hidden] { display: none; }`，让聊天页/AI 资料/本机资料的隐藏真正生效；
  - `.chat-page #composer` 增加 `padding-bottom: calc(10px + env(safe-area-inset-bottom))`，键盘态 `body.kb .chat-page #composer` 改回 10px，避免输入框贴住 home indicator 或离键盘太远；
  - Service Worker 升至 `companion-v21-2026-11-03`。
- **验证**：`dom-smoke.mjs` **51/51**、`profile-test.mjs` **30/30**；CSS 规则已确认；真机待确认（聊天页底栏消失、输入框可见；返回首页底栏恢复）。

## 签名 / 汉堡位置 / 记忆整理修复 — 2026-11-03（v22）

### 1. 个性签名

- **原因**：
  - `config.json` 的 `profile.signature` 为空，聊天页签名节点虽然存在，但没有内容可显示；
  - 最后一条消息 11-02 22:18，包含签名元数据处理的 `server.mjs` 到 23:38 才改完——用户测试时该链路尚未上线；
  - 解析器要求 `<anam-meta>` 必须严格贴结尾，模型多写一点尾巴就整块丢弃。
- **修法**：
  - `parseAssistantMetadata` 改为允许元数据块出现在任意位置，并容忍块后文字；仍取最后一个块；
  - 个性编辑面板新增「个性签名」输入（maxlength 56），失焦自动保存；AI 元数据仍可覆盖；
  - 聊天页 `.chat-header .who` 允许伸展，签名 `max-width:100%`，不再被挤掉。
- **注意**：模型是否输出签名取决于它是否遵守元数据格式；手动输入是可用的兜底。

### 2. 聊天页右上角三个横线

- **原因**：`.who` 没有 `flex:1`，`.hamburger` 没有 `margin-left:auto`，按钮紧跟在名字块后面。
- **修法**：`.chat-header .who { flex:1 1 auto; min-width:0 }` + `.chat-header .hamburger { margin-left:auto }`。

### 3. 记忆摘要不出现

- **原因**：
  - 自动摘要要求距上次摘要满 20 个用户回合；
  - 真模型路径要求 claim 的 `evidence` 是来源原文的**逐字连续子串**，模型改写标点/空白就会全部被丢弃 → `summary` 为空 → 抛错，只打一条 `[memory-summary]` 警告；
  - 聊天里让 AI "声称已存储"不会触发任何写入；此前没有手动整理入口。
- **修法**：
  - `validateSummaryClaims` 比较前统一去掉空白与中英文标点（仍要求 `sourceId` 存在、证据非空），降低误杀；
  - `maybeSummarize({ force })` 支持强制整理，返回 `{ok, record, message}`；
  - 新增 `POST /api/memory/summarize`（强制整理，不再受 20 轮限制）；
  - 控制台「长期记忆」新增「立即整理记忆」按钮，失败原因直接显示在控制台。
- **验证**：mock 隔离实例强制整理返回 200，写入 `summaries.jsonl` 1 条，`/api/memory` counts 变为 `summaries:1`；`v1-unit`、`v1-integration`、`dom-smoke`（51/51）、`profile-test`（30/30）、`reply-test`（13/13）通过。
- **SW**：升至 `companion-v22-2026-11-03`；`server.mjs` 改动需要重启服务。
- **待真机**：签名显示/编辑、汉堡位置、控制台立即整理。

## 历史分页 + 本地缓存 + 冗余清理 — 2026-11-03（v24）

- **历史分页**（解决"以前的记录看不到"）：
  - `/api/messages` 默认返回最近 **200** 条（上限 500），新增 `before=<seq>` 与 `hasMore`；
  - 启动加载 200 条；聊天页顶部新增「加载更早」，每次再取 200 条，插入时保持当前阅读位置；
  - 重连 `resync` 也带 `hasMore`；
  - 修复：聊天页在隐藏状态下渲染，进入时要重新贴到底部（否则停在最旧一条）。
- **本地缓存**：
  - 有口令时，把最近 200 条消息写入 `localStorage`（`companion.messages.v1`），启动先用缓存秒开，再用服务端最新数据替换；
  - 新消息、加载更早、resync 都会更新缓存；无口令设备不读缓存。
- **冗余清理**：
  - 启动时不再重复请求 `/api/emotion`（签名已经从 `/api/profile` 取到）；
  - 删除 `persona-edit` 这个永远不会命中的视图判断。
- **验证**：
  - API：250 条测试数据 → 首页 200/hasMore=true，再取 50/hasMore=false；
  - 真实数据：411 条 → 200（212–411）+ 200（12–211）+ 11（1–11），三批正好铺满；
  - 无头 Chrome：进入聊天页 200 条并贴底，加载更早 → 400 → 411，按钮在最后一页自动隐藏，无 JS 错误；
  - `dom-smoke` 51/51、`profile-test` 30/30、`v1-unit` 通过。
- **SW**：升至 `companion-v24-2026-11-03`；服务已重启（live，411 条消息）。

## V1 收尾 — 2026-11-03（v25）

### 手动整理没反应

- **直接原因**：操作时 8787 服务是停止的（之后已启动）；另外旧服务端整理请求把模型 `max_tokens` 设为 1100，`deepseek-flash` 是推理模型，JSON 被截断，报 `Unexpected end of JSON input`，摘要没生成。
- **修法**：
  - 摘要调用 `max_tokens` 提到 **2400**，`temperature` 降到 **0.3**；`completeOnce` 支持传入温度；
  - JSON 解析前截取第一个 `{` 到最后一个 `}`，容忍代码块/前后文字；
  - 模型仍失败时**退化为用户原话摘要**（带 `sourceId`/原文 evidence，`fallback:true`），保证这一窗口不丢；
  - 按钮增加"整理中…"状态、十几秒提示、失败原因（连不上服务/HTTP/模型错误）显示在控制台。
- **结果**：手动整理返回 200；生成第一条真实摘要（seq 1–40，20 个用户回合，6 条 claim，importance 4）；`summaries.jsonl` 3488 字节，`/api/health` 的 `memorySummaries` 从 0 变 1，花费约 +¥0.023。

### 聊天头部

- **签名**：从名字下方移到「在线」旁边，一行省略号显示；CSS `.ai-signature` 改为 inline ellipsis，空签名不占位。
- **预算**：聊天页不再常驻显示"1 元"提醒，`#budgetText` 隐藏；预算/花费只在控制台显示，超额时仍会通过错误提示告知。
- 理由：聊天页是关系界面，不应常驻金额；控制台已经有完整用量。

### 收尾与文档

- 今日备份 `backups/2026-11-03/` 已按当前数据刷新，包含新生成的 `summaries.jsonl`；并用该备份在隔离目录启动验证：**447 条消息、1 条摘要、3 条空间动态、7 天覆盖正常**。
- `DECISIONS.md`：V1 状态改为**已完成（2026-11-03）**；架构图从"两个 Tab"更新为四个 Tab。
- `README.md`：V1 状态、签名位置、预算只在控制台、以及过时的 `start-live.cmd` FAQ 已更新。
- **真机**：键盘卡顿已确认为可接受、不阻塞；个性页未保存提醒已存在。
- **验证**：`dom-smoke` 51/51、`profile-test` 30/30、`reply-test` 13/13、`v1-unit`、`v1-integration` 全部通过。

### V2 前置约定（做表情包前必须遵守）

- 消息媒体必须用 `media:{ ref, w, h, alt }`——`normalizeMedia()` 只保留这四个字段，**不能**写 `memeId/kind`；
- 消息类型用 `sticker`（`MESSAGE_TYPES` 已支持 `text/image/sticker/system`）；
- `ref` 存 `meme:<id>`，前端拼 `/api/memes/<id>/file`；
- 表情包文件放 `app/data/memes/`，`memes.jsonl` 存元数据；备份必须同时复制目录；
- 上传默认 `reviewed:false`，只有已审核+启用进入 AI 目录；每条回复最多 1 张；
- 图片接口必须走口令，不能放公开静态目录。

## 空间回应 + 摘要整页 — 2026-11-03（v26）

### 发动态后她会留言

- **原因**：原来只有"你评论她的动态"才触发 AI 回复；你发动态的 `POST /api/space/posts` 只落库，没有触发任何模型。
- **修法**：
  - 发帖后后台调用 `commentOnUserPost()`，用当前人格 + 动态内容生成 1–2 句回应（可带一个问题），每帖最多一条、受预算拦截；
  - 生成成功后通过 SSE `space` 事件推送，空间页自动刷新；不阻塞发帖响应；
  - `buildSystemPrompt` 增加"最近两条你发的动态"，让她在聊天里可以自然接话题，但要求不复述、不反复追问。
- **验证**：隔离 mock 实例发帖后 1 条 AI 评论；`v1-integration` 的评论断言更新为"用户和 AI 都存在"，通过。

### 对话摘要整页

- 新接口 `GET /api/memory/summaries`：按时间倒序返回摘要、claim、时间范围、来源片段与 `fallback` 标记。
- 控制台「长期记忆」标题下新增 **「查看对话摘要」** 按钮；打开整页（类似聊天页/控制台子页），可返回。
- 每张卡片显示：时间、消息范围、低置信度标记、摘要正文、claim + 原文证据。
- 摘要 fallback 质量修正：不再把"现在几点/昨天干什么"这类纯提问当成事实；没有可确认事实时写入"这一阶段没有可确认的长期事实（以提问/测试为主）"。
- **验证**：真实数据 5 条摘要；无头 Chrome 打开摘要页显示 5 张卡片、可正常关闭、无 JS 错误；`dom-smoke` **54/54**、`profile-test` 30/30、`v1-unit`、`v1-integration`、`reply-test` 通过。
- **SW**：升至 `companion-v26-2026-11-03`；服务已重启。

## 记忆页精简 + 图谱清理 — 2026-11-03（v27）

- **用户反馈**：控制台里看不到摘要改动；图谱是密密麻麻的来源扇形；希望"只保留一个图 + 下方摘要按钮"。
- **原因**：
  - 摘要按钮原来在搜索框/设置上方，手机上滚到记忆区时已经滚出视野；
  - `memoryGraph()` 给每条记忆铺开最多 8 条来源消息，5 条摘要就是几十条线，糊成扇形；
  - 搜索、Embedding 设置、记忆编辑卡全部堆在同一屏。
- **修法**：
  - 记忆区顺序改为：**一个图 → 「查看对话摘要」按钮 → 折叠的「记忆管理」**（搜索/编辑/语义检索/立即整理）；
  - 图谱不再生成来源节点，只保留记忆节点 + 实体 + 关系边；来源在摘要页和记忆卡里看；
  - 折叠项默认关闭，所以默认视觉只有图和按钮；
  - SW 升到 `companion-v27-2026-11-03`。
- **验证**：`/api/memory` graph 为 9 个节点/5 条边、0 个 source 节点；服务端 HTML 顺序为 graph → button → tools；`dom-smoke` 54/54；`v1-unit`、`v1-integration` 通过。

## 额度继续弹窗 — 2026-11-03（v29）

- **原因**：真实触发是 **token 上限**（200,847 / 200,000），金额只花了 ¥0.56 / ¥1.00；旧 402 文案只提"额度/金额"，没有继续入口，用户只能等第二天。
- **服务端**：
  - 新增 `app/data/budget-override.json`（按本地日期记录 `mode:'day'`）；
  - `budgetState()` 增加 `overLimit` / `override` / `blocked`：选择继续后当天 `blocked:false`，但仍返回 `overLimit:true` 和真实花费；
  - 新接口 `POST /api/budget/override`：`{mode:'day'}` 今天继续，`{mode:'clear'}` 恢复限额；
  - 402 文案区分 token 上限与金额上限。
- **客户端**：
  - 402 时弹窗显示原因；「今天继续」写入覆盖并自动重发刚才那条消息；「算了」关闭、保留输入；
  - 控制台用量区显示「今天已选择继续」并提供「恢复今日限额」按钮；
  - 弹窗文案明确"花费会继续累计，明天 0 点自动恢复"。
- **验证**：
  - 零额度临时实例：402 → 覆盖后 200 → 清除后再次 402；
  - 真实数据 402 文案为 token 上限；无头 Chrome 弹窗正常显示、取消后关闭、输入保留、无 JS 错误；
  - `dom-smoke` 54/54、服务端/前端语法通过。
- **SW**：升至 `companion-v29-2026-11-03`；服务已重启。

## V2 Phase 1 — 表情包库（数据 / API / 终端管理 / AI 资料入口 / 备份）— 2026-11-03（v30）

- **范围**：只做 Phase 1；Phase 2（目录注入、AI 选图、聊天渲染）未开始。
- **数据**：
  - 新增 `app/lib/memes.mjs`：12 字符 URL 安全 id、魔数识别 PNG/JPEG/GIF/WebP、尺寸解析、SHA-256、label/tags 清洗、目录选择、备份校验。
  - 新增 `app/data/memes.jsonl`（启动时自动创建）和 `app/data/memes/`；id 对应内容不可变，换图 = 新 id。
- **服务端**：
  - `GET/POST /api/memes`、`PATCH/DELETE /api/memes/:id`、`GET /api/memes/:id/file`、`GET /api/memes/:id/usage`、`POST /api/memes/settings`；
  - 上传：base64 JSON，body 上限 3MB（其他接口仍 1MB）；≤1.5MB、≤100 张、魔数校验、静态长边 ≤768、hash 判重、临时文件 + rename；
  - 审核必须有 label；`enabled` 默认 true；pinned 只影响目录顺序；
  - 图片接口带真实 MIME、`nosniff`、`private, immutable`；id 白名单防路径拼接；
  - 启动清理 `.tmp-*` 与无记录孤儿文件；记录缺文件标 `corrupted`，历史占位、不进目录；
  - 备份加入 `memes.jsonl` + `memes/`（递归，跳过临时文件），7 天轮换。
- **页面落位**：
  - 终端（控制台）新增「表情包」分区：上传、网格、label/tags、审核/启用/置顶、删除确认、计数；头部只读显示总开关；
  - AI 资料页新增入口卡（共 X 张 / 已启用 Y / 待审核 N）和唯一总开关「允许她发表情」；点击入口切到控制台并滚动/高亮；
  - 不新增第五个主页面；对话页与空间页 Phase 1 未改。
- **验证**：
  - `app/tools/meme-test.mjs` **28/28**：伪造格式、>1.5MB、>768、100 张、判重、GIF、label 审核、目录 31→30/等待 1、停用/取消审核不影响历史引用、删除确认与引用数、备份恢复、缺图报 id、损坏标记；
  - `app/tools/meme-browser-test.mjs` **3/3**：2000px 长边→768、透明通道保留、GIF 原样（无头 Chrome；沙箱内需外部 Chrome 调试端口）；
  - `dom-smoke` **57/57**（新增 AI 资料入口与总开关关闭/恢复）；
  - 无头 Chrome 实机页面：终端 3 张网格、AI 资料计数、入口点击落到 `#memeSection` 并高亮、无 JS 错误。
- **SW**：升至 `companion-v30-2026-11-03`；服务已重启。
- **未排期**：**生活提醒**仍是项目主要缺口，不在 V2 Phase 1 规格内；建议排在 V3 主动对话之前（提醒的调度地基可复用）。

## V2 Phase 2A — AI 选表情并发送（2026-11-04，v31）

- **范围**：只做 AI 发表情；用户手动发表情/图片（2B）未开始。
- **目录与 prompt**：
  - 每次聊天请求开始时构建目录快照（审核+启用+label+文件完好，置顶优先、reviewed_at 次之、最多 30）；
  - `buildSystemPrompt` 末尾注入紧凑块（`id | label | tags`，按 id 排序，稳定缓存）；总开关关闭或目录为空时整块不注入；
  - 只有聊天调用传入目录，空间评论/试说三句不注入。
- **发送链路**：
  - `<anam-meta>` 增加可选 `meme` 字段；`parseAssistantMetadata` 保留；
  - 整条回复完成后校验：id 必须在本次快照内；最近两条 AI 回复（按 `replyTo` 归组）已有 sticker 则剥除；无效只剥掉，不重新生成；
  - 通过后在文字消息之后追加独立 `sticker` 消息，`media:{ref:'meme:<id>',w,h,alt}`；文字为空但表情有效时允许只发表情；
  - mock 约定触发词「发个表情」固定选快照第一张；`MOCK_MEME_ID` 可强制无效 id 供测试。
- **前端**：
  - sticker 消息无气泡底色，按 `media.w/h` 预留比例、最长边约 160px；
  - 取图带口令，聊天侧 `cache:'no-store'`，删除后历史显示 `[表情] 名字` 占位；
  - inbox 预览显示 `[表情]`，历史分页/本地缓存按普通消息处理。
- **验证**：
  - `app/tools/meme-chat-test.mjs` **14/14**：目录快照、prompt 空/非空、mock 触发、无效 id 剥除、连续第二张被频率门挡、隔两条文字后可再发、总开关关闭、文字顺序、文字为空时只发表情；
  - 无头 Chrome：sticker DOM/blob 图/inbox `[表情] 开心`、无 JS 错误；删除表情后刷新显示 `[表情] 开心` 占位；
  - `dom-smoke` **57/57**、`profile-test` 30/30、`v1-unit`、`v1-integration`、`reply-test` 通过。
- **SW**：升至 `companion-v31-2026-11-04`；服务重启后生效。
- **真实库**：重启时读到 8 张已审核/启用表情；AI 下一轮起可从中选图。Phase 2B（你手动发表情/图片）待批准。

## V2 交付层性能修复 — 2026-11-04（v32）

- **问题**：原图 300×300 PNG 约 0.9–1.5MB，网格和聊天都直接拉原图；加载期间只有一个空 `<img>`，慢且像失败。
- **F1 派生预览**：
  - 上传时客户端同时生成 240px PNG 预览，服务端校验（≤300KB、≤512px、魔数）后存 `memes/previews/<id>.png`；
  - 存量 8 张已用一次性脚本补全，每条记录有 `previewFile/previewMime/previewW/H/Bytes`；
  - 新接口 `POST/GET /api/memes/:id/preview`，取图鉴权、`private, immutable`。
- **F2 网格**：只拉 `/preview`，240px 图，`loading="lazy"`；不再在网格里请求原图。
- **F3 聊天**：先显示预览；预览显示后**一律**后台预加载原图，成功才原地替换（失败保留预览，不落到失败占位）；替换前锁定预览盒子宽高，不跳位。网格仍只用预览。
- **F4 本地持久缓存**：IndexedDB `companion-memes/previews` 存 Blob；离线冷启动也能从缓存显示。
- **F5 三态占位**：`loading`（网格 shimmer / 聊天 `[表情] 名字` 骨架）→ `ready`（图片）→ `failed`（`[表情] 名字` 占位），加载中不再顶失败态。
- **离线启动**：boot 先读本地消息缓存并渲染，再尝试 health；离线时保留缓存，不再直接报“连不上”。
- **删除**：同设备删除会清 IDB 并重渲染相关 sticker；聊天取图用 `no-store`，避免浏览器缓存的旧图复活。
- **验证**：
  - 真实终端：8 张全部 240×240 预览，0 loading、0 failed，资源只有 8 个 `/preview`、0 个 `/file`；
  - 聊天：sticker `state=ready`、240×240、inbox `[表情]`；
  - 离线冷启动：消息缓存 + IDB 预览仍为 240×240、无错误；
  - 删图后：引用该图的 sticker 变为 `[表情] 名字`，其余图正常；
  - `meme-test` **30/30**、`meme-browser-test` **4/4**、`dom-smoke` **57/57**、`meme-chat-test` **14/14**。
- **SW**：升至 `companion-v32-2026-11-04`；真实库 8 张预览已补全。后续原图升级修正升至 **v33**（见下）。
- **第 2 步（扩库）当前被前置缺失挡住**：
  - 仓库里没有 `companion-v2-sticker-perf-fix.md`（F1–F5 已按你给的描述实现，未按文档原文核对）；
  - 没有 `nekowhale` / “大肥鱼套组”的源文件、URL 或既有批量导入工具，也没有 D-2.13 情绪配额记录；
  - 因此没有擅自导入外部图片；需要你提供源目录/工具/链接，或改为手动上传。
- **真实链路**：真实对话已出现 3 条 AI sticker（seq 566/575/584），分别引用 `3giUovL-78GY`、`WBC6bAiK0sBM`、`0Qb-jEy0CXjv`；说明 live 选择/追加链路已跑通，频率与贴切度留给 Tian 有机观察。

## V2 第 2 步首批导入 — 2026-11-04

- **源**：`https://kiriyuki.com/meme/kit/nekowhale.json`（version 2026-10-23），只取 `大肥鱼` 单人包；`大肥鱼和GPT娘` 整包排除。作者/许可见 `CREDITS.md`（CC BY-NC 4.0）。
- **导入器**：`app/tools/meme-import-nekowhale.mjs`；下载 65 条清单+替补，校验 SHA-1 前缀与 ≤1.5MB，再走现有 `/api/memes` 上传流水线；预览用 `meme-preview.py` 生成 240px。
- **结果**：
  - 成功 **36 张**（reviewed:false、enabled:false，未自动进目录）；
  - 库总数 **44**（原 8 + 36），待审核 **36**，目录仍 **8**，44 张均有 240px 预览；
  - 6 个配额短缺（搞怪/卖萌/喜欢/无语/疲惫/疑惑）：主选与同情绪替补都超过 1.5MB，按规则不压缩、跳过；总库 44 仍在 40–50 目标内；
  - 4 张同情绪替补实际使用：`11N08_拉炮`、`4N06_开饭`、`7N04_上菜`、`EX55_自动工作`；
  - 导入报告：`app/data/meme-import-report.json`；导入前备份：`backups/pre-neko-2026-11-04/`。
- **注意缺口**：`8N09_哈欠` / `EX11_燃尽` 均超 1.5MB，晚安向 `哈欠` 未入；`15N07_刷牙` 可作睡前日常，但不是严格“晚安”。Step 2 出口要求“安慰/大笑/晚安等稀缺类至少各 1”需要 Tian 判断是否接受刷牙/被窝/放空，或另补一张小体积晚安图。
- **下一步（Tian）**：终端逐张审核 + **同时启用**约 22 张新图，目录到约 30；导入的 36 张默认 enabled:false，只点审核不会进目录。
- **验证**：`GET /api/memes` 44/44 预览、pending 36、enabled 8；导入器未审计；未调用模型。
- **审核结果（2026-11-04 晚）**：Tian 已审核启用 43 张，当前 `catalog=30`、`waiting=13`、仅 1 张待审（`P3pZoeN-SWJx` 刷牙）；Step 2 的“目录约 30”已达成。

## 原图升级修正 — 2026-11-04（v33）

- 去掉“仅原图最长边 >320 才换”的条件：聊天里所有 sticker 在预览显示后都后台拉原图。
- 先预加载原图成功才 `img.src` 替换；失败/404 继续显示预览，不触发失败占位。
- 替换前用预览的 `getBoundingClientRect` 锁死宽高；实测 3 条真实 sticker 均为 `160×160`、`style width/height=160px`，预览/原图阶段不跳位。
- 网格仍只用 `/preview`，不请求原图。
- 实测资源：3 条 sticker → 3 个 `/preview` + 3 个 `/file`；状态全 `ready`，无失败占位。
- **SW**：升至 `companion-v33-2026-11-04`。

## 预览取帧 + 聊天加载修复 — 2026-11-04（v36）

- **接口对账**：`a_VK65DpZxu-`（猫在么）`GET /preview` = 200 image/png（原 302 字节，全透明），`GET /file` = 200 image/gif（744,565 字节）。所以不是接口 404。
- **预览取帧**：
  - 旧脚本只取 GIF 第 0 帧；猫在么第 0 帧全透明，给你心心第 0 帧只有右下角一点点；
  - `meme-preview.py` 改为对最多 32 帧采样，按 bbox 面积、可见像素数、亮度方差选信息量最大的帧；
  - 猫在么选第 22/38 帧，预览 302 → **82,295 字节**；给你心心选第 20/30 帧，1,809 → **72,856 字节**；
  - 44 张全部重跑，最小预览 61,933 字节；无空白占位。
- **聊天 failed 根因**：
  - 聊天不读 `memeList` 目录缓存；它只读消息里的 `media.ref` + IndexedDB 预览缓存；
  - 旧代码给 sticker 图片加了 `loading="lazy"`，长历史里离屏的导入图一直不加载，骨架停在 loading，看起来像 failed；
  - 旧代码还 `await image.decode()`，懒加载图片的 decode 可能长期不结算；实测 5 条 sticker 里只有当前可见的 1 条 ready。
  - 旧的空白预览也会进入 IndexedDB，刷新后继续显示空白。
- **修法**：
  - sticker 图片改 `loading="eager"`，用 `onload/onerror` 结算，不再 await decode；
  - 预览缓存数据库改名 `companion-memes-v2`，强制淘汰旧空白预览；
  - 原图升级不变：预览 ready 后一律后台预加载原图，成功才换、失败保留预览、盒子锁定不跳位。
- **验证**：真实 5 条 sticker 全部 `ready`，自然尺寸 300×300，0 failed；`a_VK` 预览 bbox 从全透明变为 `(0,5,238,238)`；接口仍 200。
- **SW**：升至 `companion-v36-2026-11-04`；手机需重开两次或 reset，新 DB 会重新取预览。

## 正文防模仿 + sticker 记录瘦身 + 空盒骨架 — 2026-11-04（v37）

- **正文禁止模仿表情**：
  - `sanitizeReply` 新增独立句 `[表情] X` 剥除；只在句首或句末标点/换行后匹配，不误伤行内普通文字；
  - 目录 prompt 与 `<anam-meta>` 指令各加一句“正文禁止书写 [表情] 格式；表情只能通过 meme 字段选择”。
- **sticker 记录去 text**：
  - 新 sticker 不再写 `text`；展示文本只在 `buildContextMessages`（`[表情] alt`）、inbox 和失败占位中派生；
  - 启动时迁移旧 sticker：去掉 text 并备份 `messages.jsonl.pre-sticker-text.bak`；
  - `normalize` 允许无 text 的 sticker，重启不会丢消息；token 估算/摘要来源改用 `messageText()`。
- **loading 骨架**：
  - 骨架改为空盒，不再放 `[表情] X` 文字；
  - 按 `media.w/h` 预先锁定 160px 内的同尺寸盒子；图片初始 `display:none`，到达后同尺寸替换；
  - 空盒 160×160 → 图片 160×160，节点盒子全程 160×160，不跳位。
- **验证**：
  - `reply-test` **16/16**（独立 `[表情]` 句、句中独立句、行内文字不误伤）；
  - `meme-chat-test` **16/16**（sticker 无 `text`、prompt 禁令、发送/频率/只发表情）；
  - `meme-test` **31/31**（旧 sticker text 迁移移除）；
  - `dom-smoke` **59/59**（骨架空盒 + 固定盒尺寸静态断言）；
  - 真实浏览器限速/暂停预览：loading 骨架 `skeletonText=""`、空盒 `160×160`、图片 `display:none`；ready 后 `160×160`、`display:block`，节点盒子不变。
- **SW**：升至 `companion-v37-2026-11-04`。

## 表情发送策略 — 2026-11-04（v38）

参考 [astrbot_plugin_meme_manager](https://github.com/anka-afk/astrbot_plugin_meme_manager)（MIT）的发送门控/软频率，改造成 Anam 自己的版本。

- **配置默认**：概率 100%、最小间隔 2 条 AI 完整回复、软频率提示关闭、每条最多 1 张固定。
- **概率门**：在 prompt 构建前掷骰；未通过直接空快照，不注入目录，不花选图机会。`MEME_DICE` 可固定骰子；纯函数 `rollMemeGate` 覆盖 0%、100%、25% 命中/未命中。
- **间隔门**：按 `replyTo` 归组的完整 AI 回复计算，排除当前回复；默认 2 表示两次表情间至少两条完整文字回复。可设 0–5。
- **软提示**：开启后追加“每约 4 条回复 1 张”，明确“用户明确要求时不受软频率参考约束”“不向用户解释频率判断”；不改变硬门控。
- **空间回应**：不掷骰、不注入目录、不计入间隔和统计；统计只看主聊天 `messages`。
- **统计**：`/api/memes` 返回最近 20 条 AI 回复/带表情数，终端显示。
- **终端 UI**：`#memeSection` 新增「发送策略」卡片（概率滑杆、间隔、软提示开关、固定 1 张说明、统计）；总开关仍只在 AI 资料页，终端只读显示。
- **测试**：
  - `meme-strategy-test.mjs` **16/16**（默认值、0/100/25 骰子、非法参数、软提示文案）；
  - `meme-chat-test.mjs` **20/20**（概率 0、非法 101、间隔 0、默认间隔、sticker 无 text）；
  - `dom-smoke` **61/61**（终端策略控件/保存、总开关位置）；
  - `meme-test` **31/31**、`reply-test` **16/16**。
- **真实数据**：策略默认 `100/2/off`，最近 20 条 AI 回复 6 条带表情；库 44 张、目录 30、等待 14、待审 0。
- **SW**：升至 `companion-v38-2026-11-04`。

## Token 优化 P0 + P1 — 2026-11-05（v39）

### P0 Prompt 缓存对齐

- 新增 `app/lib/prompt.mjs`：
  - `TIME_RULES`、`META_FORMAT`、`STICKER_BAN`、`EMOTION_RULES` 固定文本；
  - `buildStableSystemPrefix()`：`PERSONA → profileBlock → 时间约束 → meta 格式 → 正文禁表情 → 情绪/签名/动态指令`；
  - `buildSystemContent()`：`稳定前缀 → memory → recent posts → meme catalog → signature → now`。
- `app/server.mjs:553 buildSystemPrompt` 改为使用上述纯函数；`streamModel` 不再把 meta/禁令/情绪指令追加在 `buildSystemPrompt` 之后（原追加已移入稳定前缀）。
- **额外修正**：`profileBlock` 里的 `signature` 每轮会变，已移到尾巴的 `signatureBlock`，否则稳定前缀会被签名打穿。
- 表情目录里的正文禁令已由稳定前缀承担，`memePromptBlock` 不再重复。
- 稳定前缀单测：`prompt-cache-test.mjs` **8/8**（不同时间/记忆/动态/目录两次构建，稳定前缀逐字节相同）。

### P1 L1 token 预算

- 新增 `app/lib/context.mjs`：`L1_TOKEN_BUDGET=3000` + `buildL1Context()`；
- `app/server.mjs:701 buildContextMessages` 使用预算版；最多 60 条（30 轮）仍是第二上限；
- 从最新往最旧累加含 `[时间] ` 前缀的 token；最新一条用户 + 最新一条助手保底；
- `estimateInputTokens` 改为基于实际截断后的上下文。
- `l1-context-test.mjs` **7/7**：
  - 60 条 × 500 汉字长历史只保留 5 条，估算 **2581 token**（≤3100），最新用户/助手在内；
  - 短历史逐字节与旧版 `slice+map` 相同；
  - 最新一轮超预算仍保留；100 条只取 60 条。

### 真实缓存命中

临时数据目录（不污染真实聊天）连发两次真模型请求：

```
第 1 次：tokensIn=424, promptCacheHit=0, promptCacheMiss=424, cost=¥0.001192
第 2 次：tokensIn=452, promptCacheHit=256, promptCacheMiss=196, cost=¥0.001552
```

第二次 `prompt_cache_hit_tokens=256 > 0`，P0 验收通过。`usage.jsonl` 新增 `promptCacheHit` / `promptCacheMiss` 字段。

### 版本/回归

- `dom-smoke` 61/61、`meme-chat-test` 20/20、`meme-strategy-test` 16/16、`meme-test` 31/31、`reply-test` 16/16、`v1-integration` 通过。
- SW **v39**；真实服务已重启，`catalog 30`、策略默认 100/2/off/1。
- 观察期：P0 只调顺序，P1 只裁超预算最旧轮次；若风格明显变化，先查 P1 截断。

## 版本号显示 + P2 费用归因 — 2026-11-05（v40）

### 版本三分离

- 产品版本 `0.2.40`（`app/lib/version.mjs`）：`0` = 未公开发布，`2` = V2 阶段，`40` = 本阶段第 40 次改版；规则为 phase 升 minor、普通改版升 patch。
- SW 版本 `companion-v40-2026-11-05`（`app/public/sw.js`）；服务端每次请求 `/api/status` 时读取 `sw.js` 的 `VERSION`，不缓存旧值。
- 数据 schema 仍为 `1`（`SCHEMA`）。
- 新增 `GET /api/status`：产品/SW/schema、模型、baseUrl 主机（不含 key/路径）、启动时间/uptime、预算、表情计数。
- 终端新增「运行状态」：短行产品+SW、完整详情；SW 不一致且页面有 controller 时显示“新版本已准备好，点此更新”。
- 更新红线：输入框有未发送文字、或流式回复中，点击只提示，不刷新、不丢输入；空闲时走 `reset.html`。

### P2 费用归因

- `app/lib/usage.mjs`：六项 `stable/memory/posts/catalog/time/l1` + `total`，空块记 0；`sumBreakdown`、`cacheRate`。
- `app/server.mjs buildPromptBundle`：一次构建 prompt 时同步算六项；`time` 包含时间行 + 当轮签名，`l1` 为实际截断后的上下文；`streamModel` 返回 breakdown，`streamReply` 写入 usage。
- 新增 `GET /api/usage/breakdown`：最近一轮 breakdown + 今日汇总 + 缓存命中率。
- 终端「本地用量」下方显示最近一轮各块 token/占比、今日累计、今日缓存命中率；不改调用逻辑/预算护栏。

### 验收

- `status-test.mjs` **11/11**：产品版本、SW 与 sw.js 一致、schema、baseUrl 仅 host、无 key、预算/uptime/表情计数。
- `usage-breakdown-test.mjs` **6/6**：六项和=total、空 catalog=0、汇总、缓存率。
- `dom-smoke` **64/64**：终端显示产品/SW、运行详情、费用空状态。
- 一轮临时真回复：
  - `tokensIn=424`
  - `breakdown={stable:469,memory:0,posts:0,catalog:0,time:18,l1:13,total:500}`
  - 估算 total 比 tokensIn 高 **17.9%**，在 ±20% 内；catalog 0 因临时库为空。
  - 该轮 `promptCacheHit=256`、`promptCacheMiss=168`。
- `/api/status` 实测（脱敏）：`productVersion=0.2.40`、`swVersion=companion-v40-2026-11-05`、`schemaVersion=1`、`model=deepseek-flash`、`baseUrlHost=api.deepseek.com`。
- 回归：`meme-chat-test` 20/20、`meme-strategy-test` 16/16、`meme-test` 31/31、`reply-test` 16/16、P0 8/8、P1 7/7。

### 版本

- 产品 **0.2.40**；SW **v40**；schema **1**。

## 聊天三处体验 + 终端折叠 — 2026-11-05（v41）

仅前端改动；未改聊天、表情、记忆、预算服务端逻辑。表情目录 30→50 与新增 6 张入库仍推迟到 2a 观察期结束。

### 1. 加载更多只在顶部

- `updateLoadOlder()` 改为 `hasOlder && list.scrollTop <= 8`；
- 复用原有 `list` scroll 监听，同时更新加载更多与回到底部箭头；
- 原有 `renderAll({preserveScroll})` 位置保持逻辑未改。
- 实测：底部隐藏；顶部出现；无更早消息隐藏。
- 加载更早实测：`top=0, scrollHeight=12952` → 点击后 `top=12429, scrollHeight=25381`，原阅读位置保持（12429 = 新高度 - 旧高度），按钮因不再在顶部而隐藏。

### 2. 一键到底箭头

- 聊天页新增 `#jumpBottom`，悬浮在输入框上方；
- 显示条件 `!stickToBottom && distanceToBottom() > list.clientHeight`；
- 点击平滑滚动到底并隐藏；不新增 scroll 监听；
- 流式追加仍只由 `stickToBottom` 决定是否贴底，用户翻历史不抢位置。
- 实测：底部/顶部带按钮状态见截图；点击后 `top=12242, jump=false`。

### 3. 未读数字气泡

- `#tabChat` 新增 `#tabChatBadge`；localStorage `companion.read.v1` 存最后已读 `seq`；
- 只计 `role=assistant` 的消息，自己/系统不计；超过 99 显示 `99+`；
- 切回对话页（inbox/chat）写当前最大 seq 并清空；
- 为“在空间/控制台收到消息”补了**非对话页的常驻 SSE 订阅**：进入空间/控制台/联系人/资料页时启动，回对话页时关闭；收到消息仍走现有 `handleFrame`。
- 实测：空间页收到 18 条实际助手消息（mock 每次回复拆成多条）显示 18；点回对话后清空，`companion.read.v1` 写入当前 seq。
- 已知边界：PWA 关闭期间无 SSE；仅本机存储。

### 4. 终端折叠

- 终端首页只保留 API 与本地用量两张常驻卡片；余额收起；
- 新增目录行：表情包管理 / 记忆管理 / 备份与恢复 / 数据与存储 / 运行状态 / 高级维护，各带状态；
- 子页面用 hash：`#/terminal/memes` 等；返回 `#/terminal`；不新增主页面；
- 重内容延迟：表情网格只在表情子页面渲染，记忆图只在记忆子页面加载；目录只取计数；
- 关闭再打开终端保留当前 hash 子页面；
- 备份/数据/高级维护为只读概览，不新增恢复/删除操作。
- 实测：`#/terminal/memes` → API/usage/balance 均隐藏，meme 显示，返回目录恢复。

### 验收

- 移动视口截图保存在 `D:\Companion\v41-evidence\`：
  - `01-load-older-at-top.png`
  - `02-jump-bottom.png`
  - `03-chat-bottom-no-buttons.png`
  - `04-unread-badge.png`
  - `05-unread-cleared.png`
  - `06-terminal-directory.png`
  - `07-terminal-memes.png`
  - `08-terminal-cost.png`
  - `09-load-older-after.png`
- 说明：截图来自 Chrome 390×844 移动视口，不是实体手机录屏。
- `dom-smoke` **64/64**；`status-test` 11/11；`prompt-cache-test` 8/8；`l1-context-test` 7/7；`meme-chat-test` 20/20；`meme-strategy-test` 16/16；`usage-breakdown-test` 6/6；`reply-test` 16/16。
- 产品 **0.2.41**；SW **v41**；schema **1**。

## v42：键盘两件 + 未读/时间/终端收口 — 2026-11-05

### 1. 滚动聊天记录收起键盘

- `list` 上新增 `touchmove` / `wheel` 监听：只有 `document.activeElement === input` 时 `input.blur()`；
- 没有复用 scroll 监听，程序性滚动（追加消息、`scheduleScroll`）不触发；
- 实测：输入框聚焦 → wheel 后 `activeElement` 为空；随后重新聚焦 → 程序性改 `scrollTop`，焦点仍是 input。

### 2. 底部收键盘跳动

- 按 Tian 决定**本轮不改**，仅保留备忘；`fitViewport` / viewport meta 未动。

### 3. 一键到底箭头

- 改为输入框右上角圆形 V 按钮，`right:16px`、`bottom:calc(84px + safe-area)`，不再居中；
- 实测按钮矩形 `top=720 bottom=760 right=374`，输入框 `top=773.8`，`overlap=false`；
- 出现条件、点击滚到底、贴底隐藏逻辑未变。

### 4. 未读徽章

- tab 与会话行都改为红色数字；共用同一计数；
- 非列表页（空间/控制台/联系人/资料）tab 显示；消息列表页 tab 隐藏，由会话行显示，避免同一屏两个相同数字；
- 进入聊天页才写已读标记并同时清空；列表页保留未读，便于看到哪条会话未读；
- 实测：空间页 tab=`4`；切到消息列表 tab 隐藏、会话行=`4`；打开会话后两者 0，`companion.read.v1=6`。
- 后台 SSE 订阅继续使用；PWA 关闭期间仍无实时消息。

### 5. 裸时间戳外泄

- `app/lib/reply.mjs` 新增裸时间正则：
  - `[21:25]` / `[21:25:30]` 任意位置剥除；
  - 行首 `21:25` / `21:25:30` 剥除；
  - 行内 `嗯21:25好` 不误伤；
  - 保留 v41 已有点日期标签。
- 稳定前缀 `TIME_RULES` 增加“裸的 [21:25] 或行首 21:25”示例。
- `reply-test` **21/21**；截图中的旧 `[21:25]` 是修复前历史消息，不是新回复。

### 6. 终端置顶导航

- 终端首页顺序改为 **API → 本地用量 → 管理目录**；实测 API top=68、用量 top=428、目录 top=1151；
- 终端主页隐藏左上退出按钮，切换只靠底部 tab；tab 在控制台上方可见；
- 子页面复用左上角已有返回按钮（`consoleClose` 改为 `‹`，回到 `#/terminal`），删除 v41 额外 `terminalBack` 按钮；
- 实测主页 `closeHidden=true`、tabs 可见；表情子页 `closeHidden=false`，点击后回目录。

### 验收

- 截图：`D:\Companion\v42-evidence\`
  - `01-jump-v42.png`
  - `02-terminal-directory-v42.png`
  - `03-terminal-memes-v42.png`
  - `04-unread-tab-v42.png`
  - `05-inbox-row-v42.png`
- 说明：截图来自 Chrome 390×844 移动视口，不是实体手机录屏。
- 测试：`reply-test` 21/21、`prompt-cache-test` 8/8、`l1-context-test` 7/7、`status-test` 11/11、`dom-smoke` 64/64；其余回归同 v41。
- 未做：底部收键盘跳动、表情目录 30→50、新增 6 张入库。

### 版本

- 产品 **0.2.42**；SW **v42**；schema **1**。

## v43：Token 后三项 + 预算 ¥2 + 速度 + 按钮/徽章 — 2026-11-05

### 1. 预算 ¥2

- `BUDGET_YUAN` 默认 1 → 2，`DAILY_BUDGET_YUAN` 覆盖保留；
- 实测默认 `limitYuan=2`；设环境变量 `5` 时接口返回 `5`；终端上限显示 `¥2.00`。

### 2. P3 推理 token

- 真模型一轮：`tokensOut=208`，`reasoningTokens=122`，占比 **58.7%**；
- 已按规则把 `maxTokens` 上限从 800 收到 **500**（下限 256 不变）；
- `usage.jsonl` 新增 `reasoningTokens` 字段（有值才写）。

### 3. P4 Embedding 按需

- 关键词先检索；只有关键词无命中或明确回忆时才调用 `embedQuery`；
- 用本地假 embedding + 真模型路径实测三句：
  - 关键词命中且无回忆：「豆豆今天怎么样」→ **0** 次
  - 关键词无命中：「今天吃什么」→ **1** 次
  - 明确回忆：「你还记得豆豆吗」→ **2** 次
  - 旧逻辑 3 次；本轮 **2 次，省 33%**；
- 真实配置当前未启用 embedding，因此实际生产 `embedding_query` 仍为 0；逻辑在启用后才付费。
- `embedding-policy-test` 6/6。

### 4. P5 目录瘦身

- P2 实测：最近一轮 catalog 442 / 4805 = **9.2%**；今日 7,072 / 75,153 = **9.4%**（以接口实测为准）；
- 目录不是主要成本；砍 30% 仅省总 token 约 3%，且可能降低选图准确度；
- **本轮不执行目录瘦身**，只报告数据。

### 5. 跳转按钮

- 改为内联 SVG chevron；`display:flex` 居中；位置输入框右上角；
- 实测按钮 `top=720 bottom=760 left=334 right=374`，输入框 `top=773.8`，`overlap=false`；`align=center justify=center`。

### 6. 回复速度

- 终端 API 卡片新增「回复速度」：慢 1.5× / 正常 1× / 快 0.6×，写入 config；
- 实测 mock SSE 消息间隔：正常 **1706ms**、慢 **2289ms**、快 **1243ms**；
- 默认 normal 与改动前一致；只缩放句间停顿。

### 7. 红点数字居中

- `.tab-badge` / `.conversation-badge` 改为 flex 居中、`line-height:1`；
- 实测空间 tab=4、消息列表行=4；`display:flex align=center justify=center`；个位数/两位数/`99+` 同规则。

### 验收截图

`D:\Companion\v43-evidence\`
- `01-jump-svg.png`
- `02-terminal-speed-budget.png`
- `03-unread-tab.png`
- `04-inbox-row.png`

说明：Chrome 390×844 移动视口，不是实体手机录屏。

### 测试

- `reply-test` 23/23、`embedding-policy-test` 6/6、`status-test` 12/12、`dom-smoke` 66/66；
- `prompt-cache-test` 8/8、`l1-context-test` 7/7、`meme-chat-test` 20/20、`meme-strategy-test` 16/16、`usage-breakdown-test` 6/6、`meme-test` 31/31、`v1-integration` 通过。

### 版本

- 产品 **0.2.43**；SW **v43**；schema **1**。
- 未做：目录 30→50、2b、V3、记忆/表情逻辑改动。

## v44：PWA 推送 + 天气/日期 + 软提示 + 速度归位 — 2026-11-06

2a 观察期按 Tian 决定结束；本版不动目录扩容/输入等待/2B。

### 1. PWA Web Push

- 新 `app/lib/push.mjs`：VAPID JWT ES256 + RFC8291 aes128gcm，只用 Node crypto/fetch。
- 私钥 `secret.json.vapidPrivateKey`，公钥 `config.json.vapidPublicKey`；默认推送关闭。
- 新接口：`GET /api/push/status`、`GET /api/push/vapid-public-key`、`POST /api/push/vapid`、`POST /api/push/subscribe`、`POST /api/push/unsubscribe`、`POST /api/push/test`。
- 订阅 `app/data/push-subscriptions.jsonl`，按 endpoint 去重；410/404 删除。
- `streamReply` 完成后推送标题 Anam + 正文 100 字；SW 前台可见时不弹，点击聚焦/打开 `/`。
- 终端「运行状态」子页面：生成密钥、开关、测试；默认未配置。
- 测试：`push-test` 6/6（JWT/加密往返）、`push-api-test` 6/6（私钥不回传/去重/开关）。
- 未做：物理手机锁屏推送验收（无实体机）。

### 2. 天气

- 新 `app/lib/weather.mjs`；Open-Meteo + geocoding，无 Key。
- 城市/经纬度存 `config.json`；缓存 `app/data/weather.json`；启动/每小时刷新；失败保留旧缓存。
- 终端「数据与存储」子页面配置城市；留空不注入。
- prompt 尾巴在签名之后、日期之前；不超过 60 字；约 40 token。
- 新接口：`GET /api/weather/status`、`POST /api/weather/city`、`POST /api/weather/refresh`。
- 测试：`weather-test` 7/7。

### 3. 日期

- 新 `app/lib/calendar.mjs`：2026–2027 主要假日 + 24 节气；零网络。
- 一行：星期 + 节日/节气 + 临近假日倒数；在天气之后、现在时间之前。
- prompt 顺序测试 9/9。

### 4. 表情软提示

- `memeSoftFrequencyBlock` 仅在软提示开启时增加：
  - “近期连续几条回复都没有配图，且当前有合适选择时，优先配 1 张。”
  - “遇到玩笑、鼓励、庆祝、共情或轻松接话，有贴切的表情就可以配图。”
- 概率/间隔/最多 1 张/优先级不变；`meme-strategy-test` 18/18。

### 5. 终端规则 + 速度归位

- 推送进「运行状态」子页面，城市进「数据与存储」子页面；终端主页仍只有 API + 消费。
- 回复速度从终端 API 卡片移到 **AI 资料页**；接口/三档倍率/默认值不变。
- 实测：ApiSection 内无 speed，`#aiProfileView` 内有 speed；当前配置 `slow`（用户已有设置）。

### 测试

- `dom-smoke` 66/66、`status-test` 12/12、`reply-test` 23/23、`l1-context-test` 7/7、`meme-chat-test` 20/20、`usage-breakdown-test` 6/6、`meme-test` 31/31、`v1-integration` 通过。
- 产品 **0.2.44**；SW **companion-v44-2026-11-06**；schema **1**。
### v44-p1 推送补丁 — 2026-11-06

- 真实现象：`sent:0`、Apple 返回 403 `{"reason":"BadJwtToken"}`；网络/订阅均正常。
- 根因：VAPID subject 为 `mailto:anam@localhost`，Apple 拒绝；改为 `mailto:anam@example.com` 后同一订阅 201。
- `sendPush` 加 `AbortSignal.timeout(10000)`；超时/网络错误具名。
- `sendPushToAll` 返回每条订阅 `status/error`，记录 Apple 响应正文；测试接口不再静默。
- `pushStatusPayload` 增加 `keyMatch`；真实密钥对匹配 true；不匹配时可强制重新生成并清空旧订阅。
- `ui.js` toast 1200→3000ms；测试失败显示真实 status/error。
- 真实测试：`{"ok":true,"sent":1,"results":[{"status":201}],...}`。
- SW：`companion-v44-2026-11-06-p1`。
- `push-api` 7/7（新增 keyMatch）。
## v45：Phase 2b 起步 + 表情优化 — 2026-11-06

### 已完成

- 手动发表情：输入栏 ☺ 打开表情库；存在即可发，不看 AI reviewed/enabled；`POST /api/stickers/send`，用户 sticker 消息，SSE message，历史正确渲染。
- 照片基础：输入栏 ▧；客户端 canvas JPEG 长边 2048；`POST /api/photos` 校验 PNG/JPEG/WebP 魔数/尺寸/大小，`app/data/photos/` + `photos.jsonl`；`image` 消息、`photo:` 引用、手动 caption；`GET /api/photos/:id` 鉴权读取；照片进备份；终端数据页显示张数/MB；L1 `[图片：caption]`/`[图片]`。
- 表情教学示例：soft 开启时加入纯文字/文字+表情/只发表情三种范式；门控不变。
- 目录上限 30→50；UI 计数同步。
- 版本 0.2.45 / SW v45 / schema 1。

### 未完成 / 已知缺口

- AI 自动 caption 未做；当前 caption 由用户输入。
- 发送前预览/撤销、列表缩略图、首字“正在看图”等待、发送令牌去重、删消息删文件、终端 caption 编辑未做。
- 6 张新表情未导入：候选源均超 1.5MB 或配额不足；当前仍 44 张。
- 手动表情/照片不触发 AI 回复。
- 19 条注意未逐条全部实现。

### 测试

- meme-strategy 19/19；meme-test 31/31；meme-chat 20/20；dom-smoke 66/66；status 12/12；push-api 7/7；weather 7/7。
- 照片接口隔离测试：上传 201、读取 200、统计 1 张/68 B。
- 手动表情真实 UI：选择器 44 项，发送后历史出现 1 条用户 sticker。
## v46：推送标题 + 表情/照片触发回话 + 图标 — 2026-11-06

- 推送标题：`notifyReply` 与 `/api/push/test` 均取 `loadProfile().name`，空回退 Anam；实测返回 `title:"Ds鱼🐟"`。
- 表情/照片触发：新增 `POST /api/chat/respond`；只接受 user sticker/image；已有 assistant 回复返回 409，进行中返回 409；客户端发送后调用一次 `readSse`。
- 表情上下文：手动 sticker 带 `media.tags`，L1 使用 `[表情] label（tags）`；照片用 caption。
- 图标：`stickerBtn`/`photoBtn` 改内联 Lucide SVG（sticker/image），`stroke=currentColor`，尺寸 22px，按钮 40px 不变。
- 版本 0.2.46 / SW v46 / schema 1。
- 测试：status 12/12、dom 66/66、meme-strategy 19/19、meme-test 31/31、push-api 7/7、隔离 smoke 41/41。
- 真实验证：测试推送 `sent=1,title=Ds鱼🐟`；表情发送后 AI 回复 3 个分段（一次生成），第二次 `/api/chat/respond` 返回 409。

## 6 张扩库导入 — 2026-11-06

- 备份：`backups/pre-neko-2026-11-06/`（89 文件）。
- 主选 5 张成功：敲黑板、揉脸、娃娃机、自动画画、小猫懵逼。
- 「花花」主选下载后未通过校验，按手册用备选「催眠2」；6 张均 `reviewed:false, enabled:false`。
- 当前库 50 张；目录仍 44/50，等 Tian 在终端审核 6 张后进目录。
- 未生成 6 张预览图；终端会回退原图。



