// 界面层：渲染、输入、断线续传、口令、手势。网络细节在 api.js。
import {
  setToken, checkPassword, getHealth, getMessages, postChat,
  openEvents, readSse, apiFetch,
} from './api.js';
import { prepareMemeImage, prepareMemePreview } from './meme-image.js';

const list = document.getElementById('list');
const loadOlder = document.getElementById('loadOlder');
const jumpBottom = document.getElementById('jumpBottom');
const tabChatBadge = document.getElementById('tabChatBadge');
const stickerBtn = document.getElementById('stickerBtn');
const photoBtn = document.getElementById('photoBtn');
const photoFile = document.getElementById('photoFile');
const stickerPicker = document.getElementById('stickerPicker');
const stickerPickerGrid = document.getElementById('stickerPickerGrid');
const stickerPickerClose = document.getElementById('stickerPickerClose');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewImage = document.getElementById('photoPreviewImage');
const photoCaption = document.getElementById('photoCaption');
const photoPreviewCancel = document.getElementById('photoPreviewCancel');
const photoPreviewSend = document.getElementById('photoPreviewSend');
const photoList = document.getElementById('photoList');
const appEl = document.getElementById('app');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const budgetText = document.getElementById('budgetText');
const lockEl = document.getElementById('lock');
const lockInput = document.getElementById('lockInput');
const lockBtn = document.getElementById('lockBtn');
const lockErr = document.getElementById('lockErr');
const toastEl = document.getElementById('toast');

// 人格设置（侧边栏）
const profileBasics = document.getElementById('profileBasics');
const profilePageBasics = document.getElementById('profilePageBasics');
const consolePanel = document.getElementById('consolePanel');
const consoleClose = document.getElementById('consoleClose');
const consoleCloseIcon = document.getElementById('consoleCloseIcon');
const terminalDirectory = document.getElementById('terminalDirectory');
const apiSection = document.getElementById('apiSection');
const usageSection = document.getElementById('usageSection');
const balanceSection = document.getElementById('balanceSection');
const statusSection = document.getElementById('statusSection');
const memorySection = document.getElementById('memorySection');
const memeSection = document.getElementById('memeSection');
const backupSection = document.getElementById('backupSection');
const dataSection = document.getElementById('dataSection');
const advancedSection = document.getElementById('advancedSection');
const futureSection = document.getElementById('futureSection');
const rowMemes = document.getElementById('rowMemes');
const rowMemory = document.getElementById('rowMemory');
const rowBackup = document.getElementById('rowBackup');
const rowData = document.getElementById('rowData');
const rowStatus = document.getElementById('rowStatus');
const rowAdvanced = document.getElementById('rowAdvanced');
const apiHost = document.getElementById('apiHost');
const pushState = document.getElementById('pushState');
const pushHint = document.getElementById('pushHint');
const pushToggle = document.getElementById('pushToggle');
const pushTest = document.getElementById('pushTest');
const pushGenerate = document.getElementById('pushGenerate');
const weatherCity = document.getElementById('weatherCity');
const weatherState = document.getElementById('weatherState');
const weatherSave = document.getElementById('weatherSave');
const weatherRefresh = document.getElementById('weatherRefresh');
const backupInfo = document.getElementById('backupInfo');
const dataInfo = document.getElementById('dataInfo');
const advancedInfo = document.getElementById('advancedInfo');
const apiKeyInput = document.getElementById('apiKeyInput');
const replySpeed = document.getElementById('replySpeed');
const apiSaveBtn = document.getElementById('apiSaveBtn');
const apiClearBtn = document.getElementById('apiClearBtn');
const apiTestBtn = document.getElementById('apiTestBtn');
const apiSettingsMsg = document.getElementById('apiSettingsMsg');
const apiModeBadge = document.getElementById('apiModeBadge');
const apiModel = document.getElementById('apiModel');
const apiKeyState = document.getElementById('apiKeyState');
const balanceRefresh = document.getElementById('balanceRefresh');
const balanceValue = document.getElementById('balanceValue');
const balanceStatus = document.getElementById('balanceStatus');
const usageDay = document.getElementById('usageDay');
const usageSpend = document.getElementById('usageSpend');
const usageTokens = document.getElementById('usageTokens');
const usageCalls = document.getElementById('usageCalls');
const usageLimit = document.getElementById('usageLimit');
const usageBar = document.getElementById('usageBar');
const usageNote = document.getElementById('usageNote');
const usageBreakdown = document.getElementById('usageBreakdown');
const statusVersionLine = document.getElementById('statusVersionLine');
const statusUpdateHint = document.getElementById('statusUpdateHint');
const statusUpdateBtn = document.getElementById('statusUpdateBtn');
const statusDetails = document.getElementById('statusDetails');
const budgetResetBtn = document.getElementById('budgetResetBtn');
const budgetDialog = document.getElementById('budgetDialog');
const budgetDialogText = document.getElementById('budgetDialogText');
const budgetCancel = document.getElementById('budgetCancel');
const budgetContinue = document.getElementById('budgetContinue');
let pendingBudget = null;
const previewList = document.getElementById('previewList');
const previewBtn = document.getElementById('previewBtn');
const appName = document.getElementById('appName');
const aiSignature = document.getElementById('aiSignature');
const headerAvatar = document.getElementById('headerAvatar');
const spaceView = document.getElementById('spaceView');
const tabChat = document.getElementById('tabChat');
const tabSpace = document.getElementById('tabSpace');
const tabContacts = document.getElementById('tabContacts');
const tabConsole = document.getElementById('tabConsole');
const inboxView = document.getElementById('inboxView');
const chatView = document.getElementById('chatView');
const contactsView = document.getElementById('contactsView');
const aiProfileView = document.getElementById('aiProfileView');
const userProfileView = document.getElementById('userProfileView');
const conversationCard = document.getElementById('conversationCard');
const conversationSearch = document.getElementById('conversationSearch');
const inboxAiName = document.getElementById('inboxAiName');
const inboxAiAvatar = document.getElementById('inboxAiAvatar');
const inboxPreview = document.getElementById('inboxPreview');
const inboxTime = document.getElementById('inboxTime');
const inboxBadge = document.getElementById('inboxBadge');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userProfileOpen = document.getElementById('userProfileOpen');
const userProfileBack = document.getElementById('userProfileBack');
const userAvatarPreview = document.getElementById('userAvatarPreview');
const userAvatarFile = document.getElementById('userAvatarFile');
const userNameInput = document.getElementById('userNameInput');
const userProfileSave = document.getElementById('userProfileSave');
const aiProfileOpen = document.getElementById('aiProfileOpen');
const aiProfileBack = document.getElementById('aiProfileBack');
const chatBack = document.getElementById('chatBack');
const spacePostToggle = document.getElementById('spacePostToggle');
const spaceComposer = document.getElementById('spaceComposer');
const spaceInput = document.getElementById('spaceInput');
const spaceCancel = document.getElementById('spaceCancel');
const spacePosts = document.getElementById('spacePosts');
const spaceEmpty = document.getElementById('spaceEmpty');
const spaceSignature = document.getElementById('spaceSignature');
const emotionChart = document.getElementById('emotionChart');
const emotionCaption = document.getElementById('emotionCaption');
const embeddingBaseInput = document.getElementById('embeddingBaseInput');
const embeddingModelInput = document.getElementById('embeddingModelInput');
const embeddingKeyInput = document.getElementById('embeddingKeyInput');
const embeddingPriceInput = document.getElementById('embeddingPriceInput');
const embeddingSaveBtn = document.getElementById('embeddingSaveBtn');
const embeddingClearBtn = document.getElementById('embeddingClearBtn');
const embeddingTestBtn = document.getElementById('embeddingTestBtn');
const embeddingMsg = document.getElementById('embeddingMsg');
const memoryIndexBtn = document.getElementById('memoryIndexBtn');
const memorySummarizeBtn = document.getElementById('memorySummarizeBtn');
const memoryStats = document.getElementById('memoryStats');
const memorySearchForm = document.getElementById('memorySearchForm');
const memorySearchInput = document.getElementById('memorySearchInput');
const memoryGraphHost = document.getElementById('memoryGraph');
const memoryResults = document.getElementById('memoryResults');
const summaryOpenBtn = document.getElementById('summaryOpenBtn');
const summaryPanel = document.getElementById('summaryPanel');
const summaryBack = document.getElementById('summaryBack');
const summaryList = document.getElementById('summaryList');
const memeCounts = document.getElementById('memeCounts');
const memeState = document.getElementById('memeState');
const memeFile = document.getElementById('memeFile');
const memeMsg = document.getElementById('memeMsg');
const memeGrid = document.getElementById('memeGrid');
const memeEmpty = document.getElementById('memeEmpty');
const memeEntry = document.getElementById('memeEntry');
const memeEntryCounts = document.getElementById('memeEntryCounts');
const memeEnabledToggle = document.getElementById('memeEnabledToggle');
const memeDeleteDialog = document.getElementById('memeDeleteDialog');
const memeDeleteText = document.getElementById('memeDeleteText');
const memeDeleteCancel = document.getElementById('memeDeleteCancel');
const memeDeleteConfirm = document.getElementById('memeDeleteConfirm');
const memeProbability = document.getElementById('memeProbability');
const memeProbabilityValue = document.getElementById('memeProbabilityValue');
const memeMinGap = document.getElementById('memeMinGap');
const memeSoftFrequency = document.getElementById('memeSoftFrequency');
const memeStrategyMsg = document.getElementById('memeStrategyMsg');
const memeStrategyStats = document.getElementById('memeStrategyStats');
const memeAiBatch = document.getElementById('memeAiBatch');
const memeAiMsg = document.getElementById('memeAiMsg');
let memeList = [];
let memeEnabled = true;
let memeDeleteTarget = null;
let memeStrategyTimer = null;
let memeStrategyDraft = {};
let aiLabelAvailable = false;
let aiLabelChecked = false;
let terminalModule = '';
let lastHealth = null;
let lastStatus = null;
let lastMemeCounts = null;
const memePreviewUrls = new Map();
const memeOriginalUrls = new Map();
const memePreviewInflight = new Map();
const avatarPreview = document.getElementById('avatarPreview');
const pAvatarFile = document.getElementById('pAvatarFile');
const avatarClear = document.getElementById('avatarClear');
const personaEdit = document.getElementById('personaEdit');
const personaPanel = document.getElementById('personaPanel');
const panelClose = document.getElementById('panelClose');
const panelCloseIcon = document.getElementById('panelCloseIcon');
const panelCancel = document.getElementById('panelCancel');
const panelTitle = document.getElementById('panelTitle');
const discardConfirm = document.getElementById('discardConfirm');
const discardKeep = document.getElementById('discardKeep');
const discardApply = document.getElementById('discardApply');
let mobilePersonaPage = false;
let profilePageOriginal = '';
let activeView = 'inbox';
let lastReadSeq = 0;
let readInitialized = false;
let unreadEvents = null;
const READ_KEY = 'companion.read.v1';
let profileReturnView = 'chat';
let localUserAvatar = '';
const panelDone = document.getElementById('panelDone');
const panelMsg = document.getElementById('panelMsg');
const PROFILE_FIELDS = {
  name: document.getElementById('pAiName'),
  callUser: document.getElementById('pCallUser'),
  signature: document.getElementById('pSignature'),
};
const PANEL_FIELDS = {
  persona: document.getElementById('ppPersona'),
  tone: document.getElementById('ppTone'),
  initiative: document.getElementById('ppInitiative'),
  boundaries: document.getElementById('ppBoundaries'),
};
const personaValues = { tone: '', initiative: '', boundaries: '', persona: '' };
let avatarDraft = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let busy = false;
let lastFrameId = 0;    // 已处理到的 SSE 帧 id
let bootId = null;      // 服务端本次启动的 id
let awaitJob = null;    // 正在等哪条消息的回复
let recovery = null;    // 续传 AbortController
let modeText = '在线';
let framesThisSend = 0;
let typingTimer = null;
let lastAt = null;      // 上一条已渲染消息的时间（用于时间轴分隔）
let toastTimer = null;

const rendered = new Map();  // 消息 id -> 气泡
const outgoing = new Map();  // 消息 id -> { text }，失败重试用

// 已加载的历史与分页状态
let loadedMessages = [];
let hasOlder = false;
let loadingOlder = false;
const MSG_CACHE_KEY = 'companion.messages.v1';
const MSG_CACHE_LIMIT = 200;
let cacheTimer = null;

function readMessageCache() {
  try {
    const raw = localStorage.getItem(MSG_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.messages) || !data.messages.length) return null;
    return data;
  } catch { return null; }
}

function writeMessageCache() {
  try {
    const messages = loadedMessages.slice(-MSG_CACHE_LIMIT);
    localStorage.setItem(MSG_CACHE_KEY, JSON.stringify({ v: 1, messages, hasOlder, at: Date.now() }));
  } catch { /* 存储满了就算了 */ }
}

function scheduleCacheWrite() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(writeMessageCache, 400);
}

function rememberMessage(message) {
  if (!message || !message.id) return;
  if (!Number.isFinite(Number(message.seq))) return;
  if (loadedMessages.some((m) => m.id === message.id)) return;
  loadedMessages.push(message);
  loadedMessages.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  scheduleCacheWrite();
}

function updateLoadOlder() {
  // 只有真的还有更早消息、并且已经拉到顶部时才出现；8px 容差防小数抖动。
  loadOlder.hidden = !(hasOlder && list.scrollTop <= 8);
  loadOlder.disabled = loadingOlder;
  loadOlder.textContent = loadingOlder ? '加载中…' : '加载更早';
}

function maxLoadedSeq() {
  return loadedMessages.reduce((max, message) => Math.max(max, Number(message.seq) || 0), 0);
}

function initReadMarker() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const saved = Number(raw);
    lastReadSeq = Number.isFinite(saved) && saved > 0 ? saved : maxLoadedSeq();
    if (!Number.isFinite(saved) || saved <= 0) localStorage.setItem(READ_KEY, String(lastReadSeq));
  } catch {
    lastReadSeq = maxLoadedSeq();
  }
  readInitialized = true;
  updateUnreadBadge();
}

function markChatRead() {
  const max = maxLoadedSeq();
  if (max > lastReadSeq) {
    lastReadSeq = max;
    try { localStorage.setItem(READ_KEY, String(lastReadSeq)); } catch { /* ignore */ }
  }
  updateUnreadBadge();
}

