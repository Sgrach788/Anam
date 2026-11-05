// 前端回归：最小 DOM 垫片 + 真实前端模块（api.js + ui.js），自己起一个 mock 服务。
// 覆盖：历史渲染、时间轴分隔、人格面板、复制、发送、失败重试、正在输入。
// 用法：node app/tools/dom-smoke.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCT_VERSION } from '../lib/version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8907;
const BASE = `http://127.0.0.1:${PORT}`;
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'ui.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 造数据并起服务 ----------
const DATA = path.join(os.tmpdir(), `companion-dom-${Date.now()}`);
fs.mkdirSync(DATA, { recursive: true });

const at = (dayOffset, h, m) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const atMinutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();
const seed = [
  { v: 1, seq: 1, id: crypto.randomUUID(), role: 'user', text: '昨晚的消息。', at: at(-1, 22, 0) },
  { v: 1, seq: 2, id: crypto.randomUUID(), role: 'assistant', text: '昨晚的回复。', at: at(-1, 22, 1) },
  { v: 1, seq: 3, id: crypto.randomUUID(), role: 'user', text: '刚才的消息。', at: atMinutesFromNow(-20) },
  { v: 1, seq: 4, id: crypto.randomUUID(), role: 'assistant', text: '刚才的回复。', at: atMinutesFromNow(-19) },
  { v: 1, seq: 5, id: crypto.randomUUID(), role: 'user', text: '九分钟前的消息。', at: atMinutesFromNow(-9) },
];
fs.writeFileSync(path.join(DATA, 'messages.jsonl'), seed.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(DATA, 'usage.jsonl'), '', 'utf8');

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', MOCK_MODEL: '', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '' },
  stdio: 'ignore',
});

let up = false;
for (let i = 0; i < 40 && !up; i++) {
  try {
    const r = await fetch(`${BASE}/api/health`);
    up = r.ok;
  } catch { /* 还没起来 */ }
  if (!up) await sleep(150);
}

// ---------- 最小 DOM ----------
class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this._text = '';
    this._classes = new Set();
    this.dataset = {};
    this.style = {};
    this._handlers = {};
    this.scrollTop = 0;
    this.scrollHeight = 1000;
    this.clientHeight = 600;
    const self = this;
    this.classList = {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classes.has(c) : Boolean(force);
        if (on) self._classes.add(c); else self._classes.delete(c);
        return on;
      },
      contains: (c) => self._classes.has(c),
    };
  }

  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v || '').split(/\s+/).filter(Boolean)); }

  get textContent() { return this._text; }
  set textContent(v) {
    this._text = String(v ?? '');
    if (this._text === '') this.children = [];
  }

  appendChild(node) {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  insertBefore(node, before) {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((n) => n !== this);
      this.parentNode = null;
    }
  }

  addEventListener(type, fn) { (this._handlers[type] ||= []).push(fn); }

  trigger(type, ev = {}) {
    for (const fn of this._handlers[type] || []) fn({ preventDefault() {}, ...ev });
  }

  setAttribute() {}
  focus() {}
  querySelector(selector) { return selector === 'button[type="submit"]' ? this.children.find((child) => child.tagName === 'button' && child.type === 'submit') || null : null; }

  closest(sel) {
    let node = this;
    while (node) {
      if (sel.startsWith('.') && node.classList.contains(sel.slice(1))) return node;
      node = node.parentNode;
    }
    return null;
  }
}

