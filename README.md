# Companion — 使用说明

> 只属于你的私密 AI 伴侣。决策以 `DECISIONS.md` 为准；`roadmap.md` 是历史，不要照着做。
> 当前版本：产品 **0.2.41**（0 = 未公开发布，2 = V2，41 = 本阶段第 41 次改版）；V1「有过去」已完成（2026-11-03）；V2「表情包」Phase 1（库/审核/取图/备份）与 Phase 2A（AI 选图发送）已完成；v41 完成聊天页加载更多/回到底部/未读徽章与终端目录化；Phase 2B（你手动发表情/图片）待批准。插件能力按原生功能分阶段转化，不连接 AstrBot 或 QQ。

---

## 1. 启动方式

**只有一个入口：双击 `app\start.cmd`。**

- 它会自动判断：`app\data\secret.json` 里有 key 就用真模型，没有就用 mock（不花钱），并在窗口里打印电脑和手机两个地址。
- 服务运行后也可从底部“控制台”录入/替换 key；保存后会自动切换 mock/live，不用重启。环境变量 `DEEPSEEK_API_KEY` 优先级更高。
- 绑定 `0.0.0.0`，所以电脑用 `http://127.0.0.1:8787`、手机用 `http://192.168.x.x:8787`，是**同一个服务**。
- 强制 mock（不花钱试玩）：`powershell -ExecutionPolicy Bypass -File D:\Companion\run.ps1 -Mock`
- 换端口 / 只绑本机：`run.ps1 -Port 9000`、`run.ps1 -Bind 127.0.0.1`

- **关掉那个窗口 = 停止服务**；重启后历史还在。
- 第一次在每台设备上打开会要求输入**访问口令**，之后存在浏览器 localStorage 里，不用再输。
  口令在 `app\data\secret.json` 的 `accessPassword` 字段；改口令后需要重新输入（或清掉站点数据）。

## 1.5 HTTPS（Tailscale，手机主屏用这个）

手机主屏请用 **<https://<your-tailnet-host>>**（tailnet 内地址，只对登录了同一 Tailscale 账号的设备可见）。

- 电脑：Tailscale 服务常驻，`tailscale serve --bg 8787` 把本地 8787 映射成上面这个 HTTPS 地址；重启后配置仍在。
- 手机：先连上 Tailscale，再用上面的地址打开 → 重新"添加到主屏幕"（旧的 `http://192.168...` 图标删掉）。
- 好处：证书是公网信任的，Safari 不再报"不安全"，Service Worker 才能注册。
- 如果手机没开 Tailscale，这个地址打不开；在家也可以继续用 `http://<your-lan-ip>:8787`（但没有 Service Worker）。

**改了 tailnet 机器名或换账号**时，HTTPS 地址会变，需要同步改这里和手机主屏图标。

### 缓存 / Service Worker

- `sw.js` 只在**安全上下文**（https 或 localhost）注册；http 局域网地址不会注册。更新 worker 接管页面后会自动重载一次，避免 HTML/CSS/JS 混用版本。
- 它预缓存应用外壳（index.html / css / js / 图标 / manifest），**API 一律不缓存**，断网时至少能打开壳。
- 前端有改动时，要把 `app/public/sw.js` 里的 `VERSION` 加一；否则手机会先用旧缓存，再在后台更新（通常下次打开才生效）。
- 手机上如果觉得界面是旧的：把 PWA 完全关掉再开一次（必要时开两次）。

## 2. 开机自启

