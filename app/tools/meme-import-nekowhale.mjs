// 从 nekowhale 元数据导入「大肥鱼」单人包的首批清单。
// 只下载清单内条目；下载后校验 SHA-1 前缀，再走现有 /api/memes 上传流水线。
// 用法：
//   node app/tools/meme-import-nekowhale.mjs --download
//   PYTHON=... node app/tools/meme-import-nekowhale.mjs --previews
//   node app/tools/meme-import-nekowhale.mjs --upload
// 说明：Pillow 只用于离线预览生成，应用运行时仍零依赖。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const WORK = path.join(ROOT, '.tmp-neko-import');
const FILES = path.join(WORK, 'files');
const PREVIEWS = path.join(WORK, 'previews');
const MANIFEST = path.join(WORK, 'manifest.json');
const REPORT = path.join(ROOT, 'app', 'data', 'meme-import-report.json');
const SOURCE_DIR = path.join(ROOT, 'app', 'data', 'meme-sources');
const SOURCE_META = path.join(SOURCE_DIR, 'nekowhale-2026-10-23.json');
const API = 'http://127.0.0.1:8787';
const KIT_URL = 'https://kiriyuki.com/meme/kit/nekowhale.json';
const PACK = '大肥鱼';
const MAX_BYTES = 1.5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = Number(process.env.MEME_DOWNLOAD_TIMEOUT_MS || 90000);
const UA = 'Companion-local-importer/1.0 (personal, non-commercial)';

// 首批 42 张，按情绪分组（顺序即导入顺序）。
const MAIN = {
  开心: ['16N01_超开心', '9N11_笑', '2N07_喝奶茶', '15N05_嗦面'],
  搞怪: ['11N02_WATCHING-YOU', '12N07_绷住', '3N11_拖走'],
  卖萌: ['6N05_求求', '14N08_理理我嘛', 'N09_嘤嘤嘤'],
  兴奋: ['10N01_猫猫搓手', '3N04_打CALL'],
  生气: ['12N06_锤', '5N01_喵喵拳'],
  喜欢: ['16N08_给你心心', '6N01_画爱心', '4N05_蹭蹭'],
  无语: ['EX57_有脏东西', 'N01_无奈'],
  疲惫: ['8N09_哈欠', 'EX11_燃尽'],
  难过: ['7N08_难过', '6N10_碎了'],
  哭: ['16N07_委屈哭哭', '2N12_呜呜呜'],
  疑惑: ['11N06_小问号', '2N10_大脑过载'],
  思考: ['2N09_思考', '15N01_灵光一闪'],
  赞同: ['12N01_猫刻章', '15N12_敬礼'],
  打招呼: ['13N11_ciallo', '6N02_猫在么'],
  惊讶: ['13N07_猫儿这个惊讶'],
  害怕: ['13N05_快跑'],
  拒绝: ['7N11_不要不要'],
  嘲讽: ['13N10_啧啧啧'],
  害羞: ['12N11_害羞'],
  得意: ['13N01_掂'],
  感谢: ['14N04_好人喵'],
  其他: ['5N05_吃瓜', '15N07_刷牙'],
};

const REPLACEMENTS = {
  开心: ['11N08_拉炮', 'EX01_撒红包'],
  搞怪: ['N06_略略略'],
  卖萌: ['N11_诶嘿'],
  兴奋: ['4N06_开饭'],
  生气: ['9N01_哈气'],
  喜欢: ['8N05_分冰棍'],
  无语: ['7N04_上菜'],
  疲惫: ['EX55_自动工作'],
  难过: ['13N02_穷'],
  哭: ['EX10_互联网暴力'],
  疑惑: ['N10_真的假的'],
  思考: ['10N11_大调查'],
  赞同: ['16N04_宣判'],
  打招呼: ['9N07_蹦'],
  惊讶: ['10N04_砸晕'],
  害怕: ['10N10_滚筒洗猫机'],
  拒绝: ['13N03_不给'],
  嘲讽: ['5N04_嘲笑'],
  害羞: ['15N04_被项圈'],
  得意: ['16N02_超勇的'],
  感谢: ['EX14_一键三连1'],
  其他: ['7N05_玩手机'],
};