const byId = new Map();
const ids = [
  'app', 'list', 'loadOlder', 'jumpBottom', 'input', 'send', 'statusDot', 'statusText', 'budgetText', 'budgetDialog', 'budgetDialogText', 'budgetCancel', 'budgetContinue', 'budgetResetBtn', 'lock', 'lockInput', 'lockBtn', 'lockErr',
  'toast', 'composer', 'copybar', 'copyBtn', 'settingsBtn', 'sidebar', 'sideClose', 'sideMask',
  'consoleOpen', 'consolePanel', 'consoleClose', 'consoleCloseIcon', 'apiKeyInput', 'apiSaveBtn', 'apiClearBtn', 'apiTestBtn', 'apiSettingsMsg',
  'apiModeBadge', 'apiModel', 'apiKeyState', 'apiHost', 'balanceRefresh', 'balanceValue', 'balanceStatus',
  'usageDay', 'usageSpend', 'usageTokens', 'usageCalls', 'usageLimit', 'usageBar', 'usageNote', 'usageBreakdown', 'statusVersionLine', 'statusUpdateHint', 'statusUpdateBtn', 'statusDetails',
  'terminalDirectory', 'terminalBack', 'apiSection', 'usageSection', 'balanceSection', 'statusSection', 'memorySection', 'backupSection', 'dataSection', 'advancedSection', 'futureSection',
  'rowMemes', 'rowMemory', 'rowBackup', 'rowData', 'rowStatus', 'rowAdvanced', 'backupInfo', 'dataInfo', 'advancedInfo',
  'previewV1', 'previewV2', 'previewV3', 'previewV4',
  'previewList', 'previewBtn',
  'appName', 'headerAvatar', 'avatarPreview', 'pAvatarFile', 'avatarClear', 'pAiName', 'pCallUser', 'pSignature',
  'profileBasics', 'profilePageBasics', 'profileScroll',
  'personaEdit', 'personaPanel', 'panelTitle', 'panelClose', 'panelCloseIcon', 'panelCancel', 'panelDone', 'panelMsg',
  'discardConfirm', 'discardKeep', 'discardApply',
  'ppPersona', 'ppTone', 'ppInitiative', 'ppBoundaries',
  'aiSignature', 'spaceView', 'tabs', 'tabChat', 'tabChatBadge', 'tabSpace', 'spacePostToggle', 'spaceComposer', 'spaceInput', 'spaceCancel', 'spacePosts', 'spaceEmpty', 'spaceSignature', 'emotionChart', 'emotionCaption',
  'inboxView', 'chatView', 'contactsView', 'aiProfileView', 'userProfileView', 'tabContacts', 'tabConsole', 'conversationCard', 'conversationSearch', 'inboxAiName', 'inboxAiAvatar', 'inboxPreview', 'inboxTime', 'userAvatar', 'userName', 'userProfileOpen', 'userProfileBack', 'userAvatarPreview', 'userAvatarFile', 'userNameInput', 'userProfileSave', 'aiProfileOpen', 'aiProfileBack', 'chatBack', 'contactAnam', 'addAiPreview', 'infoPersona', 'infoTone', 'infoInitiative', 'infoBoundaries', 'profileAiAvatar', 'profileAiName', 'profileAiSignature',
  'embeddingBaseInput', 'embeddingModelInput', 'embeddingKeyInput', 'embeddingPriceInput', 'embeddingSaveBtn', 'embeddingClearBtn', 'embeddingTestBtn', 'embeddingMsg', 'memoryIndexBtn', 'memorySummarizeBtn', 'memoryStats', 'memorySearchForm', 'memorySearchInput', 'memoryGraph', 'memoryResults', 'summaryOpenBtn', 'summaryPanel', 'summaryBack', 'summaryList',
  'memeCounts', 'memeState', 'memeFile', 'memeMsg', 'memeGrid', 'memeEmpty', 'memeEntry', 'memeEntryCounts', 'memeEnabledToggle', 'memeDeleteDialog', 'memeDeleteText', 'memeDeleteCancel', 'memeDeleteConfirm', 'memeSection',
  'memeProbability', 'memeProbabilityValue', 'memeMinGap', 'memeSoftFrequency', 'memeStrategyMsg', 'memeStrategyStats',
];
for (const id of ids) byId.set(id, new FakeEl('div'));
const spaceSubmit = new FakeEl('button'); spaceSubmit.type = 'submit'; byId.get('spaceComposer').appendChild(spaceSubmit);
const settingsBody = new FakeEl('div');
for (const id of ['profileBasics', 'consoleOpen', 'personaEdit']) {
  const node = byId.get(id);
  node.parentNode = settingsBody;
  settingsBody.children.push(node);
}
byId.get('copybar').hidden = true;
byId.get('sideMask').hidden = true;
byId.get('personaPanel').hidden = true;
byId.get('summaryPanel').hidden = true;
byId.get('budgetDialog').hidden = true;
byId.get('memeDeleteDialog').hidden = true;
for (const id of ['previewV1', 'previewV2', 'previewV3', 'previewV4']) byId.get(id).disabled = true;