已放好：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Companion.lnk`
（Win+R → `shell:startup` 能看到它）。

- 登录 Windows 后自动启动（和 `start.cmd` 行为一致：有 key 真模型、无 key 自动 mock），窗口最小化在任务栏，关掉它即停止。
- 想暂停自启：把那个快捷方式剪切到别处；想恢复就放回去。
- 没有用计划任务，不需要管理员权限。

## 3. Node 路径怎么找

`run.ps1`（以及调用它的 `start.cmd`）按这个顺序找 node，找到第一个就用：

1. 系统 `PATH` 里的 `node`；
2. 项目自带：`D:\Companion\.runtime\node-*\node.exe`（当前 v26.13.0）；
3. DSH 自带：`%USERPROFILE%\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe`。

所以**不装 Node 也能跑**。想在自己终端里直接用 `node`：

```powershell
winget install --scope user OpenJS.NodeJS.LTS
```

（本机 winget 目前起不来，可以去 <https://nodejs.org> 下 LTS 安装包。装好后上面的第 1 条就会优先用它。）

## 4. 数据在哪

| 路径 | 内容 |
|---|---|
| `app\data\messages.jsonl` | 一行一条消息：含 schema、序号、幂等 id、AI 身份 ID、角色、文本、类型与 UTC 时间 |
| `app\data\usage.jsonl` | 一行一次模型调用：token、金额、日期、模型 |
| `app\data\facts.jsonl` | L2 基础事实记忆；只从用户明确陈述抽取，并保留来源消息 id/序号 |
| `app\data\summaries.jsonl` | 每 20 轮的 L3 摘要、来源消息与可验证关系 |
| `app\data\memory-overrides.jsonl` | 记忆删除记录，防止重启回填时复活 |
| `app\data\memory-vectors.jsonl` | 可选 Embedding 索引；不含 API Key |
| `app\data\space.jsonl` | 私有空间动态与评论 |
| `app\data\emotion.jsonl` | AI 自身情绪状态历史 |
| `app\data\memes.jsonl` | 表情包元数据：名称、标签、审核/启用/置顶、尺寸、hash |
| `app\data\memes\` | 表情原图与 `previews\` 派生 240px 预览；只经带口令的接口读取，不放公开静态目录 |
| `app\data\provider-balance.json` | DeepSeek 最近一次成功查询的账户余额与更新时间，不含 API key |
| `app\data\secret.json` | API key + 访问口令（**别外发**） |
| `app\data\config.json` | AI 个性资料与本机昵称/头像（两套资料相互独立） |
| `backups\YYYY-MM-DD\` | 自动备份（见下） |

全部 UTF-8、无 BOM、记事本可直接打开。

## 5. 备份与恢复

**自动备份**：服务启动时、以及之后每小时检查一次；当天只做一次。
把消息、用量、事实、摘要、记忆覆盖记录、向量索引、空间、情绪、表情包 JSONL 和 `memes\` 图片目录复制到 `D:\Companion\backups\2026-10-29\` 这样的日期目录，**保留最近 7 天**，更早的自动删除。

> `secret.json` **不在**备份里——避免 key 被复制到多处。换机器时单独拷。

**恢复**：

1. 关掉服务（关窗口）；
2. 把备份目录中的 JSONL 数据文件和 `memes\` 目录复制回 `app\data\`（覆盖；旧备份缺少的 V1 文件会在使用时重新生成）；
3. 重新启动。历史、花费和表情都会回来。表情包备份可用 `app\tools\meme-test.mjs` 的恢复校验逻辑核对记录、文件和消息引用。

**手动备份**：直接复制整个 `app\data`（要连 key 一起带走就复制 `secret.json`；不带也能恢复聊天记录，只是要重新填 key）。

## 6. 换机器

1. 新电脑装 Node LTS（或者把 `.runtime` 一起拷过去）；
2. 复制整个 `D:\Companion`，**可以不拷** `.runtime`（大且可重建）和 `backups`（按需）；
3. 把 `app\data\secret.json` 单独拷过去（key + 口令）；
4. 在新机器上重新放一次开机自启快捷方式（第 2 节）；
5. 启动后手机重新访问新的局域网 IP。

## 7. 手机访问 / 口令 / 防火墙

- 手机和电脑要在**同一个 WiFi**；服务默认绑 `0.0.0.0`，手机用 `http://<电脑局域网IP>:8787`。
- 电脑 IP 会变：`ipconfig` 看「IPv4 地址」，或在启动窗口里看它打印的那行。
- 页面本身和图标是公开的，**所有 `/api/*` 都校验口令**（聊天、历史、SSE 都在内）；连续输错 20 次会锁 10 分钟。
- 口令走的是 HTTP 明文，只防"同网段误连/蹭网"，不是加密。真要防窃听，得上 HTTPS 或 Tailscale（V2）。
- 防火墙（**需要管理员**，目前 8787 没被拦，所以可选）：