function updateUnreadBadge() {
  if (!readInitialized) {
    tabChatBadge.hidden = true;
    return;
  }
  const count = loadedMessages.filter((message) => message.role === 'assistant' && Number(message.seq) > lastReadSeq).length;
  const label = count > 99 ? '99+' : String(count);
  // 列表页不显示 tab 徽章；会话行负责显示未读。聊天页视为已读。
  tabChatBadge.hidden = count <= 0 || activeView === 'inbox' || activeView === 'chat';
  tabChatBadge.textContent = label;
  inboxBadge.hidden = count <= 0 || activeView === 'chat';
  inboxBadge.textContent = label;
}

function stopUnreadEvents() {
  if (unreadEvents) {
    unreadEvents.abort();
    unreadEvents = null;
  }
}

// 不在对话页时保持一条 SSE 订阅，收到她的新消息就走现有 handleFrame 路径。
async function startUnreadEvents() {
  if (unreadEvents || activeView === 'chat') return;
  const ac = new AbortController();
  unreadEvents = ac;
  while (!ac.signal.aborted) {
    try {
      const res = await openEvents(lastFrameId, bootId, ac.signal);
      if (res.status === 401) {
        lockOut('登录已失效，请重新输入口令。');
        break;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await readSse(res, handleFrame);
    } catch { /* 断线重连 */ }
    if (ac.signal.aborted) break;
    await sleep(2500);
  }
  if (unreadEvents === ac) unreadEvents = null;
}

function updateJumpBottom() {
  jumpBottom.hidden = !(!stickToBottom && distanceToBottom() > list.clientHeight);
}

jumpBottom.addEventListener('click', () => {
  if (typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  else scrollToBottom();
  stickToBottom = true;
  updateJumpBottom();
});

// ---------- 小工具 ----------
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// crypto.randomUUID 只在安全上下文有；手机走 http://局域网IP 时要自己造 v4 UUID
function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// 分隔符标签：跨天用「今天/昨天/10月28日」
function sepDayLabel(at) {
  const d = new Date(at);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return '今天';
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function fmtBudget(b) {
  if (!b) return '';
  return `¥${Number(b.spentYuan).toFixed(3)} / ${Number(b.limitYuan).toFixed(2)}`;
}

// 是否贴着底部：只由用户自己的滚动改变，追加消息/键盘变化不会把它误判掉
let stickToBottom = true;
let rafScroll = 0;

const distanceToBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight;

function cancelScheduledScroll() {
  if (!rafScroll) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafScroll);
  else clearTimeout(rafScroll);
  rafScroll = 0;
}

function scrollToBottom() {
  list.scrollTop = list.scrollHeight;
}

list.addEventListener('scroll', () => {
  stickToBottom = distanceToBottom() < 120;
  updateLoadOlder();
  updateJumpBottom();
}, { passive: true });

// 用户主动拖动聊天记录时收起键盘；程序性滚动不经过这里。
function dismissKeyboardForListDrag() {
  if (document.activeElement === input) input.blur();
}
list.addEventListener('touchmove', dismissKeyboardForListDrag, { passive: true });
list.addEventListener('wheel', dismissKeyboardForListDrag, { passive: true });

// requestAnimationFrame 合并滚动；贴底时连续两帧校正（输入框高度、键盘收缩会晚一帧生效）
function scheduleScroll(force = false) {
  if (force) stickToBottom = true;
  if (rafScroll) return;
  rafScroll = requestAnimationFrame(() => {
    rafScroll = 0;
    if (!stickToBottom) return;
    scrollToBottom();
    requestAnimationFrame(() => {
      if (stickToBottom) scrollToBottom();
    });
  });
}

function setStatus(ok, text) {
  statusDot.classList.toggle('off', !ok);
  statusText.textContent = text;
}

// 500ms 后才显示"正在输入…"，避免一闪而过
function startTyping(label = '正在输入…') {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { statusText.textContent = label; }, 500);
}

function stopTyping() {
  clearTimeout(typingTimer);
  typingTimer = null;
  setStatus(true, modeText);
}

// 时间轴分隔符：跨天显示日期；同一天距上一条 >5 分钟显示时刻；否则不显示
function maybeSeparator(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return;
  if (!lastAt) {
    list.appendChild(el('div', 'sep day', sepDayLabel(at)));
  } else if (dayKey(d) !== dayKey(lastAt)) {
    list.appendChild(el('div', 'sep day', sepDayLabel(at)));
  } else if (d.getTime() - lastAt.getTime() > 5 * 60 * 1000) {
    list.appendChild(el('div', 'sep time', hhmm(d)));
  }
  lastAt = d;
}

function cleanBubbleText(text) {
  return String(text || '')
    .replace(/<p\b[^>]*>\s*(?:&nbsp;)?\s*<\/p>/giu, '')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/giu, '$1')
    .replace(/<[^>]*>/gu, '')
    .replace(/<\/?[a-z][^>]*$/giu, '')
    .trim();
}

function addBubble(role, text, id, at) {
  if (id && rendered.has(id)) return rendered.get(id);
  const clean = cleanBubbleText(text);
  if (!clean) return null;
  maybeSeparator(at || new Date().toISOString());
  const node = el('div', `msg ${role === 'user' ? 'me' : 'ai'}`, clean);
  if (id) {
    node.dataset.id = id;
    rendered.set(id, node);
  }
  list.appendChild(node);
  updateInboxPreview(clean, at);
  scheduleScroll(role === 'user');
  return node;
}

function stickerText(message) {
  return `[表情] ${String(message?.media?.alt || '表情')}`;
}

function stickerBox(message) {
  const width = Number(message?.media?.w) || 0;
  const height = Number(message?.media?.h) || 0;
  if (width <= 0 || height <= 0) return null;
  const scale = Math.min(1, 160 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function addMessageBubble(message) {
  if (message?.type === 'sticker') return addStickerBubble(message);
  if (message?.type === 'image') return addImageBubble(message);
  return addBubble(message?.role, message?.text, message?.id, message?.at);
}

function addImageBubble(message) {
  if (message.id && rendered.has(message.id)) return rendered.get(message.id);
  const at = message.at || new Date().toISOString();
  maybeSeparator(at);
  const node = el('div', `msg image ${message.role === 'user' ? 'me' : 'ai'}`);
  if (message.optimistic) node.classList.add('optimistic');
  const ref = String(message.media?.ref || '');
  const photoId = ref.startsWith('photo:') ? ref.slice(6) : '';
  const image = el('img', 'message-photo');
  image.alt = '图片';
  node.appendChild(image);
  if (message.role === 'user' && photoId && !message.optimistic) {
    const remove = el('button', 'image-delete', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', '删除这张图片');
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!globalThis.confirm('删除这张图片和本地文件？')) return;
      try {
        const response = await apiFetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        removeBubble(message.id);
        loadedMessages = loadedMessages.filter((item) => item.id !== message.id);
        writeMessageCache();
        toast('图片和文件已删除');
      } catch (err) {
        toast(`删除失败：${err.message}`);
      }
    });
    node.appendChild(remove);
  }
  if (message.id) {
    node.dataset.id = message.id;
    rendered.set(message.id, node);
  }
  list.appendChild(node);
  if (message.localUrl) {
    image.src = message.localUrl;
  } else if (photoId) {
    void apiFetch(`/api/photos/${encodeURIComponent(photoId)}`).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      image.src = URL.createObjectURL(blob);
    }).catch(() => {
      image.remove();
      node.appendChild(el('div', 'side-msg', '图片读取失败'));
    });
  }
  updateInboxPreview('[图片]', at);
  scheduleScroll(message.role === 'user');
  return node;
}

async function openStickerPicker() {
  if (!memeList.length) await loadMemes({ render: false });
  stickerPickerGrid.textContent = '';
  if (!memeList.length) {
    toast('表情库还是空的');
    return;
  }
  for (const meme of memeList) {
    const item = el('button', 'sticker-picker-item');
    item.type = 'button';
    const image = el('img');
    image.alt = meme.label || '表情';
    image.loading = 'lazy';
    const label = el('small', '', meme.label || '未命名');
    item.appendChild(image);
    item.appendChild(label);
    item.addEventListener('click', () => { void sendManualSticker(meme); });
    stickerPickerGrid.appendChild(item);
    void getMemePreviewUrl(meme).then((url) => { image.src = url; }).catch(() => {});
  }
  stickerPicker.hidden = false;
}

async function sendManualSticker(meme) {
  stickerPicker.hidden = true;
  try {
    const response = await apiFetch('/api/stickers/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: meme.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    addMessageBubble(data.message);
    rememberMessage(data.message);
    writeMessageCache();
    scheduleScroll(true);
    void requestManualReply(data.message.id, '她正在看表情…');
  } catch (err) {
    toast(`发送表情失败：${err.message}`);
  }
}

async function requestManualReply(id, label = '正在输入…') {
  if (!id || busy || awaitJob) return;
  busy = true;
  sendBtn.disabled = true;
  awaitJob = id;
  startTyping(label);
  try {
    const response = await apiFetch('/api/chat/respond', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (response.status === 409) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await readSse(response, handleFrame);
  } catch (err) {
    if (!awaitJob) return;
    toast(`她暂时没接上话：${err.message}`);
  } finally {
    busy = false;
    sendBtn.disabled = false;
    awaitJob = null;
    stopTyping();
  }
}

stickerBtn.addEventListener('click', () => { void openStickerPicker(); });
stickerPickerClose.addEventListener('click', () => { stickerPicker.hidden = true; });
stickerPicker.addEventListener('click', (event) => {
  if (event.target === stickerPicker) stickerPicker.hidden = true;
});

photoBtn.addEventListener('click', () => photoFile.click());

async function photoToDataUrl(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  let width;
  let height;
  let source;
  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      width = image.naturalWidth;
      height = image.naturalHeight;
      source = image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, 2048 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  if (bitmap?.close) bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.88);
}

let pendingPhotoDataUrl = '';
let pendingPhotoToken = '';
let pendingPhotoTextToken = '';

photoFile.addEventListener('change', async () => {
  const file = photoFile.files?.[0];
  photoFile.value = '';
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/u.test(file.type)) {
    toast('只支持 JPG / PNG / WebP；HEIC 请先转成 JPG');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast('图片太大，请先压缩到 8MB 以内');
    return;
  }
  try {
    pendingPhotoDataUrl = await photoToDataUrl(file);
    pendingPhotoToken = crypto.randomUUID();
    pendingPhotoTextToken = crypto.randomUUID();
    photoPreviewImage.src = pendingPhotoDataUrl;
    photoCaption.value = input.value.trim();
    photoPreview.hidden = false;
    photoCaption.focus();
  } catch (err) {
    toast(`读图失败：${err.message}`);
  }
});

photoPreviewCancel.addEventListener('click', () => {
  photoPreview.hidden = true;
  pendingPhotoDataUrl = '';
  pendingPhotoToken = '';
  pendingPhotoTextToken = '';
});

photoPreviewSend.addEventListener('click', async () => {
  if (!pendingPhotoDataUrl) return;
  const dataUrl = pendingPhotoDataUrl;
  const text = photoCaption.value.trim();
  const clientId = pendingPhotoToken;
  const textClientId = pendingPhotoTextToken;
  photoPreview.hidden = true;
  pendingPhotoDataUrl = '';
  pendingPhotoToken = '';
  pendingPhotoTextToken = '';
  photoPreviewSend.disabled = true;

  const optimisticImage = {
    id: clientId,
    role: 'user',
    type: 'image',
    text: '',
    caption: '',
    media: { ref: '', w: 0, h: 0, alt: '图片' },
    localUrl: dataUrl,
    optimistic: true,
    at: new Date().toISOString(),
  };
  const optimisticText = text ? {
    id: textClientId,
    role: 'user',
    type: 'text',
    text,
    optimistic: true,
    at: new Date().toISOString(),
  } : null;
  addMessageBubble(optimisticImage);
  if (optimisticText) {
    const textNode = addMessageBubble(optimisticText);
    if (textNode) textNode.classList.add('optimistic');
  }
  scheduleScroll(true);

  let sending = false;
  const markFailed = (err) => {
    for (const id of [clientId, textClientId].filter(Boolean)) {
      const node = rendered.get(id);
      if (!node) continue;
      node.classList.add('failed');
      node.title = err.message;
      node.addEventListener('click', () => { void attempt(); }, { once: true });
    }
    photoPreviewSend.disabled = false;
    toast(`发图失败：${err.message}（点气泡重试）`);
  };

  const attempt = async () => {
    if (sending) return;
    sending = true;
    photoPreviewSend.disabled = true;
    try {
      let thumbDataUrl = '';
      try { thumbDataUrl = await makeThumbDataUrl(dataUrl); } catch { /* 缩略图失败不阻塞原图 */ }
      const response = await apiFetch('/api/photos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl, text, clientId, textClientId, thumbDataUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      removeBubble(clientId);
      if (textClientId) removeBubble(textClientId);
      addMessageBubble(data.message);
      rememberMessage(data.message);
      if (data.textMessage) {
        addMessageBubble(data.textMessage);
        rememberMessage(data.textMessage);
      }
      writeMessageCache();
      input.value = '';
      input.style.height = 'auto';
      scheduleScroll(true);
      toast('图片已发送');
      void requestManualReply(data.message.id, '她正在看图…');
    } catch (err) {
      markFailed(err);
    } finally {
      sending = false;
      photoPreviewSend.disabled = false;
    }
  };

  await attempt();
});

function addStickerBubble(message) {
  if (message.id && rendered.has(message.id)) return rendered.get(message.id);
  const at = message.at || new Date().toISOString();
  maybeSeparator(at);
  const node = el('div', `msg sticker ${message.role === 'user' ? 'me' : 'ai'}`);
  node.dataset.state = 'loading';
  const box = stickerBox(message);
  const image = el('img');
  image.alt = String(message.media?.alt || '表情');
  image.loading = 'eager';
  image.style.display = 'none';
  if (box) {
    image.style.width = `${box.width}px`;
    image.style.height = `${box.height}px`;
  }
  const skeleton = el('div', 'sticker-skeleton');
  if (box) {
    skeleton.style.width = `${box.width}px`;
    skeleton.style.height = `${box.height}px`;
  }
  node.appendChild(skeleton);
  node.appendChild(image);
  if (message.id) {
    node.dataset.id = message.id;
    rendered.set(message.id, node);
  }
  list.appendChild(node);
  loadStickerImage(message, image, skeleton, node);
  updateInboxPreview(stickerText(message), at);
  scheduleScroll(message.role === 'user');
  return node;
}

// 预览本地持久缓存：IndexedDB 存 Blob；失败就退回内存 URL。
// v2：预览取帧修复后换库名，强制淘汰旧的空白帧缓存。
let memeDbPromise = null;
function openMemeDb() {
  if (memeDbPromise) return memeDbPromise;
  memeDbPromise = new Promise((resolve, reject) => {
    const idb = globalThis.indexedDB;
    if (!idb) return reject(new Error('no indexedDB'));
    const request = idb.open('companion-memes-v2', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('previews')) db.createObjectStore('previews');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('idb open failed'));
  });
  return memeDbPromise;
}