const document = {
  getElementById: (id) => byId.get(id) || null,
  querySelectorAll: () => [],
  createElement: (tag) => new FakeEl(tag),
  createElementNS: (_ns, tag) => new FakeEl(tag),
  createTextNode: (text) => { const node = new FakeEl('#text'); node.textContent = text; return node; },
  body: new FakeEl('body'),
  documentElement: { style: { setProperty() {} } },
  execCommand: () => false,
};

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const realFetch = globalThis.fetch;
let failChat = false;
const fetchShim = (url, opts) => {
  const u = String(url);
  if (failChat && u.includes('/api/chat')) return Promise.reject(new Error('network down'));
  if (u.includes('/api/provider/balance')) {
    return Promise.resolve(new Response(JSON.stringify({ ok: false, available: false, balanceInfos: [], updatedAt: null, stale: false, error: '尚未配置 API key' }), { status: 200, headers: { 'content-type': 'application/json' } }));
  }
  return realFetch(u.startsWith('/') ? BASE + u : u, opts);
};

let raf = 0;
globalThis.document = document;
globalThis.window = globalThis;
globalThis.localStorage = localStorage;
globalThis.fetch = fetchShim;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => { raf++; fn(); }, 0);
globalThis.window.addEventListener = () => {};
let mobileMode = false;
globalThis.window.matchMedia = () => ({ matches: mobileMode });
globalThis.confirm = () => true;
globalThis.isSecureContext = true;
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
});

// ---------- 断言 ----------
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const list = byId.get('list');
const msgs = () => list.children.filter((n) => n.classList.contains('msg'));
const seps = () => list.children.filter((n) => n.classList.contains('sep'));
const meCount = () => msgs().filter((n) => n.classList.contains('me')).length;
const aiCount = () => msgs().filter((n) => n.classList.contains('ai')).length;

await import(pathToFileURL(path.join(__dirname, '..', 'public', 'ui.js')).href);
await sleep(1200);

// 1) 启动渲染 + 时间轴
check('启动后渲染了 5 条历史消息', msgs().length === 5, `n=${msgs().length}`);
const daySeps = seps().filter((s) => s.classList.contains('day'));
const timeSeps = seps().filter((s) => s.classList.contains('time'));
check('跨天分隔：昨天 / 今天', daySeps.length === 2 && daySeps.map((s) => s.textContent).join(',') === '昨天,今天');
check('同一天 1 分钟内不显示时间', timeSeps.length === 1, `time separators=${timeSeps.length}`);
const expectedTime = `${String(new Date(seed[4].at).getHours()).padStart(2, '0')}:${String(new Date(seed[4].at).getMinutes()).padStart(2, '0')}`;
check('同一天超过 5 分钟显示本地时刻', timeSeps.length === 1 && timeSeps[0].textContent === expectedTime, timeSeps.map((s) => s.textContent).join(','));
check('气泡里不显示时间', msgs().every((n) => !/^\d{1,2}:\d{2}$/.test(n.textContent) && !n.textContent.includes('今天')), 'ok');
check('状态行显示在线', byId.get('statusText').textContent.includes('在线'), byId.get('statusText').textContent);