```powershell
netsh advfirewall firewall add rule name="Companion 8787" dir=in action=allow protocol=TCP localport=8787 profile=private
```

删除：

```powershell
netsh advfirewall firewall delete rule name="Companion 8787"
```

## 8. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 手机打不开 | 服务窗口是否开着；手机和电脑是否同一 WiFi；IP 是否变了 |
| 手机能开但发不出去 | 刷新页面；页面现在会显示红字错误，把红字发出来 |
| 回复是"V0 阶段的模拟回复" | 当前是 mock 模式；在控制台确认/保存 API Key，或检查 `secret.json` 后重启 `start.cmd` |
| 提示口令不对 / 401 | 改过 `accessPassword`；重新输一次，或清站点数据后重输 |
| 提示今天的额度用完了 | 弹窗可选「今天继续」（当天不再拦截，花费继续累计）；控制台可「恢复今日限额」；明天 0 点自动恢复 |
| 端口被占用 | 已经有一个实例在跑，先关掉旧窗口 |
| 电脑睡眠后手机连不上 | 睡眠会断服务，唤醒后恢复（没做常驻守护） |
| 备份目录是空的 | 当天还没到备份点，或数据目录不是默认的 `app\data` |

## 9. 测试

```powershell
cd D:\Companion\app
node smoke.mjs            # 冒烟测试，只对 mock 模式有效
node smoke-budget.mjs     # 预算拦截，需要一台额度极小的临时实例（见文件头）
node tools\dom-smoke.mjs  # 前端、API 设置、控制台与后续功能禁用预览
node tools\memory-test.mjs # L2 回填/注入、余额失败缓存、连接测试记账
node tools\v1-unit.mjs # V1 检索、情绪惯性、元数据隐私、来源校验
node tools\v1-integration.mjs # V1 mock API、20 轮摘要、空间、五条上限、持久化
node tools\meme-test.mjs # V2 Phase 1：上传/尺寸/审核/目录/取图/删除引用/备份恢复
node tools\meme-browser-test.mjs # V2：2000px→768、240px 预览、透明（需要 Chrome；沙箱内先启动 Chrome 并设 CHROME_DEBUG_PORT=9233）
node tools\meme-chat-test.mjs # V2 Phase 2A：目录注入、AI 选图、无效 id、频率门、总开关
node tools\meme-strategy-test.mjs # 发送策略：0/100/25 骰子、间隔、软提示
node tools\prompt-cache-test.mjs # P0：稳定前缀不随记忆/时间/目录变化
node tools\l1-context-test.mjs # P1：L1 3000 token 预算与最新一轮保底
node tools\status-test.mjs # v40：/api/status 三版本号与脱敏
node tools\usage-breakdown-test.mjs # P2：费用拆解六项/汇总/缓存率
```

真模型实测脚本：`tools\live-20.mjs`、`tools\live-extra.mjs`（会花钱）。
L2 真模型验收：`node tools\live-memory-test.mjs --confirm-cost`（会产生少量费用；复制当天用量账本到临时目录以执行预算检查，成功调用会将费用记录回 `app\data\usage.jsonl`，预算已满时自动跳过）。

## 10. 当前功能与后续版本

APP 导航为底部“对话 / AI 联系人 / 空间 / 控制台”。对话首页显示本机私密资料与 Anam 对话摘要；点击进入唯一长对话。聊天右上角三横线与 AI 联系人条目进入同一份 AI 资料；个性签名显示在聊天标题的状态行、资料页和空间。头像进入的本机资料与 AI 资料分开保存。当前只启用固定身份 `anam`，不创建额外 AI 或聊天。每日预算只在控制台显示；聊天页不再常驻显示金额，超额时通过错误提示告知。