async function idbGetPreview(id) {
  try {
    const db = await openMemeDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction('previews', 'readonly').objectStore('previews').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
}

async function idbPutPreview(id, blob) {
  try {
    const db = await openMemeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', 'readwrite');
      tx.objectStore('previews').put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* 本地缓存失败不影响显示 */ }
}

async function idbDeletePreview(id) {
  try {
    const db = await openMemeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', 'readwrite');
      tx.objectStore('previews').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

function dataUrlToBlob(dataUrl) {
  const [head, payload] = String(dataUrl || '').split(',');
  const mime = /data:([^;]+)/u.exec(head || '')?.[1] || 'image/png';
  const binary = atob(payload || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function getMemePreviewUrl(meme, { backfill = true } = {}) {
  const id = String(meme?.id || '');
  if (!id) throw new Error('missing meme id');
  const cached = memePreviewUrls.get(id);
  if (cached) return cached;
  if (memePreviewInflight.has(id)) return memePreviewInflight.get(id);
  const task = (async () => {
    const stored = await idbGetPreview(id);
    if (stored) {
      const url = URL.createObjectURL(stored);
      memePreviewUrls.set(id, url);
      return url;
    }
    try {
      const response = await apiFetch(`/api/memes/${encodeURIComponent(id)}/preview`, { cache: 'no-store' });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        memePreviewUrls.set(id, url);
        await idbPutPreview(id, blob);
        return url;
      }
    } catch { /* fall through to original */ }
    if (!backfill) throw new Error('no preview');
    const original = await apiFetch(`/api/memes/${encodeURIComponent(id)}/file`, { cache: 'no-store' });
    if (!original.ok) throw new Error(`HTTP ${original.status}`);
    const preview = await prepareMemePreview(await original.blob());
    if (!preview?.previewDataUrl) throw new Error('preview failed');
    const upload = await apiFetch(`/api/memes/${encodeURIComponent(id)}/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataUrl: preview.previewDataUrl }),
    });
    if (!upload.ok) throw new Error(`preview save HTTP ${upload.status}`);
    const blob = dataUrlToBlob(preview.previewDataUrl);
    const url = URL.createObjectURL(blob);
    memePreviewUrls.set(id, url);
    await idbPutPreview(id, blob);
    const record = memeList.find((item) => item.id === id);
    if (record) record.hasPreview = true;
    return url;
  })();
  memePreviewInflight.set(id, task);
  try { return await task; } finally { memePreviewInflight.delete(id); }
}

async function upgradeStickerOriginal(message, image) {
  const ref = String(message.media?.ref || '');
  const id = ref.startsWith('meme:') ? ref.slice(5) : '';
  if (!id) return;
  let url = memeOriginalUrls.get(id);
  let created = false;
  try {
    if (!url) {
      const response = await apiFetch(`/api/memes/${encodeURIComponent(id)}/file`, { cache: 'no-store' });
      if (!response.ok) return;
      url = URL.createObjectURL(await response.blob());
      memeOriginalUrls.set(id, url);
      created = true;
    }
    // 先预加载成功，再原地替换；失败就继续用预览，不触发失败占位。
    await new Promise((resolve, reject) => {
      const preloader = new Image();
      preloader.onload = resolve;
      preloader.onerror = reject;
      preloader.src = url;
    });
    const box = image.getBoundingClientRect?.();
    if (box && box.width > 0 && box.height > 0) {
      image.style.width = `${box.width}px`;
      image.style.height = `${box.height}px`;
    }
    image.src = url;
  } catch {
    if (created) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      memeOriginalUrls.delete(id);
    }
  }
}

async function loadStickerImage(message, image, skeleton, node) {
  const ref = String(message.media?.ref || '');
  const id = ref.startsWith('meme:') ? ref.slice(5) : '';
  let settled = false;
  const fallback = () => {
    if (settled || node.dataset.state === 'failed') return;
    settled = true;
    image.onload = null;
    image.onerror = null;
    node.dataset.state = 'failed';
    image.remove();
    skeleton.remove();
    node.appendChild(el('div', 'sticker-fallback', stickerText(message)));
  };
  const ready = () => {
    if (settled || node.dataset.state === 'failed') return;
    settled = true;
    image.onload = null;
    image.onerror = null;
    skeleton.remove();
    image.style.display = 'block';
    // 锁定预览盒子尺寸，原图替换时绝不跳位。
    const box = image.getBoundingClientRect?.();
    if (box && box.width > 0 && box.height > 0) {
      image.style.width = `${box.width}px`;
      image.style.height = `${box.height}px`;
    }
    node.dataset.state = 'ready';
    // 预览显示后一律后台拉原图；拉到才换，失败保留预览。
    void upgradeStickerOriginal(message, image);
  };
  if (!id) return fallback();
  try {
    const url = await getMemePreviewUrl({ id });
    image.addEventListener('error', fallback, { once: true });
    image.onload = ready;
    image.onerror = fallback;
    image.src = url;
    if (image.complete && image.naturalWidth > 0) ready();
  } catch {
    fallback();
  }
}

function updateInboxPreview(text, at = '') {
  inboxPreview.textContent = String(text || '').replace(/\s+/gu, ' ').slice(0, 90) || '还没有消息';
  if (at) {
    const date = new Date(at);
    inboxTime.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
  }
}

function removeBubble(id) {
  const node = rendered.get(id);
  if (node) {
    node.remove();
    rendered.delete(id);
  }
}

function renderAll(messages, { preserveScroll = false } = {}) {
  const prevHeight = preserveScroll ? list.scrollHeight : 0;
  const prevTop = preserveScroll ? list.scrollTop : 0;
  if (preserveScroll) stickToBottom = false;

  list.textContent = '';
  rendered.clear();
  lastAt = null;

  const markRendered = () => {
    // 冷启动计时：从导航开始到历史渲染完成（Chrome dump-dom 可读）
    try {
      document.documentElement.dataset.renderedAt = String(Math.round(performance.now()));
    } catch { /* shim/老浏览器忽略 */ }
  };

  if (!messages || !messages.length) {
    list.appendChild(el('div', 'hint', '这是你们的开始。'));
    markRendered();
    return;
  }
  const sorted = [...messages].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const latest = sorted.at(-1);
  if (latest) updateInboxPreview(latest.type === 'sticker' ? stickerText(latest) : latest.type === 'image' ? '[图片]' : latest.text, latest.at);
  else updateInboxPreview('还没有消息');
  for (const m of sorted) addMessageBubble(m);

  if (preserveScroll) {
    // 前面插入了更早的消息：保持当前看到的内容位置不变
    list.scrollTop = list.scrollHeight - prevHeight + prevTop;
  } else {
    stickToBottom = true;
    scheduleScroll(true);
  }
  updateLoadOlder();
  updateJumpBottom();
  markRendered();
}

function showError(text) {
  list.appendChild(el('div', 'err', text));
  scheduleScroll(true);
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// ---------- 长按 → 复制按钮 ----------
// iOS 要求 execCommand('copy') 必须在用户手势的同一调用栈里；
// 所以长按只负责选中并浮出按钮，真正的复制发生在点按钮那一刻。
const copybar = document.getElementById('copybar');
const copyBtn = document.getElementById('copyBtn');
let selectedText = '';
let selectedNode = null;

function hideCopyBar() {
  copybar.hidden = true;
  selectedText = '';
  if (selectedNode) {
    selectedNode.classList.remove('selected');
    selectedNode = null;
  }
}

function copyTextSync(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 走兜底 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.focus();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

copyBtn.addEventListener('click', () => {
  const ok = copyTextSync(selectedText);
  toast(ok ? '已复制' : '复制失败');
  hideCopyBar();
});

let pressTimer = null;
let pressFrom = null;

function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
  pressFrom = null;
}

list.addEventListener('pointerdown', (e) => {
  const node = e.target.closest('.msg');
  hideCopyBar();
  if (!node) return;
  pressFrom = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    selectedNode = node;
    selectedText = node.textContent;
    node.classList.add('selected');
    copybar.hidden = false;
  }, 500);
});

list.addEventListener('pointermove', (e) => {
  if (!pressFrom) return;
  if (Math.hypot(e.clientX - pressFrom.x, e.clientY - pressFrom.y) > 10) cancelPress();
});

for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  list.addEventListener(type, cancelPress);
}

list.addEventListener('scroll', hideCopyBar, { passive: true });

// ---------- 口令 ----------
function showLock(msg = '') {
  lockErr.textContent = msg;
  lockEl.classList.add('show');
  setTimeout(() => lockInput.focus(), 60);
}

function hideLock() {
  lockEl.classList.remove('show');
}

function lockOut(msg) {
  setToken('');
  showLock(msg);
}

async function tryUnlock() {
  const pw = lockInput.value.trim();
  if (!pw) { lockErr.textContent = '请输入口令。'; return; }
  lockBtn.disabled = true;
  try {
    const status = await checkPassword(pw);
    if (status === 200) {
      setToken(pw);
      lockInput.value = '';
      hideLock();
      await boot();
    } else if (status === 401) {
      lockErr.textContent = '口令不对，再试一次。';
    } else {
      lockErr.textContent = `服务暂时不可用（HTTP ${status}）。`;
    }
  } catch {
    lockErr.textContent = '连不上服务，检查电脑上的窗口是否还开着。';
  } finally {
    lockBtn.disabled = false;
    lockInput.focus();
  }
}

lockBtn.addEventListener('click', tryUnlock);
lockInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });

// ---------- 人格设置（D2） ----------
function profilePageDraft() {
  const draft = draftProfile();
  for (const [key, node] of Object.entries(PANEL_FIELDS)) draft[key] = node.value.trim();
  return draft;
}

function profilePageIsDirty() {
  return mobilePersonaPage && profilePageOriginal !== JSON.stringify(profilePageDraft());
}

function showConsoleUsage(budget) {
  if (!budget) return;
  usageDay.textContent = budget.day || '今天';
  usageSpend.textContent = `¥${Number(budget.spentYuan || 0).toFixed(3)}`;
  usageTokens.textContent = Number(budget.tokens || 0).toLocaleString('zh-CN');
  usageCalls.textContent = Number(budget.calls || 0).toLocaleString('zh-CN');
  usageLimit.textContent = `¥${Number(budget.limitYuan || 0).toFixed(2)}`;
  const ratio = budget.limitYuan > 0 ? Math.min(100, Number(budget.spentYuan || 0) / budget.limitYuan * 100) : 0;
  usageBar.style.width = `${ratio}%`;
  usageNote.textContent = budget.override === 'day'
    ? '今天已选择继续，不再拦截；花费会继续累计，明天 0 点恢复。'
    : (budget.blocked
      ? (Number(budget.tokens) >= Number(budget.tokenLimit)
        ? '已达到今日 token 上限，模型请求会被拦截。'
        : '已达到今日预算上限，模型请求会被拦截。')
      : '金额根据 API 返回的 token 用量或本地估算记录；余额不计入这里。');
  budgetResetBtn.hidden = budget.override !== 'day';
}

const BREAKDOWN_LABELS = {
  stable: '稳定前缀',
  memory: '记忆',
  posts: '动态',
  catalog: '表情目录',
  time: '时间/签名',
  l1: 'L1 上下文',
};

function renderBreakdownBlock(container, breakdown, title) {
  container.appendChild(el('div', 'usage-breakdown-title', title));
  const total = Number(breakdown?.total) || 0;
  for (const key of ['stable', 'memory', 'posts', 'catalog', 'time', 'l1']) {
    const value = Number(breakdown?.[key]) || 0;
    const percent = total > 0 ? Math.round(value / total * 100) : 0;
    container.appendChild(el('div', 'usage-breakdown-row', `${BREAKDOWN_LABELS[key]} ${value.toLocaleString('zh-CN')} token · ${percent}%`));
  }
  container.appendChild(el('div', 'usage-breakdown-row total', `合计 ${total.toLocaleString('zh-CN')} token`));
}

function renderUsageBreakdown(data) {
  usageBreakdown.textContent = '';
  if (!data?.latest && !(data?.today?.breakdown?.total > 0)) {
    usageBreakdown.textContent = '还没有带费用拆解的聊天记录。';
    return;
  }
  if (data.latest) {
    renderBreakdownBlock(usageBreakdown, data.latest.breakdown, `最近一轮 · ${data.latest.tokensIn || 0} input token`);
  }
  if (data.today) {
    renderBreakdownBlock(usageBreakdown, data.today.breakdown, '今日累计（估算）');
    const hit = Number(data.today.cacheHit) || 0;
    const miss = Number(data.today.cacheMiss) || 0;
    const rate = data.today.cacheRate == null ? '—' : `${Math.round(Number(data.today.cacheRate) * 100)}%`;
    usageBreakdown.appendChild(el('div', 'usage-breakdown-row', `今日缓存命中率 ${rate}（hit ${hit.toLocaleString('zh-CN')} / miss ${miss.toLocaleString('zh-CN')}）`));
  }
}

async function localSwVersion() {
  try {
    if (!globalThis.caches?.keys) return '';
    const keys = await caches.keys();
    return keys.find((key) => key.startsWith('companion-v')) || '';
  } catch { return ''; }
}

function renderStatus(status, localSw) {
  if (!status) {
    statusVersionLine.textContent = '读取失败';
    return;
  }
  lastStatus = status;
  apiHost.textContent = status.baseUrlHost || '—';
  statusVersionLine.textContent = `${status.productVersion} · SW ${status.swVersion}`;
  const hasController = Boolean(globalThis.navigator?.serviceWorker?.controller);
  const mismatched = Boolean(localSw && status.swVersion && localSw !== status.swVersion && hasController);
  statusUpdateHint.hidden = !mismatched;
  statusUpdateBtn.hidden = !mismatched;
  statusDetails.textContent = '';
  const rows = [
    ['产品版本', status.productVersion],
    ['SW 版本', status.swVersion],
    ['数据 schema', `v${status.schemaVersion}`],
    ['模型', status.model || '—'],
    ['API 主机', status.baseUrlHost || '—'],
    ['今日预算', `¥${Number(status.budget?.spentYuan || 0).toFixed(3)} / ¥${Number(status.budget?.limitYuan || 0).toFixed(2)}`],
    ['已运行', status.uptimeSeconds != null ? `${Math.floor(status.uptimeSeconds / 60)} 分钟` : '—'],
  ];
  for (const [label, value] of rows) {
    const row = el('div', 'status-row');
    row.appendChild(el('span', 'muted', label));
    row.appendChild(el('b', '', String(value)));
    statusDetails.appendChild(row);
  }
  renderTerminalDirectory();
}

async function loadStatus() {
  try {
    const response = await apiFetch('/api/status');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderStatus(await response.json(), await localSwVersion());
  } catch {
    renderStatus(null, '');
  }
}

async function loadUsageBreakdown() {
  try {
    const response = await apiFetch('/api/usage/breakdown');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderUsageBreakdown(await response.json());
  } catch {
    usageBreakdown.textContent = '费用拆解读取失败。';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/gu, '+').replace(/_/gu, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

let pushInfo = { configured: false, enabled: false, subscriptions: 0 };

async function loadPushStatus() {
  try {
    const response = await apiFetch('/api/push/status');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    pushInfo = await response.json();
    const keyMismatch = pushInfo.configured && pushInfo.keyMatch === false;
    pushState.textContent = !pushInfo.configured
      ? '未配置 VAPID 密钥'
      : keyMismatch
        ? 'VAPID 公钥/私钥不匹配'
        : `${pushInfo.enabled ? '已开启' : '未开启'} · ${pushInfo.subscriptions} 个订阅`;
    pushGenerate.hidden = pushInfo.configured && !keyMismatch;
    pushGenerate.textContent = keyMismatch ? '重新生成密钥' : '生成推送密钥';
    pushToggle.hidden = !pushInfo.configured || keyMismatch;
    pushTest.hidden = !pushInfo.configured || keyMismatch;
    pushTest.disabled = !pushInfo.configured || keyMismatch || !pushInfo.subscriptions;
    if (keyMismatch) pushHint.textContent = '密钥不匹配，无法发送。请重新生成密钥，然后重新开启推送。';
    else pushHint.textContent = '默认关闭。iOS 需 16.4+，并从 Safari“添加到主屏幕”安装；开启必须由你点按授权。';
    pushToggle.textContent = pushInfo.enabled ? '关闭推送' : '开启推送';
  } catch {
    pushState.textContent = '读取失败';
  }
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('当前浏览器不支持推送；iOS 需 16.4+ 且从主屏幕打开');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('没有获得通知权限');
  const keyResponse = await apiFetch('/api/push/vapid-public-key');
  if (!keyResponse.ok) throw new Error('推送密钥尚未生成');
  const { publicKey } = await keyResponse.json();
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const response = await apiFetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.toJSON().keys }),
  });
  if (!response.ok) throw new Error(`订阅保存失败 HTTP ${response.status}`);
  await loadPushStatus();
}

async function disablePush() {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    await subscription.unsubscribe().catch(() => {});
    await apiFetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
  }
  await loadPushStatus();
}

async function loadWeatherStatus() {
  try {
    const response = await apiFetch('/api/weather/status');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    weatherCity.value = data.city || '';
    weatherState.textContent = data.configured
      ? `${data.city}${data.cache?.fetchedAt ? ` · ${new Date(data.cache.fetchedAt).toLocaleString('zh-CN')}` : ' · 等待首次更新'}`
      : '未配置';
  } catch {
    weatherState.textContent = '读取失败';
  }
}

async function loadPhotoStats() {
  try {
    const response = await apiFetch('/api/photos/stats');
    if (response.ok) photoStats = await response.json();
  } catch { /* 保持 0 */ }
}

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function makeThumbDataUrl(source) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

async function openPhotoOriginal(id) {
  try {
    const response = await apiFetch(`/api/photos/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (err) {
    toast(`打开原图失败：${err.message}`);
  }
}

async function ensurePhotoThumb(photo, image) {
  const setBlob = async (blob) => { image.src = URL.createObjectURL(blob); };
  try {
    const thumb = await apiFetch(photo.thumbUrl);
    if (thumb.ok) return setBlob(await thumb.blob());
    if (!photo.hasThumb) {
      const original = await apiFetch(`/api/photos/${encodeURIComponent(photo.id)}`);
      if (!original.ok) throw new Error(`HTTP ${original.status}`);
      const blob = await original.blob();
      await setBlob(blob);
      const thumbDataUrl = await makeThumbDataUrl(blob);
      const saved = await apiFetch(`/api/photos/${encodeURIComponent(photo.id)}/thumb`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl: thumbDataUrl }),
      });
      if (saved.ok) {
        const thumbBlob = await (await fetch(thumbDataUrl)).blob();
        await setBlob(thumbBlob);
      }
    }
  } catch {
    /* 图片失败不阻塞列表 */
  }
}

async function loadPhotoList() {
  if (!photoList) return;
  photoList.textContent = '读取中…';
  try {
    const response = await apiFetch('/api/photos');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rows = data.photos || [];
    photoList.textContent = '';
    if (!rows.length) {
      photoList.appendChild(el('div', 'muted', '还没有照片。'));
      return;
    }
    for (const photo of rows) {
      const row = el('div', 'photo-caption-row');
      const image = el('img', 'photo-caption-thumb');
      image.alt = '照片缩略图';
      image.loading = 'lazy';
      image.title = '点开原图';
      image.addEventListener('click', () => { void openPhotoOriginal(photo.id); });
      const meta = el('div', 'photo-caption-meta', `${photo.w}×${photo.h} · ${(Number(photo.bytes) / 1024 / 1024).toFixed(2)} MB · ${photo.captionBy === 'ai' ? 'AI caption' : '手写 caption'}`);
      const input = document.createElement('input');
      input.value = photo.caption || '';
      input.maxLength = 200;
      input.placeholder = 'caption（可留空）';
      const save = el('button', 'ghost compact', '保存');
      save.type = 'button';
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          const res = await apiFetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ caption: input.value.trim() }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast('caption 已保存');
          await loadPhotoList();
        } catch (err) {
          toast(`caption 保存失败：${err.message}`);
        } finally {
          save.disabled = false;
        }
      });
      row.appendChild(image);
      row.appendChild(meta);
      row.appendChild(input);
      row.appendChild(save);
      photoList.appendChild(row);
      void ensurePhotoThumb(photo, image);
    }
  } catch (err) {
    photoList.textContent = `照片列表读取失败：${err.message}`;
  }
}