// 2) 主页面、资料页与控制台 Tab
byId.get('conversationCard').trigger('click');
check('进入聊天时聊天视图已显示', byId.get('chatView').hidden === false);
check('聊天输入框和发送键没有被隐藏', byId.get('composer').hidden !== true && byId.get('input').hidden !== true && byId.get('send').hidden !== true);
byId.get('input').value = '保留的草稿';
byId.get('list').scrollTop = 321;
byId.get('aiProfileOpen').trigger('click');
await sleep(100);
check('聊天菜单打开 AI 资料页', byId.get('aiProfileView').hidden === false && byId.get('tabs').hidden === true);
check('AI 资料页有表情包入口', byId.get('memeEntryCounts').textContent.includes('共'));
byId.get('memeEnabledToggle').checked = false;
byId.get('memeEnabledToggle').trigger('change');
await sleep(350);
check('总开关可关闭', (await (await fetch(`${BASE}/api/memes`)).json()).enabled === false);
byId.get('memeEnabledToggle').checked = true;
byId.get('memeEnabledToggle').trigger('change');
await sleep(350);
check('总开关可恢复', (await (await fetch(`${BASE}/api/memes`)).json()).enabled === true);
byId.get('personaEdit').trigger('click');
await sleep(100);
check('资料页可进入个性编辑', byId.get('personaPanel').hidden === false);
byId.get('ppTone').value = '说话极简，不超过十个字';
byId.get('ppPersona').value = '像一个话不多但一直在的人';
byId.get('panelDone').trigger('click');
await sleep(400);
const savedProfile = await (await fetch(BASE + '/api/profile')).json();
check('个性字段保存到 AI 资料', savedProfile.profile.tone === '说话极简，不超过十个字' && savedProfile.profile.persona === '像一个话不多但一直在的人');
byId.get('panelClose').trigger('click');
check('个性编辑返回 AI 资料页', byId.get('personaPanel').hidden === true && byId.get('aiProfileView').hidden === false);
byId.get('aiProfileBack').trigger('click');
check('资料页返回聊天且草稿和滚动保留', byId.get('chatView').hidden === false && byId.get('input').value === '保留的草稿' && byId.get('list').scrollTop === 321);
byId.get('chatBack').trigger('click');
byId.get('conversationCard').trigger('click');
check('离开后再次打开聊天输入栏仍显示', byId.get('chatView').hidden === false && byId.get('composer').hidden !== true && byId.get('input').value === '保留的草稿');
byId.get('chatBack').trigger('click');
byId.get('tabContacts').trigger('click');
byId.get('contactAnam').trigger('click');
check('联系人入口打开同一份 AI 资料', byId.get('aiProfileView').hidden === false);
byId.get('aiProfileBack').trigger('click');

byId.get('userProfileOpen').trigger('click');
await sleep(100);
byId.get('userNameInput').value = '本机昵称';
byId.get('userProfileSave').trigger('click');
await sleep(200);
check('本机资料保存独立于 AI 资料', byId.get('userName').textContent === '本机昵称' && (await (await fetch(BASE + '/api/profile')).json()).profile.name === 'Anam');

byId.get('tabConsole').trigger('click');
await sleep(1000);
check('控制台可打开', byId.get('consolePanel').hidden === false);
check('终端显示产品与 SW 版本', byId.get('statusVersionLine').textContent.includes(PRODUCT_VERSION)
  && byId.get('statusVersionLine').textContent.includes('companion-v'), byId.get('statusVersionLine').textContent);
check('终端运行详情含三版本', byId.get('statusDetails').children.length >= 3);
check('无费用拆解时明确提示', byId.get('usageBreakdown').textContent.includes('还没有带费用拆解'), byId.get('usageBreakdown').textContent);
check('终端显示表情发送策略', byId.get('memeProbability').value === '100'
  && byId.get('memeMinGap').value === '2'
  && byId.get('memeSoftFrequency').checked === false
  && byId.get('memeState').textContent.includes('AI 资料'));
