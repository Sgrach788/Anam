// 客户端图片预处理：GIF 原样，静态图长边缩到 768；另生成 240px 预览图给网格/聊天。
export const MEME_STATIC_EDGE = 768;
export const MEME_PREVIEW_EDGE = 240;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = url;
  });
}

function renderPreview(image, width, height) {
  const scale = Math.min(1, MEME_PREVIEW_EDGE / Math.max(width, height));
  const previewW = Math.max(1, Math.round(width * scale));
  const previewH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = previewW;
  canvas.height = previewH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { previewDataUrl: '', previewW: 0, previewH: 0 };
  ctx.drawImage(image, 0, 0, previewW, previewH);
  return { previewDataUrl: canvas.toDataURL('image/png'), previewW, previewH };
}

export async function prepareMemePreview(blob) {
  if (!blob) throw new Error('没有图片');
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return renderPreview(image, image.naturalWidth || image.width, image.naturalHeight || image.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareMemeImage(file) {
  if (!file) throw new Error('没有选择图片');
  const mime = String(file.type || '');
  if (!/^image\/(?:png|jpeg|gif|webp)$/u.test(mime)) throw new Error('只接受 PNG / JPEG / GIF / WebP');
  const source = await readAsDataUrl(file);
  if (mime === 'image/gif') {
    const image = await loadImage(source);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    return { dataUrl: source, mime, w: width, h: height, ...renderPreview(image, width, height) };
  }
  const image = await loadImage(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, MEME_STATIC_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('这台设备无法处理图片');
  ctx.drawImage(image, 0, 0, w, h);
  const outputMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = outputMime === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  return { dataUrl, mime: outputMime, w, h, ...renderPreview(image, width, height) };
}