async function loadReplySpeedSetting() {
  try {
    const response = await apiFetch('/api/settings');
    if (!response.ok) return;
    const info = await response.json();
    replySpeed.value = info.replySpeed || 'normal';
  } catch { /* 保持默认 */ }
}

statusUpdateBtn.addEventListener('click', () => {
  // 红线：有未发送输入或流式回复时绝不刷新。
  if (input.value.trim() || busy || awaitJob) {
    toast('先把输入发完，或等回复结束再更新');
    return;
  }
  location.href = '/reset.html';
});

pushGenerate.addEventListener('click', async () => {
  pushGenerate.disabled = true;
  try {
    const response = await apiFetch('/api/push/vapid', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: pushInfo.configured === true }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    toast('推送密钥已生成；请重新开启推送');
    await loadPushStatus();
  } catch (err) {
    toast(`生成失败：${err.message}`);
  } finally {
    pushGenerate.disabled = false;
  }
});

pushToggle.addEventListener('click', async () => {
  pushToggle.disabled = true;
  try {
    if (pushInfo.enabled) await disablePush();
    else await enablePush();
    setPushToggleLabel();
  } catch (err) {
    toast(`推送操作失败：${err.message}`);
  } finally {
    pushToggle.disabled = false;
  }
});

pushTest.addEventListener('click', async () => {
  try {
    const response = await apiFetch('/api/push/test', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    if (data.sent > 0) {
      toast(`测试推送：${data.sent} 条已送达`);
      return;
    }
    const failure = (data.results || []).find((item) => item.error);
    const reason = failure ? `HTTP ${failure.status || 0} ${failure.error}`.slice(0, 180) : '没有可用订阅';
    toast(`测试推送失败：${reason}`);
  } catch (err) {
    toast(`测试失败：${err.message}`);
  }
});

function setPushToggleLabel() {
  pushToggle.textContent = pushInfo.enabled ? '关闭推送' : '开启推送';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'push-resubscribe' && pushInfo.configured) {
      enablePush().catch((err) => toast(`推送重新订阅失败：${err.message}`));
    }
  });
}