byId.get('memeProbability').value = '25';
byId.get('memeProbability').trigger('input');
byId.get('memeProbability').trigger('change');
byId.get('memeMinGap').value = '0';
byId.get('memeMinGap').trigger('change');
byId.get('memeSoftFrequency').checked = true;
byId.get('memeSoftFrequency').trigger('change');
await sleep(750);
const strategySaved = await (await fetch(`${BASE}/api/memes`)).json();
check('终端保存发送策略', strategySaved.strategy.probability === 25
  && strategySaved.strategy.minGapReplies === 0
  && strategySaved.strategy.softFrequency === true
  && strategySaved.strategy.maxPerReply === 1, JSON.stringify(strategySaved.strategy));
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ probability: 100, minGapReplies: 2, softFrequency: false }),
});
byId.get('summaryOpenBtn').trigger('click');
await sleep(300);
check('打开对话摘要页', byId.get('summaryPanel').hidden === false);
byId.get('summaryBack').trigger('click');
check('关闭对话摘要页', byId.get('summaryPanel').hidden === true);
check('显示默认模型', byId.get('apiModel').textContent === 'deepseek-flash', byId.get('apiModel').textContent);
check('未配置 Key 时明确显示状态', byId.get('apiKeyState').textContent === '尚未配置');
check('后续功能预览入口均禁用', ['previewV1', 'previewV2', 'previewV3', 'previewV4'].every((id) => byId.get(id).disabled === true));
const settingsResponse = await fetch(`${BASE}/api/settings`);
const publicSettings = await settingsResponse.json();
check('公开设置接口不返回 Key 明文', !Object.hasOwn(publicSettings, 'apiKey') && !JSON.stringify(publicSettings).includes('sk-'));
const balanceResponse = await fetch(`${BASE}/api/provider/balance`);
const noKeyBalance = await balanceResponse.json();
check('无 Key 时余额状态可读且不报错', balanceResponse.ok && noKeyBalance.ok === false && noKeyBalance.error === '尚未配置 API key');
byId.get('apiKeyInput').value = 'test-key-never-return-this';
byId.get('apiSaveBtn').trigger('click');
await sleep(350);
const configuredSettings = await (await fetch(`${BASE}/api/settings`)).json();
check('设置页保存 Key 后即时切换并标记待测试', configuredSettings.apiKeyConfigured && configuredSettings.mode === 'live' && configuredSettings.connectionStatus === 'untested');
check('设置接口不回传所保存的 Key', !JSON.stringify(configuredSettings).includes('test-key-never-return-this'));
byId.get('apiClearBtn').trigger('click');
await sleep(350);
const clearedSettings = await (await fetch(`${BASE}/api/settings`)).json();
check('清除 Key 后回到 mock 模式', !clearedSettings.apiKeyConfigured && clearedSettings.mode === 'mock' && clearedSettings.connectionStatus === 'not_configured');
byId.get('consoleClose').trigger('click');
check('控制台关闭时清除全屏类并返回首页', byId.get('consolePanel').hidden === true && !byId.get('consolePanel').classList.contains('mobile-page') && byId.get('inboxView').hidden === false);
byId.get('tabConsole').trigger('click');
await sleep(100);
byId.get('consoleClose').trigger('click');
check('控制台第二次打开和返回仍可退出', byId.get('consolePanel').hidden === true && !byId.get('consolePanel').classList.contains('mobile-page'));

byId.get('previewBtn').trigger('click');
await sleep(800);
check('试说三句返回 3 条', byId.get('previewList').children.length === 3, `n=${byId.get('previewList').children.length}`);

// 3) 长按 → 复制按钮
const bubble = msgs()[0];
list.trigger('pointerdown', { target: bubble, clientX: 0, clientY: 0 });
await sleep(650);
check('长按后浮出复制按钮', byId.get('copybar').hidden === false, 'hidden=' + byId.get('copybar').hidden);
check('气泡进入选中态', bubble.classList.contains('selected'));
byId.get('copyBtn').trigger('click');
await sleep(50);
check('点复制后提示已复制', byId.get('toast').textContent === '已复制', byId.get('toast').textContent);
check('复制后按钮收起', byId.get('copybar').hidden === true);
list.trigger('pointerup', {});

// 4) 发送（mock 回复有拟人化延迟，等 4.2s）
const inputEl = byId.get('input');
inputEl.value = '这是拆分后的测试消息';
byId.get('composer').trigger('submit');
await sleep(6000);

check('发送后多了一条用户气泡', meCount() === 4, `me=${meCount()}`);
check('收到分条回复（+2 条）', aiCount() === 4, `ai=${aiCount()}`);
for (let i = 0; i < 30 && !byId.get('aiSignature').textContent; i++) await sleep(100);
check('聊天完成后签名即时更新到头部', Boolean(byId.get('aiSignature').textContent), byId.get('aiSignature').textContent);
check('发送后新增一个时间分隔', seps().filter((s) => s.classList.contains('time')).length === 2, `${seps().filter((s) => s.classList.contains('time')).length}`);
check('发送后没有错误气泡', list.children.filter((n) => n.classList.contains('err')).length === 0);