const args = new Set(process.argv.slice(2));
const token = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'data', 'secret.json'), 'utf8')).accessPassword;

function allStems() {
  const out = [];
  for (const [emotion, stems] of Object.entries(MAIN)) for (const stem of stems) out.push({ emotion, stem, role: 'main' });
  for (const [emotion, stems] of Object.entries(REPLACEMENTS)) for (const stem of stems) out.push({ emotion, stem, role: 'replacement' });
  return out;
}

function urlFor(stem) {
  return `https://kiriyuki.com/media/gif/${encodeURIComponent(PACK)}/${encodeURIComponent(stem)}.gif`;
}

function labelFor(stem) {
  const index = stem.indexOf('_');
  return (index >= 0 ? stem.slice(index + 1) : stem).trim().slice(0, 20);
}

function tagsFor(item) {
  const tags = [String(item.emotion || ''), String(item.tags?.[0] || '')]
    .map((value) => value.replace(/[|\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 10))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 2);
}

async function fetchJson() {
  const response = await fetch(KIT_URL, { headers: { 'user-agent': UA } });
  if (!response.ok) throw new Error(`metadata HTTP ${response.status}`);
  const meta = await response.json();
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(SOURCE_META, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return meta;
}

async function downloadEntry(entry, byId) {
  const id = `${PACK}/${entry.stem}`;
  const item = byId.get(id);
  if (!item) return { ...entry, ok: false, reason: 'metadata_missing', id };
  const file = path.join(FILES, `${entry.stem}.gif`);
  const expected = String(item.hash || '');
  try {
    let buffer = null;
    if (fs.existsSync(file)) {
      buffer = fs.readFileSync(file);
      const existingSha = crypto.createHash('sha1').update(buffer).digest('hex');
      if (buffer.length > MAX_BYTES || !existingSha.startsWith(expected)) buffer = null;
    }
    if (!buffer) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
      try {
        const response = await fetch(urlFor(entry.stem), { headers: { 'user-agent': UA }, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } finally {
        clearTimeout(timer);
      }
      fs.writeFileSync(file, buffer);
    }
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const record = {
      ...entry, id, bytes: buffer.length, sha1,
      label: labelFor(entry.stem), tags: tagsFor(item), use: item.use || '', desc: item.desc || '',
    };
    if (buffer.length > MAX_BYTES) return { ...record, ok: false, reason: 'too_large' };
    if (!sha1.startsWith(expected)) return { ...record, ok: false, reason: 'hash_mismatch' };
    return { ...record, ok: true, file };
  } catch (err) {
    return { ...entry, id, ok: false, reason: `download:${err.message}` };
  }
}

async function download() {
  fs.mkdirSync(FILES, { recursive: true });
  fs.rmSync(MANIFEST, { force: true });
  const meta = await fetchJson();
  const byId = new Map((meta.stickers || []).map((item) => [item.id, item]));
  const entries = allStems();
  const rows = new Array(entries.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= entries.length) return;
      rows[index] = await downloadEntry(entries[index], byId);
      done++;
      if (done % 5 === 0 || done === entries.length) console.log(`progress ${done}/${entries.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  fs.writeFileSync(MANIFEST, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: KIT_URL,
    version: meta.version,
    attribution: meta.attribution,
    rows,
  }, null, 2) + '\n', 'utf8');
  const ok = rows.filter((row) => row.ok).length;
  console.log(`downloaded/validated ${ok}/${rows.length}`);
  for (const row of rows.filter((item) => !item.ok)) console.log('skip', row.stem, row.reason);
}

async function retryDownloads() {
  const meta = await fetchJson();
  const byId = new Map((meta.stickers || []).map((item) => [item.id, item]));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const rows = manifest.rows;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.ok || !String(row.reason || '').startsWith('download:')) continue;
    console.log('retry', row.stem);
    rows[index] = await downloadEntry({ emotion: row.emotion, stem: row.stem, role: row.role }, byId);
    console.log('retry', row.stem, rows[index].ok ? 'ok' : rows[index].reason);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('retry done; valid=', rows.filter((row) => row.ok).length);
}

function generatePreviews() {
  const python = process.env.PYTHON;
  if (!python || !fs.existsSync(python)) {
    console.log('PYTHON not set; previews skipped (console will backfill)');
    return;
  }
  fs.mkdirSync(PREVIEWS, { recursive: true });
  const result = spawnSync(python, [path.join(__dirname, 'meme-preview.py'), FILES, PREVIEWS], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.log('preview generation failed:', result.stderr || result.status);
    return;
  }
  const parsed = JSON.parse(result.stdout);
  console.log('previews:', Object.keys(parsed).length);
}

async function api(pathname, options = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: { 'x-access-token': token, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function uploadOne(row) {
  const file = row.file;
  const previewFile = path.join(PREVIEWS, `${row.stem}.png`);
  const dataUrl = `data:image/gif;base64,${fs.readFileSync(file).toString('base64')}`;
  const payload = { dataUrl, label: row.label, tags: row.tags };
  if (fs.existsSync(previewFile)) {
    payload.previewDataUrl = `data:image/png;base64,${fs.readFileSync(previewFile).toString('base64')}`;
  }
  const created = await api('/api/memes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (created.status !== 201) {
    return { ...row, ok: false, reason: created.body.duplicate ? 'duplicate' : (created.body.message || `HTTP ${created.status}`) };
  }
  const id = created.body.meme.id;
  const patched = await api(`/api/memes/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false, reviewed: false }),
  });
  return {
    ...row, ok: true, id, imported: true, enabled: patched.status === 200 ? false : true,
    preview: Boolean(fs.existsSync(previewFile)), patchStatus: patched.status,
  };
}