weatherSave.addEventListener('click', async () => {
  weatherSave.disabled = true;
  try {
    const response = await apiFetch('/api/weather/city', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: weatherCity.value.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    toast(weatherCity.value.trim() ? '城市已保存' : '天气已关闭');
    await loadWeatherStatus();
  } catch (err) {
    toast(`城市保存失败：${err.message}`);
  } finally {
    weatherSave.disabled = false;
  }
});

weatherRefresh.addEventListener('click', async () => {
  weatherRefresh.disabled = true;
  try {
    const response = await apiFetch('/api/weather/refresh', { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    toast('天气已更新');
    await loadWeatherStatus();
  } catch (err) {
    toast(`天气更新失败：${err.message}`);
  } finally {
    weatherRefresh.disabled = false;
  }
});

const TERMINAL_MODULES = ['memes', 'memory', 'backup', 'data', 'status', 'advanced'];

function currentTerminalModule() {
  const hash = typeof location !== 'undefined' ? (location.hash || '') : '';
  const match = /^#\/terminal\/([a-z]+)$/u.exec(hash);
  return match && TERMINAL_MODULES.includes(match[1]) ? match[1] : '';
}

function todayLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderTerminalDirectory() {
  const health = lastHealth;
  const status = lastStatus;
  rowMemes.textContent = lastMemeCounts
    ? `${lastMemeCounts.total} 张 · 目录 ${lastMemeCounts.catalog}/50${lastMemeCounts.pending ? ` · 待审 ${lastMemeCounts.pending}` : ''}`
    : '读取中…';
  rowMemory.textContent = health ? `${Number(health.memoryFacts) || 0} 条事实 · ${Number(health.memorySummaries) || 0} 摘要` : '读取中…';
  rowBackup.textContent = health?.backup
    ? `最近备份 ${health.backup === todayLabel() ? '今天' : health.backup}`
    : '尚未备份';
  rowData.textContent = health ? `${Number(health.messages) || 0} 条消息` : '读取中…';
  rowStatus.textContent = status ? `${status.productVersion} · ${String(status.swVersion).replace(/^companion-(v\d+).*/u, '$1')}` : '读取中…';
  rowAdvanced.textContent = status ? `schema v${status.schemaVersion} · ${Math.floor((Number(status.uptimeSeconds) || 0) / 60)} 分钟` : '读取中…';
}

function simpleRows(container, rows) {
  container.textContent = '';
  for (const [label, value] of rows) {
    const row = el('div', 'status-row');
    row.appendChild(el('span', 'muted', label));
    row.appendChild(el('b', '', String(value)));
    container.appendChild(row);
  }
}

let photoStats = { count: 0, bytes: 0 };

function renderTerminalPages() {
  const health = lastHealth;
  const status = lastStatus;
  simpleRows(backupInfo, [
    ['最近备份', health?.backup ? (health.backup === todayLabel() ? `今天 · ${health.backup}` : health.backup) : '尚未备份'],
    ['保留策略', '最近 7 天'],
    ['备份范围', '聊天、记忆、表情、照片与配置（不含密钥）'],
  ]);
  simpleRows(dataInfo, [
    ['聊天消息', `${Number(health?.messages) || 0} 条`],
    ['长期记忆', `${Number(health?.memoryFacts) || 0} 条事实 · ${Number(health?.memorySummaries) || 0} 条摘要`],
    ['本机缓存', (() => { try { const raw = localStorage.getItem(MSG_CACHE_KEY); return raw ? `${JSON.parse(raw).messages?.length || 0} 条消息` : '无'; } catch { return '无'; } })()],
    ['数据目录', 'app/data（仅电脑端）'],
    ['照片', `${photoStats.count} 张 · ${(photoStats.bytes / 1024 / 1024).toFixed(1)} MB`],
  ]);
  simpleRows(advancedInfo, [
    ['产品版本', status?.productVersion || '—'],
    ['SW 版本', status?.swVersion || '—'],
    ['数据 schema', status ? `v${status.schemaVersion}` : '—'],
    ['已运行', status ? `${Math.floor((Number(status.uptimeSeconds) || 0) / 60)} 分钟` : '—'],
  ]);
}

async function loadTerminalModule(module) {
  if (module === 'memes') await loadMemes({ render: true });
  else if (module === 'memory') await loadMemory('');
  else if (module === 'status') {
    await loadStatus();
    await loadPushStatus();
  } else if (module === 'data') {
    await loadPhotoStats();
    renderTerminalPages();
    await loadWeatherStatus();
    await loadPhotoList();
  } else renderTerminalPages();
}

function showTerminalModule(module) {
  terminalModule = module;
  const subpage = Boolean(module);
  terminalDirectory.hidden = subpage;
  consoleClose.hidden = !subpage;
  if (subpage) {
    consoleCloseIcon.textContent = '‹';
    consoleClose.setAttribute('aria-label', '返回终端目录');
  }
  apiSection.hidden = subpage;
  usageSection.hidden = subpage;
  balanceSection.hidden = true;
  statusSection.hidden = !subpage || module !== 'status';
  memorySection.hidden = !subpage || module !== 'memory';
  memeSection.hidden = !subpage || module !== 'memes';
  backupSection.hidden = !subpage || module !== 'backup';
  dataSection.hidden = !subpage || module !== 'data';
  advancedSection.hidden = !subpage || module !== 'advanced';
  futureSection.hidden = module !== 'advanced';
  renderTerminalDirectory();
  if (subpage) void loadTerminalModule(module);
}

function handleTerminalHash() {
  if (consolePanel.hidden) return;
  showTerminalModule(currentTerminalModule());
}

window.addEventListener('hashchange', () => {
  if (!consolePanel.hidden) handleTerminalHash();
});
document.querySelectorAll('[data-terminal]').forEach((button) => {
  button.addEventListener('click', () => {
    const module = button.dataset.terminal;
    if (TERMINAL_MODULES.includes(module)) location.hash = `#/terminal/${module}`;
  });
});

function showBudgetDialog(text, id, budget) {
  pendingBudget = { text, id };
  const spent = Number(budget?.spentYuan || 0).toFixed(3);
  const limit = Number(budget?.limitYuan || 0).toFixed(2);
  const tokenHit = Number(budget?.tokens || 0) >= Number(budget?.tokenLimit || Infinity);
  const reason = tokenHit
    ? `今日 token 用量 ${Number(budget.tokens).toLocaleString('zh-CN')} / ${Number(budget.tokenLimit).toLocaleString('zh-CN')}`
    : `已花 ¥${spent} / 上限 ¥${limit}`;
  budgetDialogText.textContent = `${reason}。选择「今天继续」后，今天不再拦截，花费会继续累计；明天 0 点自动恢复。`;
  budgetDialog.hidden = false;
}

budgetCancel.addEventListener('click', () => {
  budgetDialog.hidden = true;
  pendingBudget = null;
});

budgetContinue.addEventListener('click', async () => {
  budgetContinue.disabled = true;
  try {
    const response = await apiFetch('/api/budget/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'day' }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    budgetDialog.hidden = true;
    const job = pendingBudget;
    pendingBudget = null;
    toast('今天不再限制额度');
    if (job) send(job.text, job.id);
  } catch (err) {
    budgetDialogText.textContent = `继续失败：${err.message}`;
  } finally {
    budgetContinue.disabled = false;
  }
});

budgetResetBtn.addEventListener('click', async () => {
  budgetResetBtn.disabled = true;
  try {
    const response = await apiFetch('/api/budget/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'clear' }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    toast('已恢复今日限额');
    if (!consolePanel.hidden) loadConsole();
  } catch (err) {
    toast(`恢复失败：${err.message}`);
  } finally {
    budgetResetBtn.disabled = false;
  }
});

function displaySettings(info) {
  apiModel.textContent = info.model || 'deepseek-flash';
  replySpeed.value = info.replySpeed || 'normal';
  apiKeyState.textContent = info.keySource === 'environment'
    ? '由环境变量管理'
    : (info.apiKeyConfigured ? '已保存在本机' : '尚未配置');
  const connectionLabel = {
    mock: '模拟模式',
    connected: '连接成功',
    failed: '连接失败',
    untested: 'API 已配置 · 待测试',
    not_configured: '未配置 API',
  };
  apiModeBadge.textContent = connectionLabel[info.connectionStatus] || (info.mode === 'mock' ? '模拟模式' : 'API 已配置');
  apiModeBadge.classList.toggle('mock', info.mode === 'mock');
  apiModeBadge.classList.toggle('live', info.mode !== 'mock');
  const editable = info.keyEditable !== false;
  apiKeyInput.disabled = !editable;
  apiSaveBtn.disabled = !editable;
  apiClearBtn.disabled = !editable || !info.apiKeyConfigured;
  apiTestBtn.disabled = !info.apiKeyConfigured;
  const embedding = info.embedding || {};
  embeddingBaseInput.value = embedding.baseUrl || '';
  embeddingModelInput.value = embedding.model || '';
  embeddingPriceInput.value = embedding.priceYuanPerMTok ?? '';
  embeddingKeyInput.value = '';
  embeddingKeyInput.disabled = embedding.keySource === 'environment';
  embeddingClearBtn.disabled = !embedding.apiKeyConfigured || embedding.keySource === 'environment';
  embeddingTestBtn.disabled = !embedding.configured;
  memoryIndexBtn.disabled = !embedding.configured;
  embeddingMsg.textContent = embedding.configured
    ? `已配置 ${embedding.model} · 已索引 ${embedding.indexCount || 0}/${embedding.memoryCount || 0} 条。向量调用按所填单价记入每日预算。`
    : '不配置也能使用本地关键词检索。配置时请填写单价；免费服务填 0。Key 只保存在 PC 服务端。';
}

function renderMemoryGraph(graph) {
  memoryGraphHost.textContent = '';
  const nodes = (graph?.nodes || []).slice(0, 48);
  if (!nodes.length) {
    memoryGraphHost.textContent = '记忆图会在生成摘要并找到关联后出现。';
    return;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const columns = { fact: 100, summary: 100, entity: 310, source: 530 };
  const counts = { fact: 0, summary: 0, entity: 0, source: 0 };
  const positions = new Map();
  for (const node of nodes) {
    const key = columns[node.kind] === undefined ? 'entity' : node.kind;
    const y = 36 + counts[key] * 38;
    counts[key]++;
    positions.set(node.id, { x: columns[key] ?? 310, y });
  }
  const height = Math.max(180, ...Object.values(counts).map((count) => 36 + count * 38));
  svg.setAttribute('viewBox', `0 0 620 ${height}`);
  svg.setAttribute('role', 'presentation');
  for (const edge of (graph.edges || [])) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(from.x)); line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x)); line.setAttribute('y2', String(to.y));
    svg.appendChild(line);
  }
  for (const node of nodes) {
    const point = positions.get(node.id);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(point.x)); circle.setAttribute('cy', String(point.y)); circle.setAttribute('r', '7');
    if (node.kind === 'source') circle.setAttribute('class', 'source-node');
    if (node.kind === 'entity') circle.setAttribute('class', 'entity-node');
    svg.appendChild(circle);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(point.x + 12)); label.setAttribute('y', String(point.y + 4));
    label.textContent = String(node.label || '').slice(0, 24);
    svg.appendChild(label);
  }
  memoryGraphHost.appendChild(svg);
}

function renderMemoryResults(records) {
  memoryResults.textContent = '';
  if (!records.length) {
    memoryResults.appendChild(el('div', 'muted', '还没有匹配的记忆。'));
    return;
  }
  for (const record of records) {
    const card = el('article', 'memory-record');
    const head = el('div', 'memory-record-head');
    head.appendChild(el('b', '', record.kind === 'fact' ? '明确事实' : '对话摘要'));
    head.appendChild(el('span', '', `重要度 ${record.importance || 3}`));
    card.appendChild(head);
    const area = document.createElement('textarea');
    area.value = record.text || record.quote || record.summary || '';
    area.setAttribute('aria-label', '记忆内容');
    card.appendChild(area);
    const sourceLabel = (record.sources || []).map((source) => `消息 ${source.seq}：${source.text.slice(0, 80)}`).join('；')
      || (record.sourceSeq ? `来源消息 ${record.sourceSeq}` : '未关联到来源消息');
    card.appendChild(el('div', 'memory-record-source', sourceLabel));
    const actions = el('div', 'memory-record-actions');
    const save = el('button', 'ghost', '保存修改');
    save.type = 'button';
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const response = await apiFetch(`/api/memory/${encodeURIComponent(record.id)}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: area.value }),
        });
        if (!response.ok) throw new Error((await response.json()).message || `HTTP ${response.status}`);
        toast('记忆已更新');
        await loadMemory(memorySearchInput.value.trim());
      } catch (err) { toast(`保存失败：${err.message}`); }
      finally { save.disabled = false; }
    });
    const remove = el('button', 'danger', '删除');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (remove.dataset.confirm !== 'yes') { remove.dataset.confirm = 'yes'; remove.textContent = '确认删除'; return; }
      remove.disabled = true;
      try {
        const response = await apiFetch(`/api/memory/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        toast('记忆已删除');
        await loadMemory(memorySearchInput.value.trim());
      } catch (err) { toast(`删除失败：${err.message}`); }
      finally { remove.disabled = false; }
    });
    actions.appendChild(save); actions.appendChild(remove); card.appendChild(actions);
    memoryResults.appendChild(card);
  }
}

function renderEmotion(points = []) {
  emotionChart.textContent = '';
  const rows = points.slice(-30);
  if (!rows.length) { emotionCaption.textContent = '聊过几次之后，这里会慢慢留下状态变化'; return; }
  emotionCaption.textContent = `${rows.length} 个状态记录 · 只记录她自己的状态`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 600 150');
  for (const y of [20, 75, 130]) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0'); line.setAttribute('x2', '600'); line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    line.setAttribute('class', 'emotion-gridline'); svg.appendChild(line);
  }
  for (const [key, cls, map] of [
    ['pleasure', 'emotion-pleasure', (v) => 130 - (Math.max(-1, Math.min(1, Number(v) || 0)) + 1) * 55],
    ['energy', 'emotion-energy', (v) => 130 - Math.max(0, Math.min(1, Number(v) || 0)) * 110],
  ]) {
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const denom = Math.max(1, rows.length - 1);
    poly.setAttribute('points', rows.map((row, i) => `${(i / denom) * 600},${map(row[key])}`).join(' '));
    poly.setAttribute('class', cls); svg.appendChild(poly);
  }
  emotionChart.appendChild(svg);
}

function renderSpace(posts) {
  spacePosts.textContent = '';
  spaceEmpty.hidden = posts.length > 0;
  for (const post of posts) {
    const card = el('article', 'space-post');
    const head = el('div', 'space-post-head');
    head.appendChild(el('b', '', post.author === 'ai' ? appName.textContent : '我'));
    head.appendChild(el('time', '', new Date(post.at).toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })));
    card.appendChild(head);
    card.appendChild(el('div', 'space-post-text', post.text));
    if (post.author === 'ai' && Array.isArray(post.sourceSeqs) && post.sourceSeqs.length) {
      card.appendChild(el('div', 'space-source', `关联聊天消息 ${post.sourceSeqs.join('、')}`));
    }
    const comments = el('div', 'space-comments');
    for (const comment of post.comments || []) {
      const row = el('div', 'space-comment'); row.appendChild(el('b', '', comment.author === 'ai' ? appName.textContent : '我'));
      row.appendChild(document.createTextNode(comment.text)); comments.appendChild(row);
    }
    card.appendChild(comments);
    const form = el('form', 'space-comment-form');
    const field = document.createElement('input'); field.maxLength = 800; field.placeholder = '留一句评论…'; field.setAttribute('aria-label', '评论内容');
    const submit = el('button', '', '发送'); submit.type = 'submit'; form.appendChild(field); form.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const text = field.value.trim(); if (!text) return;
      submit.disabled = true;
      try {
        const response = await apiFetch(`/api/space/posts/${encodeURIComponent(post.id)}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        await loadSpace();
      } catch (err) { toast(`评论失败：${err.message}`); }
      finally { submit.disabled = false; }
    });
    card.appendChild(form); spacePosts.appendChild(card);
  }
}

async function loadSpace() {
  try {
    const [spaceResponse, emotionResponse] = await Promise.all([apiFetch('/api/space'), apiFetch('/api/emotion?days=30')]);
    if (!spaceResponse.ok || !emotionResponse.ok) throw new Error('读取失败');
    const space = await spaceResponse.json(); const emotion = await emotionResponse.json();
    spaceSignature.textContent = space.signature || '';
    renderSpace(space.posts || []); renderEmotion(emotion.points || []);
  } catch (err) { toast(`空间暂时无法加载：${err.message}`); }
}

const rootViews = { inbox: inboxView, chat: chatView, contacts: contactsView, space: spaceView, 'ai-profile': aiProfileView, 'user-profile': userProfileView };
function switchMainView(view, { keepScroll = false } = {}) {
  activeView = view;
  if (view === 'chat') {
    stopUnreadEvents();
    markChatRead();
  } else {
    updateUnreadBadge();
    void startUnreadEvents();
  }
  // 离开聊天页时取消尚未执行的贴底滚动，避免它晚一帧把阅读位置冲掉
  if (view !== 'chat') {
    stickToBottom = false;
    cancelScheduledScroll();
  }
  for (const [name, node] of Object.entries(rootViews)) node.hidden = name !== view;
  document.body.classList.toggle('console-open', view === 'console');
  appEl.classList.toggle('chat-mode', view === 'chat');
  document.getElementById('tabs').hidden = view === 'chat' || view === 'ai-profile' || view === 'user-profile';
  tabChat.classList.toggle('active', view === 'inbox');
  tabContacts.classList.toggle('active', view === 'contacts');
  tabSpace.classList.toggle('active', view === 'space');
  tabConsole.classList.toggle('active', view === 'console');
  if (view === 'space') loadSpace();
  // 从列表进入聊天要贴底；从 AI 资料返回聊天时保留原来的阅读位置
  if (view === 'chat' && !keepScroll) {
    stickToBottom = true;
    scheduleScroll(true);
  }
  if (view === 'console') {
    consolePanel.classList.add('mobile-page');
    consoleCloseIcon.textContent = '‹';
    consolePanel.hidden = false;
    loadConsole();
  } else {
    // 必须同时移除全屏类和 hidden 状态；否则 mobile-page 的 display 规则可能盖过 hidden。
    consolePanel.classList.remove('mobile-page');
    consolePanel.hidden = true;
  }
  if (view === 'ai-profile') { refreshAiInfo(); loadMemes(); void loadReplySpeedSetting(); }
}

tabChat.addEventListener('click', () => switchMainView('inbox'));
tabContacts.addEventListener('click', () => switchMainView('contacts'));
tabSpace.addEventListener('click', () => switchMainView('space'));
tabConsole.addEventListener('click', () => switchMainView('console'));
conversationCard.addEventListener('click', () => switchMainView('chat'));
document.getElementById('contactAnam').addEventListener('click', () => { profileReturnView = 'contacts'; switchMainView('ai-profile'); });
document.getElementById('addAiPreview').addEventListener('click', () => toast('添加 AI 将在后续版本开放。'));
conversationSearch.addEventListener('input', () => { const q = conversationSearch.value.trim().toLowerCase(); conversationCard.hidden = !!q && !`${inboxAiName.textContent} ${inboxPreview.textContent}`.toLowerCase().includes(q); });
chatBack.addEventListener('click', () => switchMainView('inbox'));
aiProfileOpen.addEventListener('click', () => { profileReturnView = 'chat'; switchMainView('ai-profile'); });
aiProfileBack.addEventListener('click', () => switchMainView(profileReturnView, { keepScroll: profileReturnView === 'chat' }));
userProfileOpen.addEventListener('click', openUserProfile);
userProfileBack.addEventListener('click', () => switchMainView('inbox'));
spacePostToggle.addEventListener('click', () => { spaceComposer.hidden = !spaceComposer.hidden; if (!spaceComposer.hidden) spaceInput.focus(); });
spaceCancel.addEventListener('click', () => { spaceComposer.hidden = true; spaceInput.value = ''; });
spaceComposer.addEventListener('submit', async (event) => {
  event.preventDefault(); const text = spaceInput.value.trim(); if (!text) return;
  const submit = spaceComposer.querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    const response = await apiFetch('/api/space/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    spaceInput.value = ''; spaceComposer.hidden = true; await loadSpace();
  } catch (err) { toast(`发布失败：${err.message}`); }
  finally { submit.disabled = false; }
});

async function loadMemory(query = '') {
  try {
    const response = await apiFetch(`/api/memory${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    memoryStats.textContent = `${data.counts.facts} 条事实 · ${data.counts.summaries} 条摘要 · ${data.counts.indexed} 条向量`;
    renderMemoryGraph(data.graph);
    renderMemoryResults(data.records || []);
  } catch (err) {
    memoryStats.textContent = '记忆读取失败';
    memoryResults.textContent = `暂时无法读取：${err.message}`;
  }
}

async function saveEmbeddingSettings(clear = false) {
  embeddingSaveBtn.disabled = true;
  embeddingMsg.textContent = '正在保存…';
  try {
    const embedding = {
      baseUrl: embeddingBaseInput.value.trim(),
      model: embeddingModelInput.value.trim(),
      priceYuanPerMTok: embeddingPriceInput.value,
    };
    if (clear) embedding.clearApiKey = true;
    else if (embeddingKeyInput.value.trim()) embedding.apiKey = embeddingKeyInput.value.trim();
    const response = await apiFetch('/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ embedding }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    displaySettings(data.settings);
    embeddingMsg.textContent = 'Embedding 设置已保存在 PC 服务端。';
  } catch (err) { embeddingMsg.textContent = `保存失败：${err.message}`; }
  finally { embeddingSaveBtn.disabled = false; }
}

function renderBalance(info) {
  if (info.balanceInfos?.length) {
    balanceValue.textContent = info.balanceInfos
      .map((row) => `${row.currency} ${Number(row.totalBalance).toFixed(2)}`)
      .join('　·　');
  } else {
    balanceValue.textContent = info.error === '尚未配置 API key' ? '尚未配置' : '暂无余额数据';
  }
  const updated = info.updatedAt ? new Date(info.updatedAt).toLocaleString('zh-HK') : '';
  if (info.ok) {
    balanceStatus.textContent = `${info.available ? '账户可用于 API 调用' : '账户余额不足'}${updated ? ` · 更新于 ${updated}` : ''}`;
  } else {
    balanceStatus.textContent = `${info.error || '余额查询暂不可用'}${info.stale ? ' · 显示上次查询结果' : ''}${updated ? ` · 上次更新 ${updated}` : ''}`;
  }
}

async function refreshBalance() {
  balanceRefresh.disabled = true;
  balanceStatus.textContent = '正在查询账户余额…';
  try {
    const r = await apiFetch('/api/provider/balance');
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return; }
    const info = await r.json();
    renderBalance(info);
  } catch {
    balanceStatus.textContent = '余额查询暂不可用；下次成功查询前保留上次结果。';
  } finally {
    balanceRefresh.disabled = false;
  }
}

async function loadConsole() {
  apiSettingsMsg.textContent = '正在读取设置…';
  const [settingsResult, healthResult] = await Promise.allSettled([
    apiFetch('/api/settings'), getHealth(),
  ]);
  if (settingsResult.status === 'fulfilled' && settingsResult.value.ok) {
    const info = await settingsResult.value.json();
    displaySettings(info);
    apiSettingsMsg.textContent = info.keyEditable === false
      ? '当前 Key 由环境变量管理，请在电脑服务配置中修改。'
      : 'Key 只保存在电脑服务端，不会回显到网页。测试模型会消耗少量 token 并计入本地预算。';
  } else {
    apiSettingsMsg.textContent = '读取 API 设置失败。';
  }
  if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
    const health = await healthResult.value.json();
    lastHealth = health;
    showConsoleUsage(health.budget);
  }
  await Promise.allSettled([loadStatus(), loadUsageBreakdown(), loadMemes({ render: false })]);
  await refreshBalance();
  handleTerminalHash();
}