// 空间页、动态与评论也通过真实前端事件走 mock 服务。
byId.get('tabSpace').trigger('click');
for (let i = 0; i < 20 && (!byId.get('spaceSignature').textContent || !byId.get('emotionChart').children.length); i++) await sleep(100);
check('空间在同一 APP 页面内切换', byId.get('spaceView').hidden === false && byId.get('inboxView').hidden === true);
const spaceDebug = await (await fetch(`${BASE}/api/space`)).json();
const emotionDebug = await (await fetch(`${BASE}/api/emotion?days=30`)).json();
check('空间接口保留签名与情绪数据', Boolean(spaceDebug.signature) && emotionDebug.points.length > 0, `signature=${spaceDebug.signature}, points=${emotionDebug.points.length}`);
check('AI 情绪记录带稳定 AI 身份', emotionDebug.points.filter((row) => row.assistantId).every((row) => row.assistantId === 'anam'));
check('AI 空间内容带稳定 AI 身份', spaceDebug.posts.filter((row) => row.author === 'ai').every((row) => row.assistantId === 'anam'));
byId.get('spaceInput').value = '我的空间动态';
byId.get('spaceComposer').trigger('submit');
await sleep(250);
check('用户可以发布空间动态', byId.get('spacePosts').children.length === 1);
await sleep(300);
check('发动态后 AI 会主动留言', byId.get('spacePosts').children[0].children.at(-2).children.length >= 1);
check('空间页绘制状态曲线并显示签名', byId.get('emotionChart').children.length > 0 && Boolean(byId.get('spaceSignature').textContent), `chart=${byId.get('emotionChart').children.length}, signature=${byId.get('spaceSignature').textContent}`);
const spaceCard = byId.get('spacePosts').children[0];
const commentForm = spaceCard.children.at(-1);
commentForm.children[0].value = '留一条评论';
commentForm.trigger('submit');
await sleep(350);
check('用户评论会保存并收到 AI 评论', byId.get('spacePosts').children[0].children.at(-2).children.length >= 2);
byId.get('tabChat').trigger('click');
check('空间返回对话列表不重载页面', byId.get('inboxView').hidden === false && byId.get('spaceView').hidden === true);

// 5) 断网 → 失败提示 → 重试
for (let i = 0; i < 60 && byId.get('statusText').textContent === '正在输入…'; i++) await sleep(100);
failChat = true;
inputEl.value = '这条会失败';
byId.get('composer').trigger('submit');
await sleep(650);
check('500ms 后状态行显示正在输入…', byId.get('statusText').textContent === '正在输入…', byId.get('statusText').textContent);
await sleep(1800);

const chip = list.children.find((n) => n.classList.contains('retry'));
check('失败后出现重试按钮', Boolean(chip), chip ? chip.textContent : 'missing');
check('失败后用户气泡还在', meCount() === 5, `me=${meCount()}`);

failChat = false;
const aiBeforeRetry = aiCount();
if (chip) {
  chip.trigger('click');
  await sleep(4200);
}
check('重试后收到分条回复', aiCount() >= aiBeforeRetry + 2, `ai ${aiBeforeRetry} -> ${aiCount()}`);
check('重试按钮已移除', !list.children.includes(chip));
check('重试后没有错误气泡', list.children.filter((n) => n.classList.contains('err')).length === 0);

// ---------- 收尾 ----------
server.kill();
try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }

check('sticker loading 骨架是空盒', /const skeleton = el\('div', 'sticker-skeleton'\);/.test(uiSource)
  && !/sticker-skeleton[^\n]*stickerText/.test(uiSource)
  && /\.sticker-skeleton\s*\{[^}]*width:\s*160px/u.test(cssSource));
check('sticker 骨架与图片共用固定盒尺寸', /const box = stickerBox\(message\);/u.test(uiSource)
  && /skeleton\.style\.width = `\$\{box\.width\}px`/u.test(uiSource)
  && /image\.style\.width = `\$\{box\.width\}px`/u.test(uiSource));

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过${up ? '' : '（服务未起来）'}`);
process.exit(failed || !up ? 1 : 0);