async function upload() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const rows = manifest.rows;
  const rowByStem = new Map(rows.map((row) => [row.stem, row]));
  const accepted = new Map(rows.filter((row) => row.ok).map((row) => [row.stem, row]));
  const used = new Set();
  const results = [];
  for (const [emotion, stems] of Object.entries(MAIN)) {
    for (const stem of stems) {
      let row = accepted.get(stem);
      let replacement = false;
      if (!row) {
        const fallback = (REPLACEMENTS[emotion] || []).find((candidate) => accepted.has(candidate) && !used.has(candidate));
        if (fallback) { row = accepted.get(fallback); replacement = true; }
      }
      if (!row) {
        const details = [stem, ...(REPLACEMENTS[emotion] || [])].map((candidate) => ({
          stem: candidate,
          reason: rowByStem.get(candidate)?.reason || 'not_in_manifest',
        }));
        results.push({ emotion, stem, ok: false, reason: 'quota_short', details });
        continue;
      }
      used.add(row.stem);
      const result = await uploadOne(row);
      results.push({ ...result, requestedStem: stem, replacement });
      if (result.ok) console.log('imported', result.stem, emotion, result.id, result.preview ? 'preview' : 'no-preview');
      else console.log('skip', row.stem, result.reason);
    }
  }
  const imported = results.filter((row) => row.ok);
  const skipped = results.filter((row) => !row.ok);
  const counts = (await api('/api/memes')).body.counts;
  const report = {
    generatedAt: new Date().toISOString(),
    source: KIT_URL,
    version: manifest.version,
    attribution: manifest.attribution,
    imported: imported.map(({ file, ...row }) => row),
    skipped,
    downloadSkips: rows.filter((row) => !row.ok).map(({ emotion, stem, role, reason, bytes }) => ({ emotion, stem, role, reason, bytes })),
    counts,
    requested: Object.values(MAIN).flat().length,
    importedCount: imported.length,
  };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ imported: imported.length, skipped: skipped.length, counts }, null, 2));
}

if (args.has('--download')) await download();
else if (args.has('--retry')) await retryDownloads();
else if (args.has('--previews')) generatePreviews();
else if (args.has('--upload')) await upload();
else console.log('use --download, --previews, or --upload');