embeddingSaveBtn.addEventListener('click', () => saveEmbeddingSettings(false));
embeddingClearBtn.addEventListener('click', () => saveEmbeddingSettings(true));
embeddingTestBtn.addEventListener('click', async () => {
  embeddingTestBtn.disabled = true;
  embeddingMsg.textContent = '正在测试连接…';
  try {
    const response = await apiFetch('/api/settings/embedding/test', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    embeddingMsg.textContent = `${data.message} ${data.mode === 'mock' ? '未连接外部服务。' : ''}`;
    displaySettings(await (await apiFetch('/api/settings')).json());
  } catch (err) { embeddingMsg.textContent = `测试失败：${err.message}`; }
  finally { embeddingTestBtn.disabled = false; }
});
memoryIndexBtn.addEventListener('click', async () => {
  memoryIndexBtn.disabled = true;
  embeddingMsg.textContent = '正在建立语义索引…';
  try {
    const response = await apiFetch('/api/memory/index', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    embeddingMsg.textContent = data.message;
    await loadMemory(memorySearchInput.value.trim());
    displaySettings(await (await apiFetch('/api/settings')).json());
  } catch (err) { embeddingMsg.textContent = `索引未完成：${err.message}`; }
  finally { memoryIndexBtn.disabled = false; }
});
memorySearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadMemory(memorySearchInput.value.trim());
});