V1 保留 L1 最近 30 轮（同时受 3000 token 预算约束）和 L2 原话事实；每 20 轮整理有来源引用的 L3 摘要；本地关键词检索始终可用，也可配置单独的 Embedding 接口做语义召回。控制台可查看、搜索、修订和删除记忆。

私有空间支持用户与 AI 动态、评论、AI 情绪曲线和个性签名。你发动态后，她会在后台留一条评论（受预算约束，每帖最多一条）；最近两条动态会进入聊天上下文，方便她自然接话。控制台「长期记忆」默认只显示一个记忆图和「查看对话摘要」按钮；搜索、编辑、语义检索收在折叠的「记忆管理」里。摘要页可整页查看时间范围、claim 与原文证据，低置信度摘要会标注。AI 的情绪/签名随聊天请求更新，不另发模型请求；AI 动态需通过隐私过滤、带聊天来源且每日最多 5 条。

V2 Phase 1 把表情包库建在控制台「表情包」：上传、名称/标签、审核/启用/置顶、删除确认、100 张/1.5MB/静态长边 768 的边界；图片只能经带口令的接口读取。AI 资料页有入口卡和唯一总开关「允许她发表情」；控制台只读显示开关状态。

Phase 2A 已把合格目录注入聊天 prompt：她可以在 `<anam-meta>` 里选一张，服务端按本次请求的快照校验；无效 id 直接剥掉，不重新生成；最近两条 AI 回复里已有表情时会跳过，保证两次表情之间至少隔两条文字。表情作为独立消息追加在文字之后，聊天页无气泡底色、最长边约 160px，失败显示 `[表情] 名字`，inbox 显示 `[表情]`。你手动发表情和图片属于 Phase 2B，尚未开始；对话输入栏仍没有新增按钮。

表情图加载走派生预览：上传时生成 240px 预览（GIF 选信息量最大的非空帧，不取全透明首帧），网格只拉 `previews/`，聊天先显示预览、随后**一律**后台拉原图，成功才原地替换（失败继续显示预览，盒子尺寸锁定不跳位）；预览 Blob 存在 IndexedDB，飞行模式冷启动也能显示。加载中显示骨架、失败才显示 `[表情] 名字`，三种状态分开。首批共 44 张，已全部审核启用；目录 30、等待 14。

终端「表情包」新增「发送策略」：发送概率 0–100%、两次表情至少间隔 0–5 条 AI 完整回复、软频率提示开关（每约 4 条回复 1 张），每条回复最多 1 张固定。概率门在构建 prompt 前判定，未通过不注入目录；间隔按完整 AI 回复组计算；空间回应不掷骰、不注入目录、不计入间隔和统计。总开关仍只在 AI 资料页，终端只读显示状态。

- Embedding 可选；未配置、失败或预算不足时回退本地关键词检索。Key 只保存在 PC 服务端。
- 测试模型按钮会发送一条很短的真实请求并计入本地预算；余额刷新只调用 DeepSeek 余额接口。
- 插件转化路线：V1 记忆与空间；V2 本地表情包库（Phase 1 已完成）与 AI 语境选择（Phase 2A 已完成）；Phase 2B 你手动发表情/图片待批准；V3 主动对话与免打扰控制；V4+ 多 AI 与职责分工。全程不连接 AstrBot/QQ。

## 11. 表情包来源

当前表情库包含「大肥鱼」单人包的一部分，作者 **可以叫我云大人**（B 站 space.bilibili.com/103739），经 kiriyuki.com 发布，许可 **CC BY-NC 4.0**；仅个人非商业使用，图片只保存在本机。详见 [CREDITS.md](CREDITS.md)。「大肥鱼和GPT娘」双人包未导入。