// 手动整理一次记忆：用于验证/补整理，不受"满 20 轮"限制
memorySummarizeBtn.addEventListener('click', async () => {
  const label = memorySummarizeBtn.textContent;
  memorySummarizeBtn.disabled = true;
  memorySummarizeBtn.textContent = '整理中…';
  memoryStats.textContent = '正在整理记忆（可能需要十几秒）…';
  try {
    const response = await apiFetch('/api/memory/summarize', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const count = data.record?.sourceIds?.length || 0;
    await loadMemory(memorySearchInput.value.trim());
    memoryStats.textContent = `已整理 1 条摘要（来源 ${count} 条消息）`;
  } catch (err) {
    const reason = /fetch|network/i.test(String(err.message)) ? '连不上服务，确认电脑上的窗口还开着' : err.message;
    memoryStats.textContent = `整理失败：${reason}`;
  } finally {
    memorySummarizeBtn.disabled = false;
    memorySummarizeBtn.textContent = label;
  }
});

// ---------- 对话摘要整页 ----------
function summaryWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadSummaries() {
  summaryList.textContent = '';
  summaryList.appendChild(el('div', 'summary-empty', '读取中…'));
  try {
    const response = await apiFetch('/api/memory/summaries');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const summaries = data.summaries || [];
    summaryList.textContent = '';
    if (!summaries.length) {
      summaryList.appendChild(el('div', 'summary-empty', '还没有摘要。聊满 20 轮，或在控制台点「立即整理记忆」。'));
      return;
    }
    for (const item of summaries) {
      const card = el('article', 'summary-card');
      const time = el('time', '', summaryWhen(item.at));
      time.dateTime = item.at || '';
      card.appendChild(time);
      if (item.sourceStartSeq && item.sourceEndSeq) {
        card.appendChild(el('span', 'summary-badge', `消息 ${item.sourceStartSeq}–${item.sourceEndSeq}`));
      }
      if (item.fallback) card.appendChild(el('span', 'summary-badge', '低置信度'));
      card.appendChild(el('p', '', item.summary || ''));
      const claims = (item.claims || []).slice(0, 8);
      if (claims.length) {
        const list = el('ul', 'summary-claims');
        for (const claim of claims) {
          const li = el('li', '', claim.text || '');
          if (claim.evidence) li.appendChild(document.createTextNode(`「${claim.evidence}」`));
          list.appendChild(li);
        }
        card.appendChild(list);
      }
      summaryList.appendChild(card);
    }
  } catch (err) {
    summaryList.textContent = '';
    summaryList.appendChild(el('div', 'summary-empty', `读取失败：${err.message}`));
  }
}

function openSummaryPanel() {
  summaryPanel.hidden = false;
  loadSummaries();
}

function closeSummaryPanel() {
  summaryPanel.hidden = true;
}

summaryOpenBtn.addEventListener('click', openSummaryPanel);
summaryBack.addEventListener('click', closeSummaryPanel);

// ---------- 表情包库（V2 Phase 1） ----------
function updateMemeSummary(counts, enabled) {
  if (counts) {
    memeCounts.textContent = `全库 ${counts.total}/100 · 合格 ${counts.qualified} · 目录 ${counts.catalog}/50 · 等待 ${counts.waiting}`;
    memeEntryCounts.textContent = `共 ${counts.total} 张 · 已启用 ${counts.enabled} 张${counts.pending ? ` · 待审核 ${counts.pending}` : ''}`;
    lastMemeCounts = counts;
    renderTerminalDirectory();
  }
  memeEnabled = Boolean(enabled);
  memeState.textContent = `总开关：${memeEnabled ? '已在 AI 资料开启' : '已在 AI 资料关闭（AI 暂不发表情）'}`;
  memeEnabledToggle.checked = memeEnabled;
}

function updateMemeStrategy(strategy, stats) {
  if (strategy) {
    memeProbability.value = String(Number(strategy.probability ?? 100));
    memeProbabilityValue.textContent = `${Number(strategy.probability ?? 100)}%`;
    memeMinGap.value = String(Number(strategy.minGapReplies ?? 2));
    memeSoftFrequency.checked = strategy.softFrequency === true;
  }
  if (stats) {
    const total = Number(stats.recentAiReplies) || 0;
    const withSticker = Number(stats.recentWithSticker) || 0;
    memeStrategyStats.textContent = total
      ? `最近 ${total} 条 AI 回复：${withSticker} 条带表情`
      : '最近 AI 回复：暂无';
  }
}

async function saveMemeStrategy(patch) {
  try {
    const response = await apiFetch('/api/memes/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    updateMemeStrategy(data.strategy, data.stats);
    memeStrategyMsg.textContent = '已保存';
    clearTimeout(memeStrategyTimer);
    memeStrategyTimer = setTimeout(() => { memeStrategyMsg.textContent = ''; }, 1500);
  } catch (err) {
    memeStrategyMsg.textContent = `保存失败：${err.message}`;
    await loadMemes();
  }
}

function scheduleMemeStrategy(patch) {
  Object.assign(memeStrategyDraft, patch);
  clearTimeout(memeStrategyTimer);
  memeStrategyTimer = setTimeout(() => {
    const body = memeStrategyDraft;
    memeStrategyDraft = {};
    void saveMemeStrategy(body);
  }, 300);
}

async function refreshAiLabelAvailability() {
  if (aiLabelChecked) return;
  try {
    const response = await apiFetch('/api/settings');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();
    aiLabelAvailable = info.apiKeyConfigured === true && info.mode !== 'mock';
  } catch { aiLabelAvailable = false; }
  aiLabelChecked = true;
  memeAiBatch.disabled = !aiLabelAvailable;
  memeAiMsg.textContent = aiLabelAvailable ? '' : 'AI 草稿需要真实模型 key，mock 模式下不可用。';
}

async function loadMemes({ render = null } = {}) {
  try {
    await refreshAiLabelAvailability();
    const response = await apiFetch('/api/memes');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    memeList = data.memes || [];
    updateMemeSummary(data.counts, data.enabled !== false);
    updateMemeStrategy(data.strategy, data.stats);
    const shouldRender = render == null ? terminalModule === 'memes' : render;
    if (!consolePanel.hidden && shouldRender) renderMemeGrid();
  } catch (err) {
    memeMsg.textContent = `表情包读取失败：${err.message}`;
  }
}

async function setMemeThumb(meme, holder) {
  if (meme.corrupted) {
    holder.classList.remove('loading');
    holder.classList.add('failed');
    holder.textContent = '[文件缺失]';
    return;
  }
  try {
    const url = await getMemePreviewUrl(meme);
    const image = el('img', 'meme-thumb-img');
    image.alt = meme.label || '表情';
    image.loading = 'lazy';
    image.onerror = () => {
      holder.className = 'meme-thumb placeholder failed';
      holder.textContent = '[加载失败]';
      image.remove();
    };
    image.src = url;
    holder.className = 'meme-thumb';
    holder.textContent = '';
    holder.appendChild(image);
  } catch {
    holder.classList.remove('loading');
    holder.classList.add('failed');
    holder.textContent = '[加载失败]';
  }
}

function renderMemeGrid() {
  memeGrid.textContent = '';
  memeEmpty.hidden = memeList.length > 0;
  for (const meme of memeList) {
    const card = el('article', 'meme-card');
    card.dataset.id = meme.id;
    const holder = el('div', 'meme-thumb placeholder loading', '…');
    card.appendChild(holder);
    void setMemeThumb(meme, holder);

    const label = el('input');
    label.type = 'text';
    label.maxLength = 20;
    label.placeholder = '名称 / 描述（≤20 字）';
    label.value = meme.label || meme.ai_label || '';
    label.addEventListener('change', () => patchMeme(meme.id, { label: label.value }));
    card.appendChild(label);

    const tags = el('input');
    tags.type = 'text';
    tags.placeholder = '标签（最多 2 个，逗号分隔）';
    tags.value = (meme.tags?.length ? meme.tags : meme.ai_tags || []).join('，');
    tags.addEventListener('change', () => patchMeme(meme.id, { tags: tags.value }));
    card.appendChild(tags);

    if (meme.ai_label || meme.ai_tags?.length) {
      card.appendChild(el('div', 'meme-ai-draft', `AI 草稿：${meme.ai_label || '—'} / ${(meme.ai_tags || []).join('、') || '—'}`));
    }

    const flags = el('div', 'meme-flags');
    const addFlag = (key, text) => {
      const box = el('label');
      const input = el('input');
      input.type = 'checkbox';
      input.checked = Boolean(meme[key]);
      if (key === 'reviewed') input.disabled = !String(meme.label || meme.ai_label || '').trim();
      input.addEventListener('change', () => {
        const patch = { [key]: input.checked };
        if (key === 'reviewed' && input.checked && !String(meme.label || '').trim()) {
          patch.label = label.value;
          patch.tags = tags.value;
        }
        patchMeme(meme.id, patch);
      });
      box.appendChild(input);
      box.appendChild(document.createTextNode(text));
      flags.appendChild(box);
    };
    addFlag('reviewed', '审核');
    addFlag('enabled', '启用');
    addFlag('pinned', '置顶');
    card.appendChild(flags);

    if (meme.corrupted) card.appendChild(el('div', 'meme-broken', '文件缺失，历史消息会显示占位'));
    const actions = el('div', 'meme-actions');
    const aiDraft = el('button', 'ghost compact', 'AI 草稿');
    aiDraft.type = 'button';
    aiDraft.disabled = !aiLabelAvailable;
    aiDraft.title = aiLabelAvailable ? '生成草稿，不会自动审核' : '需要真实模型 key';
    aiDraft.addEventListener('click', () => { void generateMemeAiDraft(meme.id, aiDraft); });
    actions.appendChild(aiDraft);
    const remove = el('button', 'ghost', '删除');
    remove.type = 'button';
    remove.addEventListener('click', () => openMemeDelete(meme));
    actions.appendChild(remove);
    card.appendChild(actions);
    memeGrid.appendChild(card);
  }
}

async function generateMemeAiDraft(id, button) {
  if (!aiLabelAvailable) return;
  button.disabled = true;
  memeAiMsg.textContent = '正在生成 AI 草稿…';
  try {
    const response = await apiFetch(`/api/memes/${encodeURIComponent(id)}/ai-label`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const index = memeList.findIndex((meme) => meme.id === id);
    if (index >= 0) memeList[index] = data.meme;
    memeAiMsg.textContent = `AI 草稿已生成：${data.meme?.ai_label || ''}`;
    renderMemeGrid();
  } catch (err) {
    memeAiMsg.textContent = `AI 草稿失败：${err.message}`;
    button.disabled = false;
  }
}

async function patchMeme(id, patch) {
  try {
    const response = await apiFetch(`/api/memes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const index = memeList.findIndex((meme) => meme.id === id);
    if (index >= 0) memeList[index] = data.meme;
    updateMemeSummary(data.counts, memeEnabled);
    renderMemeGrid();
  } catch (err) {
    memeMsg.textContent = `保存失败：${err.message}`;
    await loadMemes();
  }
}

async function openMemeDelete(meme) {
  try {
    const response = await apiFetch(`/api/memes/${encodeURIComponent(meme.id)}/usage`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    memeDeleteTarget = meme;
    memeDeleteText.textContent = data.references > 0
      ? `删除后这 ${data.references} 条历史消息只剩「[表情]」占位，且无法恢复。`
      : '没有历史消息引用它，删除后不可恢复。';
    memeDeleteDialog.hidden = false;
  } catch (err) {
    toast(`读取引用数失败：${err.message}`);
  }
}

memeProbability.addEventListener('input', () => {
  memeProbabilityValue.textContent = `${memeProbability.value}%`;
});
memeProbability.addEventListener('change', () => {
  scheduleMemeStrategy({ probability: Number(memeProbability.value) });
});
memeMinGap.addEventListener('change', () => {
  const value = Math.max(0, Math.min(5, Math.round(Number(memeMinGap.value) || 0)));
  memeMinGap.value = String(value);
  scheduleMemeStrategy({ minGapReplies: value });
});
memeSoftFrequency.addEventListener('change', () => {
  scheduleMemeStrategy({ softFrequency: memeSoftFrequency.checked });
});

memeAiBatch.addEventListener('click', async () => {
  if (!aiLabelAvailable) return;
  memeAiBatch.disabled = true;
  memeAiMsg.textContent = '正在为待审核生成草稿…';
  try {
    const response = await apiFetch('/api/memes/ai-label-batch', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const ok = (data.results || []).filter((item) => item.ok).length;
    const failed = (data.results || []).filter((item) => !item.ok).length;
    memeAiMsg.textContent = `批量完成：成功 ${ok}，失败 ${failed}，跳过已有草稿。`;
    await loadMemes();
  } catch (err) {
    memeAiMsg.textContent = `批量生成失败：${err.message}`;
  } finally {
    memeAiBatch.disabled = !aiLabelAvailable;
  }
});

memeFile.addEventListener('change', async (event) => {  const files = [...(event.target.files || [])];
  event.target.value = '';
  if (!files.length) return;
  memeMsg.textContent = '正在上传…';
  for (const file of files) {
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('超过 2MB');
      const prepared = await prepareMemeImage(file);
      const response = await apiFetch('/api/memes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl: prepared.dataUrl, previewDataUrl: prepared.previewDataUrl, label: '', tags: [] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      memeMsg.textContent = data.duplicate ? '这张已经在库里了。' : '已上传；填名称并审核后 AI 才能用。';
    } catch (err) {
      memeMsg.textContent = `上传失败：${err.message}`;
    }
  }
  await loadMemes();
});

memeEnabledToggle.addEventListener('change', async () => {
  const enabled = memeEnabledToggle.checked;
  try {
    const response = await apiFetch('/api/memes/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    updateMemeSummary(null, enabled);
    toast(enabled ? '已允许她发表情' : '已关闭表情发送');
  } catch (err) {
    memeEnabledToggle.checked = !enabled;
    toast(`保存失败：${err.message}`);
  }
});

memeEntry.addEventListener('click', () => {
  switchMainView('console');
  setTimeout(() => {
    const section = document.getElementById('memeSection');
    if (!section) return;
    section.scrollIntoView({ block: 'start', behavior: 'smooth' });
    section.classList.add('meme-flash');
    setTimeout(() => section.classList.remove('meme-flash'), 1300);
  }, 150);
});

memeDeleteCancel.addEventListener('click', () => {
  memeDeleteDialog.hidden = true;
  memeDeleteTarget = null;
});

memeDeleteConfirm.addEventListener('click', async () => {
  if (!memeDeleteTarget) return;
  const meme = memeDeleteTarget;
  memeDeleteConfirm.disabled = true;
  try {
    const response = await apiFetch(`/api/memes/${encodeURIComponent(meme.id)}?confirm=1`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const previewUrl = memePreviewUrls.get(meme.id);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); memePreviewUrls.delete(meme.id); }
    const originalUrl = memeOriginalUrls.get(meme.id);
    if (originalUrl) { URL.revokeObjectURL(originalUrl); memeOriginalUrls.delete(meme.id); }
    await idbDeletePreview(meme.id);
    memeDeleteDialog.hidden = true;
    memeDeleteTarget = null;
    toast('已删除');
    await loadMemes();
    // 同一台设备删图后，聊天里已渲染的 sticker 也要立刻变成占位。
    if (loadedMessages.some((message) => message.type === 'sticker' && message.media?.ref === `meme:${meme.id}`)) {
      renderAll(loadedMessages);
    }
  } catch (err) {
    memeMsg.textContent = `删除失败：${err.message}`;
  } finally {
    memeDeleteConfirm.disabled = false;
  }
});

async function saveApiKey(clear = false) {
  apiSaveBtn.disabled = true;
  apiClearBtn.disabled = true;
  apiSettingsMsg.textContent = clear ? '正在清除…' : '正在保存…';
  try {
    const r = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(clear ? { clearApiKey: true } : { apiKey: apiKeyInput.value }),
    });
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return; }
    const info = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(info.message || `HTTP ${r.status}`);
    apiKeyInput.value = '';
    displaySettings(info.settings);
    apiSettingsMsg.textContent = clear ? '已清除本机 API Key。' : '已保存。服务会自动切换到模型模式。';
    modeText = info.settings.mode === 'mock' ? '在线 · 模拟模式' : '在线';
    setStatus(true, modeText);
    await refreshBalance();
  } catch (err) {
    apiSettingsMsg.textContent = `操作失败：${err.message}`;
  } finally {
    try {
      const r = await apiFetch('/api/settings');
      if (r.ok) displaySettings(await r.json());
    } catch { /* keep the current settings status */ }
  }
}

consoleClose.addEventListener('click', () => {
  // 终端主页面不设退出按钮；子页面左上角返回目录。
  if (!consolePanel.hidden && terminalModule) {
    location.hash = '#/terminal';
    return;
  }
  switchMainView('inbox');
});
consolePanel.addEventListener('click', (e) => {
  if (e.target === consolePanel) switchMainView('inbox');
});
replySpeed.addEventListener('change', async () => {
  const previous = replySpeed.value;
  try {
    const response = await apiFetch('/api/settings/reply-speed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ speed: replySpeed.value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    toast(`回复速度：${replySpeed.selectedOptions?.[0]?.textContent || data.replySpeed}`);
  } catch (err) {
    replySpeed.value = previous;
    toast(`回复速度保存失败：${err.message}`);
  }
});
apiSaveBtn.addEventListener('click', () => saveApiKey(false));
apiClearBtn.addEventListener('click', () => saveApiKey(true));
balanceRefresh.addEventListener('click', refreshBalance);
apiTestBtn.addEventListener('click', async () => {
  apiTestBtn.disabled = true;
  apiSettingsMsg.textContent = '正在进行一次短模型请求…';
  try {
    const r = await apiFetch('/api/settings/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const info = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(info.message || `HTTP ${r.status}`);
    apiSettingsMsg.textContent = `${info.message} 已记入本地用量。`;
    showConsoleUsage(info.budget);
    const s = await apiFetch('/api/settings');
    if (s.ok) displaySettings(await s.json());
  } catch (err) {
    apiSettingsMsg.textContent = `测试失败：${err.message}`;
  } finally {
    apiTestBtn.disabled = false;
    try {
      const s = await apiFetch('/api/settings');
      if (s.ok) displaySettings(await s.json());
    } catch { /* leave the last visible connection state */ }
  }
});

function paintAvatar(node, url) {
  if (url) {
    node.style.backgroundImage = `url("${url}")`;
    node.textContent = '';
    node.classList.add('has-img');
  } else {
    node.style.backgroundImage = '';
    node.textContent = node.id?.startsWith('userAvatar') ? '我' : '✳';
    node.classList.remove('has-img');
  }
}

// 选图后在本地缩到 128×128 JPEG，存成 data URL，避免往 config 里塞大图
function shrinkAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

function applyHeaderProfile(profile) {
  const name = String(profile.name || '').trim();
  appName.textContent = name || 'Companion';
  aiSignature.textContent = profile.signature || '';
  spaceSignature.textContent = profile.signature || '';
  paintAvatar(headerAvatar, profile.avatar || '');
  paintAvatar(inboxAiAvatar, profile.avatar || '');
  paintAvatar(document.getElementById('profileAiAvatar'), profile.avatar || '');
  document.querySelectorAll('.contact-avatar').forEach((node) => paintAvatar(node, profile.avatar || ''));
  inboxAiName.textContent = name || 'Anam';
  for (const node of document.querySelectorAll('.contact-name')) node.textContent = name || 'Anam';
  for (const node of document.querySelectorAll('.contact-signature')) node.textContent = profile.signature || '还没有签名';
  document.getElementById('profileAiName').textContent = name || 'Anam';
  document.getElementById('profileAiSignature').textContent = profile.signature || '还没有签名';
  document.getElementById('infoPersona').textContent = profile.persona || '尚未设置';
  document.getElementById('infoTone').textContent = profile.tone || '尚未设置';
  document.getElementById('infoInitiative').textContent = profile.initiative || '尚未设置';
  document.getElementById('infoBoundaries').textContent = profile.boundaries || '尚未设置';
}

async function refreshAiInfo() { await loadProfileForm(); }

async function openUserProfile() {
  try {
    const response = await apiFetch('/api/user-profile');
    const data = await response.json();
    localUserAvatar = data.profile?.avatar || '';
    userNameInput.value = data.profile?.name || '我';
    paintAvatar(userAvatarPreview, localUserAvatar);
    switchMainView('user-profile');
  } catch { toast('本机资料读取失败'); }
}

userAvatarFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try { localUserAvatar = await shrinkAvatar(file); paintAvatar(userAvatarPreview, localUserAvatar); }
  catch { toast('这张图读不出来，换一张试试'); }
});
userProfileSave.addEventListener('click', async () => {
  userProfileSave.disabled = true;
  try {
    const response = await apiFetch('/api/user-profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: { name: userNameInput.value.trim(), avatar: localUserAvatar } }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    userName.textContent = data.profile.name; paintAvatar(userAvatar, data.profile.avatar); toast('本机资料已保存'); switchMainView('inbox');
  } catch (err) { toast(`保存失败：${err.message}`); }
  finally { userProfileSave.disabled = false; }
});

function fillProfileForm(profile) {
  for (const [key, node] of Object.entries(PROFILE_FIELDS)) node.value = profile[key] || '';
  for (const key of Object.keys(personaValues)) personaValues[key] = profile[key] || '';
  avatarDraft = profile.avatar || '';
  paintAvatar(avatarPreview, avatarDraft);
}

async function loadProfileForm() {
  try {
    const r = await apiFetch('/api/profile');
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { profile } = await r.json();
    fillProfileForm(profile);
    applyHeaderProfile(profile);
  } catch {
    toast('读取失败，稍后再试');
  }
}

function draftProfile() {
  return {
    avatar: avatarDraft,
    name: PROFILE_FIELDS.name.value.trim(),
    callUser: PROFILE_FIELDS.callUser.value.trim(),
    ...personaValues,
  };
}

// 面板里还没保存的草稿（含四个板块的当前输入）
function panelDraft() {
  const draft = draftProfile();
  for (const [key, node] of Object.entries(PANEL_FIELDS)) draft[key] = node.value.trim();
  return draft;
}

async function saveProfileNow({ silent = false } = {}) {
  if (!silent) {
    panelDone.disabled = true;
    panelMsg.textContent = '保存中…';
  }
  try {
    const r = await apiFetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: draftProfile() }),
    });
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return false; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { profile } = await r.json();
    fillProfileForm(profile);
    applyHeaderProfile(profile);
    if (silent) toast('已保存');
    else panelMsg.textContent = '已保存，下一轮生效。';
    previewList.textContent = '';
    return true;
  } catch (e) {
    if (silent) toast('保存失败');
    else panelMsg.textContent = `保存失败：${e.message}`;
    return false;
  } finally {
    if (!silent) panelDone.disabled = false;
  }
}

// 名称 / 称呼 / 签名改完（失焦）自动保存，侧边栏不再放保存按钮
for (const node of [PROFILE_FIELDS.name, PROFILE_FIELDS.callUser, PROFILE_FIELDS.signature]) {
  node.addEventListener('change', () => {
    if (!mobilePersonaPage) saveProfileNow({ silent: true });
  });
}

previewBtn.addEventListener('click', async () => {
  previewBtn.disabled = true;
  previewList.textContent = '';
  panelMsg.textContent = '正在生成…';
  try {
    const r = await apiFetch('/api/profile/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: panelDraft() }),
    });
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return; }
    const info = await r.json().catch(() => ({}));
    if (!r.ok) {
      panelMsg.textContent = info.message || `生成失败（HTTP ${r.status}）`;
      return;
    }
    previewList.textContent = '';
    for (const line of info.lines || []) {
      const li = document.createElement('li');
      li.textContent = line;
      previewList.appendChild(li);
    }
    panelMsg.textContent = '满意就保存；不保存不会生效。';
  } catch (e) {
    panelMsg.textContent = `生成失败：${e.message}`;
  } finally {
    previewBtn.disabled = false;
  }
});


pAvatarFile.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    avatarDraft = await shrinkAvatar(file);
    paintAvatar(avatarPreview, avatarDraft);
    if (!mobilePersonaPage) await saveProfileNow({ silent: true });
  } catch {
    toast('这张图读不出来，换一张试试');
  }
});

avatarClear.addEventListener('click', async () => {
  avatarDraft = '';
  paintAvatar(avatarPreview, '');
  if (!mobilePersonaPage) await saveProfileNow({ silent: true });
});

// 个性面板：四个板块，按优先级分配大小；保存直接落库
async function openPersonaPanel() {
  mobilePersonaPage = true;
  await loadProfileForm();
  for (const [key, node] of Object.entries(PANEL_FIELDS)) node.value = personaValues[key] || '';
  panelMsg.textContent = '';
  previewList.textContent = '';
  panelTitle.textContent = '编辑个性';
  panelCloseIcon.textContent = '‹';
  panelCancel.hidden = mobilePersonaPage;
  discardConfirm.hidden = true;
  if (mobilePersonaPage) {
    personaPanel.classList.add('mobile-page');
    profilePageBasics.appendChild(profileBasics);
    profilePageOriginal = JSON.stringify(profilePageDraft());
  }
  personaPanel.hidden = false;
}

async function closePersonaPanel({ discardConfirmed = false } = {}) {
  if (mobilePersonaPage && profilePageIsDirty() && !discardConfirmed) {
    discardConfirm.hidden = false;
    discardKeep.focus();
    return false;
  }
  if (mobilePersonaPage && discardConfirmed) {
    await loadProfileForm();
    for (const [key, node] of Object.entries(PANEL_FIELDS)) node.value = personaValues[key] || '';
  }
  mobilePersonaPage = false;
  discardConfirm.hidden = true;
  panelCancel.hidden = false;
  personaPanel.classList.remove('mobile-page');
  profilePageOriginal = '';
  personaPanel.hidden = true;
  if (activeView === 'ai-profile') await refreshAiInfo();
  return true;
}

personaEdit.addEventListener('click', openPersonaPanel);
for (const node of [panelClose, panelCancel]) node.addEventListener('click', closePersonaPanel);
discardKeep.addEventListener('click', () => {
  discardConfirm.hidden = true;
  panelClose.focus();
});
discardApply.addEventListener('click', () => {
  discardConfirm.hidden = true;
  closePersonaPanel({ discardConfirmed: true });
});
personaPanel.addEventListener('click', (e) => {
  if (e.target === personaPanel && !mobilePersonaPage) closePersonaPanel();
});

panelDone.addEventListener('click', async () => {
  const previous = { ...personaValues };
  for (const [key, node] of Object.entries(PANEL_FIELDS)) personaValues[key] = node.value.trim();
  const ok = await saveProfileNow();
  if (ok) {
    if (mobilePersonaPage) {
      profilePageOriginal = JSON.stringify(profilePageDraft());
      panelMsg.textContent = '已保存。';
      await refreshAiInfo();
    } else {
      closePersonaPanel();
    }
  } else {
    Object.assign(personaValues, previous);
    panelMsg.textContent = '保存失败，稍后再试。';
  }
});

// ---------- SSE 事件 ----------
function handleFrame({ event, data, id }) {
  if (id) lastFrameId = Math.max(lastFrameId, id);

  if (event === 'hello') {
    bootId = data.boot;
    modeText = data.mode === 'mock' ? '在线 · 模拟模式' : '在线';
    lastFrameId = Math.max(lastFrameId, data.eventSeq || 0);
    setStatus(true, modeText);
  } else if (event === 'resync') {
    lastFrameId = Math.max(lastFrameId, data.eventSeq || 0);
    bootId = data.boot;
    loadedMessages = data.messages || [];
    hasOlder = Boolean(data.hasMore);
    renderAll(loadedMessages);
    updateLoadOlder();
    writeMessageCache();
    if (!readInitialized) initReadMarker();
    else if (activeView === 'chat') markChatRead();
    else updateUnreadBadge();
  } else if (event === 'user') {
    addMessageBubble(data);
    rememberMessage(data);
  } else if (event === 'message') {
    addMessageBubble(data);
    rememberMessage(data);
    if (activeView === 'chat') markChatRead();
    else updateUnreadBadge();
  } else if (event === 'message-deleted') {
    removeBubble(data.id);
    loadedMessages = loadedMessages.filter((item) => item.id !== data.id);
    writeMessageCache();
  } else if (event === 'message-updated') {
    // caption 只用于 L1/终端，不进入聊天气泡。
  } else if (event === 'done') {
    if (data.jobId === awaitJob) { awaitJob = null; loadHeaderProfile(); }
  } else if (event === 'budget') {
    budgetText.textContent = fmtBudget(data);
    if (!consolePanel.hidden) showConsoleUsage(data);
  } else if (event === 'signature') {
    aiSignature.textContent = data.signature || '';
    spaceSignature.textContent = data.signature || '';
    document.getElementById('profileAiSignature').textContent = data.signature || '还没有签名';
    document.querySelectorAll('.contact-signature').forEach((node) => { node.textContent = data.signature || '还没有签名'; });
  } else if (event === 'emotion') {
    if (!spaceView.hidden) loadSpace();
  } else if (event === 'space') {
    if (!spaceView.hidden) loadSpace();
  } else if (event === 'memory') {
    if (!consolePanel.hidden) loadMemory(memorySearchInput.value.trim());
    if (!summaryPanel.hidden) loadSummaries();
  } else if (event === 'error') {
    awaitJob = null;
    showError(data.message || '出错了');
  }
}

// ---------- 发送 / 重试 ----------
function failSend(id, reason) {
  const item = outgoing.get(id);
  if (!item) return;
  const chip = el('button', 'retry', `发送失败${reason ? '：' + reason : ''}，点击重试`);
  chip.type = 'button';
  chip.addEventListener('click', () => {
    chip.remove();
    send(item.text, id);
  });
  list.appendChild(chip);
  scheduleScroll(true);
}

async function send(text, givenId) {
  const clean = text.trim();
  if (!clean || busy) return;

  stopRecovery();
  busy = true;
  sendBtn.disabled = true;

  const id = givenId || newId();
  framesThisSend = 0;
  awaitJob = id;
  outgoing.set(id, { text: clean });

  if (!givenId) addBubble('user', clean, id, new Date().toISOString());
  startTyping();

  try {
    // 同一个 id 最多试 3 次；服务端幂等，重试不会产生两条
    let res = null;
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await postChat(id, clean);
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(400 * (attempt + 1));
      }
    }

    if (res.status === 401) {
      removeBubble(id);
      awaitJob = null;
      lockOut('登录已失效，请重新输入口令。');
      return;
    }
    if (res.status === 402) {
      const info = await res.json().catch(() => ({}));
      removeBubble(id);
      budgetText.textContent = fmtBudget(info.budget);
      input.value = clean;
      awaitJob = null;
      showBudgetDialog(clean, id, info.budget);
      return;
    }
    if (res.status === 503) {
      const info = await res.json().catch(() => ({}));
      removeBubble(id);
      showError(info.message || '服务端还没配置模型');
      input.value = clean;
      awaitJob = null;
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await readSse(res, (frame) => {
      framesThisSend++;
      handleFrame(frame);
    });
  } catch (e) {
    if (framesThisSend === 0) {
      failSend(id, e.message);
      awaitJob = null;
    }
  } finally {
    busy = false;
    sendBtn.disabled = false;
    stopTyping();
    input.focus();
  }

  if (awaitJob) await resumeStream();
  if (!awaitJob) outgoing.delete(id);
}

// ---------- 断线续传 ----------
async function resumeStream() {
  if (recovery) return;
  const ac = new AbortController();
  recovery = ac;
  let attempt = 0;
  const until = Date.now() + 120000;

  try {
    while (!ac.signal.aborted && Date.now() < until && awaitJob) {
      try {
        const res = await openEvents(lastFrameId, bootId, ac.signal);
        if (res.status === 401) {
          lockOut('登录已失效，请重新输入口令。');
          awaitJob = null;
          break;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await readSse(res, handleFrame);
      } catch {
        if (ac.signal.aborted) break;
      }
      if (!awaitJob) break;
      attempt++;
      await sleep(Math.min(400 * 2 ** attempt, 5000));
    }
  } finally {
    if (recovery === ac) recovery = null;
    ac.abort();
  }

  stopTyping();
  if (awaitJob) {
    failSend(awaitJob, '连接中断');
    awaitJob = null;
  }
}

function stopRecovery() {
  if (recovery) {
    recovery.abort();
    recovery = null;
  }
}

// ---------- 启动 ----------
async function boot() {
  // 先用本地缓存秒开：离线冷启动也能看到历史与已缓存的预览图。
  const cached = localStorage.getItem('companion.token') ? readMessageCache() : null;
  if (cached) {
    loadedMessages = cached.messages;
    hasOlder = Boolean(cached.hasOlder);
    renderAll(loadedMessages);
    updateLoadOlder();
  }

  try {
    const res = await getHealth();
    if (res.status === 401) {
      showLock('请输入访问口令。');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const h = await res.json();

    bootId = h.boot;
    lastFrameId = h.eventSeq || 0;
    modeText = h.mode === 'mock' ? '在线 · 模拟模式' : '在线';
    setStatus(true, modeText);
    budgetText.textContent = fmtBudget(h.budget);

    const mr = await getMessages(200);
    if (mr.status === 401) {
      showLock('请输入访问口令。');
      return;
    }
    const body = await mr.json();
    loadedMessages = body.messages || [];
    hasOlder = Boolean(body.hasMore);
    renderAll(loadedMessages);
    updateLoadOlder();
    writeMessageCache();
    initReadMarker();
    void startUnreadEvents();
    await loadHeaderProfile();
    try {
      const userResponse = await apiFetch('/api/user-profile');
      if (userResponse.ok) {
        const user = (await userResponse.json()).profile;
        userName.textContent = user.name || '我';
        paintAvatar(userAvatar, user.avatar || '');
      }
    } catch { /* 本机资料可稍后重试 */ }
  } catch {
    setStatus(false, '未连接');
    if (!cached) showError('连不上服务，确认电脑上的窗口还开着。');
  }
}

// 再往前翻 200 条：保留当前阅读位置
loadOlder.addEventListener('click', async () => {
  if (loadingOlder || !hasOlder || !loadedMessages.length) return;
  const first = loadedMessages[0];
  if (!first || !Number.isFinite(Number(first.seq))) return;

  loadingOlder = true;
  updateLoadOlder();
  try {
    const r = await getMessages(200, first.seq);
    if (r.status === 401) { lockOut('登录已失效，请重新输入口令。'); return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    const seen = new Set(loadedMessages.map((m) => m.id));
    const older = (body.messages || []).filter((m) => !seen.has(m.id));
    loadedMessages = [...older, ...loadedMessages].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    hasOlder = Boolean(body.hasMore);
    updateLoadOlder();
    renderAll(loadedMessages, { preserveScroll: true });
    writeMessageCache();
  } catch (err) {
    toast(`加载更早失败：${err.message}`);
  } finally {
    loadingOlder = false;
    updateLoadOlder();
  }
});

// 头像/名称不是关键路径，失败就算了
async function loadHeaderProfile() {
  try {
    const r = await apiFetch('/api/profile');
    if (!r.ok) return;
    const { profile } = await r.json();
    applyHeaderProfile(profile);
  } catch { /* ignore */ }
}

// 键盘：不再用 JS 改 #app 的 height/top。
// #app 用 inset: 0 贴住视口，键盘弹起时视口本身变矮，输入框自然贴在键盘上方；
// 这里只负责判定键盘状态（隐藏胶囊、去掉底部留白）和键盘稳定后的回底。
const vv = window.visualViewport;
let vvRaf = 0;
// 启动时的布局视口高度作为基准；旋转/窗口变大时才更新
let layoutBase = document.documentElement.clientHeight || window.innerHeight || 0;
let lastKb = null;
let settleTimer = 0;

function applyViewport() {
  const clientH = document.documentElement.clientHeight || 0;
  if (clientH > layoutBase) layoutBase = clientH;

  const height = vv ? vv.height : (clientH || layoutBase);
  const keyboardOpen = layoutBase > 0 && (
    height < layoutBase - 100 || (clientH > 0 && clientH < layoutBase - 100)
  );

  if (keyboardOpen !== lastKb) {
    document.body.classList.toggle('kb', keyboardOpen);
    lastKb = keyboardOpen;
    // 键盘动画结束后只在收起时校正一次列表位置；动画期间不反复读写滚动位置。
    clearTimeout(settleTimer);
    if (!keyboardOpen) settleTimer = setTimeout(() => scheduleScroll(false), 120);
  }
}

// resize / scroll 风暴合并到一帧；滚动放到键盘稳定后再做，避免每帧强制布局
function fitViewport() {
  if (vvRaf) return;
  vvRaf = requestAnimationFrame(() => {
    vvRaf = 0;
    applyViewport();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => scheduleScroll(false), 120);
  });
}

if (vv) {
  vv.addEventListener('resize', fitViewport);
  vv.addEventListener('scroll', fitViewport);
}
applyViewport();

document.getElementById('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  send(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    document.getElementById('composer').requestSubmit();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

// 有任何未捕获错误都显示出来，别静默失败
window.addEventListener('error', (e) => {
  if (e && e.message) showError(`页面出错：${e.message}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e && e.reason;
  showError(`请求出错：${(r && r.message) || r}`);
});

// 有口令就带着它问；没有的话 boot() 会收到 401 并弹口令框
boot();







